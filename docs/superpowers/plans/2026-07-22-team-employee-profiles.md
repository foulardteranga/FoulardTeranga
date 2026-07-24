# Gestion d'équipe & profils employés — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter le spec `docs/superpowers/specs/2026-07-22-team-employee-profiles-design.md` — la gérante (`owner`) peut créer des profils d'accès personnalisés (ex. Gérant, Caissier) définissant les modules du back-office accessibles, puis créer des comptes employés (`staff`) rattachés à un profil, depuis un nouvel écran « Équipe ».

**Architecture:** Nouveau modèle Prisma `EmployeeRole` (nom + liste de modules autorisés), `Profile` gagne `employeeRoleId`, `active` et `email`. L'application des permissions est **centralisée dans `proxy.ts`** (même point d'application que la zone `dashboard` existante) plutôt que dupliquée dans chaque `page.tsx` — `proxy.ts` connaît déjà la session à chaque requête, donc y ajouter une vérification par module est la façon la plus DRY d'obtenir le même résultat que le helper `requireModule()` envisagé au design. L'écran « Équipe » reste strictement réservé à `owner` (pas un module cochable, pour éviter toute escalade de privilèges). La création de compte employé passe par un nouveau client Supabase **service_role**, strictement serveur, dans une Server Action dédiée.

**Tech Stack:** Next.js 16.2 (Server Actions, `proxy.ts`), Prisma 7 + Supabase Postgres (DDL via MCP), Supabase Auth Admin API, Zod 4, Vitest.

## Global Constraints

