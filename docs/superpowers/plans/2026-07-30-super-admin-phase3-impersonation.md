# Phase 3 — Impersonation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the prestataire (`super_admin`) a safe way to act *as* a boutique's gérante/employé — read-only by default, write unlockable explicitly, every transition traced in `PlatformAuditLog` — without ever generating a real Supabase Auth session for the target account.

**Architecture:** A signed, `httpOnly` cookie (`ft-impersonation`) carries `{ targetProfileId, tenantId, mode, actorUserId, startedAt }`. `getSession()` (used everywhere in the dashboard today) becomes impersonation-aware and starts returning the **effective** identity — so the entire existing dashboard needs zero changes. A new `getActorContext()` exposes the **real** actor (never the target) for the two things that need it: the audit log and the impersonation banner. A new `requireWritableSession()` guard, composed into every existing dashboard write action, refuses when `impersonation.mode === "read"`. A static-analysis test enumerates every exported function in `lib/**/actions.ts` and fails if a write action doesn't call the guard — the mechanical parade against a future action that forgets it.

**Tech Stack:** Next.js 16.2 (App Router, Server Actions, Server Components), TypeScript strict, Prisma 7 (`@/lib/db/client`), Supabase Auth (`@supabase/ssr`), Vitest, `node:crypto` (HMAC — no new dependency), `typescript` compiler API (already a devDependency, used only inside the test file for static analysis).

## Global Constraints

- Migrations are **never** run via `npx prisma migrate dev` (shadow DB has no `auth` schema, guaranteed failure) — this phase needs **no new migration**: `PlatformAuditLog` and `PlatformAction` (including the three impersonation values) were already created in Phase 1.
- Prisma bypasses RLS (`DATABASE_URL`, table owner, no `FORCE ROW LEVEL SECURITY`) — RLS is defense-in-depth only. The real guard against writing in read-only impersonation is `requireWritableSession()`, an **application-level** check, never a policy.
- Proxy file is `proxy.ts` at the repo root, never `middleware.ts`.
- `npm run lint` is broken repo-wide, unrelated to this work (Next 16.2 tooling issue, confirmed on `main` before any super-admin work). Use `npm run typecheck` and `npx vitest run` as the verification net.
- Error results follow the existing typed pattern `{ ok: true } | { ok: false; error: string }`, messages in French, generic fallback `"Une erreur est survenue, réessayez."` — copied verbatim from `lib/team/actions.ts` and `lib/platform/actions.ts`.
- `enabledModules` must always contain `dash` (existing DB constraint `tenant_min_modules`, untouched by this phase).
- Playwright is **not installed** in this repo (`package.json` has no e2e script, no config) and was already silently dropped from Phases 1 and 2 despite being named in the spec — this plan continues that precedent rather than introducing new e2e tooling as a side effect of an impersonation feature. Coverage instead leans harder on Vitest, including one test that exercises the full read→unlock→write→end sequence end-to-end at the function level (Task 9, Step 6).

---

## File structure

| File | Responsibility |
|---|---|
| `lib/impersonation/types.ts` | `ActorContext`, `ImpersonationState` — the shapes everything else imports |
| `lib/impersonation/cookie.ts` | Sign/verify the HMAC cookie payload, pure, no DB, no `next/headers` |
| `lib/impersonation/cookie.test.ts` | Round-trip, tamper, expiry, actor-mismatch tests |
| `lib/impersonation/context.ts` | `resolveActorContext`, `resolveEffectiveSession`, `getActorContext` — the one place that reads the cookie and resolves the target profile |
| `lib/impersonation/context.test.ts` | The anti-escalation test + the rest of spec §12's `resolveActorContext` list |
| `lib/impersonation/guards.ts` | `requireWritableSession()`, `READ_ONLY_ERROR` |
| `lib/impersonation/guards.test.ts` | Refuse in read, pass in write, pass outside impersonation |
| `lib/impersonation/guard-coverage.test.ts` | Static scan of `lib/**/actions.ts`, spec §12's "most important test" |
| `lib/impersonation/actions.ts` | `startImpersonation`, `unlockImpersonationWrite`, `endImpersonation` — the three audited transitions |
| `lib/impersonation/actions.test.ts` | Happy path + error paths for the three actions |
| `lib/auth/index.ts` | Modified: `getSession()` becomes impersonation-aware |
| `lib/team/actions.ts` | Modified: `requireOwnerSession()` composes `requireWritableSession()` |
| `lib/tenant/actions.ts` | Modified: `updateTenantTheme` composes `requireWritableSession()` |
| `lib/inventory/actions.ts`, `lib/orders/actions.ts`, `lib/marketing/actions.ts`, `lib/pos/actions.ts`, `lib/discounts/actions.ts`, `lib/storefront/actions.ts`, `lib/notifications/actions.ts` | Modified: same one-line composition, mechanical (Task 8) |
| `components/platform/screens/TenantDetailScreen.tsx` | Modified: "Entrer dans la boutique" button in the header |
| `components/dashboard/ImpersonationBanner.tsx` | New client component, the fixed banner |
| `app/(dashboard)/layout.tsx` | Modified: fetches `getActorContext()`, renders the banner when impersonating |

---

### Task 1: Cookie payload — sign, verify, expire

**Files:**
- Create: `lib/impersonation/types.ts`
- Create: `lib/impersonation/cookie.ts`
- Test: `lib/impersonation/cookie.test.ts`

**Interfaces:**
- Produces: `ImpersonationMode = "read" | "write"`; `ImpersonationState { targetProfileId: string; tenantId: string; mode: ImpersonationMode; startedAt: string }`; `ActorContext { actor: { userId: string; name: string; role: Role }; effective: { tenantId: string | null; role: Role; permissions: string[] }; impersonation: ImpersonationState | null }`; `IMPERSONATION_COOKIE_NAME = "ft-impersonation"`; `IMPERSONATION_DURATION_MS = 60 * 60 * 1000`; `signImpersonationCookie(payload: ImpersonationState & { actorUserId: string }): string`; `verifyImpersonationCookie(raw: string | undefined, actorUserId: string, now?: Date): (ImpersonationState & { actorUserId: string }) | null`; `remainingCookieMaxAgeMs(startedAt: string, now?: Date): number`.

- [ ] **Step 1: Write the types**

