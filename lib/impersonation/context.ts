import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/client";
import { resolveSession } from "@/lib/auth/session";
import type { Session, Role } from "@/lib/auth/session";
import { IMPERSONATION_COOKIE_NAME, verifyImpersonationCookie } from "./cookie";
import type { ActorContext } from "./types";

interface Resolved {
  actor: { userId: string; name: string; role: Role };
  /** Identité effective, prête à devenir un `Session` — voir resolveEffectiveSession. */
  session: Session;
  impersonation: ActorContext["impersonation"];
}

/**
 * Cœur partagé par `resolveEffectiveSession` (utilisé par `getSession()`, donc
 * par tout le dashboard existant) et `resolveActorContext` (audit, bandeau).
 * Une seule résolution DB par appel. Si l'acteur n'est pas `super_admin`, le
 * cookie est ignoré avant même d'être lu — c'est ce qui rend son forgeage sans
 * effet pour qui n'est pas déjà `super_admin` (spec §3, test le plus important
 * du lot, cf. context.test.ts).
 */
async function resolveActorAndSession(supabase: SupabaseClient): Promise<Resolved | null> {
  const actorSession = await resolveSession(supabase);
  if (!actorSession) return null;

  const actor = { userId: actorSession.userId, name: actorSession.name, role: actorSession.role };

  if (actor.role !== "super_admin") {
    return { actor, session: actorSession, impersonation: null };
  }

  const store = await cookies();
  const raw = store.get(IMPERSONATION_COOKIE_NAME)?.value;
  const payload = verifyImpersonationCookie(raw, actor.userId);
  if (!payload) {
    return { actor, session: actorSession, impersonation: null };
  }

  const target = await prisma.profile.findUnique({
    where: { id: payload.targetProfileId },
    select: {
      id: true,
      name: true,
      role: true,
      active: true,
      tenantId: true,
      employeeRole: { select: { permissions: true } },
      tenant: { select: { status: true, enabledModules: true } },
    },
  });

  const targetIsValid =
    !!target &&
    target.active &&
    target.tenantId === payload.tenantId &&
    target.tenant?.status === "active" &&
    (target.role === "owner" || target.role === "staff");

  if (!targetIsValid || !target || !target.tenantId || !target.tenant) {
    return { actor, session: actorSession, impersonation: null };
  }

  // `userId` = l'identité de LA CIBLE : c'est ce qui permet à tout le code
  // dashboard existant (qui filtre déjà sur `session.userId`) de fonctionner
  // sans modification (spec §3, "Ce qui rend le changement peu coûteux").
  const effectiveSession: Session = {
    userId: target.id,
    name: target.name,
    role: target.role as Role,
    tenantId: target.tenantId,
    permissions: target.role === "staff" ? (target.employeeRole?.permissions ?? []) : [],
    enabledModules: target.tenant.enabledModules,
  };

  return {
    actor,
    session: effectiveSession,
    impersonation: {
      targetProfileId: payload.targetProfileId,
      tenantId: payload.tenantId,
      mode: payload.mode,
      startedAt: payload.startedAt,
    },
  };
}

export async function resolveEffectiveSession(supabase: SupabaseClient): Promise<Session | null> {
  const resolved = await resolveActorAndSession(supabase);
  return resolved?.session ?? null;
}

export async function resolveActorContext(supabase: SupabaseClient): Promise<ActorContext | null> {
  const resolved = await resolveActorAndSession(supabase);
  if (!resolved) return null;
  return {
    actor: resolved.actor,
    effective: {
      tenantId: resolved.session.tenantId,
      role: resolved.session.role,
      permissions: resolved.session.permissions,
    },
    impersonation: resolved.impersonation,
  };
}

/** Convenience Server Component/Action, à l'image de `getSession()` (lib/auth/index.ts). */
export async function getActorContext(): Promise<ActorContext | null> {
  const supabase = await createClient();
  return resolveActorContext(supabase);
}