- Langue produit : FR (libellés, erreurs). Code/commits : EN. TypeScript strict, jamais de `any`.
- `npm run build` (Turbopack) est **cassé** par le nom du dossier parent (é NFD) — utiliser `npx next build --webpack` pour vérifier le build. `npm run test` et `npm run typecheck` fonctionnent normalement.
- Migrations DDL appliquées au projet Supabase **via le MCP Supabase** (`mcp__supabase__apply_migration`), SQL committé sous `prisma/migrations/<timestamp>_<name>/migration.sql`, puis `npx prisma generate` localement.
- Toute nouvelle table → RLS **+** vérification `mcp__supabase__get_advisors` (type `security`) — aucune nouvelle alerte attendue.
- Résultats de Server Action typés `{ ok: true, ... } | { ok: false; error: string }`, messages d'erreur en français, jamais d'exception non gérée (`try/catch` autour de tout accès Prisma/Supabase).
- `service_role` ne doit **jamais** être exposée côté client — uniquement importée depuis des fichiers `"use server"` (CLAUDE.md §9/§12).
- `owner` garde toujours un accès complet, non restreignable — les checks de permission ne s'appliquent qu'aux comptes `staff`.
- La gestion des profils/employés (`/equipe`) reste strictement réservée à `owner` — ce n'est **pas** un module que l'on peut cocher dans un `EmployeeRole` (risque d'escalade de privilèges, cf. design §1).
- Pas de suite Playwright dans ce repo aujourd'hui (aucun `playwright.config`, aucun `tests/` — vérifié en amont) : la vérification E2E du design (§5) est remplacée par une checklist de QA manuelle à la fin de ce plan plutôt que d'introduire tout un framework de test comme effet de bord de cette fonctionnalité.
- Après chaque tâche : `npm run test` et `npm run typecheck` doivent être verts.

---

### Task 1: Migration — `EmployeeRole`, colonnes `Profile`, RLS

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260722140000_employee_roles/migration.sql`

**Interfaces:**
- Consumes: rien (première tâche).
- Produces: le modèle Prisma `EmployeeRole` (`id`, `tenantId`, `name`, `permissions: string[]`, `createdAt`) ; `Profile` gagne `employeeRoleId: string | null`, `active: boolean`, `email: string | null` — consommés par toutes les tâches suivantes via `prisma.employeeRole` / `prisma.profile`.

- [ ] **Step 1: Étendre `prisma/schema.prisma`**

Ajouter un nouveau model juste après `model Profile` (avant `model Product`) :

```prisma
model EmployeeRole {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  permissions String[] @default([])
  createdAt   DateTime @default(now())

  tenant   Tenant    @relation(fields: [tenantId], references: [id])
  profiles Profile[]

  @@unique([tenantId, name])
  @@index([tenantId])
}
```

Remplacer le `model Profile` existant par :

```prisma
model Profile {
  id             String   @id @db.Uuid
  tenantId       String
  role           Role
  name           String
  email          String?
  employeeRoleId String?
  active         Boolean  @default(true)
  createdAt      DateTime @default(now())

  tenant            Tenant             @relation(fields: [tenantId], references: [id])
  employeeRole      EmployeeRole?      @relation(fields: [employeeRoleId], references: [id])
  customer          Customer?
  stockMovements    StockMovement[]
  orderStatusEvents OrderStatusEvent[]

  @@index([tenantId])
  @@index([employeeRoleId])
}
```

Dans `model Tenant`, ajouter à la liste des relations (après `profiles Profile[]`) :

```prisma
  employeeRoles EmployeeRole[]
```

- [ ] **Step 2: Créer la migration SQL**

`prisma/migrations/20260722140000_employee_roles/migration.sql` :

```sql
-- EmployeeRole : profils d'accès personnalisés (ex. Gérant, Caissier), un
-- nom unique par tenant, la liste des modules dashboard autorisés.
CREATE TABLE "EmployeeRole" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "permissions" TEXT[] NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeRole_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmployeeRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EmployeeRole_tenantId_name_key" ON "EmployeeRole"("tenantId", "name");
CREATE INDEX "EmployeeRole_tenantId_idx" ON "EmployeeRole"("tenantId");

-- Profile : email (affichage écran Équipe, copié depuis Supabase Auth à la
-- création — évite un appel Admin API à chaque lecture), employeeRoleId
-- (ON DELETE RESTRICT : impossible de supprimer un profil d'accès tant que
-- des employés y sont rattachés — appliqué par la DB, pas seulement par
-- l'application), active (désactivation sans suppression, cf. design §1).
ALTER TABLE "Profile" ADD COLUMN "email" TEXT;
ALTER TABLE "Profile" ADD COLUMN "employeeRoleId" TEXT;
ALTER TABLE "Profile" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_employeeRoleId_fkey" FOREIGN KEY ("employeeRoleId") REFERENCES "EmployeeRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Profile_employeeRoleId_idx" ON "Profile"("employeeRoleId");

-- RLS EmployeeRole : lecture par owner/staff du tenant (nécessaire pour que
-- resolveSession() puisse embarquer les permissions d'un compte staff via le
-- client Supabase lié à sa propre session, cf. lib/auth/index.ts) ; écriture
-- réservée à owner (les Server Actions écrivent via Prisma qui bypasse la
-- RLS — ces policies sont une défense en profondeur, forme alignée sur
-- "current_role"() quoté comme dans StockMovement/PromoCode).
ALTER TABLE "EmployeeRole" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_roles_select_staff" ON "EmployeeRole"
  FOR SELECT TO authenticated
  USING ("tenantId" = current_tenant_id() AND "current_role"() = ANY (ARRAY['owner'::"Role", 'staff'::"Role"]));

CREATE POLICY "employee_roles_insert_owner" ON "EmployeeRole"
  FOR INSERT TO authenticated
  WITH CHECK ("tenantId" = current_tenant_id() AND "current_role"() = 'owner'::"Role");

CREATE POLICY "employee_roles_update_owner" ON "EmployeeRole"
  FOR UPDATE TO authenticated
  USING ("tenantId" = current_tenant_id() AND "current_role"() = 'owner'::"Role")
  WITH CHECK ("tenantId" = current_tenant_id() AND "current_role"() = 'owner'::"Role");

CREATE POLICY "employee_roles_delete_owner" ON "EmployeeRole"
  FOR DELETE TO authenticated
  USING ("tenantId" = current_tenant_id() AND "current_role"() = 'owner'::"Role");

-- RLS Profile : owner peut créer/mettre à jour des profils staff de son
-- tenant (défense en profondeur — l'écriture applicative passe par Prisma).
CREATE POLICY "profiles_insert_owner" ON "Profile"
  FOR INSERT TO authenticated
  WITH CHECK ("tenantId" = current_tenant_id() AND "current_role"() = 'owner'::"Role" AND role = 'staff'::"Role");

CREATE POLICY "profiles_update_owner" ON "Profile"
  FOR UPDATE TO authenticated
  USING ("tenantId" = current_tenant_id() AND "current_role"() = 'owner'::"Role" AND role = 'staff'::"Role")
  WITH CHECK ("tenantId" = current_tenant_id() AND "current_role"() = 'owner'::"Role" AND role = 'staff'::"Role");
```

Avant d'appliquer : vérifier la forme exacte actuellement en base avec `mcp__supabase__execute_sql` (`SELECT policyname, qual, with_check FROM pg_policies WHERE tablename = 'Profile';`) et l'imiter si elle diverge du texte ci-dessus (déjà vérifié une fois pendant le brainstorming de cette tâche — `current_tenant_id()` non quoté, `"current_role"()` quoté, cast `::"Role"` — mais revérifier reste la convention du projet).

- [ ] **Step 3: Appliquer via MCP et vérifier**

`mcp__supabase__apply_migration` avec `name: "employee_roles"` et le SQL ci-dessus. Puis vérifier :

```sql
SELECT relrowsecurity FROM pg_class WHERE relname = 'EmployeeRole';   -- attendu: true
SELECT policyname FROM pg_policies WHERE tablename = 'EmployeeRole';  -- attendu: les 4 policies
SELECT policyname FROM pg_policies WHERE tablename = 'Profile';       -- attendu: les 5 anciennes + 2 nouvelles
SELECT column_name FROM information_schema.columns WHERE table_name = 'Profile' ORDER BY 1;
```

Lancer `mcp__supabase__get_advisors` (type `security`) : aucune **nouvelle** advisory concernant `EmployeeRole` ou `Profile`.

- [ ] **Step 4: Régénérer et vérifier**

Run: `npx prisma generate && npm run typecheck && npm run test`
Expected: generate OK, typecheck propre, tous les tests actuels verts (aucun nouveau test dans cette tâche).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260722140000_employee_roles
git commit -m "feat(team): EmployeeRole model, Profile access-control columns, RLS"
```

---

### Task 2: Registre des modules — `lib/nav.ts` + `lib/proxy/zones.ts`

**Files:**
- Modify: `lib/nav.ts`
- Modify: `lib/proxy/zones.ts`
- Modify: `lib/proxy/zones.test.ts`

**Interfaces:**
- Consumes: rien (pas de dépendance sur Task 1).
- Produces: `MODULE_IDS` (tuple readonly, `lib/nav.ts`) et `ModuleId` type — consommés par `lib/validators/team.ts` (Task 6) et `EquipeScreen` (Task 10). `PATH_MODULE_IDS`, `MODULE_ID_PATHS`, `moduleForPath()` (`lib/proxy/zones.ts`) — consommés par `proxy.ts` (Task 4). Nouvelle entrée de nav `"equipe"` — consommée par `Sidebar`/`MobileNav` (Task 9).

- [ ] **Step 1: Ajouter `MODULE_IDS` et l'entrée de nav « Équipe » dans `lib/nav.ts`**

Ajouter en haut du fichier, avant `export const NAV: NavDef[] = [`:

```ts
/** Modules du dashboard qu'un profil d'accès personnalisé peut autoriser (cf. EmployeeRole.permissions). "equipe" n'en fait PAS partie : toujours réservé à owner. */
export const MODULE_IDS = ["pos", "dash", "orders", "inv", "cust", "mkt", "fin", "theme", "vitrine", "boutique"] as const;
export type ModuleId = (typeof MODULE_IDS)[number];
```

Ajouter une entrée à la fin du tableau `NAV` (après l'entrée `boutique`) :

```ts
  { id: "equipe", href: "/admin/equipe", label: "Équipe", short: "Équipe", icon: ICONS.personPlus },
```

Mettre à jour `MORE_ROUTES` pour inclure `"equipe"` :

```ts
export const MORE_ROUTES = ["cust", "mkt", "fin", "theme", "vitrine", "boutique", "equipe"];
```

Ajouter une entrée à `SCREEN_META` :

```ts
  "/admin/equipe": ["Équipe", "Profils d'accès et employés"],
```

- [ ] **Step 2: Ajouter le mapping chemin → module dans `lib/proxy/zones.ts`**

Ajouter `"/equipe"` à `DASHBOARD_PATHS` (avant `"/connexion"`) :

```ts
export const DASHBOARD_PATHS = [
  "/pos",
  "/tableau-de-bord",
  "/commandes",
  "/inventaire",
  "/clientes",
  "/marketing",
  "/finance",
  "/personnalisation",
  "/vitrine",
  "/boutique",
  "/equipe",
  "/connexion",
] as const;
```

Ajouter à la fin du fichier :

```ts
/**
 * Mapping chemin dashboard → id de module (cf. MODULE_IDS dans lib/nav.ts).
 * "/equipe" et "/connexion" sont volontairement absents : "/equipe" a sa
 * propre garde (owner uniquement, pas un module de EmployeeRole.permissions)
 * et "/connexion" n'est jamais soumis au contrôle de module dans proxy.ts.
 */
export const PATH_MODULE_IDS: Record<string, string> = {
  "/pos": "pos",
  "/tableau-de-bord": "dash",
  "/commandes": "orders",
  "/inventaire": "inv",
  "/clientes": "cust",
  "/marketing": "mkt",
  "/finance": "fin",
  "/personnalisation": "theme",
  "/vitrine": "vitrine",
  "/boutique": "boutique",
};

export const MODULE_ID_PATHS: Record<string, string> = Object.fromEntries(
  Object.entries(PATH_MODULE_IDS).map(([path, id]) => [id, path])
);

/** Résout l'id de module pour un chemin dashboard (avec ses sous-chemins), ou null si non gated (ex. "/equipe", "/connexion"). */
export function moduleForPath(pathname: string): string | null {
  const entry = Object.entries(PATH_MODULE_IDS).find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
  return entry ? entry[1] : null;
}
```

- [ ] **Step 3: Ajouter les tests de `moduleForPath`**

Ajouter à la fin de `lib/proxy/zones.test.ts` :

```ts
import { moduleForPath } from "@/lib/proxy/zones";

describe("moduleForPath", () => {
  it("résout un chemin exact vers son id de module", () => {
    expect(moduleForPath("/finance")).toBe("fin");
  });

  it("résout un sous-chemin vers le même module que son parent", () => {
    expect(moduleForPath("/inventaire/produit-1")).toBe("inv");
  });

  it("retourne null pour un chemin non gaté (équipe, connexion)", () => {
    expect(moduleForPath("/equipe")).toBeNull();
    expect(moduleForPath("/connexion")).toBeNull();
  });
});
```

Mettre à jour l'import en haut du fichier pour inclure `moduleForPath` dans le même `import` que `resolveZone` :

```ts
import { resolveZone, isPathAllowedForZone, dashboardPath, moduleForPath } from "@/lib/proxy/zones";
```

(Supprimer le second `import` ajouté au Step 3 ci-dessus — le fusionner dans celui en haut du fichier.)

- [ ] **Step 4: Run tests**

Run: `npm run test -- lib/proxy/zones.test.ts && npm run typecheck`
Expected: tous les tests passent, y compris les 3 nouveaux.

- [ ] **Step 5: Commit**

```bash
git add lib/nav.ts lib/proxy/zones.ts lib/proxy/zones.test.ts
git commit -m "feat(team): module registry and path-to-module mapping"
```

---

### Task 3: `hasModuleAccess` + session enrichie — `lib/auth/index.ts`

**Files:**
- Modify: `lib/auth/index.ts`
- Modify: `lib/auth/index.test.ts`

**Interfaces:**
- Consumes: rien de Task 1/2 directement (le module id est une simple `string` ici, pas encore couplé à `MODULE_IDS`).
- Produces: `Session.permissions: string[]`, `hasModuleAccess(session: Session | null, moduleId: string): boolean` — consommés par `proxy.ts` (Task 4), `Sidebar`/`MobileNav` (Task 9).

- [ ] **Step 1: Écrire les tests (ils échoueront tant que Step 2 n'est pas fait)**

Remplacer le contenu de `lib/auth/index.test.ts` par :

```ts
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isRoleAllowedForZone, resolveSession, hasModuleAccess, type Session } from "@/lib/auth";

function fakeSupabase(
  user: { id: string } | null,
  profile: {
    role: string;
    name: string;
    active?: boolean;
    employeeRole?: { permissions: string[] } | null;
  } | null
): SupabaseClient {
  return {
    auth: {
      getUser: async () => ({ data: { user } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: profile }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("isRoleAllowedForZone", () => {
  it("always allows the public storefront zone, even with no role", () => {
    expect(isRoleAllowedForZone("storefront", null)).toBe(true);
  });

  it("allows owner and staff into the dashboard zone", () => {
    expect(isRoleAllowedForZone("dashboard", "owner")).toBe(true);
    expect(isRoleAllowedForZone("dashboard", "staff")).toBe(true);
  });

  it("rejects customer and super_admin from the dashboard zone", () => {
    expect(isRoleAllowedForZone("dashboard", "customer")).toBe(false);
    expect(isRoleAllowedForZone("dashboard", "super_admin")).toBe(false);
  });

  it("only allows super_admin into the admin zone", () => {
    expect(isRoleAllowedForZone("admin", "super_admin")).toBe(true);
    expect(isRoleAllowedForZone("admin", "owner")).toBe(false);
  });

  it("rejects a null role from any privileged zone", () => {
    expect(isRoleAllowedForZone("dashboard", null)).toBe(false);
    expect(isRoleAllowedForZone("admin", null)).toBe(false);
  });
});

describe("hasModuleAccess", () => {
  it("grants owner access to every module, including ones not in MODULE_IDS", () => {
    const owner: Session = { userId: "u1", name: "N", role: "owner", permissions: [] };
    expect(hasModuleAccess(owner, "fin")).toBe(true);
    expect(hasModuleAccess(owner, "equipe")).toBe(true);
  });

  it("grants staff access only to modules listed in their permissions", () => {
    const staff: Session = { userId: "u1", name: "N", role: "staff", permissions: ["pos", "orders"] };
    expect(hasModuleAccess(staff, "pos")).toBe(true);
    expect(hasModuleAccess(staff, "fin")).toBe(false);
  });

  it("denies customer sessions and null sessions", () => {
    expect(hasModuleAccess(null, "pos")).toBe(false);
    const customer: Session = { userId: "u1", name: "N", role: "customer", permissions: [] };
    expect(hasModuleAccess(customer, "pos")).toBe(false);
  });
});

describe("resolveSession", () => {
  it("returns null when there is no authenticated user", async () => {
    const session = await resolveSession(fakeSupabase(null, null));
    expect(session).toBeNull();
  });

  it("returns null when the authenticated user has no matching Profile row", async () => {
    const session = await resolveSession(fakeSupabase({ id: "u1" }, null));
    expect(session).toBeNull();
  });

  it("returns the session when both the user and its profile exist", async () => {
    const session = await resolveSession(
      fakeSupabase({ id: "u1" }, { role: "owner", name: "Aïcha Koné" })
    );
    expect(session).toEqual({ userId: "u1", name: "Aïcha Koné", role: "owner", permissions: [] });
  });

  it("returns null when the profile has been deactivated", () => {
    return resolveSession(
      fakeSupabase({ id: "u1" }, { role: "staff", name: "Awa", active: false, employeeRole: { permissions: ["pos"] } })
    ).then((session) => expect(session).toBeNull());
  });

  it("loads the staff member's module permissions from their EmployeeRole", async () => {
    const session = await resolveSession(
      fakeSupabase(
        { id: "u1" },
        { role: "staff", name: "Awa", active: true, employeeRole: { permissions: ["pos", "orders"] } }
      )
    );
    expect(session).toEqual({ userId: "u1", name: "Awa", role: "staff", permissions: ["pos", "orders"] });
  });

  it("defaults staff permissions to an empty array when no EmployeeRole is assigned", async () => {
    const session = await resolveSession(
      fakeSupabase({ id: "u1" }, { role: "staff", name: "Awa", active: true, employeeRole: null })
    );
    expect(session).toEqual({ userId: "u1", name: "Awa", role: "staff", permissions: [] });
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm run test -- lib/auth/index.test.ts`
Expected: FAIL — `hasModuleAccess is not exported`, et les assertions `permissions` échouent (`Session` ne l'a pas encore).

- [ ] **Step 3: Implémenter dans `lib/auth/index.ts`**

Remplacer le contenu du fichier par :

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type Zone = "storefront" | "dashboard" | "admin";
export type Role = "owner" | "staff" | "super_admin" | "customer";

export interface Session {
  userId: string;
  name: string;
  role: Role;
  /** Modules dashboard autorisés — pertinent uniquement pour `staff` (cf. hasModuleAccess). Toujours [] pour owner/super_admin/customer. */
  permissions: string[];
}

const ZONE_ROLES: Record<Exclude<Zone, "storefront">, Role[]> = {
  dashboard: ["owner", "staff"],
  admin: ["super_admin"],
};

/** Pure : aucune dépendance réseau, testable directement. */
export function isRoleAllowedForZone(zone: Zone, role: Role | null): boolean {
  if (zone === "storefront") return true;
  if (!role) return false;
  return ZONE_ROLES[zone].includes(role);
}

/**
 * Accès à un module du dashboard : `owner` a toujours accès complet, `staff`
 * uniquement aux modules listés dans son `EmployeeRole.permissions`. La
 * gestion d'équipe ("equipe") n'est volontairement PAS un module régulier —
 * elle se vérifie séparément via `session.role === "owner"` (cf.
 * docs/superpowers/specs/2026-07-22-team-employee-profiles-design.md §1).
 */
export function hasModuleAccess(session: Session | null, moduleId: string): boolean {
  if (!session) return false;
  if (session.role === "owner") return true;
  if (session.role !== "staff") return false;
  return session.permissions.includes(moduleId);
}

/**
 * Résout la session à partir d'un client Supabase déjà construit — factorisé
 * pour être appelable aussi bien depuis un contexte Server Component/Action
 * (lib/supabase/server.ts) que depuis proxy.ts en Edge (lib/supabase/middleware.ts),
 * qui n'ont pas la même API de cookies.
 */
export async function resolveSession(supabase: SupabaseClient): Promise<Session | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("Profile")
    .select("role, name, active, employeeRole:EmployeeRole(permissions)")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;
  if (profile.active === false) return null;

  const role = profile.role as Role;
  const employeeRole = profile.employeeRole as { permissions: string[] } | null;
  const permissions = role === "staff" ? (employeeRole?.permissions ?? []) : [];

  return { userId: user.id, name: profile.name, role, permissions };
}

/** Convenience Server Component/Action : construit le client puis résout la session. */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  return resolveSession(supabase);
}

export async function requireZone(zone: Zone): Promise<{ allowed: boolean }> {
  const session = await getSession();
  return { allowed: isRoleAllowedForZone(zone, session?.role ?? null) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/auth/index.test.ts && npm run typecheck`
Expected: PASS — tous les tests verts, typecheck propre.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/index.ts lib/auth/index.test.ts
git commit -m "feat(team): hasModuleAccess and session-level module permissions"
```

---

### Task 4: Application dans `proxy.ts`

**Files:**
- Modify: `proxy.ts`

**Interfaces:**
- Consumes: `hasModuleAccess`, `Session` (Task 3, `@/lib/auth`) ; `moduleForPath`, `MODULE_ID_PATHS` (Task 2, `@/lib/proxy/zones`).
- Produces: application effective des permissions par module pour toute requête dashboard — rien de nouveau exporté (fichier terminal, pas de consommateur en aval).

- [ ] **Step 1: Modifier `proxy.ts`**

Remplacer le contenu du fichier par :

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  resolveZone,
  isPathAllowedForZone,
  dashboardPath,
  moduleForPath,
  MODULE_ID_PATHS,
} from "@/lib/proxy/zones";
import { resolveTenantFromHost } from "@/lib/tenant/registry";
import { resolveSession, isRoleAllowedForZone, hasModuleAccess } from "@/lib/auth";
import { createMiddlewareClient } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "localhost";
  const { zone, rewrittenPathname } = resolveZone(hostname, request.nextUrl.pathname);

  if (!isPathAllowedForZone(zone, rewrittenPathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Réponse "brouillon" utilisée par le client Supabase pour écrire les cookies
  // de rafraîchissement de session ; recopiée sur la réponse finale plus bas,
  // qu'il s'agisse d'une redirection ou d'un rewrite.
  const authDraft = NextResponse.next();

  if (zone !== "storefront" && rewrittenPathname !== "/connexion") {
    const supabase = createMiddlewareClient(request, authDraft);
    const session = await resolveSession(supabase);
    if (!isRoleAllowedForZone(zone, session?.role ?? null)) {
      // La zone admin (super_admin) n'a pas de page de connexion dédiée dans ce
      // sous-projet (dormant en v1, aucun compte super_admin) — comportement
      // inchangé : redirection vers la vitrine.
      const target = zone === "dashboard" ? dashboardPath(hostname, "/connexion") : "/";
      const redirectUrl = new URL(target, request.url);
      if (zone === "dashboard") redirectUrl.searchParams.set("next", rewrittenPathname);
      const redirect = NextResponse.redirect(redirectUrl);
      authDraft.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }

    // Contrôle d'accès par module (profils d'accès personnalisés, cf. design
    // 2026-07-22). "/equipe" a sa propre garde : owner uniquement, jamais un
    // module coché dans un EmployeeRole (escalade de privilèges).
    if (zone === "dashboard") {
      const isEquipePath = rewrittenPathname === "/equipe" || rewrittenPathname.startsWith("/equipe/");
      const moduleId = moduleForPath(rewrittenPathname);
      const moduleAllowed = isEquipePath
        ? session?.role === "owner"
        : moduleId
          ? hasModuleAccess(session, moduleId)
          : true;

      if (!moduleAllowed) {
        // Repli sur le premier module autorisé du profil (garanti non-vide :
        // EmployeeRole exige au moins un module, cf. lib/validators/team.ts) ;
        // sinon (état incohérent) repli sur /connexion, qui sort de ce bloc de
        // contrôle et ne peut donc pas reboucler.
        const firstAllowedId = session?.permissions[0];
        const fallbackPath = firstAllowedId ? MODULE_ID_PATHS[firstAllowedId] : undefined;
        const redirectUrl = new URL(dashboardPath(hostname, fallbackPath ?? "/connexion"), request.url);
        const redirect = NextResponse.redirect(redirectUrl);
        authDraft.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
        return redirect;
      }
    }
  }

  const tenant = resolveTenantFromHost(hostname);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-id", tenant.id);

  const url = request.nextUrl.clone();
  url.pathname = rewrittenPathname;

  const rewrite = NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  });
  authDraft.cookies.getAll().forEach((cookie) => rewrite.cookies.set(cookie));
  return rewrite;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Run existing suite**

Run: `npm run test && npm run typecheck`
Expected: tous les tests verts (`proxy.ts` n'a pas de test unitaire dédié dans ce repo — comportement existant, ses dépendances pures `resolveZone`/`isPathAllowedForZone`/`moduleForPath` le sont). Typecheck propre.

- [ ] **Step 3: Commit**

```bash
git add proxy.ts
git commit -m "feat(team): enforce per-module dashboard access in proxy"
```

---

### Task 5: Client Supabase `service_role`

**Files:**
- Create: `lib/supabase/admin.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: rien.
- Produces: `createAdminClient(): SupabaseClient` — consommé par `createEmployee` (Task 7).

- [ ] **Step 1: Créer `lib/supabase/admin.ts`**

```ts
import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase avec la clé service_role — bypass la RLS, réservé aux
 * Server Actions qui doivent gérer des comptes Supabase Auth (création
 * d'employés). Ne jamais importer depuis un composant client (CLAUDE.md §9).
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

- [ ] **Step 2: Documenter la variable d'env**

Ajouter à la fin de `.env.example` :

```
# Supabase — clé service_role, SERVEUR UNIQUEMENT (bypass RLS). Jamais exposée
# côté client, jamais préfixée NEXT_PUBLIC_. Récupérable dans le dashboard
# Supabase : Project Settings > API > service_role secret. Utilisée par
# lib/supabase/admin.ts (création de comptes employés).
SUPABASE_SERVICE_ROLE_KEY="<service_role_secret>"
```

Ajouter `SUPABASE_SERVICE_ROLE_KEY="<valeur réelle>"` dans le `.env` local (non commité, déjà gitignored) — à faire manuellement depuis le dashboard Supabase du projet, cette valeur ne doit jamais transiter par du code ou une conversation.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: propre (le fichier n'est pas encore importé nulle part, mais doit compiler seul).

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/admin.ts .env.example
git commit -m "feat(team): service_role Supabase client for employee account creation"
```

---

### Task 6: Validators — `lib/validators/team.ts`

**Files:**
- Create: `lib/validators/team.ts`
- Create: `lib/validators/team.test.ts`

**Interfaces:**
- Consumes: `MODULE_IDS` (Task 2, `@/lib/nav`).
- Produces: `employeeRoleSchema`, `EmployeeRoleInput`, `createEmployeeSchema`, `CreateEmployeeInput` — consommés par `lib/team/actions.ts` (Task 7).

- [ ] **Step 1: Écrire les tests**

`lib/validators/team.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { employeeRoleSchema, createEmployeeSchema } from "./team";

describe("employeeRoleSchema", () => {
  const valid = { name: "Caissier", permissions: ["pos", "orders"] };

  it("accepte un nom et une liste de modules valides", () => {
    expect(employeeRoleSchema.safeParse(valid).success).toBe(true);
  });

  it("refuse un nom trop court", () => {
    expect(employeeRoleSchema.safeParse({ ...valid, name: "C" }).success).toBe(false);
  });

  it("refuse une liste de modules vide", () => {
    expect(employeeRoleSchema.safeParse({ ...valid, permissions: [] }).success).toBe(false);
  });

  it("refuse un id de module inconnu", () => {
    expect(employeeRoleSchema.safeParse({ ...valid, permissions: ["not-a-module"] }).success).toBe(false);
  });
});

describe("createEmployeeSchema", () => {
  const valid = { name: "Awa Traoré", email: "awa@example.com", password: "password123", employeeRoleId: "r1" };

  it("accepte des informations valides", () => {
    expect(createEmployeeSchema.safeParse(valid).success).toBe(true);
  });

  it("refuse un email invalide", () => {
    expect(createEmployeeSchema.safeParse({ ...valid, email: "pas-un-email" }).success).toBe(false);
  });

  it("refuse un mot de passe trop court", () => {
    expect(createEmployeeSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
  });

  it("refuse un employeeRoleId vide", () => {
    expect(createEmployeeSchema.safeParse({ ...valid, employeeRoleId: "" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/validators/team.test.ts`
Expected: FAIL — `./team` introuvable.

- [ ] **Step 3: Implémenter `lib/validators/team.ts`**

```ts
import { z } from "zod";
import { MODULE_IDS } from "@/lib/nav";

export const employeeRoleSchema = z.object({
  name: z.string().trim().min(2, "Le nom du profil doit contenir au moins 2 caractères.").max(40),
  permissions: z.array(z.enum(MODULE_IDS)).min(1, "Sélectionnez au moins un module."),
});
export type EmployeeRoleInput = z.infer<typeof employeeRoleSchema>;

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères."),
  email: z.string().trim().email("Adresse email invalide."),
  password: z.string().min(8, "8 caractères minimum."),
  employeeRoleId: z.string().min(1, "Choisissez un profil d'accès."),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/validators/team.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/validators/team.ts lib/validators/team.test.ts
git commit -m "feat(team): Zod validators for employee roles and employee creation"
```

---

### Task 7: Server Actions — `lib/team/actions.ts`

**Files:**
- Create: `lib/team/actions.ts`
- Create: `lib/team/actions.test.ts`

**Interfaces:**
- Consumes: `employeeRoleSchema`, `createEmployeeSchema` (Task 6) ; `createAdminClient` (Task 5) ; `getSession` (`@/lib/auth`) ; `prisma` (`@/lib/db/client`) ; `getCurrentTenant` (`@/lib/tenant`).
- Produces: `createEmployeeRole`, `updateEmployeeRole`, `deleteEmployeeRole`, `createEmployee`, `setEmployeeActive`, `setEmployeeRole` — tous `(...) => Promise<{ ok: true } | { ok: false; error: string }>` — consommés par `EquipeScreen` (Task 10).

- [ ] **Step 1: Écrire les tests (garde owner-only, sans dépendance DB)**

`lib/team/actions.test.ts` :

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: async () => ({ userId: "u1", name: "Awa", role: "staff", permissions: ["pos"] }),
}));

import {
  createEmployeeRole,
  updateEmployeeRole,
  deleteEmployeeRole,
  createEmployee,
  setEmployeeActive,
  setEmployeeRole,
} from "./actions";

const denied = { ok: false, error: "Une erreur est survenue, réessayez." };

describe("team actions — réservées à owner", () => {
  it("rejette createEmployeeRole pour un compte non-owner", async () => {
    expect(await createEmployeeRole({ name: "Caissier", permissions: ["pos"] })).toEqual(denied);
  });

  it("rejette updateEmployeeRole pour un compte non-owner", async () => {
    expect(await updateEmployeeRole("r1", { name: "Caissier", permissions: ["pos"] })).toEqual(denied);
  });

  it("rejette deleteEmployeeRole pour un compte non-owner", async () => {
    expect(await deleteEmployeeRole("r1")).toEqual(denied);
  });

  it("rejette createEmployee pour un compte non-owner", async () => {
    expect(
      await createEmployee({ name: "Awa", email: "awa@example.com", password: "password123", employeeRoleId: "r1" })
    ).toEqual(denied);
  });

  it("rejette setEmployeeActive pour un compte non-owner", async () => {
    expect(await setEmployeeActive("p1", false)).toEqual(denied);
  });

  it("rejette setEmployeeRole pour un compte non-owner", async () => {
    expect(await setEmployeeRole("p1", "r1")).toEqual(denied);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/team/actions.test.ts`
Expected: FAIL — `./actions` introuvable.

- [ ] **Step 3: Implémenter `lib/team/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { getSession, type Session } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  employeeRoleSchema,
  createEmployeeSchema,
  type EmployeeRoleInput,
  type CreateEmployeeInput,
} from "@/lib/validators/team";

async function requireOwnerSession(): Promise<Session | null> {
  const session = await getSession();
  return session?.role === "owner" ? session : null;
}

export async function createEmployeeRole(
  input: EmployeeRoleInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireOwnerSession())) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const parsed = employeeRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Informations invalides." };
  }

  try {
    const tenant = await getCurrentTenant();
    const existing = await prisma.employeeRole.findFirst({
      where: { tenantId: tenant.id, name: parsed.data.name },
    });
    if (existing) return { ok: false, error: "Un profil porte déjà ce nom." };

    await prisma.employeeRole.create({
      data: { tenantId: tenant.id, name: parsed.data.name, permissions: parsed.data.permissions },
    });
    revalidatePath("/equipe");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}

export async function updateEmployeeRole(
  id: string,
  input: EmployeeRoleInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireOwnerSession())) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const parsed = employeeRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Informations invalides." };
  }

  try {
    const tenant = await getCurrentTenant();
    const role = await prisma.employeeRole.findFirst({ where: { id, tenantId: tenant.id } });
    if (!role) return { ok: false, error: "Profil introuvable." };

    const duplicate = await prisma.employeeRole.findFirst({
      where: { tenantId: tenant.id, name: parsed.data.name, NOT: { id } },
    });
    if (duplicate) return { ok: false, error: "Un profil porte déjà ce nom." };

    await prisma.employeeRole.update({
      where: { id: role.id },
      data: { name: parsed.data.name, permissions: parsed.data.permissions },
    });
    revalidatePath("/equipe");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}

export async function deleteEmployeeRole(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireOwnerSession())) return { ok: false, error: "Une erreur est survenue, réessayez." };

  try {
    const tenant = await getCurrentTenant();
    const role = await prisma.employeeRole.findFirst({ where: { id, tenantId: tenant.id } });
    if (!role) return { ok: false, error: "Profil introuvable." };

    const employeeCount = await prisma.profile.count({ where: { employeeRoleId: id } });
    if (employeeCount > 0) {
      return {
        ok: false,
        error: `Réassignez d'abord les ${employeeCount} employé${employeeCount > 1 ? "s" : ""} utilisant ce profil.`,
      };
    }

    await prisma.employeeRole.delete({ where: { id: role.id } });
    revalidatePath("/equipe");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}

export async function createEmployee(
  input: CreateEmployeeInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireOwnerSession())) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const parsed = createEmployeeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Informations invalides." };
  }

  const tenant = await getCurrentTenant();
  const role = await prisma.employeeRole.findFirst({
    where: { id: parsed.data.employeeRoleId, tenantId: tenant.id },
  });
  if (!role) return { ok: false, error: "Profil d'accès introuvable." };

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    if (createError?.code === "email_exists") return { ok: false, error: "Cet email est déjà utilisé." };
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }

  try {
    await prisma.profile.create({
      data: {
        id: created.user.id,
        tenantId: tenant.id,
        role: "staff",
        name: parsed.data.name,
        email: parsed.data.email,
        employeeRoleId: role.id,
      },
    });
  } catch {
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }

  revalidatePath("/equipe");
  return { ok: true };
}

export async function setEmployeeActive(
  profileId: string,
  active: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireOwnerSession())) return { ok: false, error: "Une erreur est survenue, réessayez." };

  try {
    const tenant = await getCurrentTenant();
    const { count } = await prisma.profile.updateMany({
      where: { id: profileId, tenantId: tenant.id, role: "staff" },
      data: { active },
    });
    if (count === 0) return { ok: false, error: "Employé introuvable." };
    revalidatePath("/equipe");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}

export async function setEmployeeRole(
  profileId: string,
  employeeRoleId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireOwnerSession())) return { ok: false, error: "Une erreur est survenue, réessayez." };

  try {
    const tenant = await getCurrentTenant();
    const role = await prisma.employeeRole.findFirst({ where: { id: employeeRoleId, tenantId: tenant.id } });
    if (!role) return { ok: false, error: "Profil d'accès introuvable." };

    const { count } = await prisma.profile.updateMany({
      where: { id: profileId, tenantId: tenant.id, role: "staff" },
      data: { employeeRoleId: role.id },
    });
    if (count === 0) return { ok: false, error: "Employé introuvable." };
    revalidatePath("/equipe");
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/team/actions.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/team/actions.ts lib/team/actions.test.ts
git commit -m "feat(team): server actions for employee roles and employee accounts"
```

---

### Task 8: Lecture — `lib/data/team.server.ts`

**Files:**
- Create: `lib/data/team.server.ts`

**Interfaces:**
- Consumes: `prisma` (`@/lib/db/client`), `getCurrentTenant` (`@/lib/tenant`).
- Produces: `EmployeeRoleView`, `EmployeeView`, `getEmployeeRoles(): Promise<EmployeeRoleView[]>`, `getEmployees(): Promise<EmployeeView[]>` — consommés par `app/(dashboard)/equipe/page.tsx` et `EquipeScreen` (Task 10).

- [ ] **Step 1: Implémenter**

```ts
import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";

export interface EmployeeRoleView {
  id: string;
  name: string;
  permissions: string[];
  employeeCount: number;
}

export interface EmployeeView {
  id: string;
  name: string;
  email: string;
  active: boolean;
  employeeRoleId: string | null;
}

/** Profils d'accès du tenant courant, plus anciens d'abord (écran Équipe). */
export async function getEmployeeRoles(): Promise<EmployeeRoleView[]> {
  const tenant = await getCurrentTenant();
  const rows = await prisma.employeeRole.findMany({
    where: { tenantId: tenant.id },
    include: { _count: { select: { profiles: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    permissions: r.permissions,
    employeeCount: r._count.profiles,
  }));
}

/** Comptes employés (role = staff) du tenant courant, plus anciens d'abord (écran Équipe). */
export async function getEmployees(): Promise<EmployeeView[]> {
  const tenant = await getCurrentTenant();
  const rows = await prisma.profile.findMany({
    where: { tenantId: tenant.id, role: "staff" },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email ?? "",
    active: r.active,
    employeeRoleId: r.employeeRoleId,
  }));
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: propre.

- [ ] **Step 3: Commit**

```bash
git add lib/data/team.server.ts
git commit -m "feat(team): read helpers for employee roles and employees"
```

---

### Task 9: Filtrage de la navigation — `Sidebar.tsx`, `MobileNav.tsx`, `layout.tsx`

**Files:**
- Modify: `components/dashboard/Sidebar.tsx`
- Modify: `components/dashboard/MobileNav.tsx`
- Modify: `app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `hasModuleAccess` (Task 3, `@/lib/auth`), `NAV`/`MORE_ROUTES` (Task 2, `@/lib/nav`).
- Produces: rien de nouveau exporté — comportement UI uniquement.

- [ ] **Step 1: Filtrer `NAV` dans `Sidebar.tsx`**

Dans `components/dashboard/Sidebar.tsx`, ajouter à l'import existant depuis `@/lib/auth` :

```ts
import { signOut } from "@/lib/auth/actions";
import { hasModuleAccess, type Session } from "@/lib/auth";
```

(Remplace la ligne `import type { Session } from "@/lib/auth";` existante — `hasModuleAccess` s'ajoute au même import.)

Juste avant `return (` dans `Sidebar`, ajouter :

```ts
  const visibleNav = NAV.filter((n) =>
    n.id === "equipe" ? session?.role === "owner" : hasModuleAccess(session, n.id)
  );
```

Remplacer `{NAV.map((n) => {` par `{visibleNav.map((n) => {` dans le JSX de la nav.

- [ ] **Step 2: Filtrer `NAV` dans `MobileNav.tsx`**

Dans `components/dashboard/MobileNav.tsx`, ajouter les imports :

```ts
import { hasModuleAccess, type Session } from "@/lib/auth";
```

Changer la signature du composant pour recevoir la session :

```ts
export function MobileNav({ pendingCount, session }: { pendingCount: number; session: Session | null }) {
```

Remplacer les deux lignes de calcul de `tabs`/`moreItems` :

```ts
  const tabs = TAB_IDS.map((id) => NAV.find((n) => n.id === id)!);
  const moreItems = MORE_ROUTES.map((id) => NAV.find((n) => n.id === id)!);
```

par :

```ts
  const visibleIds = new Set(
    NAV.filter((n) => (n.id === "equipe" ? session?.role === "owner" : hasModuleAccess(session, n.id))).map(
      (n) => n.id
    )
  );
  const tabs = TAB_IDS.filter((id) => visibleIds.has(id)).map((id) => NAV.find((n) => n.id === id)!);
  const moreItems = MORE_ROUTES.filter((id) => visibleIds.has(id)).map((id) => NAV.find((n) => n.id === id)!);
```

- [ ] **Step 3: Passer `session` depuis le layout**

Dans `app/(dashboard)/layout.tsx`, remplacer :

```tsx
        <MobileNav pendingCount={pendingCount} />
```

par :

```tsx
        <MobileNav pendingCount={pendingCount} session={session} />
```

- [ ] **Step 4: Run typecheck et tests**

Run: `npm run typecheck && npm run test`
Expected: propre, tous les tests verts (pas de nouveau test dans cette tâche — composants UI non couverts par Vitest dans ce repo, cf. convention existante pour `MarketingScreen`/`BoutiqueScreen`).

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/Sidebar.tsx components/dashboard/MobileNav.tsx "app/(dashboard)/layout.tsx"
git commit -m "feat(team): filter dashboard navigation by module permissions"
```

---

### Task 10: Écran « Équipe »

**Files:**
- Create: `components/dashboard/screens/EquipeScreen.tsx`
- Create: `app/(dashboard)/equipe/page.tsx`

**Interfaces:**
- Consumes: `EmployeeRoleView`, `EmployeeView`, `getEmployeeRoles`, `getEmployees` (Task 8) ; `createEmployeeRole`, `updateEmployeeRole`, `deleteEmployeeRole`, `createEmployee`, `setEmployeeActive`, `setEmployeeRole` (Task 7) ; `MODULE_IDS`, `NAV` (Task 2).
- Produces: route `/admin/equipe` fonctionnelle.

- [ ] **Step 1: Implémenter `EquipeScreen.tsx`**

```tsx
"use client";

import { useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { useBackoffice } from "@/lib/store/useBackoffice";
import { MODULE_IDS, NAV } from "@/lib/nav";
import {
  createEmployeeRole,
  updateEmployeeRole,
  deleteEmployeeRole,
  createEmployee,
  setEmployeeActive,
  setEmployeeRole,
} from "@/lib/team/actions";
import type { EmployeeRoleView, EmployeeView } from "@/lib/data/team.server";

const MODULE_LABELS: Record<string, string> = Object.fromEntries(
  MODULE_IDS.map((id) => [id, NAV.find((n) => n.id === id)?.label ?? id])
);

const EMPTY_ROLE_FORM = { id: null as string | null, name: "", permissions: [] as string[] };
const EMPTY_EMPLOYEE_FORM = { name: "", email: "", password: "", employeeRoleId: "" };

export function EquipeScreen({ roles, employees }: { roles: EmployeeRoleView[]; employees: EmployeeView[] }) {
  const showToast = useBackoffice((s) => s.showToast);
  const [roleForm, setRoleForm] = useState(EMPTY_ROLE_FORM);
  const [roleSaving, setRoleSaving] = useState(false);
  const [employeeForm, setEmployeeForm] = useState(EMPTY_EMPLOYEE_FORM);
  const [employeeSaving, setEmployeeSaving] = useState(false);

  function toggleModule(id: string) {
    setRoleForm((f) => ({
      ...f,
      permissions: f.permissions.includes(id) ? f.permissions.filter((m) => m !== id) : [...f.permissions, id],
    }));
  }

  async function handleSaveRole() {
    setRoleSaving(true);
    const input = { name: roleForm.name, permissions: roleForm.permissions };
    const r = roleForm.id ? await updateEmployeeRole(roleForm.id, input) : await createEmployeeRole(input);
    setRoleSaving(false);
    if (!r.ok) {
      showToast(r.error, "error");
      return;
    }
    showToast(roleForm.id ? "Profil mis à jour." : "Profil créé.", "success");
    setRoleForm(EMPTY_ROLE_FORM);
  }

  async function handleDeleteRole(id: string) {
    const r = await deleteEmployeeRole(id);
    if (!r.ok) {
      showToast(r.error, "error");
      return;
    }
    showToast("Profil supprimé.", "success");
    if (roleForm.id === id) setRoleForm(EMPTY_ROLE_FORM);
  }

  async function handleCreateEmployee() {
    setEmployeeSaving(true);
    const r = await createEmployee(employeeForm);
    setEmployeeSaving(false);
    if (!r.ok) {
      showToast(r.error, "error");
      return;
    }
    showToast("Employé·e créé·e.", "success");
    setEmployeeForm(EMPTY_EMPLOYEE_FORM);
  }

  async function handleToggleActive(employee: EmployeeView) {
    const r = await setEmployeeActive(employee.id, !employee.active);
    if (!r.ok) showToast(r.error, "error");
  }

  async function handleReassign(employee: EmployeeView, employeeRoleId: string) {
    const r = await setEmployeeRole(employee.id, employeeRoleId);
    if (!r.ok) showToast(r.error, "error");
  }

  return (
    <div className="ft-pad" style={{ maxWidth: 1200, display: "flex", flexDirection: "column", gap: 22 }}>
      <section>
        <h2 style={sectionTitle}>Profils d&apos;accès</h2>
        <div className="ft-grid-2">
          <div style={{ ...card, padding: "18px 20px" }}>
            {roles.length === 0 && (
              <p style={{ fontSize: 13, color: colors.muted }}>
                Aucun profil pour l&apos;instant — créez le premier ci-contre.
              </p>
            )}
            {roles.map((role) => (
              <div key={role.id} style={row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{role.name}</div>
                  <div style={{ fontSize: 12, color: colors.muted }}>
                    {role.permissions.map((id) => MODULE_LABELS[id]).join(" · ")} · {role.employeeCount} employé
                    {role.employeeCount > 1 ? "s" : ""}
                  </div>
                </div>
                <button onClick={() => setRoleForm({ id: role.id, name: role.name, permissions: role.permissions })} style={ghostBtn}>
                  Modifier
                </button>
                <button onClick={() => handleDeleteRole(role.id)} style={ghostBtn}>
                  Supprimer
                </button>
              </div>
            ))}
          </div>

          <div style={{ ...card, padding: "18px 20px" }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
              {roleForm.id ? "Modifier le profil" : "Créer un profil d'accès"}
            </div>
            <div style={{ fontSize: 12.5, color: colors.muted, marginBottom: 16 }}>
              Nom et modules accessibles du back-office.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={fieldLabel}>Nom du profil</label>
                <input
                  value={roleForm.name}
                  onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Caissier"
                  style={textField}
                />
              </div>
              <div>
                <label style={fieldLabel}>Modules accessibles</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {MODULE_IDS.map((id) => (
                    <label key={id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                      <input type="checkbox" checked={roleForm.permissions.includes(id)} onChange={() => toggleModule(id)} />
                      {MODULE_LABELS[id]}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="ft-primary-btn"
                  onClick={handleSaveRole}
                  disabled={roleSaving || !roleForm.name || roleForm.permissions.length === 0}
                  style={primaryBtn(roleSaving || !roleForm.name || roleForm.permissions.length === 0)}
                >
                  {roleSaving ? "Enregistrement…" : roleForm.id ? "Enregistrer" : "Créer le profil"}
                </button>
                {roleForm.id && (
                  <button onClick={() => setRoleForm(EMPTY_ROLE_FORM)} style={ghostBtn}>
                    Annuler
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 style={sectionTitle}>Employés</h2>
        <div className="ft-grid-2">
          <div style={{ ...card, padding: "18px 20px" }}>
            {employees.length === 0 && <p style={{ fontSize: 13, color: colors.muted }}>Aucun employé pour l&apos;instant.</p>}
            {employees.map((employee) => (
              <div key={employee.id} style={{ ...row, opacity: employee.active ? 1 : 0.55 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{employee.name}</div>
                  <div style={{ fontSize: 12, color: colors.muted }}>{employee.email}</div>
                </div>
                <SelectField value={employee.employeeRoleId ?? ""} onChange={(v) => handleReassign(employee, v)}>
                  <option value="" disabled>
                    Profil…
                  </option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </SelectField>
                <button onClick={() => handleToggleActive(employee)} style={ghostBtn}>
                  {employee.active ? "Désactiver" : "Activer"}
                </button>
              </div>
            ))}
          </div>

          <div style={{ ...card, padding: "18px 20px" }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Ajouter un employé</div>
            <div style={{ fontSize: 12.5, color: colors.muted, marginBottom: 16 }}>
              Nom, email, mot de passe temporaire et profil d&apos;accès.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={fieldLabel}>Nom</label>
                <input
                  value={employeeForm.name}
                  onChange={(e) => setEmployeeForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Awa Traoré"
                  style={textField}
                />
              </div>
              <div>
                <label style={fieldLabel}>Email</label>
                <input
                  type="email"
                  value={employeeForm.email}
                  onChange={(e) => setEmployeeForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="awa@example.com"
                  style={textField}
                />
              </div>
              <div>
                <label style={fieldLabel}>Mot de passe temporaire</label>
                <input
                  type="text"
                  value={employeeForm.password}
                  onChange={(e) => setEmployeeForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="8 caractères minimum"
                  style={textField}
                />
              </div>
              <div>
                <label style={fieldLabel}>Profil d&apos;accès</label>
                <SelectField
                  value={employeeForm.employeeRoleId}
                  onChange={(v) => setEmployeeForm((f) => ({ ...f, employeeRoleId: v }))}
                >
                  <option value="" disabled>
                    {roles.length === 0 ? "Créez d'abord un profil ci-dessus" : "Choisir un profil"}
                  </option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </SelectField>
              </div>
              <button
                className="ft-primary-btn"
                onClick={handleCreateEmployee}
                disabled={employeeSaving || !employeeForm.name || !employeeForm.email || !employeeForm.employeeRoleId}
                style={primaryBtn(employeeSaving || !employeeForm.name || !employeeForm.email || !employeeForm.employeeRoleId)}
              >
                {employeeSaving ? "Création…" : "Créer l'employé"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SelectField({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ position: "relative", flex: "none", width: 160 }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          height: 36,
          padding: "0 30px 0 10px",
          border: `1.5px solid ${colors.borderField}`,
          borderRadius: 8,
          font: `400 12.5px ${fonts.ui}`,
          appearance: "none",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        {children}
      </select>
      <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
        <Icon path={ICONS.chevronDown} size={14} stroke={colors.muted} strokeWidth={2} />
      </span>
    </div>
  );
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    height: 48,
    border: "none",
    borderRadius: 10,
    background: colors.accent,
    color: "#fff",
    font: `700 15px ${fonts.ui}`,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    flex: 1,
  };
}

const sectionTitle: React.CSSProperties = { font: `700 17px ${fonts.display}`, marginBottom: 12 };
const card: React.CSSProperties = { background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, overflow: "hidden" };
const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "11px 18px", borderBottom: `1px solid ${colors.faintLine}` };
const fieldLabel: React.CSSProperties = { display: "block", font: `600 12.5px ${fonts.ui}`, marginBottom: 6 };
const textField: React.CSSProperties = { width: "100%", height: 44, padding: "0 13px", border: `1.5px solid ${colors.borderField}`, borderRadius: 10, font: `400 14px ${fonts.ui}` };
const ghostBtn: React.CSSProperties = {
  height: 30,
  padding: "0 11px",
  border: `1.5px solid ${colors.borderField}`,
  borderRadius: 8,
  background: "#fff",
  font: `600 12px ${fonts.ui}`,
  color: colors.muted,
  cursor: "pointer",
  flex: "none",
};
```

- [ ] **Step 2: Implémenter `app/(dashboard)/equipe/page.tsx`**

```tsx
import { getEmployeeRoles, getEmployees } from "@/lib/data/team.server";
import { EquipeScreen } from "@/components/dashboard/screens/EquipeScreen";

export default async function EquipePage() {
  const [roles, employees] = await Promise.all([getEmployeeRoles(), getEmployees()]);
  return <EquipeScreen roles={roles} employees={employees} />;
}
```

(Pas de garde d'accès dans cette page — `proxy.ts`, déjà modifié en Task 4, est le seul point d'application de la règle « `/equipe` réservé à `owner` », convention déjà suivie par toutes les autres pages du dashboard, ex. `app/(dashboard)/boutique/page.tsx`.)

- [ ] **Step 3: Run typecheck et tests**

Run: `npm run typecheck && npm run test`
Expected: propre, tous les tests verts.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/screens/EquipeScreen.tsx "app/(dashboard)/equipe/page.tsx"
git commit -m "feat(team): Équipe screen — access profiles and employee management"
```

---

### Task 11: Vérification finale

**Files:** aucun (vérification uniquement).

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: rien — dernière tâche.

- [ ] **Step 1: Suite complète**

Run: `npm run typecheck && npm run test && npm run lint`
Expected: tout vert, zéro erreur.

- [ ] **Step 2: Build (webpack — Turbopack cassé par le nom du dossier parent)**

Run: `npx next build --webpack`
Expected: build réussi, aucune nouvelle erreur.

- [ ] **Step 3: Advisories Supabase**

Run `mcp__supabase__get_advisors` (type `security`) une dernière fois : aucune advisory nouvelle liée à `EmployeeRole`/`Profile` par rapport à l'état constaté en Task 1.

- [ ] **Step 4: Checklist de QA manuelle (remplace l'E2E Playwright, absent de ce repo)**

Prérequis : `SUPABASE_SERVICE_ROLE_KEY` doit être renseignée dans `.env` local (Task 5) — sans elle, `createEmployee` échouera à l'étape « créer un compte Supabase Auth ».

1. Se connecter en tant que `owner` (`/admin/equipe`) — l'entrée « Équipe » doit apparaître dans la sidebar.
2. Créer un profil « Caissier » avec uniquement les modules « Point de vente » et « Commandes ». Vérifier qu'il apparaît dans la liste avec « 0 employé ».
3. Créer une employée « Awa Test » (email de test, mot de passe ≥ 8 caractères) avec le profil « Caissier ». Vérifier le toast de succès et son apparition dans la liste « Employés ».
4. Tenter de supprimer le profil « Caissier » → doit être refusé (« Réassignez d'abord… »).
5. Se déconnecter, se reconnecter avec le compte Awa (email + mot de passe créés à l'étape 3).
6. Vérifier que la sidebar n'affiche que « Point de vente » et « Commandes » (pas Finance, Marketing, Équipe, etc.).
7. Naviguer directement vers `/admin/finance` (URL tapée à la main) → doit rediriger, pas d'accès.
8. Naviguer directement vers `/admin/equipe` → doit rediriger (owner uniquement), même si Awa avait eu accès à un module par erreur.
9. Se reconnecter en `owner`, désactiver Awa (bouton « Désactiver »). Tenter de se reconnecter avec le compte Awa → doit échouer (session traitée comme inexistante, `active = false`).
10. Réactiver Awa, la réassigner à un nouveau profil « Gérant » (créé avec tous les modules) via le sélecteur inline de la liste « Employés ». Se reconnecter avec Awa → tous les modules doivent apparaître.

- [ ] **Step 5: Nettoyage des données de test**

Une fois la checklist validée, supprimer le compte « Awa Test » créé pour la QA (Supabase dashboard > Authentication, ou `mcp__supabase__execute_sql` en lecture seule pour vérifier son id puis suppression via le dashboard — ne pas utiliser `execute_sql` pour un `DELETE`, réservé aux migrations DDL via `apply_migration`) afin de ne pas polluer les données réelles de la boutique.