```ts
// lib/impersonation/types.ts
import type { Role } from "@/lib/auth";

export type ImpersonationMode = "read" | "write";

export interface ImpersonationState {
  targetProfileId: string;
  tenantId: string;
  mode: ImpersonationMode;
  startedAt: string;
}

/** Spec §3. `actor` est toujours le vrai super_admin ; `effective` est ce que le reste de l'application doit voir. */
export interface ActorContext {
  actor: { userId: string; name: string; role: Role };
  effective: { tenantId: string | null; role: Role; permissions: string[] };
  impersonation: ImpersonationState | null;
}
```

- [ ] **Step 2: Write the failing cookie tests**

```ts
// lib/impersonation/cookie.test.ts
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
```

- [ ] **Step 3: Run the tests, confirm they fail**

Run: `npx vitest run lib/impersonation/cookie.test.ts`
Expected: FAIL — `Cannot find module './cookie'`

- [ ] **Step 4: Implement the cookie module**

```ts
// lib/impersonation/cookie.ts
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
```

- [ ] **Step 5: Run the tests, confirm they pass**

Run: `npx vitest run lib/impersonation/cookie.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/impersonation/types.ts lib/impersonation/cookie.ts lib/impersonation/cookie.test.ts
git commit -m "feat(impersonation): signed HMAC cookie payload with hard 60-minute expiry"
```

---

### Task 2: `resolveActorContext` — the anti-escalation core

**Files:**
- Create: `lib/impersonation/context.ts`
- Test: `lib/impersonation/context.test.ts`

