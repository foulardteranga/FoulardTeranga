"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/db/client";
import { recordPlatformAction } from "@/lib/platform/audit";
import { getActorContext } from "./context";
import { signImpersonationCookie, IMPERSONATION_COOKIE_NAME, remainingCookieMaxAgeMs } from "./cookie";

const GENERIC_ERROR = "Une erreur est survenue, réessayez.";
const TARGET_UNAVAILABLE = "Impossible d'entrer dans cette boutique.";

type Result = { ok: true } | { ok: false; error: string };

export async function startImpersonation(targetProfileId: string): Promise<Result> {
  const ctx = await getActorContext();
  if (!ctx || ctx.actor.role !== "super_admin") return { ok: false, error: GENERIC_ERROR };

  const target = await prisma.profile.findUnique({
    where: { id: targetProfileId },
    select: { id: true, tenantId: true, role: true, active: true, tenant: { select: { status: true } } },
  });

  const targetIsValid =
    !!target &&
    target.active &&
    !!target.tenantId &&
    target.tenant?.status === "active" &&
    (target.role === "owner" || target.role === "staff");
  if (!targetIsValid || !target || !target.tenantId) {
    return { ok: false, error: TARGET_UNAVAILABLE };
  }

  const startedAt = new Date().toISOString();
  const cookieValue = signImpersonationCookie({
    targetProfileId: target.id,
    tenantId: target.tenantId,
    mode: "read",
    actorUserId: ctx.actor.userId,
    startedAt,
  });

  const store = await cookies();
  store.set(IMPERSONATION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.ceil(remainingCookieMaxAgeMs(startedAt) / 1000),
  });

  await recordPlatformAction({
    actorId: ctx.actor.userId,
    action: "impersonation_started",
    tenantId: target.tenantId,
    targetId: target.id,
  });

  return { ok: true };
}

export async function unlockImpersonationWrite(): Promise<Result> {
  const ctx = await getActorContext();
  if (!ctx || ctx.actor.role !== "super_admin" || !ctx.impersonation) return { ok: false, error: GENERIC_ERROR };

  const cookieValue = signImpersonationCookie({
    targetProfileId: ctx.impersonation.targetProfileId,
    tenantId: ctx.impersonation.tenantId,
    mode: "write",
    actorUserId: ctx.actor.userId,
    startedAt: ctx.impersonation.startedAt, // inchangé : l'expiration dure ne se prolonge pas au déblocage
  });

  const store = await cookies();
  store.set(IMPERSONATION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.ceil(remainingCookieMaxAgeMs(ctx.impersonation.startedAt) / 1000),
  });

  await recordPlatformAction({
    actorId: ctx.actor.userId,
    action: "impersonation_write_unlocked",
    tenantId: ctx.impersonation.tenantId,
    targetId: ctx.impersonation.targetProfileId,
  });

  return { ok: true };
}

export async function endImpersonation(): Promise<Result> {
  const ctx = await getActorContext();
  if (!ctx || ctx.actor.role !== "super_admin") return { ok: false, error: GENERIC_ERROR };

  const store = await cookies();
  if (ctx.impersonation) {
    await recordPlatformAction({
      actorId: ctx.actor.userId,
      action: "impersonation_ended",
      tenantId: ctx.impersonation.tenantId,
      targetId: ctx.impersonation.targetProfileId,
    });
  }
  store.delete(IMPERSONATION_COOKIE_NAME);
  return { ok: true };
}
