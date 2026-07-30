import { createHmac, timingSafeEqual } from "node:crypto";
import type { ImpersonationState } from "./types";

export const IMPERSONATION_COOKIE_NAME = "ft-impersonation";
/** Spec §3 : expiration dure, pour qu'une impersonation oubliée se referme d'elle-même. */
export const IMPERSONATION_DURATION_MS = 60 * 60 * 1000;

type SignedPayload = ImpersonationState & { actorUserId: string };

/**
 * Pas de nouvelle dépendance (`jose`/`iron-session`) : ce projet n'en a aucune
 * et `node:crypto` suffit à un HMAC simple. `IMPERSONATION_COOKIE_SECRET` est
 * requis en production ; un repli de développement évite de bloquer `npm run
 * dev` sur une variable d'env de plus.
 */
function secret(): string {
  const value = process.env.IMPERSONATION_COOKIE_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("IMPERSONATION_COOKIE_SECRET est requis en production.");
  }
  return "dev-only-insecure-impersonation-secret";
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function signImpersonationCookie(payload: SignedPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyImpersonationCookie(
  raw: string | undefined,
  actorUserId: string,
  now: Date = new Date()
): SignedPayload | null {
  if (!raw) return null;
  const [body, signature] = raw.split(".");
  if (!body || !signature) return null;

  const expectedSignature = sign(body);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  let payload: SignedPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (payload.actorUserId !== actorUserId) return null;

  const startedAtMs = new Date(payload.startedAt).getTime();
  if (Number.isNaN(startedAtMs) || now.getTime() - startedAtMs > IMPERSONATION_DURATION_MS) return null;

  return payload;
}

/** Temps restant avant l'expiration dure, jamais négatif — utilisé pour le `maxAge` du cookie et le minuteur du bandeau. */
export function remainingCookieMaxAgeMs(startedAt: string, now: Date = new Date()): number {
  const startedAtMs = new Date(startedAt).getTime();
  return Math.max(0, IMPERSONATION_DURATION_MS - (now.getTime() - startedAtMs));
}