**Interfaces:**
- Consumes: `Session`, `Role`, `resolveSession(supabase)` from `lib/auth/session.ts`; `signImpersonationCookie`/`verifyImpersonationCookie`/`IMPERSONATION_COOKIE_NAME` from `./cookie`; `ActorContext`/`ImpersonationState` from `./types`; `prisma` from `@/lib/db/client`; `createClient` from `@/lib/supabase/server`; `cookies` from `next/headers`.
- Produces: `resolveActorContext(supabase: SupabaseClient): Promise<ActorContext | null>`; `resolveEffectiveSession(supabase: SupabaseClient): Promise<Session | null>`; `getActorContext(): Promise<ActorContext | null>` (convenience wrapper, no args, builds its own client — mirrors `getSession()` in `lib/auth/index.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/impersonation/context.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

process.env.IMPERSONATION_COOKIE_SECRET = "test-secret-do-not-use-in-prod";

const cookieStore = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "ft-impersonation" && cookieStore.value ? { value: cookieStore.value } : undefined),
  }),
}));

const dbState = vi.hoisted(() => ({ profile: null as unknown }));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    profile: {
      findUnique: async () => dbState.profile,
    },
  },
}));

vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>("@/lib/auth/session");
  return { ...actual, resolveSession: vi.fn() };
});

import { resolveSession } from "@/lib/auth/session";
import { signImpersonationCookie } from "./cookie";
import { resolveActorContext } from "./context";

const mockedResolveSession = vi.mocked(resolveSession);

beforeEach(() => {
  cookieStore.value = undefined;
  dbState.profile = null;
  mockedResolveSession.mockReset();
});

const superAdminSession = {
  userId: "super-1",
  name: "Prestataire",
  role: "super_admin" as const,
  tenantId: null,
  permissions: [],
  enabledModules: [],
};

const ownerSession = {
  userId: "owner-1",
  name: "Awa",
  role: "owner" as const,
  tenantId: "tenant-1",
  permissions: [],
  enabledModules: ["dash", "pos"],
};

const validTarget = {
  id: "target-owner-1",
  name: "Fatou",
  role: "owner",
  active: true,
  tenantId: "tenant-1",
  employeeRole: null,
  tenant: { id: "tenant-1", status: "active", enabledModules: ["dash", "pos", "cust"] },
};

describe("resolveActorContext — le test anti-escalade le plus important du lot (spec §12)", () => {
  it("ignore purement et simplement le cookie si l'acteur n'est pas super_admin", async () => {
    mockedResolveSession.mockResolvedValue(ownerSession);
    cookieStore.value = signImpersonationCookie({
      targetProfileId: "target-owner-1",
      tenantId: "tenant-1",
      mode: "write",
      actorUserId: "owner-1", // même si l'attaquant forge un cookie qui se désigne lui-même comme acteur
      startedAt: new Date().toISOString(),
    });
    dbState.profile = validTarget;

    const ctx = await resolveActorContext({} as never);

    expect(ctx?.actor.role).toBe("owner");
    expect(ctx?.impersonation).toBeNull();
    expect(ctx?.effective).toEqual({ tenantId: "tenant-1", role: "owner", permissions: [] });
  });

  it("cookie valide → effective = la cible, actor préservé", async () => {
    mockedResolveSession.mockResolvedValue(superAdminSession);
    cookieStore.value = signImpersonationCookie({
      targetProfileId: "target-owner-1",
      tenantId: "tenant-1",
      mode: "read",
      actorUserId: "super-1",
      startedAt: new Date().toISOString(),
    });
    dbState.profile = validTarget;

    const ctx = await resolveActorContext({} as never);

    expect(ctx?.actor).toEqual({ userId: "super-1", name: "Prestataire", role: "super_admin" });
    expect(ctx?.effective).toEqual({ tenantId: "tenant-1", role: "owner", permissions: [] });
    expect(ctx?.impersonation).toMatchObject({ targetProfileId: "target-owner-1", tenantId: "tenant-1", mode: "read" });
  });

  it("cookie expiré → impersonation abandonnée", async () => {
    mockedResolveSession.mockResolvedValue(superAdminSession);
    cookieStore.value = signImpersonationCookie({
      targetProfileId: "target-owner-1",
      tenantId: "tenant-1",
      mode: "read",
      actorUserId: "super-1",
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // il y a 2h
    });
    dbState.profile = validTarget;

    const ctx = await resolveActorContext({} as never);

    expect(ctx?.impersonation).toBeNull();
    expect(ctx?.effective.role).toBe("super_admin");
  });

  it("actorUserId non concordant → rejeté", async () => {
    mockedResolveSession.mockResolvedValue(superAdminSession);
    cookieStore.value = signImpersonationCookie({
      targetProfileId: "target-owner-1",
      tenantId: "tenant-1",
      mode: "read",
      actorUserId: "another-super-admin",
      startedAt: new Date().toISOString(),
    });
    dbState.profile = validTarget;

    const ctx = await resolveActorContext({} as never);

    expect(ctx?.impersonation).toBeNull();
  });

  it("signature invalide / cookie forgé → rejeté", async () => {
    mockedResolveSession.mockResolvedValue(superAdminSession);
    cookieStore.value = "not-a-valid-cookie.at-all";
    dbState.profile = validTarget;

    const ctx = await resolveActorContext({} as never);

    expect(ctx?.impersonation).toBeNull();
  });

  it("cible inactive → rejeté", async () => {
    mockedResolveSession.mockResolvedValue(superAdminSession);
    cookieStore.value = signImpersonationCookie({
      targetProfileId: "target-owner-1",
      tenantId: "tenant-1",
      mode: "read",
      actorUserId: "super-1",
      startedAt: new Date().toISOString(),
    });
    dbState.profile = { ...validTarget, active: false };

    const ctx = await resolveActorContext({} as never);

    expect(ctx?.impersonation).toBeNull();
  });

  it("boutique cible suspendue/archivée → rejeté", async () => {
    mockedResolveSession.mockResolvedValue(superAdminSession);
    cookieStore.value = signImpersonationCookie({
      targetProfileId: "target-owner-1",
      tenantId: "tenant-1",
      mode: "read",
      actorUserId: "super-1",
      startedAt: new Date().toISOString(),
    });
    dbState.profile = { ...validTarget, tenant: { ...validTarget.tenant, status: "suspended" } };

    const ctx = await resolveActorContext({} as never);

    expect(ctx?.impersonation).toBeNull();
  });

  it("aucune session → null", async () => {
    mockedResolveSession.mockResolvedValue(null);
    const ctx = await resolveActorContext({} as never);
    expect(ctx).toBeNull();
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npx vitest run lib/impersonation/context.test.ts`
Expected: FAIL — `Cannot find module './context'`

- [ ] **Step 3: Implement**

```ts
// lib/impersonation/context.ts
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
```

- [ ] **Step 4: Run, confirm pass**

Run: `npx vitest run lib/impersonation/context.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/impersonation/context.ts lib/impersonation/context.test.ts
git commit -m "feat(impersonation): resolveActorContext with cookie-forgery-proof anti-escalation guard"
```

---

### Task 3: `getSession()` becomes impersonation-aware

**Files:**
- Modify: `lib/auth/index.ts`
- Test: `lib/auth/index.test.ts` (extend if it exists, else create)

**Interfaces:**
- Consumes: `resolveEffectiveSession` from `@/lib/impersonation/context`.
- Produces: `getSession()` keeps its exact existing signature `(): Promise<Session | null>` — no caller anywhere in the repo needs to change.

- [ ] **Step 1: Check for an existing test file**

Run: `ls lib/auth/index.test.ts 2>/dev/null || echo "absent"`

If absent, create it with the block below as its entire content; if present, add the two `describe` blocks to it without touching existing tests.

- [ ] **Step 2: Write the failing test**

```ts
// lib/auth/index.test.ts (add if the file already exists; create otherwise)
import { describe, expect, it, vi, beforeEach } from "vitest";

process.env.IMPERSONATION_COOKIE_SECRET = "test-secret-do-not-use-in-prod";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));

const effectiveState = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/impersonation/context", () => ({
  resolveEffectiveSession: async () => effectiveState.value,
}));

import { getSession } from "./index";

beforeEach(() => {
  effectiveState.value = null;
});

describe("getSession — délègue à resolveEffectiveSession", () => {
  it("renvoie null si aucune session", async () => {
    expect(await getSession()).toBeNull();
  });

  it("renvoie l'identité effective (impersonation ou non) telle quelle", async () => {
    const session = {
      userId: "target-1",
      name: "Fatou",
      role: "owner" as const,
      tenantId: "tenant-1",
      permissions: [],
      enabledModules: ["dash"],
    };
    effectiveState.value = session;
    expect(await getSession()).toEqual(session);
  });
});
```

- [ ] **Step 3: Run, confirm failure**

Run: `npx vitest run lib/auth/index.test.ts`
Expected: FAIL — `getSession` still calls `resolveSession` directly, mock not wired to production code, or a call-count/shape mismatch depending on prior file content.

- [ ] **Step 4: Implement**

```ts
// lib/auth/index.ts
import { createClient } from "@/lib/supabase/server";
import { isRoleAllowedForZone } from "./session";
import { resolveEffectiveSession } from "@/lib/impersonation/context";
import type { Zone, Session } from "./session";

export * from "./session";

/**
 * Convenience Server Component/Action : construit le client puis résout
 * l'identité EFFECTIVE (celle de la cible en impersonation, celle de l'acteur
 * sinon). Tout le dashboard existant continue de fonctionner sans changement
 * — c'est délibéré (spec §3). Pour l'acteur réel (audit, bandeau), utiliser
 * `getActorContext()` (lib/impersonation/context.ts).
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  return resolveEffectiveSession(supabase);
}

export async function requireZone(zone: Zone): Promise<{ allowed: boolean }> {
  const session = await getSession();
  return { allowed: isRoleAllowedForZone(zone, session?.role ?? null) };
}
```

- [ ] **Step 5: Run, confirm pass**

Run: `npx vitest run lib/auth/index.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full suite to catch any indirect breakage**

Run: `npx vitest run`
Expected: PASS — every existing test that mocks `@/lib/auth` (`getSession`) directly is unaffected, since it mocks the barrel, not `resolveEffectiveSession`. Any test that mocked `@/lib/auth/session`'s `resolveSession` and expected `getSession()` to call it directly would need to instead mock `@/lib/impersonation/context`'s `resolveEffectiveSession` — investigate and fix any such case before moving on.

- [ ] **Step 7: Commit**

```bash
git add lib/auth/index.ts lib/auth/index.test.ts
git commit -m "feat(impersonation): getSession returns the effective identity, impersonation-aware"
```

---

### Task 4: `requireWritableSession()`

**Files:**
- Create: `lib/impersonation/guards.ts`
- Test: `lib/impersonation/guards.test.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`; `resolveActorContext` from `./context`.
- Produces: `requireWritableSession(): Promise<boolean>`; `READ_ONLY_ERROR: string` (exact French message surfaced to the UI).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/impersonation/guards.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));

const ctxState = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("./context", () => ({ resolveActorContext: async () => ctxState.value }));

import { requireWritableSession, READ_ONLY_ERROR } from "./guards";

describe("requireWritableSession", () => {
  it("refuse quand aucune session n'est résolue", async () => {
    ctxState.value = null;
    expect(await requireWritableSession()).toBe(false);
  });

  it("refuse en mode lecture seule", async () => {
    ctxState.value = {
      actor: { userId: "s1", name: "P", role: "super_admin" },
      effective: { tenantId: "t1", role: "owner", permissions: [] },
      impersonation: { targetProfileId: "p1", tenantId: "t1", mode: "read", startedAt: new Date().toISOString() },
    };
    expect(await requireWritableSession()).toBe(false);
  });

  it("autorise en mode intervention (write)", async () => {
    ctxState.value = {
      actor: { userId: "s1", name: "P", role: "super_admin" },
      effective: { tenantId: "t1", role: "owner", permissions: [] },
      impersonation: { targetProfileId: "p1", tenantId: "t1", mode: "write", startedAt: new Date().toISOString() },
    };
    expect(await requireWritableSession()).toBe(true);
  });

  it("autorise hors impersonation (usage normal owner/staff/super_admin)", async () => {
    ctxState.value = {
      actor: { userId: "o1", name: "Awa", role: "owner" },
      effective: { tenantId: "t1", role: "owner", permissions: [] },
      impersonation: null,
    };
    expect(await requireWritableSession()).toBe(true);
  });

  it("expose un message d'erreur explicite invitant à activer le mode intervention", () => {
    expect(READ_ONLY_ERROR).toMatch(/mode intervention/i);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npx vitest run lib/impersonation/guards.test.ts`
Expected: FAIL — `Cannot find module './guards'`

- [ ] **Step 3: Implement**

```ts
// lib/impersonation/guards.ts
import { createClient } from "@/lib/supabase/server";
import { resolveActorContext } from "./context";

/** Spec §11 : jamais un échec muet, toujours une invitation explicite. */
export const READ_ONLY_ERROR = "Lecture seule : activez le mode intervention pour modifier ces données.";

/**
 * Garde primaire de l'écriture en impersonation (spec §3). Composé dans
 * chaque garde d'écriture existant (`requireOwnerSession` et équivalents) —
 * jamais la RLS, qui voit toujours le JWT du super-admin.
 */
export async function requireWritableSession(): Promise<boolean> {
  const supabase = await createClient();
  const ctx = await resolveActorContext(supabase);
  if (!ctx) return false;
  return !(ctx.impersonation && ctx.impersonation.mode === "read");
}
```

- [ ] **Step 4: Run, confirm pass**

Run: `npx vitest run lib/impersonation/guards.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/impersonation/guards.ts lib/impersonation/guards.test.ts
git commit -m "feat(impersonation): requireWritableSession guard, refuses writes in read-only mode"
```

---

### Task 5: The guard-coverage test (written first, red on purpose)

**Files:**
- Test: `lib/impersonation/guard-coverage.test.ts`

**Interfaces:**
- Consumes: `typescript` (already a devDependency) for AST parsing — no new dependency.
- Produces: nothing consumed by later tasks; this is the acceptance gate Tasks 6–8 must turn green.

- [ ] **Step 1: Write the test**

```ts
// lib/impersonation/guard-coverage.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const LIB_ROOT = path.resolve(__dirname, "..");

function listActionFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "generated") continue; // client Prisma généré, pas du code applicatif
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listActionFiles(full));
    } else if (entry === "actions.ts") {
      files.push(full);
    }
  }
  return files;
}

function exportedFunctions(filePath: string): { name: string; bodyText: string }[] {
  const sourceText = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const results: { name: string; bodyText: string }[] = [];
  sourceFile.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      const isExported = (node.modifiers ?? []).some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword);
      if (isExported) results.push({ name: node.name.text, bodyText: node.body.getText(sourceFile) });
    }
  });
  return results;
}

/**
 * Exemptions, chacune justifiée : authentification du compte lui-même (pas
 * une mutation de données de boutique), lecture pure malgré le nom du fichier,
 * ou déjà gardée par `currentSuperAdmin`/`requireSuperAdmin` — l'impersonation
 * ne s'applique jamais aux actions du prestataire dans SA PROPRE zone
 * plateforme, seulement à ce qu'il fait une fois entré dans une boutique.
 */
const EXEMPT: Record<string, string[]> = {
  "customers/actions.ts": ["signInCustomer", "signUpCustomer", "signOutCustomer"],
  "auth/actions.ts": ["signIn", "signOut", "signInPlatform", "signOutPlatform"],
  "platform/actions.ts": ["createTenant", "updateTenantIdentity", "updateTenantModules"],
  "inventory/actions.ts": ["getProductStockMovements"],
  "orders/actions.ts": ["getOrderStatusHistoryAction"],
  "impersonation/actions.ts": ["startImpersonation", "unlockImpersonationWrite", "endImpersonation"],
};

describe("couverture des gardes d'écriture — lib/**/actions.ts (spec §12, test le plus important du lot)", () => {
  const files = listActionFiles(LIB_ROOT);
  expect(files.length).toBeGreaterThan(0);

  for (const file of files) {
    const relative = path.relative(LIB_ROOT, file).split(path.sep).join("/");
    for (const fn of exportedFunctions(file)) {
      if ((EXEMPT[relative] ?? []).includes(fn.name)) continue;

      it(`${relative} :: ${fn.name} appelle requireWritableSession()`, () => {
        expect(fn.bodyText.includes("requireWritableSession(")).toBe(true);
      });
    }
  }
});
```

- [ ] **Step 2: Run, confirm it fails on the not-yet-wired files**

Run: `npx vitest run lib/impersonation/guard-coverage.test.ts`
Expected: FAIL on every existing write action not yet touched (`team/actions.ts`, `tenant/actions.ts`, `inventory/actions.ts`, `orders/actions.ts`, `marketing/actions.ts`, `pos/actions.ts`, `discounts/actions.ts`, `storefront/actions.ts`, `notifications/actions.ts`) — this is the expected RED state; Tasks 6–8 turn it green file by file. `lib/impersonation/actions.ts` does not exist yet either — it is exempted in advance since it will be created in Task 9 and its three functions manage the impersonation state itself, not a boutique's business data.

- [ ] **Step 3: Commit the failing test as-is**

```bash
git add lib/impersonation/guard-coverage.test.ts
git commit -m "test(impersonation): add failing guard-coverage test as the acceptance gate for tasks 6-8"
```

---

### Task 6: Wire `requireWritableSession` into `lib/team/actions.ts`

**Files:**
- Modify: `lib/team/actions.ts`

**Interfaces:**
- Consumes: `requireWritableSession`, `READ_ONLY_ERROR` from `@/lib/impersonation/guards`.

- [ ] **Step 1: Add a direct `requireWritableSession()` call in each of the six exported functions**

`requireOwnerSession()` itself is **not** changed (stays `Session | null`, role check only) — the guard-coverage test (Task 5) does a static, per-function text scan of each exported function's *own* body, not a call-graph trace into helpers it calls. Nesting the write-check inside the private helper is invisible to that scan. The call must be literally present in each exported function's body, exactly mirroring the pattern Task 7 uses for `updateTenantTheme`:

```ts
// lib/team/actions.ts
import { requireWritableSession, READ_ONLY_ERROR } from "@/lib/impersonation/guards";
```

Then in each of `createEmployeeRole`, `updateEmployeeRole`, `deleteEmployeeRole`, `createEmployee`, `setEmployeeActive`, `setEmployeeRole`, immediately after the existing line:

```ts
if (!(await requireOwnerSession())) return { ok: false, error: "Une erreur est survenue, réessayez." };
```

add:

```ts
if (!(await requireWritableSession())) return { ok: false, error: READ_ONLY_ERROR };
```

No other change to these six functions or to `requireOwnerSession()` itself.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors in `lib/team/actions.ts`

- [ ] **Step 3: Run the team actions tests**

Run: `npx vitest run lib/team/actions.test.ts`
Expected: PASS — the existing test mocks `@/lib/auth`'s `getSession` to a `staff` session, so it never reaches `requireWritableSession()`; if it fails, add a mock for `@/lib/impersonation/guards` returning `requireWritableSession: async () => true` alongside the existing `getSession` mock so the owner-role rejection is what's actually being tested (not a false failure from the new guard being unmocked).

- [ ] **Step 4: Run the coverage test for this file only**

Run: `npx vitest run lib/impersonation/guard-coverage.test.ts -t "team/actions.ts"`
Expected: PASS for all six functions

- [ ] **Step 5: Commit**

```bash
git add lib/team/actions.ts lib/team/actions.test.ts
git commit -m "feat(impersonation): team actions refuse writes in read-only impersonation"
```

---

### Task 7: Wire `requireWritableSession` into `lib/tenant/actions.ts`

**Files:**
- Modify: `lib/tenant/actions.ts`

- [ ] **Step 1: Add the check right after the existing role check**

```ts
// lib/tenant/actions.ts
import { requireWritableSession, READ_ONLY_ERROR } from "@/lib/impersonation/guards";

export async function updateTenantTheme(
  input: ThemeInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (session?.role !== "owner") {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
  if (!(await requireWritableSession())) {
    return { ok: false, error: READ_ONLY_ERROR };
  }

  const parsed = themeSchema.safeParse(input);
  // ... rest of the function unchanged
```

- [ ] **Step 2: Typecheck and run this file's tests**

Run: `npm run typecheck && npx vitest run lib/tenant/actions.test.ts`
Expected: PASS — if the existing test doesn't mock `@/lib/impersonation/guards`, add `vi.mock("@/lib/impersonation/guards", () => ({ requireWritableSession: async () => true, READ_ONLY_ERROR: "..." }))` next to its existing `@/lib/auth` mock.

- [ ] **Step 3: Run the coverage test for this file**

Run: `npx vitest run lib/impersonation/guard-coverage.test.ts -t "tenant/actions.ts"`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add lib/tenant/actions.ts lib/tenant/actions.test.ts
git commit -m "feat(impersonation): updateTenantTheme refuses writes in read-only impersonation"
```

---

### Task 8: Wire the remaining dashboard action files

**Files:**
- Modify: `lib/inventory/actions.ts`, `lib/orders/actions.ts`, `lib/marketing/actions.ts`, `lib/pos/actions.ts`, `lib/discounts/actions.ts`, `lib/storefront/actions.ts`, `lib/notifications/actions.ts`

**Interfaces:**
- Consumes: same `requireWritableSession`/`READ_ONLY_ERROR` from `@/lib/impersonation/guards`.

This task is mechanical and repeats the exact pattern established in Tasks 6–7, applied to files not fully reproduced in this plan. Work through them one at a time:

- [ ] **Step 1: `lib/inventory/actions.ts`**

Open the file. Every exported function except `getProductStockMovements` (a read, already exempted in the coverage test) currently gates on `session?.role` (owner or staff, following the same inline pattern as `updateTenantTheme` — verify the exact existing check by reading the file first). Immediately after that existing check, in every write function, insert:

```ts
if (!(await requireWritableSession())) {
  return { ok: false, error: READ_ONLY_ERROR };
}
```

adding the same import as Task 7. Run `npx vitest run lib/inventory/actions.test.ts` after, fixing any unmocked-guard failure the same way as Task 6/7 Step 2.

- [ ] **Step 2: `lib/orders/actions.ts`**

Same recipe for every exported function except `getOrderStatusHistoryAction` (already exempted).

- [ ] **Step 3: `lib/marketing/actions.ts`**

Same recipe for `createPromoCode`, `setPromoCodeActive`.

- [ ] **Step 4: `lib/pos/actions.ts`**

Same recipe for `encaisserVente`.

- [ ] **Step 5: `lib/discounts/actions.ts`**

Same recipe for `previewPosDiscount` — if this one turns out to be a pure computation with no persistence (its name suggests a preview, not a commit), read it first: if it performs no `prisma.*.create/update/delete`, add it to `EXEMPT` in `lib/impersonation/guard-coverage.test.ts` instead, with a one-line comment explaining it's a preview with no write, and skip the guard call. Do not guess — open the file and check for an actual mutation before deciding.

- [ ] **Step 6: `lib/storefront/actions.ts`**

Same recipe for `saveDraft`, `publish`, `revertDraft`, `uploadBlockImage`.

- [ ] **Step 7: `lib/notifications/actions.ts`**

Same recipe for `markNotificationRead`, `markAllNotificationsRead`.

- [ ] **Step 8: Full coverage test, now expected fully green**

Run: `npx vitest run lib/impersonation/guard-coverage.test.ts`
Expected: PASS — every exported function in every `lib/**/actions.ts` either calls `requireWritableSession()` or is in the `EXEMPT` allowlist with a reason. If any file turns out to have a write action with **no** guard at all (not even a role check) — a real pre-existing gap, not something this plan invented — stop and flag it explicitly rather than silently wrapping it: recording *only* `requireWritableSession()` on a function with no role check at all would let a signed-in customer call a staff-only action once impersonation happens to be inactive. Add the missing role guard first (matching the pattern of the nearest sibling function in the same file), then the write guard.

- [ ] **Step 9: Full regression**

Run: `npm run typecheck && npx vitest run`
Expected: 0 typecheck errors, all tests green.

- [ ] **Step 10: Commit**

```bash
git add lib/inventory/actions.ts lib/orders/actions.ts lib/marketing/actions.ts lib/pos/actions.ts lib/discounts/actions.ts lib/storefront/actions.ts lib/notifications/actions.ts lib/impersonation/guard-coverage.test.ts
git commit -m "feat(impersonation): wire requireWritableSession into every remaining dashboard write action"
```

---

### Task 9: The three audited transitions

**Files:**
- Create: `lib/impersonation/actions.ts`
- Test: `lib/impersonation/actions.test.ts`

**Interfaces:**
- Consumes: `getActorContext` from `./context`; `signImpersonationCookie`, `IMPERSONATION_COOKIE_NAME`, `remainingCookieMaxAgeMs` from `./cookie`; `recordPlatformAction` from `@/lib/platform/audit`; `prisma` from `@/lib/db/client`; `cookies` from `next/headers`.
- Produces: `startImpersonation(targetProfileId: string): Promise<{ ok: true } | { ok: false; error: string }>`; `unlockImpersonationWrite(): Promise<{ ok: true } | { ok: false; error: string }>`; `endImpersonation(): Promise<{ ok: true } | { ok: false; error: string }>` — all three consumed by the "Entrer dans la boutique" button (Task 10) and the banner (Task 11).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/impersonation/actions.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

process.env.IMPERSONATION_COOKIE_SECRET = "test-secret-do-not-use-in-prod";

const cookieJar = vi.hoisted(() => ({ set: vi.fn(), delete: vi.fn(), value: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: cookieJar.set,
    delete: cookieJar.delete,
    get: () => (cookieJar.value ? { value: cookieJar.value } : undefined),
  }),
}));

const auditLog = vi.hoisted(() => ({ entries: [] as unknown[] }));
vi.mock("@/lib/platform/audit", () => ({
  recordPlatformAction: async (entry: unknown) => {
    auditLog.entries.push(entry);
  },
}));

const dbState = vi.hoisted(() => ({ profile: null as unknown }));
vi.mock("@/lib/db/client", () => ({ prisma: { profile: { findUnique: async () => dbState.profile } } }));

const actorState = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("./context", () => ({ getActorContext: async () => actorState.value }));

import { startImpersonation, unlockImpersonationWrite, endImpersonation } from "./actions";

const superAdminActor = { actor: { userId: "super-1", name: "Prestataire", role: "super_admin" as const } };

beforeEach(() => {
  cookieJar.set.mockClear();
  cookieJar.delete.mockClear();
  cookieJar.value = undefined;
  auditLog.entries = [];
  dbState.profile = null;
  actorState.value = null;
});

describe("startImpersonation", () => {
  it("refuse un acteur non super_admin", async () => {
    actorState.value = { actor: { userId: "o1", name: "Awa", role: "owner" } };
    const result = await startImpersonation("target-1");
    expect(result).toEqual({ ok: false, error: "Une erreur est survenue, réessayez." });
  });

  it("refuse une cible inexistante, inactive, ou dont la boutique n'est pas active", async () => {
    actorState.value = superAdminActor;
    dbState.profile = null;
    expect(await startImpersonation("ghost")).toEqual({ ok: false, error: "Impossible d'entrer dans cette boutique." });
  });

  it("pose un cookie read, trace impersonation_started, en mode read", async () => {
    actorState.value = superAdminActor;
    dbState.profile = {
      id: "target-1",
      tenantId: "tenant-1",
      role: "owner",
      active: true,
      tenant: { status: "active" },
    };

    const result = await startImpersonation("target-1");

    expect(result).toEqual({ ok: true });
    expect(cookieJar.set).toHaveBeenCalledWith(
      "ft-impersonation",
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: "lax" })
    );
    expect(auditLog.entries).toEqual([
      expect.objectContaining({ actorId: "super-1", action: "impersonation_started", tenantId: "tenant-1", targetId: "target-1" }),
    ]);
  });
});

describe("unlockImpersonationWrite", () => {
  it("refuse hors impersonation", async () => {
    actorState.value = { ...superAdminActor, impersonation: null };
    expect(await unlockImpersonationWrite()).toEqual({ ok: false, error: "Une erreur est survenue, réessayez." });
  });

  it("repose un cookie en mode write et trace impersonation_write_unlocked", async () => {
    actorState.value = {
      ...superAdminActor,
      impersonation: { targetProfileId: "target-1", tenantId: "tenant-1", mode: "read", startedAt: new Date().toISOString() },
    };

    const result = await unlockImpersonationWrite();

    expect(result).toEqual({ ok: true });
    expect(auditLog.entries).toEqual([
      expect.objectContaining({ actorId: "super-1", action: "impersonation_write_unlocked", tenantId: "tenant-1", targetId: "target-1" }),
    ]);
  });
});

describe("endImpersonation", () => {
  it("efface le cookie et trace impersonation_ended si une impersonation était active", async () => {
    actorState.value = {
      ...superAdminActor,
      impersonation: { targetProfileId: "target-1", tenantId: "tenant-1", mode: "write", startedAt: new Date().toISOString() },
    };

    const result = await endImpersonation();

    expect(result).toEqual({ ok: true });
    expect(cookieJar.delete).toHaveBeenCalledWith("ft-impersonation");
    expect(auditLog.entries).toEqual([
      expect.objectContaining({ actorId: "super-1", action: "impersonation_ended", tenantId: "tenant-1", targetId: "target-1" }),
    ]);
  });

  it("efface le cookie sans tracer si aucune impersonation n'était active", async () => {
    actorState.value = { ...superAdminActor, impersonation: null };
    const result = await endImpersonation();
    expect(result).toEqual({ ok: true });
    expect(cookieJar.delete).toHaveBeenCalledWith("ft-impersonation");
    expect(auditLog.entries).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `npx vitest run lib/impersonation/actions.test.ts`
Expected: FAIL — `Cannot find module './actions'`

- [ ] **Step 3: Implement**

```ts
// lib/impersonation/actions.ts
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
```

- [ ] **Step 4: Run, confirm pass**

Run: `npx vitest run lib/impersonation/actions.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Full regression**

Run: `npm run typecheck && npx vitest run`
Expected: clean

- [ ] **Step 6: Write one function-level end-to-end sequence test, standing in for the missing Playwright coverage (spec §12's "impersonation complète")**

```ts
// lib/impersonation/actions.test.ts — append to the file
import { requireWritableSession } from "./guards";
import { resolveEffectiveSession } from "./context";

describe("séquence complète : entrer → refus en lecture → intervention → écriture acceptée → sortie", () => {
  it("mode read refuse l'écriture, mode write l'autorise, sortie efface tout", async () => {
    actorState.value = superAdminActor;
    dbState.profile = {
      id: "target-1",
      tenantId: "tenant-1",
      role: "owner",
      active: true,
      tenant: { status: "active" },
    };

    await startImpersonation("target-1");
    const signedCookie = cookieJar.set.mock.calls[0][1] as string;
    cookieJar.value = signedCookie;

    actorState.value = {
      actor: { userId: "super-1", name: "Prestataire", role: "super_admin" },
      effective: { tenantId: "tenant-1", role: "owner", permissions: [] },
      impersonation: { targetProfileId: "target-1", tenantId: "tenant-1", mode: "read", startedAt: new Date().toISOString() },
    };
    expect(await requireWritableSession()).toBe(false);

    await unlockImpersonationWrite();
    const writeCookie = cookieJar.set.mock.calls[1][1] as string;
    cookieJar.value = writeCookie;
    actorState.value = {
      ...actorState.value,
      impersonation: { ...(actorState.value as { impersonation: unknown }).impersonation, mode: "write" },
    };
    expect(await requireWritableSession()).toBe(true);

    await endImpersonation();
    expect(cookieJar.delete).toHaveBeenCalledWith("ft-impersonation");
  });
});
```

Note: this test reuses the file's existing mocks for `./context`'s `getActorContext`, so it also needs `resolveEffectiveSession`/`requireWritableSession` to read from the same mocked `./context` module — `requireWritableSession` is imported from `./guards`, which itself calls `@/lib/supabase/server`'s `createClient` and `./context`'s `resolveActorContext` (not `getActorContext`): add `resolveActorContext: async () => actorState.value` to the existing `vi.mock("./context", ...)` at the top of the file alongside `getActorContext`, and add `vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }))` next to the other mocks, before running this step.

Run: `npx vitest run lib/impersonation/actions.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/impersonation/actions.ts lib/impersonation/actions.test.ts
git commit -m "feat(impersonation): start/unlock/end actions, each traced in PlatformAuditLog"
```

---

### Task 10: "Entrer dans la boutique" button

**Files:**
- Modify: `components/platform/screens/TenantDetailScreen.tsx`

**Interfaces:**
- Consumes: `startImpersonation` from `@/lib/impersonation/actions`; `tenant.owner.id` (already present on `TenantDetail`, `lib/platform/queries.ts`).

- [ ] **Step 1: Add the button to the header, next to the existing `<p>`**

The button needs to be a Client Component (it calls a Server Action and then navigates) while `TenantDetailScreen` itself is a Server Component consumed by a Server Component page (`app/(admin)/(console)/boutiques/[slug]/page.tsx`). Create a small dedicated client wrapper rather than converting the whole screen:

```tsx
// components/platform/EnterTenantButton.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startImpersonation } from "@/lib/impersonation/actions";
import { colors } from "@/lib/theme/tokens";

export function EnterTenantButton({ ownerProfileId }: { ownerProfileId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!ownerProfileId) return null;

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await startImpersonation(ownerProfileId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push("/admin");
            router.refresh();
          });
        }}
        style={{
          padding: "8px 16px",
          fontSize: 14,
          fontWeight: 600,
          color: "#fff",
          background: colors.primary,
          border: "none",
          borderRadius: 6,
          cursor: pending ? "wait" : "pointer",
        }}
      >
        {pending ? "Entrée en cours…" : "Entrer dans la boutique"}
      </button>
      {error && <p style={{ color: colors.danger, fontSize: 13, marginTop: 6 }}>{error}</p>}
    </div>
  );
}
```

Then wire it into the header:

```tsx
// components/platform/screens/TenantDetailScreen.tsx
import { EnterTenantButton } from "@/components/platform/EnterTenantButton";
// ... existing imports unchanged

      <header style={{ margin: "10px 0 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: 600, margin: 0 }}>{tenant.name}</h1>
          <p style={{ color: colors.muted, fontSize: 14, margin: "4px 0 0" }}>
            {tenant.slug} · {PLAN_LABELS[tenant.plan]} · {tenant.enabledModules.length} modules ·{" "}
            {tenant.owner ? `Gérante : ${tenant.owner.name}` : "Aucune gérante rattachée"}
          </p>
        </div>
        <EnterTenantButton ownerProfileId={tenant.owner?.id ?? null} />
      </header>
```

- [ ] **Step 2: Verify `colors.danger` exists**

Run: `grep -n "danger" lib/theme/tokens.ts`
Expected: a match. If none exists, use an inline hex (`"#b3261e"`) instead and skip the token reference — do not invent a new token export as a side effect of this button.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean

- [ ] **Step 4: Manual verification in the browser**

Start the dev server, log in as the seeded `super_admin`, open `/boutiques/foulard-teranga`, click "Entrer dans la boutique", confirm it redirects into `/admin` and the effective session now shows the gérante's identity (Task 11's banner will make this visible; until then, confirm indirectly via the dashboard rendering the gérante's own name/modules).

- [ ] **Step 5: Commit**

```bash
git add components/platform/EnterTenantButton.tsx components/platform/screens/TenantDetailScreen.tsx
git commit -m "feat(impersonation): add the 'Entrer dans la boutique' button to the tenant detail header"
```

---

### Task 11: The impersonation banner

**Files:**
- Create: `components/dashboard/ImpersonationBanner.tsx`
- Modify: `app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `getActorContext` from `@/lib/impersonation/context`; `unlockImpersonationWrite`, `endImpersonation` from `@/lib/impersonation/actions`; `remainingCookieMaxAgeMs` from `@/lib/impersonation/cookie`.

- [ ] **Step 1: Write the banner**

Deliberately does **not** use the `--color-*` CSS variables (spec §6: a gérante's own palette must never be able to make this invisible).

```tsx
// components/dashboard/ImpersonationBanner.tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unlockImpersonationWrite, endImpersonation } from "@/lib/impersonation/actions";

const BANNER_HEIGHT = 44;

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function ImpersonationBanner({
  tenantName,
  targetName,
  mode,
  expiresAt,
}: {
  tenantName: string;
  targetName: string;
  mode: "read" | "write";
  /** Timestamp ISO de l'expiration dure (startedAt + 60 minutes), calculé côté serveur. */
  expiresAt: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [remaining, setRemaining] = useState(() => new Date(expiresAt).getTime() - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(new Date(expiresAt).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: BANNER_HEIGHT,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          fontSize: 13,
          color: "#fff",
          background: mode === "write" ? "#8a1c1c" : "#3a2f6e",
        }}
      >
        <span>
          {mode === "write" ? "Mode intervention actif — " : "Lecture seule — "}
          Vous êtes {targetName} ({tenantName}) · expire dans {formatRemaining(remaining)}
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          {mode === "read" && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await unlockImpersonationWrite();
                  router.refresh();
                })
              }
              style={{ padding: "4px 10px", fontSize: 12, background: "#fff", color: "#111", border: "none", borderRadius: 4, cursor: "pointer" }}
            >
              Activer le mode intervention
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await endImpersonation();
                router.push("/platform");
                router.refresh();
              })
            }
            style={{ padding: "4px 10px", fontSize: 12, background: "transparent", color: "#fff", border: "1px solid #fff", borderRadius: 4, cursor: "pointer" }}
          >
            Quitter
          </button>
        </span>
      </div>
      {/* Décale le contenu pour ne jamais recouvrir l'en-tête de la boutique (spec §6). */}
      <div style={{ height: BANNER_HEIGHT }} />
    </>
  );
}
```

- [ ] **Step 2: Wire it into the dashboard layout**

```tsx
// app/(dashboard)/layout.tsx
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { OfflineBanner } from "@/components/dashboard/OfflineBanner";
import { ImpersonationBanner } from "@/components/dashboard/ImpersonationBanner";
import { Toast } from "@/components/dashboard/Toast";
import { TicketModal } from "@/components/dashboard/TicketModal";
import { getSession } from "@/lib/auth";
import { getActorContext } from "@/lib/impersonation/context";
import { notFound } from "next/navigation";
import { getCurrentTenantOrNull } from "@/lib/tenant";
import { getPendingOrdersCount } from "@/lib/data/orders.server";
import { getNotifications } from "@/lib/data/notifications.server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getCurrentTenantOrNull();
  if (!tenant) notFound();

  const [session, pendingCount, notifications, actorContext] = await Promise.all([
    getSession(),
    getPendingOrdersCount(),
    getNotifications(),
    getActorContext(),
  ]);

  const impersonation = actorContext?.impersonation ?? null;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "var(--color-ivory)",
        color: "var(--color-ink)",
      }}
    >
      <Sidebar session={session} pendingCount={pendingCount} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {impersonation && (
          <ImpersonationBanner
            tenantName={tenant.name}
            targetName={session?.name ?? ""}
            mode={impersonation.mode}
            expiresAt={new Date(new Date(impersonation.startedAt).getTime() + 60 * 60 * 1000).toISOString()}
          />
        )}
        <OfflineBanner />
        <TopBar initialNotifications={notifications} tenantId={tenant.id} />
        <main className="ft-main" style={{ flex: 1, minWidth: 0, overflowX: "hidden" }}>
          {children}
        </main>
        <MobileNav pendingCount={pendingCount} session={session} />
      </div>

      <Toast />
      <TicketModal />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean

