import { describe, expect, it, beforeAll } from "vitest";

beforeAll(() => {
  process.env.IMPERSONATION_COOKIE_SECRET = "test-secret-do-not-use-in-prod";
});

import {
  signImpersonationCookie,
  verifyImpersonationCookie,
  remainingCookieMaxAgeMs,
  IMPERSONATION_DURATION_MS,
} from "./cookie";

const basePayload = {
  targetProfileId: "profile-1",
  tenantId: "tenant-1",
  mode: "read" as const,
  actorUserId: "actor-1",
  startedAt: new Date("2026-07-30T10:00:00.000Z").toISOString(),
};

describe("signImpersonationCookie / verifyImpersonationCookie", () => {
  it("vérifie un cookie fraîchement signé", () => {
    const raw = signImpersonationCookie(basePayload);
    const result = verifyImpersonationCookie(raw, "actor-1", new Date("2026-07-30T10:05:00.000Z"));
    expect(result).toEqual(basePayload);
  });

  it("rejette un cookie dont le corps a été modifié", () => {
    const raw = signImpersonationCookie(basePayload);
    const [body, signature] = raw.split(".");
    const tamperedBody = Buffer.from(JSON.stringify({ ...basePayload, mode: "write" })).toString("base64url");
    const result = verifyImpersonationCookie(`${tamperedBody}.${signature}`, "actor-1");
    expect(result).toBeNull();
  });

  it("rejette une signature invalide", () => {
    const raw = signImpersonationCookie(basePayload);
    const [body] = raw.split(".");
    const result = verifyImpersonationCookie(`${body}.forged-signature`, "actor-1");
    expect(result).toBeNull();
  });

  it("rejette si l'acteur courant ne correspond pas à celui du cookie", () => {
    const raw = signImpersonationCookie(basePayload);
    const result = verifyImpersonationCookie(raw, "someone-else");
    expect(result).toBeNull();
  });

  it("rejette un cookie expiré (plus de 60 minutes)", () => {
    const raw = signImpersonationCookie(basePayload);
    const justAfterExpiry = new Date(new Date(basePayload.startedAt).getTime() + IMPERSONATION_DURATION_MS + 1000);
    const result = verifyImpersonationCookie(raw, "actor-1", justAfterExpiry);
    expect(result).toBeNull();
  });

  it("accepte un cookie à quelques secondes de l'expiration", () => {
    const raw = signImpersonationCookie(basePayload);
    const justBeforeExpiry = new Date(new Date(basePayload.startedAt).getTime() + IMPERSONATION_DURATION_MS - 1000);
    const result = verifyImpersonationCookie(raw, "actor-1", justBeforeExpiry);
    expect(result).not.toBeNull();
  });

  it("rejette un cookie malformé", () => {
    expect(verifyImpersonationCookie("garbage-without-a-dot", "actor-1")).toBeNull();
    expect(verifyImpersonationCookie(undefined, "actor-1")).toBeNull();
    expect(verifyImpersonationCookie("", "actor-1")).toBeNull();
  });
});

describe("remainingCookieMaxAgeMs", () => {
  it("renvoie le temps restant jusqu'à l'expiration dure", () => {
    const now = new Date(new Date(basePayload.startedAt).getTime() + 10 * 60 * 1000); // +10 min
    const remaining = remainingCookieMaxAgeMs(basePayload.startedAt, now);
    expect(remaining).toBe(IMPERSONATION_DURATION_MS - 10 * 60 * 1000);
  });

  it("ne renvoie jamais une valeur négative", () => {
    const longAfter = new Date(new Date(basePayload.startedAt).getTime() + 5 * IMPERSONATION_DURATION_MS);
    expect(remainingCookieMaxAgeMs(basePayload.startedAt, longAfter)).toBe(0);
  });
});