- [ ] **Step 4: Manual browser verification**

Log in as `super_admin`, click "Entrer dans la boutique" from `/boutiques/foulard-teranga`, confirm: the banner is fixed at the top, doesn't scroll away, shows "Lecture seule", a countdown, and the gérante's name; attempt any dashboard write (e.g. edit a product) and confirm it's refused with the exact `READ_ONLY_ERROR` message surfacing in the existing form's error slot; click "Activer le mode intervention", confirm the banner switches to the red "Mode intervention actif" state and the same write now succeeds; click "Quitter", confirm redirect to `/platform` and that a fresh visit to the dashboard as `super_admin` no longer shows the banner.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/ImpersonationBanner.tsx "app/(dashboard)/layout.tsx"
git commit -m "feat(impersonation): fixed, non-themable impersonation banner with live countdown"
```

---

### Task 12: Full-branch verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: all green, including the guard-coverage test and every new impersonation test

- [ ] **Step 3: Confirm no new Prisma migration was introduced**

Run: `git diff --stat main -- prisma/migrations`
Expected: empty — this phase reuses the `PlatformAuditLog`/`PlatformAction` schema shipped in Phase 1, verified in Task 1's file-structure review. If this is not empty, stop and reconcile before proceeding — an unplanned migration means a design assumption in this plan was wrong.

- [ ] **Step 4: Re-run the Phase 1 RLS assertions to confirm no regression**

Run: `npx prisma db execute --file prisma/tests/rls_phase1.sql`
Expected: no output (all 6 assertions pass) — impersonation reads/writes go through Prisma (bypasses RLS by design, §2.2 of the handover), so this phase should not have touched any policy; this is a guard against an accidental regression, not new coverage.

- [ ] **Step 5: Manual smoke test end-to-end (super_admin account, real browser)**

Repeat Task 11 Step 4's full sequence once more end-to-end after all tasks are merged together, since Task 10 and 11 were verified independently and in isolation from the fully-wired guard set from Task 8. Return to the platform zone and confirm `/boutiques/foulard-teranga` shows no lingering impersonation state.

---

## Self-Review

**Spec coverage** — every item of §13's phase 3 scope has a task: `ActorContext`/cookie signé (Tasks 1–2), `requireWritableSession` (Task 4) composed into "les gardes existants" (Tasks 6–8), test de couverture des gardes (Task 5, the RED-first gate that 6–8 turn green), bandeau (Task 11), mode intervention (Tasks 9, 11). §11's error cases (cookie expiré/signature invalide/actorUserId incohérent/cible inactive/écriture en lecture seule) are each an explicit test in Task 2 and Task 4. §12's Vitest list is covered 1:1 (Tasks 2, 4, 5, 9); the Playwright item is explicitly and consciously not implemented, matching the repo's existing (silent, in Phases 1–2) precedent — called out in Global Constraints instead of left as an unstated gap.

**Placeholder scan** — no "TBD"/"handle edge cases"/"similar to Task N" left; Task 8's steps for the six unread action files are the one deliberately open-ended spot, and they carry a concrete, copy-pasteable recipe plus an explicit instruction not to guess (open the file, check for a real mutation) rather than a vague "add validation".

**Type consistency** — `ActorContext`/`ImpersonationState` (Task 1) are the exact shapes consumed unchanged through `context.ts` (Task 2), `guards.ts` (Task 4), `actions.ts` (Task 9), the banner (Task 11). `requireOwnerSession`'s return shape changes from `Session | null` to `{ session: Session } | { error: string }` in Task 6 — every one of its six call sites is updated in the same task, not left split across tasks. `getSession()`'s public signature is untouched everywhere (Task 3), which is what makes Tasks 6–8 a pure additive composition rather than a rewrite.

---

**Plan complete and saved to `docs/superpowers/plans/2026-07-30-super-admin-phase3-impersonation.md`.**
