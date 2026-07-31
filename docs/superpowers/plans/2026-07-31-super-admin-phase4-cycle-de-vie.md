# Phase 4 — Cycle de vie des boutiques & support prestataire · Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au prestataire le contrôle complet du cycle de vie d'une boutique — suspendre, réactiver, archiver, supprimer définitivement — avec application réelle de ces états sur la vitrine, le back-office et la connexion, plus les outils de support (diagnostic, réinitialisation du mot de passe de la gérante, export JSON).

**Architecture :** `Tenant.status` existe déjà en base depuis la phase 1 mais **n'est lu nulle part**. Le cœur de cette phase est donc de le faire remonter du registry en cache jusqu'aux trois surfaces qui doivent l'honorer (vitrine, dashboard, `/connexion`), conformément au spec §2 qui interdit de mettre la base sur le chemin edge de `proxy.ts`. Les mutations d'état sont des Server Actions gardées `super_admin`, tracées dans `PlatformAuditLog` et invalidant l'étiquette de cache des tenants. La suppression définitive est une transaction Prisma à ordre explicite (aucune FK n'est en `CASCADE` — vérifié en base le 2026-07-31).

**Tech Stack :** Next.js 16.2 (App Router, Server Components, Server Actions), React 19.2, TypeScript strict, Prisma 7.8 sur Supabase Postgres, Zod 4, Vitest 4.

---

## Global Constraints

Ces contraintes s'appliquent implicitement à **toutes** les tâches. Elles ont chacune coûté du temps dans une phase précédente.

- **TypeScript `strict`, jamais de `any`** (préférer `unknown` + narrowing). `CLAUDE.md` §8.
- **Le fichier de proxy s'appelle `proxy.ts`**, jamais `middleware.ts` (convention Next 16). Ne jamais y ajouter d'option `runtime` : elle est interdite et lève. `proxy.ts` tourne **toujours en runtime Node.js** — Prisma et `node:crypto` y sont utilisables.
- **`unstable_cache`, pas `use cache`.** `cacheTag()` lève sans `cacheComponents: true` dans `next.config.ts`, drapeau que ce projet n'active pas.
- **Depuis une Server Action, invalider avec `updateTag(tag)`** (un seul argument), pas `revalidateTag` (qui exige 2 arguments dans cette version).
- **Toute mutation de boutique doit appeler `updateTag(TENANTS_CACHE_TAG)`.** Sans cela, la suspension ne prend effet qu'après le plancher `revalidate: 300` du registry — jusqu'à 5 minutes de vitrine en ligne pour une boutique suspendue.
- **Aucune migration Prisma dans cette phase.** Vérifié en base le 2026-07-31 : les 15 valeurs de `PlatformAction` existent déjà (`tenant_suspended`, `tenant_reactivated`, `tenant_archived`, `tenant_deleted`, `owner_password_reset`, `data_exported` comprises) et les colonnes `status`/`suspendedAt`/`suspendedReason`/`archivedAt` existent depuis la phase 1. **Si un implémenteur croit avoir besoin d'une migration, il doit S'ARRÊTER et demander** — `npx prisma migrate dev` est inutilisable dans ce projet (shadow database sans le schéma `auth` de Supabase), et une migration destructive exige une confirmation explicite de l'utilisateur (`CLAUDE.md` §12).
- **Prisma contourne la RLS.** Les Server Actions se connectent en propriétaire de table, sans JWT. La RLS est de la défense en profondeur ; **la garde réelle est `currentSuperAdmin()` en tête de chaque action**.
- **Tout nouveau fichier `"use server"` sous `lib/` doit être ajouté à `EXEMPT` dans `lib/impersonation/guard-coverage.test.ts`**, avec un commentaire justifiant l'exemption. Sinon ce test échoue. Les actions de la zone plateforme sont exemptées parce qu'elles sont déjà gardées par `currentSuperAdmin` — l'impersonation ne s'applique jamais à ce que le prestataire fait dans SA PROPRE zone.
- **Résultats typés `{ ok: true } | { ok: false; error: string }`**, messages en français, repli générique `« Une erreur est survenue, réessayez. »` (spec §11).
- **Langue** : copie produit et messages d'erreur en **français** ; code, identifiants, noms de fichiers et messages de commit en **anglais** (Conventional Commits).
- **`npm run lint` est cassé à l'échelle du dépôt** (`next lint` retiré dans Next 16), antérieur et sans rapport. Filets : `npm run typecheck` et `npx vitest run`.
- **Base de référence avant de commencer : 419 tests verts sur 45 fichiers, `npm run typecheck` propre.** Toute tâche doit laisser ces deux filets verts.
- **`npx prisma db execute --stdin` n'affiche jamais les lignes d'un `SELECT`.** Pour lire la base, utiliser un script `npx tsx --env-file=.env` avec le client Prisma généré.

---

## Les états et ce qu'ils signifient

Trois valeurs de `TenantStatus`, et pour chacune le comportement attendu **sur chaque surface**. Ce tableau est la référence de toutes les tâches d'application (5 à 8) et du parcours final (tâche 16).

| Surface | `active` | `suspended` | `archived` |
|---|---|---|---|
| Vitrine publique | normale | page « boutique temporairement indisponible » (200) | `notFound()` (404) |
| Layout dashboard | normal | écran bloquant + message | écran bloquant + message |
| `/connexion` zone dashboard | formulaire | message, pas de formulaire | message, pas de formulaire |
| Server Action `signIn` | connecte | refuse | refuse |
| `proxy.ts` | inchangé | **inchangé** (décision explicite, tâche 8) | **inchangé** |
| Liste du parc (prestataire) | listée | listée, badge « Suspendue » | **masquée par défaut**, visible via le filtre |
| Fiche boutique (prestataire) | accessible | accessible | accessible |
| « Entrer dans la boutique » | autorisé | refusé | refusé |

**Le piège à ne jamais rouvrir :** l'écran bloquant du dashboard doit **continuer d'afficher le bandeau d'impersonation** quand une impersonation est active. Sinon, suspendre une boutique pendant qu'un prestataire y est entré le laisse sans bouton « Quitter », enfermé jusqu'à l'expiration des 60 minutes — exactement le bug qui a coûté trois tours de correctifs en phase 3.

---

## File Structure

### Fichiers créés

| Fichier | Responsabilité |
|---|---|
| `lib/platform/transitions.ts` | Table des transitions du spec §9 + messages de refus. Pur, sans I/O. |
| `lib/platform/transitions.test.ts` | Couvre chaque case du tableau, y compris les refus. |
| `lib/platform/lifecycle.ts` | `"use server"` — `suspendTenant`, `reactivateTenant`, `archiveTenant`, `deleteTenant`. |
| `lib/platform/lifecycle.test.ts` | Tests des quatre actions. |
| `lib/platform/deletion.ts` | Ordre de suppression des lignes métier d'un tenant. Pur (reçoit un client de transaction). |
| `lib/platform/deletion.test.ts` | Vérifie l'ordre exact et l'exhaustivité. |
| `lib/platform/health.ts` | Diagnostic d'une boutique (spec §10). Lectures gardées `super_admin`. |
| `lib/platform/health.test.ts` | Tests du diagnostic. |
| `lib/platform/export.ts` | `"use server"` — export JSON complet d'une boutique, tracé `data_exported`. |
| `lib/platform/export.test.ts` | Tests de l'export. |
| `lib/platform/team.ts` | `"use server"` — `resetOwnerPassword`, `createTenantOwner`. |
| `lib/platform/team.test.ts` | Tests de l'équipe. |
| `components/storefront/StoreUnavailable.tsx` | Page « temporairement indisponible » de la vitrine. |
| `components/dashboard/TenantBlockedNotice.tsx` | Écran bloquant du dashboard et de `/connexion`. |
| `components/platform/StatusBadge.tsx` | Pastille d'état, réutilisée liste + fiche. |
| `components/platform/screens/TenantOverviewTab.tsx` | Onglet « Vue d'ensemble » (diagnostic + état courant). |
| `components/platform/screens/TenantTeamTab.tsx` | Onglet « Équipe ». |
| `components/platform/screens/TenantDangerTab.tsx` | Onglet « Zone de danger ». |

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `lib/tenant/types.ts` | `Tenant` gagne `status: TenantStatus`. |
| `lib/tenant/registry.ts` | `select` gagne `status` ; `toTenant` le recopie. |
| `lib/tenant/registry.test.ts` | Fixtures mises à jour + test de remontée du statut. |
| `lib/tenant/index.ts` | Ajout de `requireActiveStorefrontTenant()`. |
| `app/(storefront)/layout.tsx` | Branche `suspended` → `StoreUnavailable` ; `archived` → `notFound()`. |
| `app/(storefront)/page.tsx`, `catalogue/page.tsx`, `compte/page.tsx`, `confirmation/page.tsx`, `produit/[id]/page.tsx` | Garde partagée `requireActiveStorefrontTenant()`. |
| `app/(dashboard)/layout.tsx` | Branche bloquante, bandeau d'impersonation préservé. |
| `app/(auth)/connexion/page.tsx` | Zone dashboard + boutique non active → message. |
| `lib/auth/actions.ts` | `signIn` refuse sur boutique non active. |
| `proxy.ts` | Commentaire de décision explicite (aucun contrôle de statut ici). |
| `proxy.test.ts` | Test de non-régression sur cette décision. |
| `lib/platform/queries.ts` | `listTenants({ includeArchived })` ; `getTenantBySlug` remonte `suspendedAt`/`suspendedReason`/`archivedAt`. |
| `lib/platform/queries.test.ts` | Tests correspondants. |
| `lib/impersonation/actions.ts` | `startImpersonation` refuse une boutique non active. |
| `lib/impersonation/actions.test.ts` | Test du refus. |
| `lib/impersonation/guard-coverage.test.ts` | Entrées `EXEMPT` pour `platform/lifecycle.ts`, `platform/export.ts`, `platform/team.ts`. |
| `lib/validators/platform.ts` | `suspendTenantSchema`, `deleteTenantSchema`, `resetPasswordSchema`, `createOwnerSchema`. |
| `lib/validators/platform.test.ts` | Tests des nouveaux schémas. |
| `components/platform/screens/TenantDetailScreen.tsx` | Onglets `apercu`, `equipe`, `danger` deviennent disponibles ; badge d'état dans l'en-tête. |
| `components/platform/screens/TenantListScreen.tsx` | Badge d'état + bascule « Afficher les archivées ». |
| `app/(admin)/(console)/boutiques/[slug]/page.tsx` | Routage des six onglets. |
| `app/(admin)/(console)/boutiques/page.tsx` | Passage du filtre d'archivage. |
| `components/platform/EnterTenantButton.tsx` | Désactivé si la boutique n'est pas active. |

---

### Task 1: `Tenant.status` remonte jusqu'aux layouts

Fondation de toute la phase. `Tenant.status` existe en base depuis la phase 1 mais le type `Tenant` du registry ne le porte pas, donc aucun layout ne peut le lire. **`lib/auth/session.ts` lit `Tenant` via PostgREST sous le JWT de l'utilisateur, et seule la colonne `enabledModules` y est concédée à `authenticated`** (migration `20260726155246`, vérifié en base le 2026-07-31) : lire `status` par cette voie renverrait du vide silencieux. Le statut doit donc passer **exclusivement** par le registry Prisma en cache.

**Files:**
- Modify: `lib/tenant/types.ts`
- Modify: `lib/tenant/registry.ts:9-31` et `:41-50`
- Test: `lib/tenant/registry.test.ts`

**Interfaces:**
- Consumes: rien (première tâche).
- Produces: `Tenant.status: TenantStatus` où `TenantStatus` est importé de `@/lib/generated/prisma/enums` et vaut `"active" | "suspended" | "archived"`. Toutes les tâches 5 à 8 en dépendent.

- [ ] **Step 1: Write the failing test**

Ajouter à la fin de `lib/tenant/registry.test.ts` :

```ts
describe("statut de la boutique", () => {
  it("remonte le statut de la boutique résolue", async () => {
    findMany.mockResolvedValue(ROWS);
    const tenant = await resolveTenantFromHost("localhost");
    expect(tenant?.status).toBe("active");
  });

  it("remonte un statut suspendu sans masquer la boutique — c'est aux layouts de décider", async () => {
    findMany.mockResolvedValue([{ ...ROWS[0], status: "suspended" }]);
    const tenant = await resolveTenantFromHost("localhost");
    expect(tenant).not.toBeNull();
    expect(tenant?.status).toBe("suspended");
  });
});
```

Et ajouter `status: "active",` à **chaque** objet du tableau `ROWS` en tête du fichier (il en contient plusieurs — les parcourir tous, sinon le premier test échoue sur `undefined`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/tenant/registry.test.ts`
Expected: FAIL — `expected undefined to be 'active'`.

- [ ] **Step 3: Write minimal implementation**

Dans `lib/tenant/types.ts`, ajouter l'import et le champ :

```ts
import type { TenantStatus } from "@/lib/generated/prisma/enums";

export interface Tenant {
  id: string;
  /** Sous-domaine canonique (ex. "foulard-teranga" → foulard-teranga.plateforme.app). */
  slug: string;
  name: string;
  /**
   * Cycle de vie (spec §9). Porté ici et non dans la session : `lib/auth/session.ts`
   * lit `Tenant` via PostgREST sous le JWT de l'utilisateur, et seul `enabledModules`
   * y est concédé à `authenticated` (migration 20260726155246) — `status` y serait
   * silencieusement vide. Le registry Prisma est la seule voie de lecture.
   */
  status: TenantStatus;
  theme: ThemeTokens;
  /** Hôtes additionnels mappés à ce tenant (domaines custom, alias locaux). */
  domains: string[];
}
```

Dans `lib/tenant/registry.ts`, ajouter `status` à l'interface `TenantRow`, au `select` et à `toTenant` :

```ts
import type { TenantStatus } from "@/lib/generated/prisma/enums";

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  primaryColor: string;
  accentColor: string;
  logoText: string;
  domains: string[];
}

function toTenant(row: TenantRow): Tenant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    theme: {
      primaryColor: row.primaryColor,
      accentColor: row.accentColor,
      logoText: row.logoText,
    },
    domains: row.domains,
  };
}
```

Et dans le `select` de `loadTenants` : ajouter `status: true,` après `name: true,`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run lib/tenant/registry.test.ts && npm run typecheck`
Expected: tests PASS, typecheck sans sortie d'erreur.

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: 421 passed (419 de base + 2 nouveaux), 45 files.

- [ ] **Step 6: Commit**

```bash
git add lib/tenant/types.ts lib/tenant/registry.ts lib/tenant/registry.test.ts
git commit -m "feat(lifecycle): carry Tenant.status through the cached registry"
```

---

### Task 2: Table des transitions du spec §9

Fonction pure, sans I/O, qui encode le tableau du spec §9 et ses refus. Isolée pour être testable exhaustivement sans mocker la base.

**Files:**
- Create: `lib/platform/transitions.ts`
- Test: `lib/platform/transitions.test.ts`

**Interfaces:**
- Consumes: `TenantStatus` de `@/lib/generated/prisma/enums`.
- Produces:
  - `type LifecycleTarget = TenantStatus | "deleted"`
  - `canTransition(from: TenantStatus, to: LifecycleTarget): boolean`
  - `transitionRefusal(from: TenantStatus, to: LifecycleTarget): string | null` — message français, ou `null` si la transition est autorisée.
  - `STATUS_LABELS: Record<TenantStatus, string>`

- [ ] **Step 1: Write the failing test**

Créer `lib/platform/transitions.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { canTransition, transitionRefusal, STATUS_LABELS } from "@/lib/platform/transitions";

describe("canTransition — tableau du spec §9", () => {
  it("autorise active → suspended", () => {
    expect(canTransition("active", "suspended")).toBe(true);
  });

  it("autorise suspended → active", () => {
    expect(canTransition("suspended", "active")).toBe(true);
  });

  it("autorise active → archived", () => {
    expect(canTransition("active", "archived")).toBe(true);
  });

  it("autorise suspended → archived", () => {
    expect(canTransition("suspended", "archived")).toBe(true);
  });

  it("autorise archived → active", () => {
    expect(canTransition("archived", "active")).toBe(true);
  });

  it("autorise archived → deleted", () => {
    expect(canTransition("archived", "deleted")).toBe(true);
  });

  it("REFUSE active → deleted : il faut archiver d'abord", () => {
    expect(canTransition("active", "deleted")).toBe(false);
  });

  it("REFUSE suspended → deleted : il faut archiver d'abord", () => {
    expect(canTransition("suspended", "deleted")).toBe(false);
  });

  it("refuse archived → suspended : absent du tableau du spec §9", () => {
    expect(canTransition("archived", "suspended")).toBe(false);
  });

  it("refuse une transition vers l'état courant", () => {
    expect(canTransition("active", "active")).toBe(false);
    expect(canTransition("suspended", "suspended")).toBe(false);
    expect(canTransition("archived", "archived")).toBe(false);
  });
});

describe("transitionRefusal", () => {
  it("renvoie null quand la transition est autorisée", () => {
    expect(transitionRefusal("archived", "deleted")).toBeNull();
  });

  it("explique qu'il faut archiver avant de supprimer", () => {
    expect(transitionRefusal("active", "deleted")).toBe(
      "Seule une boutique archivée peut être supprimée définitivement. Archivez-la d'abord."
    );
    expect(transitionRefusal("suspended", "deleted")).toBe(
      "Seule une boutique archivée peut être supprimée définitivement. Archivez-la d'abord."
    );
  });

  it("explique un changement d'état impossible sans laisser un message technique", () => {
    expect(transitionRefusal("archived", "suspended")).toBe(
      "Cette boutique est archivée : réactivez-la avant de la suspendre."
    );
  });

  it("explique une transition vers l'état courant", () => {
    expect(transitionRefusal("active", "active")).toBe("Cette boutique est déjà active.");
  });
});

describe("STATUS_LABELS", () => {
  it("nomme les trois états en français", () => {
    expect(STATUS_LABELS.active).toBe("Active");
    expect(STATUS_LABELS.suspended).toBe("Suspendue");
    expect(STATUS_LABELS.archived).toBe("Archivée");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/platform/transitions.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/platform/transitions"`.

- [ ] **Step 3: Write minimal implementation**

Créer `lib/platform/transitions.ts` :

```ts
import type { TenantStatus } from "@/lib/generated/prisma/enums";

/** Cible d'une transition : un statut, ou la suppression définitive (qui n'est pas un statut). */
export type LifecycleTarget = TenantStatus | "deleted";

export const STATUS_LABELS: Record<TenantStatus, string> = {
  active: "Active",
  suspended: "Suspendue",
  archived: "Archivée",
};

/**
 * Tableau des transitions autorisées du spec §9, encodé littéralement. Ce qui
 * n'y figure pas est refusé — y compris `archived → suspended`, absent du spec,
 * et toute transition vers l'état courant.
 */
const ALLOWED: Record<TenantStatus, LifecycleTarget[]> = {
  active: ["suspended", "archived"],
  suspended: ["active", "archived"],
  archived: ["active", "deleted"],
};

export function canTransition(from: TenantStatus, to: LifecycleTarget): boolean {
  return ALLOWED[from].includes(to);
}

/**
 * Message expliquant pourquoi une transition est refusée, ou `null` si elle est
 * autorisée. Spec §11 : jamais un échec muet ni un message technique.
 */
export function transitionRefusal(from: TenantStatus, to: LifecycleTarget): string | null {
  if (canTransition(from, to)) return null;

  if (to === "deleted") {
    return "Seule une boutique archivée peut être supprimée définitivement. Archivez-la d'abord.";
  }
  if (from === to) {
    return `Cette boutique est déjà ${STATUS_LABELS[from].toLowerCase()}.`;
  }
  if (from === "archived") {
    return "Cette boutique est archivée : réactivez-la avant de la suspendre.";
  }
  return "Ce changement d'état n'est pas autorisé.";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/platform/transitions.test.ts`
Expected: PASS — 15 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/platform/transitions.ts lib/platform/transitions.test.ts
git commit -m "feat(lifecycle): encode the spec §9 transition table with its refusals"
```

---

### Task 3: Schémas Zod du cycle de vie

**Files:**
- Modify: `lib/validators/platform.ts` (ajout en fin de fichier)
- Test: `lib/validators/platform.test.ts` (ajout en fin de fichier)

**Interfaces:**
- Consumes: `z` de `zod` (déjà importé dans le fichier).
- Produces:
  - `suspendTenantSchema` → `{ reason: string }`, type `SuspendTenantInput`
  - `deleteTenantSchema` → `{ confirmSlug: string }`, type `DeleteTenantInput`
  - `resetOwnerPasswordSchema` → `{ password: string }`, type `ResetOwnerPasswordInput`
  - `createOwnerSchema` → `{ name: string; email: string; password: string }`, type `CreateOwnerInput`

- [ ] **Step 1: Write the failing test**

Ajouter à la fin de `lib/validators/platform.test.ts` :

```ts
describe("suspendTenantSchema", () => {
  it("accepte un motif renseigné", () => {
    const result = suspendTenantSchema.safeParse({ reason: "Impayé depuis 2 mois" });
    expect(result.success).toBe(true);
  });

  it("accepte un motif vide — la suspension ne doit jamais être bloquée par la paperasse", () => {
    const result = suspendTenantSchema.safeParse({ reason: "" });
    expect(result.success).toBe(true);
  });

  it("refuse un motif trop long", () => {
    const result = suspendTenantSchema.safeParse({ reason: "x".repeat(281) });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe("280 caractères maximum.");
  });
});

describe("deleteTenantSchema", () => {
  it("accepte un slug de confirmation", () => {
    expect(deleteTenantSchema.safeParse({ confirmSlug: "foulard-teranga" }).success).toBe(true);
  });

  it("refuse une confirmation vide", () => {
    const result = deleteTenantSchema.safeParse({ confirmSlug: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Retapez le slug de la boutique pour confirmer.");
    }
  });
});

describe("resetOwnerPasswordSchema", () => {
  it("exige 8 caractères minimum, comme createTenantSchema", () => {
    expect(resetOwnerPasswordSchema.safeParse({ password: "1234567" }).success).toBe(false);
    expect(resetOwnerPasswordSchema.safeParse({ password: "12345678" }).success).toBe(true);
  });
});

describe("createOwnerSchema", () => {
  it("accepte une gérante complète", () => {
    const result = createOwnerSchema.safeParse({
      name: "Aïssatou Diallo",
      email: "aissatou@example.com",
      password: "motdepasse1",
    });
    expect(result.success).toBe(true);
  });

  it("refuse une adresse email invalide", () => {
    const result = createOwnerSchema.safeParse({ name: "Aya", email: "pas-un-email", password: "motdepasse1" });
    expect(result.success).toBe(false);
  });
});
```

Ajouter les quatre schémas à la ligne d'import existante en tête du fichier de test (elle importe déjà depuis `@/lib/validators/platform`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/validators/platform.test.ts`
Expected: FAIL — `suspendTenantSchema is not defined` (ou une erreur d'import).

- [ ] **Step 3: Write minimal implementation**

Ajouter à la fin de `lib/validators/platform.ts` :

```ts
/**
 * Motif de suspension (spec §9). Optionnel par conception : la gérante doit
 * pouvoir être coupée immédiatement, la justification peut suivre. Stocké dans
 * `Tenant.suspendedReason` et recopié dans `metadata` de l'entrée d'audit.
 */
export const suspendTenantSchema = z.object({
  reason: z.string().trim().max(280, "280 caractères maximum.").default(""),
});
export type SuspendTenantInput = z.infer<typeof suspendTenantSchema>;

/**
 * Confirmation de la suppression définitive (spec §9) : l'opérateur retape le
 * slug. La comparaison au slug réel se fait dans l'action, pas ici — le schéma
 * ne connaît pas la boutique visée.
 */
export const deleteTenantSchema = z.object({
  confirmSlug: z.string().trim().min(1, "Retapez le slug de la boutique pour confirmer."),
});
export type DeleteTenantInput = z.infer<typeof deleteTenantSchema>;

/** Même plancher que `createTenantSchema.ownerPassword` : 8 caractères. */
export const resetOwnerPasswordSchema = z.object({
  password: z.string().min(8, "8 caractères minimum."),
});
export type ResetOwnerPasswordInput = z.infer<typeof resetOwnerPasswordSchema>;

/** Rattachement d'une gérante à une boutique qui n'en a pas (spec §6, onglet Équipe). */
export const createOwnerSchema = z.object({
  name: z.string().trim().min(2, "Le nom de la gérante est requis."),
  email: z.string().trim().email("Adresse email invalide."),
  password: z.string().min(8, "8 caractères minimum."),
});
export type CreateOwnerInput = z.infer<typeof createOwnerSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/validators/platform.test.ts && npm run typecheck`
Expected: PASS, typecheck propre.

- [ ] **Step 5: Commit**

```bash
git add lib/validators/platform.ts lib/validators/platform.test.ts
git commit -m "feat(lifecycle): add Zod schemas for suspension, deletion and owner support"
```

---

### Task 4: Server Actions suspendre / réactiver / archiver

Trois mutations d'état, sur le modèle exact de `updateTenantModules` (`lib/platform/actions.ts:248-300`) : garde `currentSuperAdmin`, validation Zod, lecture de l'état courant, contrôle de transition, transaction Prisma incluant l'entrée d'audit, puis `updateTag` + `revalidatePath` **hors du `try`**.

La suppression définitive n'est **pas** dans cette tâche : elle est isolée en tâche 15 parce qu'elle est destructive et exige une confirmation explicite de l'utilisateur.

**Files:**
- Create: `lib/platform/lifecycle.ts`
- Test: `lib/platform/lifecycle.test.ts`
- Modify: `lib/impersonation/guard-coverage.test.ts` (entrée `EXEMPT`)

**Interfaces:**
- Consumes: `canTransition`/`transitionRefusal` (tâche 2), `suspendTenantSchema` (tâche 3), `currentSuperAdmin` de `./guard`, `recordPlatformAction` de `./audit`, `TENANTS_CACHE_TAG` de `@/lib/tenant`.
- Produces:
  - `suspendTenant(tenantId: string, input: SuspendTenantInput): Promise<PlatformResult>`
  - `reactivateTenant(tenantId: string): Promise<PlatformResult>`
  - `archiveTenant(tenantId: string): Promise<PlatformResult>`
  - `PlatformResult` est **redéclaré localement** dans `lifecycle.ts` (`{ ok: true } | { ok: false; error: string }`), identique à celui de `actions.ts`. L'importer depuis `actions.ts` créerait une dépendance entre deux fichiers `"use server"` sans aucun gain : le type fait une ligne et n'a pas d'invariant à partager.

- [ ] **Step 1: Write the failing test**

Créer `lib/platform/lifecycle.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const authState = vi.hoisted(() => ({ role: "owner" as "owner" | "super_admin" }));

const dbState = vi.hoisted(() => ({
  tenant: null as null | { id: string; slug: string; name: string; status: string },
  calls: {
    tenantUpdate: [] as Array<Record<string, unknown>>,
    auditCreate: [] as Array<Record<string, unknown>>,
  },
}));

vi.mock("@/lib/impersonation/context", () => ({
  getActorContext: async () =>
    authState.role === "super_admin"
      ? {
          actor: { userId: "admin-1", name: "Admin Plateforme", role: "super_admin" },
          effective: { tenantId: null, role: "super_admin", permissions: [] },
          impersonation: null,
        }
      : {
          actor: { userId: "u1", name: "Aya", role: "owner" },
          effective: { tenantId: "t1", role: "owner", permissions: [] },
          impersonation: null,
        },
}));

vi.mock("@/lib/db/client", () => {
  const tx = {
    tenant: {
      update: async (args: Record<string, unknown>) => {
        dbState.calls.tenantUpdate.push(args);
        return {};
      },
    },
    platformAuditLog: {
      create: async (args: Record<string, unknown>) => {
        dbState.calls.auditCreate.push(args);
        return {};
      },
    },
  };
  return {
    prisma: {
      tenant: {
        findUnique: async () => dbState.tenant,
        update: tx.tenant.update,
      },
      platformAuditLog: tx.platformAuditLog,
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});

const updateTag = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ updateTag, revalidatePath }));

const { suspendTenant, reactivateTenant, archiveTenant } = await import("@/lib/platform/lifecycle");

beforeEach(() => {
  authState.role = "super_admin";
  dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "active" };
  dbState.calls.tenantUpdate = [];
  dbState.calls.auditCreate = [];
  updateTag.mockClear();
  revalidatePath.mockClear();
});

describe("suspendTenant", () => {
  it("refuse un appelant qui n'est pas super_admin, sans toucher la base", async () => {
    authState.role = "owner";
    const result = await suspendTenant("t1", { reason: "" });
    expect(result).toEqual({ ok: false, error: "Une erreur est survenue, réessayez." });
    expect(dbState.calls.tenantUpdate).toHaveLength(0);
  });

  it("passe la boutique en suspended avec la date et le motif", async () => {
    const result = await suspendTenant("t1", { reason: "Impayé" });
    expect(result).toEqual({ ok: true });
    const data = dbState.calls.tenantUpdate[0].data as Record<string, unknown>;
    expect(data.status).toBe("suspended");
    expect(data.suspendedReason).toBe("Impayé");
    expect(data.suspendedAt).toBeInstanceOf(Date);
  });

  it("trace tenant_suspended avec l'acteur réel et le motif", async () => {
    await suspendTenant("t1", { reason: "Impayé" });
    const data = dbState.calls.auditCreate[0].data as Record<string, unknown>;
    expect(data.action).toBe("tenant_suspended");
    expect(data.actorId).toBe("admin-1");
    expect(data.tenantId).toBe("t1");
    expect(data.metadata).toMatchObject({ reason: "Impayé", slug: "boutique-test" });
  });

  it("invalide l'étiquette de cache des tenants — sinon la vitrine reste en ligne 5 minutes", async () => {
    await suspendTenant("t1", { reason: "" });
    expect(updateTag).toHaveBeenCalledWith("tenants");
  });

  it("refuse de suspendre une boutique archivée, avec le message du spec §9", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "archived" };
    const result = await suspendTenant("t1", { reason: "" });
    expect(result).toEqual({
      ok: false,
      error: "Cette boutique est archivée : réactivez-la avant de la suspendre.",
    });
    expect(dbState.calls.tenantUpdate).toHaveLength(0);
  });

  it("renvoie « Boutique introuvable. » si l'id ne correspond à rien", async () => {
    dbState.tenant = null;
    const result = await suspendTenant("inconnu", { reason: "" });
    expect(result).toEqual({ ok: false, error: "Boutique introuvable." });
  });
});

describe("reactivateTenant", () => {
  it("remet une boutique suspendue en active et efface le motif", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "suspended" };
    const result = await reactivateTenant("t1");
    expect(result).toEqual({ ok: true });
    const data = dbState.calls.tenantUpdate[0].data as Record<string, unknown>;
    expect(data.status).toBe("active");
    expect(data.suspendedAt).toBeNull();
    expect(data.suspendedReason).toBeNull();
    expect(data.archivedAt).toBeNull();
  });

  it("réactive aussi une boutique archivée (spec §9 : archived → active)", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "archived" };
    const result = await reactivateTenant("t1");
    expect(result).toEqual({ ok: true });
    expect(dbState.calls.auditCreate[0].data).toMatchObject({ action: "tenant_reactivated" });
  });

  it("refuse de réactiver une boutique déjà active", async () => {
    const result = await reactivateTenant("t1");
    expect(result).toEqual({ ok: false, error: "Cette boutique est déjà active." });
  });
});

describe("archiveTenant", () => {
  it("archive une boutique active et pose archivedAt", async () => {
    const result = await archiveTenant("t1");
    expect(result).toEqual({ ok: true });
    const data = dbState.calls.tenantUpdate[0].data as Record<string, unknown>;
    expect(data.status).toBe("archived");
    expect(data.archivedAt).toBeInstanceOf(Date);
    expect(dbState.calls.auditCreate[0].data).toMatchObject({ action: "tenant_archived" });
  });

  it("archive aussi une boutique suspendue (spec §9)", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "suspended" };
    expect(await archiveTenant("t1")).toEqual({ ok: true });
  });

  it("refuse d'archiver une boutique déjà archivée", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "archived" };
    const result = await archiveTenant("t1");
    expect(result).toEqual({ ok: false, error: "Cette boutique est déjà archivée." });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/platform/lifecycle.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/platform/lifecycle"`.

- [ ] **Step 3: Write minimal implementation**

Créer `lib/platform/lifecycle.ts` :

```ts
"use server";

import { revalidatePath, updateTag } from "next/cache";
import { prisma } from "@/lib/db/client";
import { TENANTS_CACHE_TAG } from "@/lib/tenant";
import { currentSuperAdmin } from "./guard";
import { recordPlatformAction } from "./audit";
import { transitionRefusal, type LifecycleTarget } from "./transitions";
import { suspendTenantSchema, type SuspendTenantInput } from "@/lib/validators/platform";
import type { PlatformAction, TenantStatus } from "@/lib/generated/prisma/enums";
import type { Prisma } from "@/lib/generated/prisma/client";

export type PlatformResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = "Une erreur est survenue, réessayez.";
const NOT_FOUND_ERROR = "Boutique introuvable.";

/**
 * Corps commun des trois transitions d'état. Chacune ne diffère que par sa
 * cible, les colonnes qu'elle écrit et son action d'audit — factoriser évite
 * que l'une d'elles oublie `updateTag` (sans quoi la vitrine d'une boutique
 * suspendue reste servie jusqu'à 5 minutes, plancher `revalidate` du registry).
 */
async function applyTransition(
  tenantId: string,
  target: Exclude<LifecycleTarget, "deleted">,
  action: PlatformAction,
  data: Prisma.TenantUpdateInput,
  metadata: Record<string, unknown>
): Promise<PlatformResult> {
  const actor = await currentSuperAdmin();
  if (!actor) return { ok: false, error: GENERIC_ERROR };

  let slug = "";
  try {
    const before = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true, name: true, status: true },
    });
    if (!before) return { ok: false, error: NOT_FOUND_ERROR };
    slug = before.slug;

    const refusal = transitionRefusal(before.status as TenantStatus, target);
    if (refusal) return { ok: false, error: refusal };

    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({ where: { id: tenantId }, data });
      await recordPlatformAction(
        {
          actorId: actor.userId,
          action,
          tenantId,
          metadata: { slug: before.slug, name: before.name, statusBefore: before.status, ...metadata },
        },
        tx
      );
    });
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  // Hors du try : un échec ici correspond à une écriture déjà réussie.
  updateTag(TENANTS_CACHE_TAG);
  revalidatePath("/boutiques");
  revalidatePath(`/boutiques/${slug}`);
  return { ok: true };
}

/** `active`/`suspended` → `suspended` (spec §9). Vitrine indisponible, back-office bloqué, données intactes. */
export async function suspendTenant(tenantId: string, input: SuspendTenantInput): Promise<PlatformResult> {
  const parsed = suspendTenantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Informations invalides." };
  }
  const reason = parsed.data.reason;
  return applyTransition(
    tenantId,
    "suspended",
    "tenant_suspended",
    { status: "suspended", suspendedAt: new Date(), suspendedReason: reason || null },
    { reason }
  );
}

/** `suspended`/`archived` → `active` (spec §9). Efface les trois marqueurs de sortie. */
export async function reactivateTenant(tenantId: string): Promise<PlatformResult> {
  return applyTransition(
    tenantId,
    "active",
    "tenant_reactivated",
    { status: "active", suspendedAt: null, suspendedReason: null, archivedAt: null },
    {}
  );
}

/** `active`/`suspended` → `archived` (spec §9). Sortie du parc, invisible sauf pour le prestataire. */
export async function archiveTenant(tenantId: string): Promise<PlatformResult> {
  return applyTransition(
    tenantId,
    "archived",
    "tenant_archived",
    { status: "archived", archivedAt: new Date() },
    {}
  );
}
```

- [ ] **Step 4: Ajouter l'exemption de couverture des gardes**

Dans `lib/impersonation/guard-coverage.test.ts`, ajouter à l'objet `EXEMPT` :

```ts
  // Actions de la zone plateforme, déjà gardées par `currentSuperAdmin` :
  // l'impersonation ne s'applique jamais à ce que le prestataire fait dans SA
  // PROPRE zone, seulement à ce qu'il fait une fois entré dans une boutique.
  "platform/lifecycle.ts": ["suspendTenant", "reactivateTenant", "archiveTenant"],
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/platform/lifecycle.test.ts lib/impersonation/guard-coverage.test.ts && npm run typecheck`
Expected: PASS des deux fichiers, typecheck propre.

- [ ] **Step 6: Commit**

```bash
git add lib/platform/lifecycle.ts lib/platform/lifecycle.test.ts lib/impersonation/guard-coverage.test.ts
git commit -m "feat(lifecycle): add suspend, reactivate and archive server actions"
```

---

### Task 5: Application vitrine — layout **et** pages

C'est ici que la leçon de la phase 3 mord le plus fort. Le layout vitrine ne suffit **pas** : les cinq pages de `app/(storefront)/` portent chacune leur propre garde `getCurrentTenantOrNull()` parce que Next.js **prérend les segments en parallèle** — leurs commentaires le documentent explicitement. Une garde posée uniquement dans le layout laisserait chaque page exécuter ses requêtes catalogue/commandes sur une boutique suspendue.

**Files:**
- Create: `components/storefront/StoreUnavailable.tsx`
- Modify: `lib/tenant/index.ts`
- Modify: `app/(storefront)/layout.tsx`
- Modify: `app/(storefront)/page.tsx`, `app/(storefront)/catalogue/page.tsx`, `app/(storefront)/compte/page.tsx`, `app/(storefront)/confirmation/page.tsx`, `app/(storefront)/produit/[id]/page.tsx`
- Test: `lib/tenant/access.test.ts` (nouveau)

**Interfaces:**
- Consumes: `Tenant.status` (tâche 1).
- Produces: `requireActiveStorefrontTenant(): Promise<Tenant>` exporté depuis `@/lib/tenant` — lève `notFound()` si le tenant est absent **ou** `archived`, et lève `notFound()` aussi si `suspended` (le layout, lui, rend la page dédiée avant que cela ne compte). Voir la note de comportement ci-dessous.

**Comportement à comprendre avant d'écrire le code :** quand le layout ne rend pas `{children}` (branche « suspendue »), le `notFound()` levé en parallèle par une page enfant est sans effet visible — le layout a déjà remplacé l'arbre. La garde des pages sert donc uniquement à **empêcher leurs requêtes de tourner**, pas à produire la réponse. La réponse visible d'une boutique suspendue est la page `StoreUnavailable` du layout ; celle d'une boutique archivée est un 404.

- [ ] **Step 1: Write the failing test**

Créer `lib/tenant/access.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const tenantState = vi.hoisted(() => ({
  current: null as null | { id: string; slug: string; name: string; status: string },
}));

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  })
);

vi.mock("next/navigation", () => ({ notFound }));

vi.mock("next/headers", () => ({
  headers: async () => new Map([["x-tenant-host", "localhost"]]),
}));

vi.mock("@/lib/tenant/registry", () => ({
  TENANTS_CACHE_TAG: "tenants",
  resolveTenantFromHost: async () => tenantState.current,
}));

const { requireActiveStorefrontTenant } = await import("@/lib/tenant");

beforeEach(() => {
  notFound.mockClear();
  tenantState.current = { id: "t1", slug: "boutique", name: "Boutique", status: "active" };
});

describe("requireActiveStorefrontTenant", () => {
  it("renvoie la boutique quand elle est active", async () => {
    const tenant = await requireActiveStorefrontTenant();
    expect(tenant.id).toBe("t1");
    expect(notFound).not.toHaveBeenCalled();
  });

  it("coupe le rendu quand aucune boutique ne correspond à l'hôte", async () => {
    tenantState.current = null;
    await expect(requireActiveStorefrontTenant()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("coupe le rendu — donc les requêtes de la page — quand la boutique est suspendue", async () => {
    tenantState.current = { id: "t1", slug: "boutique", name: "Boutique", status: "suspended" };
    await expect(requireActiveStorefrontTenant()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("coupe le rendu quand la boutique est archivée", async () => {
    tenantState.current = { id: "t1", slug: "boutique", name: "Boutique", status: "archived" };
    await expect(requireActiveStorefrontTenant()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/tenant/access.test.ts`
Expected: FAIL — `requireActiveStorefrontTenant is not a function`.

- [ ] **Step 3: Ajouter la garde partagée**

Dans `lib/tenant/index.ts`, ajouter l'import `notFound` et la fonction :

```ts
import { notFound } from "next/navigation";
```

```ts
/**
 * Garde des **pages** de la vitrine. Next.js prérend les segments en parallèle :
 * sans elle, une page continuerait d'exécuter ses requêtes catalogue/commandes
 * alors que le layout a déjà décidé de ne pas la rendre. Elle coupe donc le
 * rendu pour tout état non `active` — y compris `suspended`, dont la réponse
 * visible est produite par le layout (`StoreUnavailable`), pas ici.
 */
export async function requireActiveStorefrontTenant(): Promise<Tenant> {
  const tenant = await getCurrentTenantOrNull();
  if (!tenant || tenant.status !== "active") notFound();
  return tenant;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/tenant/access.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Créer la page « temporairement indisponible »**

Créer `components/storefront/StoreUnavailable.tsx` :

```tsx
/**
 * Réponse publique d'une boutique suspendue (spec §9). Volontairement sans
 * aucune variable CSS de thème : la boutique est coupée, ses couleurs ne sont
 * pas le sujet, et cet écran doit rester lisible même si le thème est cassé.
 * Le motif de suspension n'est JAMAIS affiché — c'est une information interne
 * entre le prestataire et la gérante, pas une information cliente.
 */
export function StoreUnavailable({ tenantName }: { tenantName: string }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
        textAlign: "center",
        background: "#FAF7F2",
        color: "#1E1B18",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>{tenantName} est temporairement indisponible</h1>
      <p style={{ fontSize: 15, color: "#6B6459", margin: 0, maxWidth: 420 }}>
        Cette boutique est momentanément fermée. Merci de revenir un peu plus tard.
      </p>
    </main>
  );
}
```

- [ ] **Step 6: Brancher le layout vitrine**

Remplacer le corps de `app/(storefront)/layout.tsx` (garder les imports existants, ajouter `StoreUnavailable`) :

```tsx
export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenantOrNull();
  // Un hôte qui ne correspond à aucune boutique ne doit pas afficher la
  // vitrine d'une cliente au hasard (spec §2). Une boutique archivée est
  // « sortie du parc, invisible partout sauf pour le prestataire » (spec §9) :
  // elle est donc indistinguable d'un hôte inconnu, d'où le même 404.
  if (!tenant || tenant.status === "archived") notFound();

  // Une boutique suspendue existe toujours et le dit (spec §9) : réponse 200
  // avec un message, pas un 404 qui laisserait croire à une erreur de domaine.
  if (tenant.status === "suspended") return <StoreUnavailable tenantName={tenant.name} />;

  const { phone } = await getTenantSettings();
  return (
    <div style={{ minHeight: "100vh", background: "#FAF7F2", color: "#1E1B18", display: "flex", flexDirection: "column" }}>
      <StoreOfflineBanner />
      <StoreHeader />
      <MobileMenu whatsappPhone={phone} />
      <main style={{ flex: 1 }}>{children}</main>
      <BottomTab />
      <StoreToast />
    </div>
  );
}
```

- [ ] **Step 7: Basculer les cinq pages sur la garde partagée**

Dans chacun de ces cinq fichiers, remplacer l'import et l'appel :

- `app/(storefront)/page.tsx`
- `app/(storefront)/catalogue/page.tsx`
- `app/(storefront)/compte/page.tsx`
- `app/(storefront)/confirmation/page.tsx`
- `app/(storefront)/produit/[id]/page.tsx`

Import :

```ts
import { requireActiveStorefrontTenant } from "@/lib/tenant";
```

Appel (remplace la ligne `if (!(await getCurrentTenantOrNull())) notFound();`) :

```ts
await requireActiveStorefrontTenant();
```

Retirer l'import `notFound` de `next/navigation` de ces cinq fichiers **s'il n'y est plus utilisé ailleurs** — `produit/[id]/page.tsx` l'utilise aussi pour un produit introuvable, l'y garder. `npm run typecheck` signale tout import devenu inutile.

- [ ] **Step 8: Run typecheck and full suite**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck propre, suite verte.

- [ ] **Step 9: Commit**

```bash
git add lib/tenant/index.ts lib/tenant/access.test.ts components/storefront/StoreUnavailable.tsx "app/(storefront)"
git commit -m "feat(lifecycle): enforce suspension and archival on the storefront"
```

---

### Task 6: Application dashboard — sans jamais enfermer un prestataire

**Files:**
- Create: `components/dashboard/TenantBlockedNotice.tsx`
- Modify: `app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `Tenant.status` (tâche 1), `ImpersonationBanner` et `BANNER_HEIGHT` (existants), `getActorContext` (existant).
- Produces: `TenantBlockedNotice({ tenantName, status }: { tenantName: string; status: "suspended" | "archived" })`.

**Invariant à ne pas casser :** si une impersonation est active, l'écran bloquant **doit** afficher le bandeau, donc le bouton « Quitter ». Sans cela, suspendre une boutique pendant qu'un prestataire y est entré l'enferme 60 minutes derrière un cookie `httpOnly`.

- [ ] **Step 1: Créer l'écran bloquant**

Créer `components/dashboard/TenantBlockedNotice.tsx` :

```tsx
/**
 * Écran servi au back-office d'une boutique suspendue ou archivée (spec §2).
 * Comme `StoreUnavailable`, il n'utilise aucune variable CSS de thème : la
 * boutique est coupée, et cet écran doit rester lisible quoi qu'il arrive.
 */
export function TenantBlockedNotice({
  tenantName,
  status,
}: {
  tenantName: string;
  status: "suspended" | "archived";
}) {
  const title =
    status === "suspended" ? `L'accès à ${tenantName} est suspendu` : `${tenantName} est archivée`;
  const body =
    status === "suspended"
      ? "Votre back-office est momentanément fermé. Contactez votre prestataire pour rétablir l'accès."
      : "Cette boutique a été archivée. Contactez votre prestataire pour la réactiver.";

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
        textAlign: "center",
        background: "#FAF7F2",
        color: "#1E1B18",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>{title}</h1>
      <p style={{ fontSize: 15, color: "#6B6459", margin: 0, maxWidth: 460 }}>{body}</p>
    </main>
  );
}
```

- [ ] **Step 2: Brancher le layout dashboard**

Dans `app/(dashboard)/layout.tsx`, ajouter les imports :

```ts
import { TenantBlockedNotice } from "@/components/dashboard/TenantBlockedNotice";
```

Puis insérer la branche bloquante **après** la résolution du tenant et **après** le `Promise.all` (le contexte d'acteur est nécessaire pour savoir s'il faut afficher le bandeau) :

```tsx
  const tenant = await getCurrentTenantOrNull();
  if (!tenant) notFound();

  const [session, pendingCount, notifications, actorContext] = await Promise.all([
    getSession(),
    getPendingOrdersCount(),
    getNotifications(),
    getActorContext(),
  ]);

  const impersonation = actorContext?.impersonation ?? null;
  const topOffset = impersonation ? BANNER_HEIGHT : 0;

  // Boutique suspendue ou archivée : accès bloqué (spec §2). Le bandeau
  // d'impersonation est rendu MALGRÉ le blocage, délibérément : sans lui, le
  // prestataire entré dans la boutique avant sa suspension perdrait le bouton
  // « Quitter » et resterait enfermé jusqu'à l'expiration des 60 minutes,
  // derrière un cookie httpOnly qu'il ne peut pas supprimer depuis l'interface.
  if (tenant.status !== "active") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {impersonation && (
          <ImpersonationBanner
            tenantName={tenant.name}
            targetName={session?.name ?? ""}
            mode={impersonation.mode}
            expiresAt={new Date(
              new Date(impersonation.startedAt).getTime() + IMPERSONATION_DURATION_MS
            ).toISOString()}
          />
        )}
        <TenantBlockedNotice tenantName={tenant.name} status={tenant.status} />
      </div>
    );
  }
```

Le reste du layout (le `return` existant) est inchangé.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: aucune sortie. Si TypeScript se plaint que `tenant.status` n'est pas assignable à `"suspended" | "archived"`, c'est que le narrowing `!== "active"` n'a pas été appliqué sur une union littérale — vérifier que la tâche 1 a bien typé `status: TenantStatus` et non `string`.

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: suite verte.

- [ ] **Step 5: Commit**

```bash
git add "components/dashboard/TenantBlockedNotice.tsx" "app/(dashboard)/layout.tsx"
git commit -m "feat(lifecycle): block the dashboard on suspended tenants, keeping the exit reachable"
```

---

### Task 7: Application sur `/connexion` dashboard **et** sur `signIn`

Le spec §2 exige que `/connexion` du dashboard soit bloquée aussi, « sinon la gérante se connecte pour atterrir sur un mur ». Bloquer la page seule ne suffit pas : la Server Action `signIn` est un point d'entrée indépendant, appelable sans passer par la page.

`app/(auth)/connexion/page.tsx` est **partagée** par les deux zones — Next.js refuse deux `page.tsx` sur le même chemin — et se distingue par l'en-tête `x-zone` posé par `proxy.ts`. Le blocage ne doit s'appliquer qu'à `zone !== "admin"` : la connexion plateforme du prestataire ne doit jamais dépendre de l'état d'une boutique.

**Files:**
- Modify: `app/(auth)/connexion/page.tsx`
- Modify: `lib/auth/actions.ts` (fonction `signIn`)
- Test: `lib/auth/actions.test.ts` (créer si absent — vérifier avec `ls lib/auth/`)

**Interfaces:**
- Consumes: `getCurrentTenantOrNull` (existant), `Tenant.status` (tâche 1).
- Produces: `signIn` refuse avec le message `"L'accès à cette boutique est suspendu. Contactez votre prestataire."`

- [ ] **Step 1: Write the failing test**

Créer (ou compléter) `lib/auth/actions.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const tenantState = vi.hoisted(() => ({
  current: { id: "t1", slug: "boutique", name: "Boutique", status: "active" } as {
    id: string;
    slug: string;
    name: string;
    status: string;
  } | null,
}));

const signInWithPassword = vi.hoisted(() => vi.fn(async () => ({ error: null })));

vi.mock("@/lib/tenant", () => ({
  getCurrentTenantOrNull: async () => tenantState.current,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword, signOut: vi.fn() } }),
}));

const { signIn } = await import("@/lib/auth/actions");

function formData(email: string, password: string): FormData {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("password", password);
  return fd;
}

beforeEach(() => {
  tenantState.current = { id: "t1", slug: "boutique", name: "Boutique", status: "active" };
  signInWithPassword.mockClear();
});

describe("signIn — application de la suspension", () => {
  it("refuse la connexion sur une boutique suspendue, sans appeler Supabase", async () => {
    tenantState.current = { id: "t1", slug: "boutique", name: "Boutique", status: "suspended" };
    const result = await signIn({}, formData("aya@example.com", "motdepasse"));
    expect(result.error).toBe("L'accès à cette boutique est suspendu. Contactez votre prestataire.");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("refuse la connexion sur une boutique archivée", async () => {
    tenantState.current = { id: "t1", slug: "boutique", name: "Boutique", status: "archived" };
    const result = await signIn({}, formData("aya@example.com", "motdepasse"));
    expect(result.error).toBe("L'accès à cette boutique est suspendu. Contactez votre prestataire.");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
```

**Note pour l'implémenteur :** `signIn` existe déjà (`lib/auth/actions.ts:15`) et redirige en cas de succès. Lire sa signature exacte (`_prevState: SignInState, formData: FormData`) et le type `SignInState` **avant** d'écrire le test ; adapter la forme de l'assertion `result.error` à ce que `SignInState` porte réellement. Si `signIn` importe d'autres modules (`next/navigation`, `lib/proxy/zones`), les mocker de la même façon. Ne pas tester le chemin de succès ici : il redirige, ce qui lève.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/auth/actions.test.ts`
Expected: FAIL — la connexion passe alors qu'elle devrait être refusée.

- [ ] **Step 3: Bloquer `signIn`**

Dans `lib/auth/actions.ts`, en tête de `signIn`, **avant** tout appel à Supabase :

```ts
  // Spec §2 : une boutique suspendue ou archivée refuse la connexion à son
  // back-office. Contrôlé ici en plus de la page /connexion parce que la Server
  // Action est un point d'entrée indépendant, appelable sans passer par elle.
  const tenant = await getCurrentTenantOrNull();
  if (tenant && tenant.status !== "active") {
    return { error: "L'accès à cette boutique est suspendu. Contactez votre prestataire." };
  }
```

Ajouter l'import `import { getCurrentTenantOrNull } from "@/lib/tenant";` s'il est absent. **Ne pas** toucher à `signInPlatform` : la connexion du prestataire ne dépend d'aucune boutique.

- [ ] **Step 4: Bloquer la page `/connexion` de la zone dashboard**

Remplacer `app/(auth)/connexion/page.tsx` :

```tsx
import { Suspense } from "react";
import { headers } from "next/headers";
import { LoginView } from "@/components/auth/LoginView";
import { TenantBlockedNotice } from "@/components/dashboard/TenantBlockedNotice";
import { getCurrentTenantOrNull } from "@/lib/tenant";

/**
 * Page partagée par la zone dashboard et la zone plateforme : Next.js refuse
 * deux `page.tsx` résolvant le même chemin, et `proxy.ts` réécrit les deux
 * zones vers `/connexion`. L'en-tête `x-zone`, posé par `proxy.ts`, est la
 * seule information qui distingue les deux appels.
 */
export default async function ConnexionPage() {
  const zone = (await headers()).get("x-zone");
  const isPlatform = zone === "admin";

  // Spec §2 : la connexion au back-office d'une boutique suspendue est bloquée,
  // sinon la gérante se connecte pour atterrir sur un mur. La connexion
  // PLATEFORME n'est jamais concernée — le prestataire doit pouvoir entrer pour
  // réactiver précisément la boutique en cause.
  if (!isPlatform) {
    const tenant = await getCurrentTenantOrNull();
    if (tenant && tenant.status !== "active") {
      return <TenantBlockedNotice tenantName={tenant.name} status={tenant.status} />;
    }
  }

  return (
    <Suspense fallback={<div style={{ maxWidth: 380, margin: "96px auto" }} />}>
      <LoginView variant={isPlatform ? "platform" : "dashboard"} />
    </Suspense>
  );
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: suite verte, typecheck propre.

- [ ] **Step 6: Commit**

```bash
git add "app/(auth)/connexion/page.tsx" lib/auth/actions.ts lib/auth/actions.test.ts
git commit -m "feat(lifecycle): block dashboard sign-in on suspended tenants, page and action"
```

---

### Task 8: `proxy.ts` — décider explicitement, et le prouver

Le spec §2 dit de garder la base **hors du chemin edge** et de contrôler la suspension dans les layouts. Depuis la phase 3, `proxy.ts` touche pourtant déjà la base (résolution de l'impersonation). Le handover §8 demande de **revalider ce choix plutôt que de le supposer**.

**Décision retenue, à implémenter telle quelle :** `proxy.ts` ne contrôle **pas** le statut. Raisons :
1. La requête d'impersonation de `proxy.ts` ne s'exécute que si un cookie d'impersonation est présent **et** l'acteur est `super_admin` — c'est-à-dire quasiment jamais. Contrôler le statut y ajouterait un aller-retour SQL sur **chaque requête de vitrine publique**, sur le chemin où `CLAUDE.md` §10 vise un LCP < 2,5 s.
2. Les layouts lisent le statut via le registry **en cache** (`unstable_cache`, une entrée pour tout le parc) : le coût réel est nul.
3. Un contrôle en proxy ne remplacerait de toute façon pas celui des layouts, puisque `/connexion` sort déjà du bloc de contrôle de `proxy.ts` (ligne 29).

Cette tâche ne change aucun comportement : elle écrit la décision dans le code et pose un test qui échouera si quelqu'un la défait par inadvertance.

**Files:**
- Modify: `proxy.ts` (commentaire au-dessus du bloc de résolution du tenant, ~ligne 84)
- Test: `proxy.test.ts`

**Interfaces:**
- Consumes: rien de nouveau.
- Produces: rien de nouveau.

- [ ] **Step 1: Write the failing test**

Ajouter à `proxy.test.ts` :

```ts
describe("statut de boutique — décision de conception du spec §2", () => {
  it("laisse passer une requête de vitrine sans consulter la base : la suspension est l'affaire des layouts", async () => {
    const request = makeRequest("http://localhost:3000/catalogue");
    const response = await proxy(request);
    // Ni redirection ni blocage : le proxy achemine, le layout décide.
    expect(response.status).toBe(200);
    expect(response.headers.get("x-tenant-host")).toBe("localhost");
  });

  it("achemine une requête dashboard vers le layout plutôt que de la refuser lui-même", async () => {
    setSession({ role: "owner", tenantId: "t1" });
    const request = makeRequest("http://localhost:3000/admin/pos");
    const response = await proxy(request);
    expect(response.status).toBe(200);
  });
});
```

**Note pour l'implémenteur :** `makeRequest` et `setSession` sont des noms d'illustration. Lire `proxy.test.ts` en entier et réutiliser **les helpers et l'idiome de mock qui s'y trouvent déjà** — ce fichier est le premier test au niveau middleware du dépôt et a sa propre plomberie. Adapter les deux tests ci-dessus à cette plomberie plutôt que d'en introduire une seconde.

- [ ] **Step 2: Run test to verify it passes as written**

Run: `npx vitest run proxy.test.ts`
Expected: PASS immédiatement — c'est un test de non-régression sur un comportement existant. **Si l'un des deux échoue, ne pas le « réparer » en modifiant le test : c'est un vrai défaut de routage à signaler avant d'aller plus loin.**

- [ ] **Step 3: Écrire la décision dans le code**

Dans `proxy.ts`, remplacer le commentaire des lignes 84-86 :

```ts
  // La résolution du tenant est faite côté serveur applicatif (lib/tenant), où
  // elle est mise en cache : la garder ici imposerait un aller-retour SQL sur
  // chaque requête de vitrine publique.
  //
  // Le STATUT de la boutique (suspendue/archivée, spec §9) n'est volontairement
  // pas contrôlé ici non plus — décision revalidée en phase 4, pas héritée. La
  // requête Prisma que ce fichier exécute depuis la phase 3 ne part que si un
  // cookie d'impersonation est présent ET que l'acteur est super_admin, donc
  // quasiment jamais ; contrôler le statut ici la rendrait inconditionnelle sur
  // le chemin public, celui où CLAUDE.md §10 vise un LCP < 2,5 s. L'application
  // vit dans les layouts (spec §2), qui lisent le registry en cache :
  //   - app/(storefront)/layout.tsx        → indisponible (suspendue) / 404 (archivée)
  //   - app/(dashboard)/layout.tsx         → écran bloquant
  //   - app/(auth)/connexion/page.tsx      → message, zone dashboard uniquement
  //   - lib/auth/actions.ts (signIn)       → refus côté action
  // Ce choix est couvert par les tests « statut de boutique » de proxy.test.ts.
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run proxy.test.ts && npm run typecheck`
Expected: PASS, typecheck propre.

- [ ] **Step 5: Commit**

```bash
git add proxy.ts proxy.test.ts
git commit -m "docs(lifecycle): record why proxy.ts does not check tenant status, with a regression test"
```

---

### Task 9: Les archivées sortent du parc

Spec §9 : une boutique archivée est « invisible partout **sauf pour le prestataire** ». Elle disparaît donc de la liste par défaut, mais reste atteignable via une bascule — sinon elle serait insupprimable, la suppression définitive n'étant possible que depuis sa fiche.

**Files:**
- Modify: `lib/platform/queries.ts` (`listTenants`, `getTenantBySlug`)
- Modify: `lib/platform/queries.test.ts`
- Create: `components/platform/StatusBadge.tsx`
- Modify: `components/platform/screens/TenantListScreen.tsx`
- Modify: `app/(admin)/(console)/boutiques/page.tsx`

**Interfaces:**
- Consumes: `STATUS_LABELS` (tâche 2).
- Produces:
  - `listTenants(options?: { includeArchived?: boolean }): Promise<TenantListItem[]>` — par défaut `includeArchived: false`.
  - `TenantDetail` gagne `suspendedAt: Date | null`, `suspendedReason: string | null`, `archivedAt: Date | null`.
  - `StatusBadge({ status }: { status: TenantStatus })`.

- [ ] **Step 1: Write the failing test**

Ajouter à `lib/platform/queries.test.ts` :

```ts
describe("listTenants — archivage", () => {
  it("exclut les boutiques archivées par défaut", async () => {
    await listTenants();
    const args = findManyCalls[0];
    expect(args.where).toEqual({ status: { not: "archived" } });
  });

  it("les inclut quand le prestataire le demande explicitement", async () => {
    await listTenants({ includeArchived: true });
    const args = findManyCalls[0];
    expect(args.where).toBeUndefined();
  });
});

describe("getTenantBySlug — colonnes de cycle de vie", () => {
  it("remonte suspendedAt, suspendedReason et archivedAt", async () => {
    const detail = await getTenantBySlug("boutique-test");
    expect(detail).toMatchObject({
      suspendedAt: null,
      suspendedReason: null,
      archivedAt: null,
    });
  });
});
```

**Note pour l'implémenteur :** `findManyCalls` est un nom d'illustration. Lire `lib/platform/queries.test.ts` et réutiliser son idiome de mock existant (`vi.hoisted` + capture d'appels, comme dans `lib/platform/actions.test.ts`). Les fixtures du mock `findUnique` devront gagner `suspendedAt: null, suspendedReason: null, archivedAt: null` pour que le second test passe.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/platform/queries.test.ts`
Expected: FAIL — `where` est `undefined` alors qu'on attend le filtre.

- [ ] **Step 3: Implémenter le filtre et les colonnes**

Dans `lib/platform/queries.ts` :

```ts
export interface TenantDetail {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  font: string;
  logoText: string;
  whatsappPhone: string;
  domains: string[];
  status: TenantStatus;
  plan: TenantPlan;
  enabledModules: string[];
  createdAt: Date;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  archivedAt: Date | null;
  owner: { id: string; name: string; email: string } | null;
}

/**
 * Spec §9 : une boutique archivée est « sortie du parc, invisible partout sauf
 * pour le prestataire ». Elle est donc masquée par défaut mais reste atteignable
 * — sans quoi elle deviendrait insupprimable, la suppression définitive n'étant
 * possible que depuis sa fiche.
 */
export async function listTenants(options?: { includeArchived?: boolean }): Promise<TenantListItem[]> {
  await requireSuperAdmin();
  const rows = await prisma.tenant.findMany({
    ...(options?.includeArchived ? {} : { where: { status: { not: "archived" } } }),
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { products: true, orders: true } },
      profiles: { where: { role: "owner" }, orderBy: { createdAt: "asc" }, select: { name: true }, take: 1 },
    },
  });
  // … mapping inchangé
}
```

Dans `getTenantBySlug`, ajouter au retour :

```ts
    suspendedAt: row.suspendedAt,
    suspendedReason: row.suspendedReason,
    archivedAt: row.archivedAt,
```

- [ ] **Step 4: Créer la pastille d'état**

Créer `components/platform/StatusBadge.tsx` :

```tsx
import { colors } from "@/lib/theme/tokens";
import { STATUS_LABELS } from "@/lib/platform/transitions";
import type { TenantStatus } from "@/lib/generated/prisma/enums";

const STYLES: Record<TenantStatus, { background: string; color: string }> = {
  active: { background: colors.bgSuccess, color: colors.fgSuccess },
  suspended: { background: colors.bgDanger, color: colors.fgDanger },
  archived: { background: colors.surfaceMuted ?? "#EFEBE3", color: colors.muted },
};

/** Pastille d'état d'une boutique, partagée par la liste du parc et la fiche. */
export function StatusBadge({ status }: { status: TenantStatus }) {
  const style = STYLES[status];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 9px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: style.background,
        color: style.color,
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
```

**Note pour l'implémenteur :** vérifier les noms réels exportés par `lib/theme/tokens.ts` (`colors.bgSuccess`, `colors.fgSuccess`, `colors.bgDanger`, `colors.fgDanger`, `colors.muted` existent — confirmés via `components/platform/FormMessage.tsx`). `colors.surfaceMuted` n'est **pas** confirmé : si absent, utiliser le littéral `"#EFEBE3"` sans `??`, TypeScript strict refusant un `??` sur une propriété inexistante.

- [ ] **Step 5: Brancher la liste**

Dans `app/(admin)/(console)/boutiques/page.tsx`, lire le paramètre de recherche et le passer :

```tsx
export default async function BoutiquesPage({
  searchParams,
}: {
  searchParams: Promise<{ archivees?: string }>;
}) {
  const { archivees } = await searchParams;
  const includeArchived = archivees === "1";
  const tenants = await listTenants({ includeArchived });
  return <TenantListScreen tenants={tenants} includeArchived={includeArchived} />;
}
```

Dans `components/platform/screens/TenantListScreen.tsx` : ajouter la prop `includeArchived: boolean`, afficher `<StatusBadge status={tenant.status} />` dans chaque ligne, et ajouter au-dessus du tableau un lien de bascule :

```tsx
<Link
  href={includeArchived ? "/boutiques" : "/boutiques?archivees=1"}
  className="ft-platform-link"
  style={{ fontSize: 13, color: colors.muted, textDecoration: "none" }}
>
  {includeArchived ? "Masquer les boutiques archivées" : "Afficher les boutiques archivées"}
</Link>
```

**Note pour l'implémenteur :** lire `TenantListScreen.tsx` en entier avant d'éditer et respecter sa structure (tableau grand écran, repli en cartes sur mobile, spec §6). Placer le badge dans les **deux** rendus, pas seulement le tableau.

- [ ] **Step 6: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: suite verte, typecheck propre.

- [ ] **Step 7: Commit**

```bash
git add lib/platform/queries.ts lib/platform/queries.test.ts components/platform/StatusBadge.tsx components/platform/screens/TenantListScreen.tsx "app/(admin)"
git commit -m "feat(lifecycle): hide archived tenants from the fleet list, show status badges"
```

---

### Task 10: Refuser d'entrer dans une boutique non active

Sans cela, « Entrer dans la boutique » sur une boutique suspendue pose le cookie, redirige vers le dashboard… qui affiche l'écran bloquant. Le prestataire se retrouve en impersonation dans une coquille vide, sans autre issue que « Quitter ».

**Files:**
- Modify: `lib/impersonation/actions.ts` (`startImpersonation`)
- Modify: `lib/impersonation/actions.test.ts`
- Modify: `components/platform/EnterTenantButton.tsx`
- Modify: `components/platform/screens/TenantDetailScreen.tsx` (passage du statut au bouton)

**Interfaces:**
- Consumes: `TenantDetail.status` (tâche 9).
- Produces: `EnterTenantButton({ ownerProfileId, tenantStatus }: { ownerProfileId: string | null; tenantStatus: TenantStatus })`.

- [ ] **Step 1: Write the failing test**

Ajouter à `lib/impersonation/actions.test.ts` :

```ts
describe("startImpersonation — boutique non active", () => {
  it("refuse d'entrer dans une boutique suspendue, sans poser de cookie", async () => {
    setTargetTenantStatus("suspended");
    const result = await startImpersonation("owner-profile-1");
    expect(result).toEqual({
      ok: false,
      error: "Cette boutique n'est pas active : réactivez-la avant d'y entrer.",
    });
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("refuse d'entrer dans une boutique archivée", async () => {
    setTargetTenantStatus("archived");
    const result = await startImpersonation("owner-profile-1");
    expect(result.ok).toBe(false);
    expect(cookieStore.set).not.toHaveBeenCalled();
  });
});
```

**Note pour l'implémenteur :** `setTargetTenantStatus` et `cookieStore` sont des noms d'illustration. Lire `lib/impersonation/actions.test.ts` en entier — il a une plomberie de mock élaborée (le test « préserve le startedAt d'origine » décode un vrai cookie signé). Étendre l'état hoisté existant du profil cible pour qu'il porte le statut de son tenant, plutôt que d'ajouter un second mécanisme.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/impersonation/actions.test.ts`
Expected: FAIL — l'impersonation démarre alors qu'elle devrait être refusée.

- [ ] **Step 3: Refuser dans l'action**

Dans `startImpersonation` (`lib/impersonation/actions.ts`), après le chargement du profil cible et **avant** toute signature ou pose de cookie :

```ts
  // Spec §9 : une boutique suspendue ou archivée a son back-office bloqué.
  // Y entrer poserait le cookie pour 60 minutes et aboutirait à l'écran
  // bloquant — une impersonation dans une coquille vide.
  if (targetTenant.status !== "active") {
    return { ok: false, error: "Cette boutique n'est pas active : réactivez-la avant d'y entrer." };
  }
```

**Note pour l'implémenteur :** `startImpersonation` charge déjà le profil cible via Prisma. Étendre ce `select`/`include` existant pour rapporter `tenant: { select: { status: true } }` plutôt que d'ajouter une seconde requête.

- [ ] **Step 4: Désactiver le bouton côté UI**

Dans `components/platform/EnterTenantButton.tsx`, ajouter la prop `tenantStatus` et désactiver le bouton avec un `title` explicatif quand `tenantStatus !== "active"`, sur le modèle de la case `dash` désactivée de `TenantModulesForm`. Dans `TenantDetailScreen.tsx`, passer `tenantStatus={tenant.status}`.

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: suite verte, typecheck propre.

- [ ] **Step 6: Commit**

```bash
git add lib/impersonation/actions.ts lib/impersonation/actions.test.ts components/platform/EnterTenantButton.tsx components/platform/screens/TenantDetailScreen.tsx
git commit -m "feat(lifecycle): refuse impersonation into a suspended or archived tenant"
```

---

### Task 11: Diagnostic de santé et onglet « Vue d'ensemble »

Spec §10 : « dernière connexion de la gérante, nombre de produits, commandes sur 30 jours, vitrine publiée ou non, produits en rupture ».

**Files:**
- Create: `lib/platform/health.ts`
- Test: `lib/platform/health.test.ts`
- Create: `components/platform/screens/TenantOverviewTab.tsx`
- Modify: `components/platform/screens/TenantDetailScreen.tsx` (onglet `apercu` disponible)
- Modify: `app/(admin)/(console)/boutiques/[slug]/page.tsx`

**Interfaces:**
- Consumes: `requireSuperAdmin` de `./guard`, `createAdminClient` de `@/lib/supabase/admin`.
- Produces:

```ts
export interface TenantHealth {
  productCount: number;
  outOfStockCount: number;
  ordersLast30Days: number;
  storefrontPublished: boolean;
  ownerLastSignInAt: Date | null;
}
export async function getTenantHealth(tenantId: string, ownerProfileId: string | null): Promise<TenantHealth>;
```

- [ ] **Step 1: Write the failing test**

Créer `lib/platform/health.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const authState = vi.hoisted(() => ({ role: "super_admin" as "owner" | "super_admin" }));

const dbState = vi.hoisted(() => ({
  productCount: 12,
  outOfStockCount: 3,
  ordersLast30Days: 7,
  publishedPage: { publishedAt: new Date("2026-07-01T00:00:00Z") } as { publishedAt: Date | null } | null,
  countCalls: [] as Array<Record<string, unknown>>,
}));

const adminState = vi.hoisted(() => ({
  lastSignInAt: "2026-07-29T08:00:00.000Z" as string | null,
  error: null as null | { message: string },
  getUserByIdCalls: [] as string[],
}));

vi.mock("@/lib/impersonation/context", () => ({
  getActorContext: async () =>
    authState.role === "super_admin"
      ? {
          actor: { userId: "admin-1", name: "Admin Plateforme", role: "super_admin" },
          effective: { tenantId: null, role: "super_admin", permissions: [] },
          impersonation: null,
        }
      : {
          actor: { userId: "u1", name: "Aya", role: "owner" },
          effective: { tenantId: "t1", role: "owner", permissions: [] },
          impersonation: null,
        },
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    product: {
      count: async (args: Record<string, unknown>) => {
        dbState.countCalls.push({ model: "product", ...args });
        const where = args.where as Record<string, unknown>;
        return where.stock ? dbState.outOfStockCount : dbState.productCount;
      },
    },
    order: {
      count: async (args: Record<string, unknown>) => {
        dbState.countCalls.push({ model: "order", ...args });
        return dbState.ordersLast30Days;
      },
    },
    storefrontPage: {
      findFirst: async () => dbState.publishedPage,
    },
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        getUserById: async (id: string) => {
          adminState.getUserByIdCalls.push(id);
          if (adminState.error) return { data: { user: null }, error: adminState.error };
          return { data: { user: { last_sign_in_at: adminState.lastSignInAt } }, error: null };
        },
      },
    },
  }),
}));

const { getTenantHealth } = await import("@/lib/platform/health");

beforeEach(() => {
  authState.role = "super_admin";
  dbState.countCalls = [];
  dbState.publishedPage = { publishedAt: new Date("2026-07-01T00:00:00Z") };
  adminState.lastSignInAt = "2026-07-29T08:00:00.000Z";
  adminState.error = null;
  adminState.getUserByIdCalls = [];
});

describe("getTenantHealth", () => {
  it("lève si l'appelant n'est pas super_admin", async () => {
    authState.role = "owner";
    await expect(getTenantHealth("t1", "owner-1")).rejects.toThrow("Accès plateforme refusé.");
  });

  it("rapporte les cinq indicateurs du spec §10", async () => {
    const health = await getTenantHealth("t1", "owner-1");
    expect(health).toEqual({
      productCount: 12,
      outOfStockCount: 3,
      ordersLast30Days: 7,
      storefrontPublished: true,
      ownerLastSignInAt: new Date("2026-07-29T08:00:00.000Z"),
    });
  });

  it("considère la vitrine non publiée quand aucune page n'a de publishedAt", async () => {
    dbState.publishedPage = null;
    const health = await getTenantHealth("t1", "owner-1");
    expect(health.storefrontPublished).toBe(false);
  });

  it("renvoie null pour la dernière connexion quand la boutique n'a pas de gérante", async () => {
    const health = await getTenantHealth("t1", null);
    expect(health.ownerLastSignInAt).toBeNull();
    expect(adminState.getUserByIdCalls).toHaveLength(0);
  });

  it("dégrade en null plutôt que de lever si Supabase Auth répond une erreur — le diagnostic ne doit jamais casser la fiche", async () => {
    adminState.error = { message: "User not found" };
    const health = await getTenantHealth("t1", "owner-1");
    expect(health.ownerLastSignInAt).toBeNull();
    expect(health.productCount).toBe(12);
  });

  it("filtre toutes les requêtes sur le tenant demandé", async () => {
    await getTenantHealth("t1", "owner-1");
    for (const call of dbState.countCalls) {
      expect((call.where as Record<string, unknown>).tenantId).toBe("t1");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/platform/health.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/platform/health"`.

- [ ] **Step 3: Write minimal implementation**

Créer `lib/platform/health.ts` :

```ts
import { prisma } from "@/lib/db/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "./guard";

export interface TenantHealth {
  productCount: number;
  outOfStockCount: number;
  ordersLast30Days: number;
  storefrontPublished: boolean;
  ownerLastSignInAt: Date | null;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Indicateurs de dépannage d'une boutique (spec §10). Toutes les requêtes sont
 * filtrées par `tenantId` — contrairement à `queries.ts`, ce module n'a aucune
 * raison de lire sans filtre.
 *
 * `ownerLastSignInAt` vient de Supabase Auth, pas de Postgres : `Profile` ne
 * stocke pas la dernière connexion. Toute erreur Auth dégrade en `null` plutôt
 * que de lever — un diagnostic partiel vaut mieux qu'une fiche boutique
 * inaccessible.
 */
export async function getTenantHealth(
  tenantId: string,
  ownerProfileId: string | null
): Promise<TenantHealth> {
  await requireSuperAdmin();

  const since = new Date(Date.now() - THIRTY_DAYS_MS);

  const [productCount, outOfStockCount, ordersLast30Days, publishedPage] = await Promise.all([
    prisma.product.count({ where: { tenantId } }),
    prisma.product.count({ where: { tenantId, stock: { lte: 0 } } }),
    prisma.order.count({ where: { tenantId, createdAt: { gte: since } } }),
    prisma.storefrontPage.findFirst({
      where: { tenantId, publishedAt: { not: null } },
      select: { publishedAt: true },
    }),
  ]);

  let ownerLastSignInAt: Date | null = null;
  if (ownerProfileId) {
    try {
      const { data, error } = await createAdminClient().auth.admin.getUserById(ownerProfileId);
      const raw = error ? null : (data.user?.last_sign_in_at ?? null);
      ownerLastSignInAt = raw ? new Date(raw) : null;
    } catch {
      ownerLastSignInAt = null;
    }
  }

  return {
    productCount,
    outOfStockCount,
    ordersLast30Days,
    storefrontPublished: publishedPage !== null,
    ownerLastSignInAt,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/platform/health.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Créer l'onglet « Vue d'ensemble »**

Créer `components/platform/screens/TenantOverviewTab.tsx` — Server Component (pas de `"use client"`, il ne fait qu'afficher) :

```tsx
import { colors, adminBorder } from "@/lib/theme/tokens";
import { StatusBadge } from "@/components/platform/StatusBadge";
import type { TenantDetail } from "@/lib/platform/queries";
import type { TenantHealth } from "@/lib/platform/health";

function formatDate(value: Date | null): string {
  if (!value) return "Jamais";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(value);
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ background: colors.surface, border: adminBorder, borderRadius: 14, padding: 16 }}>
      <p style={{ margin: 0, fontSize: 13, color: colors.muted }}>{label}</p>
      <p style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 600, color: warn ? colors.danger : colors.ink }}>
        {value}
      </p>
    </div>
  );
}

/** Indicateurs de santé et état courant d'une boutique (spec §6, onglet 1 ; spec §10). */
export function TenantOverviewTab({ tenant, health }: { tenant: TenantDetail; health: TenantHealth }) {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={{ background: colors.surface, border: adminBorder, borderRadius: 16, padding: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 10px" }}>État</h2>
        <StatusBadge status={tenant.status} />
        {tenant.status === "suspended" && (
          <p style={{ margin: "10px 0 0", fontSize: 14, color: colors.muted }}>
            Suspendue le {formatDate(tenant.suspendedAt)}
            {tenant.suspendedReason ? ` — ${tenant.suspendedReason}` : ""}
          </p>
        )}
        {tenant.status === "archived" && (
          <p style={{ margin: "10px 0 0", fontSize: 14, color: colors.muted }}>
            Archivée le {formatDate(tenant.archivedAt)}
          </p>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>Diagnostic</h2>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
          <Metric label="Produits au catalogue" value={String(health.productCount)} />
          <Metric
            label="Produits en rupture"
            value={String(health.outOfStockCount)}
            warn={health.outOfStockCount > 0}
          />
          <Metric label="Commandes sur 30 jours" value={String(health.ordersLast30Days)} />
          <Metric
            label="Vitrine"
            value={health.storefrontPublished ? "Publiée" : "Non publiée"}
            warn={!health.storefrontPublished}
          />
          <Metric label="Dernière connexion de la gérante" value={formatDate(health.ownerLastSignInAt)} />
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Router l'onglet**

Dans `components/platform/screens/TenantDetailScreen.tsx` : passer `available: true` sur l'entrée `apercu`, et étendre le type :

```ts
export type TenantTab = "apercu" | "modules" | "equipe" | "identite" | "journal" | "danger";
```

Dans `app/(admin)/(console)/boutiques/[slug]/page.tsx` :

```tsx
const TABS = ["apercu", "modules", "equipe", "identite", "danger"] as const;

function resolveTab(raw: string | undefined): TenantTab {
  return (TABS as readonly string[]).includes(raw ?? "") ? (raw as TenantTab) : "apercu";
}

export default async function BoutiqueDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ onglet?: string }>;
}) {
  const [{ slug }, { onglet }] = await Promise.all([params, searchParams]);
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const tab = resolveTab(onglet);
  const health = tab === "apercu" ? await getTenantHealth(tenant.id, tenant.owner?.id ?? null) : null;

  return (
    <TenantDetailScreen tenant={tenant} tab={tab}>
      {tab === "apercu" && health && <TenantOverviewTab tenant={tenant} health={health} />}
      {tab === "modules" && <TenantModulesForm tenant={tenant} />}
      {tab === "identite" && <TenantIdentityForm tenant={tenant} />}
    </TenantDetailScreen>
  );
}
```

**Note :** l'onglet par défaut passe d'`identite` à `apercu` — c'est le point d'entrée naturel selon le spec §6 (onglet 1). `equipe` et `danger` seront branchés aux tâches 12 et 14 ; d'ici là ils restent `available: false` dans `TABS` de `TenantDetailScreen.tsx`.

- [ ] **Step 7: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: suite verte, typecheck propre.

- [ ] **Step 8: Commit**

```bash
git add lib/platform/health.ts lib/platform/health.test.ts components/platform/screens/TenantOverviewTab.tsx components/platform/screens/TenantDetailScreen.tsx "app/(admin)"
git commit -m "feat(support): add tenant health diagnostics and the overview tab"
```

---

### Task 12: Onglet « Équipe » — reset du mot de passe et rattachement d'une gérante

Spec §6, onglet 3 : « profils d'accès et employés de la boutique, création de la gérante, réinitialisation de son mot de passe ». La création est nécessaire, pas décorative : la fiche d'une boutique sans gérante affiche « Aucune gérante rattachée » et son bouton « Entrer dans la boutique » est inerte, sans aucun moyen de corriger cela depuis l'interface.

**Files:**
- Create: `lib/platform/team.ts`
- Test: `lib/platform/team.test.ts`
- Create: `components/platform/screens/TenantTeamTab.tsx`
- Modify: `lib/platform/queries.ts` (ajout de `getTenantTeam`)
- Modify: `lib/impersonation/guard-coverage.test.ts` (entrée `EXEMPT`)
- Modify: `components/platform/screens/TenantDetailScreen.tsx`, `app/(admin)/(console)/boutiques/[slug]/page.tsx`

**Interfaces:**
- Consumes: `resetOwnerPasswordSchema`, `createOwnerSchema` (tâche 3), `createAdminClient`, `recordPlatformAction`, `currentSuperAdmin`.
- Produces:
  - `resetOwnerPassword(tenantId: string, ownerProfileId: string, input: ResetOwnerPasswordInput): Promise<PlatformResult>`
  - `createTenantOwner(tenantId: string, input: CreateOwnerInput): Promise<PlatformResult>`
  - `getTenantTeam(tenantId: string): Promise<{ profiles: Array<{ id: string; name: string; email: string; role: string; active: boolean; employeeRoleName: string | null }>; employeeRoles: Array<{ id: string; name: string; permissions: string[] }> }>`

- [ ] **Step 1: Write the failing test**

Créer `lib/platform/team.test.ts`. Réutiliser **exactement** l'idiome de mock de `lib/platform/lifecycle.test.ts` (tâche 4) pour `@/lib/impersonation/context`, `@/lib/db/client` et `next/cache`, plus le mock `@/lib/supabase/admin` de `lib/platform/health.test.ts` (tâche 11) étendu avec `updateUserById` et `createUser`. Tests exigés :

```ts
describe("resetOwnerPassword", () => {
  it("refuse un appelant qui n'est pas super_admin, sans toucher Supabase Auth", async () => {
    authState.role = "owner";
    const result = await resetOwnerPassword("t1", "owner-1", { password: "nouveaumdp1" });
    expect(result).toEqual({ ok: false, error: "Une erreur est survenue, réessayez." });
    expect(adminState.calls.updateUserById).toHaveLength(0);
  });

  it("refuse un mot de passe trop court avant tout appel réseau", async () => {
    const result = await resetOwnerPassword("t1", "owner-1", { password: "court" });
    expect(result).toEqual({ ok: false, error: "8 caractères minimum." });
    expect(adminState.calls.updateUserById).toHaveLength(0);
  });

  it("refuse de réinitialiser un profil qui n'appartient pas à cette boutique", async () => {
    dbState.profile = { id: "owner-1", tenantId: "AUTRE", role: "owner", name: "Aya", email: "a@b.c" };
    const result = await resetOwnerPassword("t1", "owner-1", { password: "nouveaumdp1" });
    expect(result).toEqual({ ok: false, error: "Cette gérante n'appartient pas à cette boutique." });
    expect(adminState.calls.updateUserById).toHaveLength(0);
  });

  it("met à jour le mot de passe et trace owner_password_reset", async () => {
    const result = await resetOwnerPassword("t1", "owner-1", { password: "nouveaumdp1" });
    expect(result).toEqual({ ok: true });
    expect(adminState.calls.updateUserById[0]).toEqual(["owner-1", { password: "nouveaumdp1" }]);
    const audit = dbState.calls.auditCreate[0].data as Record<string, unknown>;
    expect(audit.action).toBe("owner_password_reset");
    expect(audit.actorId).toBe("admin-1");
    expect(audit.targetId).toBe("owner-1");
    expect(JSON.stringify(audit.metadata)).not.toContain("nouveaumdp1");
  });

  it("ne trace rien si Supabase Auth échoue", async () => {
    adminState.updateUserError = { message: "boom" };
    const result = await resetOwnerPassword("t1", "owner-1", { password: "nouveaumdp1" });
    expect(result.ok).toBe(false);
    expect(dbState.calls.auditCreate).toHaveLength(0);
  });
});

describe("createTenantOwner", () => {
  it("refuse si la boutique a déjà une gérante", async () => {
    dbState.existingOwner = { id: "owner-1" };
    const result = await createTenantOwner("t1", {
      name: "Aya",
      email: "aya@example.com",
      password: "motdepasse1",
    });
    expect(result).toEqual({ ok: false, error: "Cette boutique a déjà une gérante." });
    expect(adminState.calls.createUser).toHaveLength(0);
  });

  it("crée le compte Auth puis le Profile, et trace owner_created", async () => {
    dbState.existingOwner = null;
    const result = await createTenantOwner("t1", {
      name: "Aya",
      email: "aya@example.com",
      password: "motdepasse1",
    });
    expect(result).toEqual({ ok: true });
    expect(adminState.calls.createUser).toHaveLength(1);
    const profile = dbState.calls.profileCreate[0].data as Record<string, unknown>;
    expect(profile).toMatchObject({ tenantId: "t1", role: "owner", name: "Aya" });
    expect(dbState.calls.auditCreate[0].data).toMatchObject({ action: "owner_created" });
  });

  it("supprime le compte Auth au mieux si l'écriture du Profile échoue", async () => {
    dbState.existingOwner = null;
    dbState.transactionThrows = true;
    const result = await createTenantOwner("t1", {
      name: "Aya",
      email: "aya@example.com",
      password: "motdepasse1",
    });
    expect(result.ok).toBe(false);
    expect(adminState.calls.deleteUser).toEqual(["owner-new-id"]);
  });

  it("renvoie un message parlant si l'email est déjà utilisé", async () => {
    dbState.existingOwner = null;
    adminState.createUserError = { message: "User already registered" };
    const result = await createTenantOwner("t1", {
      name: "Aya",
      email: "aya@example.com",
      password: "motdepasse1",
    });
    expect(result).toEqual({ ok: false, error: "Cette adresse email est déjà utilisée." });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/platform/team.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/platform/team"`.

- [ ] **Step 3: Write the implementation**

Créer `lib/platform/team.ts`. Contraintes non négociables :

- `"use server"` en première ligne.
- `currentSuperAdmin()` en tête des **deux** fonctions ; `null` → `GENERIC_ERROR`.
- Validation Zod **avant** tout appel réseau.
- `resetOwnerPassword` : vérifier que `profile.tenantId === tenantId` **et** `profile.role === "owner"` avant d'appeler `auth.admin.updateUserById`. Le message de refus est `"Cette gérante n'appartient pas à cette boutique."`
- Le mot de passe ne doit **jamais** apparaître dans `metadata` de l'audit. `metadata` porte au plus `{ ownerName, ownerEmail }`.
- L'audit n'est écrit qu'**après** un appel Auth réussi.
- `createTenantOwner` suit l'ordre imposé par le spec §8, déjà appliqué par `createTenant` (`lib/platform/actions.ts:33`) : compte Auth **d'abord**, puis transaction Prisma (`Profile` + audit), puis `deleteUser` au mieux si la transaction échoue. **Lire `createTenant` et copier ce rattrapage** plutôt que d'en réinventer un.
- Le `Profile` créé porte `id` = l'uid Auth retourné, `tenantId`, `role: "owner"`, `name`, `email`, `active: true`. La contrainte base `profile_tenant_role_coherent` exige un `tenantId` non nul pour un rôle ≠ `super_admin` : l'omettre fait échouer l'insertion.
- Terminer par `revalidatePath("/boutiques/<slug>")`. Le slug n'étant pas un paramètre, le lire dans la même requête que le contrôle d'existence de la gérante.

Ajouter `getTenantTeam` à `lib/platform/queries.ts`, gardée par `requireSuperAdmin()`, filtrée sur `tenantId` :

```ts
export async function getTenantTeam(tenantId: string) {
  await requireSuperAdmin();
  const [profiles, employeeRoles] = await Promise.all([
    prisma.profile.findMany({
      where: { tenantId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        employeeRole: { select: { name: true } },
      },
    }),
    prisma.employeeRole.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, permissions: true },
    }),
  ]);
  return {
    profiles: profiles.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email ?? "",
      role: p.role as string,
      active: p.active,
      employeeRoleName: p.employeeRole?.name ?? null,
    })),
    employeeRoles,
  };
}
```

- [ ] **Step 4: Ajouter l'exemption de couverture des gardes**

Dans `lib/impersonation/guard-coverage.test.ts`, à l'objet `EXEMPT` :

```ts
  "platform/team.ts": ["resetOwnerPassword", "createTenantOwner"],
```

- [ ] **Step 5: Créer l'onglet Équipe**

Créer `components/platform/screens/TenantTeamTab.tsx` — `"use client"`, sur le modèle de `TenantModulesForm` (état local, `FormMessage`, `router.refresh()`). Contenu :

1. Table en lecture seule des profils (nom, email, rôle, profil d'accès, actif/inactif) et des profils d'accès avec leurs permissions.
2. Si `tenant.owner` existe : un champ mot de passe + bouton « Réinitialiser le mot de passe », appelant `resetOwnerPassword`. En cas de succès, message `"Mot de passe réinitialisé. Communiquez-le à la gérante par un canal sûr."` — **ne jamais réafficher le mot de passe saisi**.
3. Si `tenant.owner` est `null` : un formulaire nom / email / mot de passe appelant `createTenantOwner`.

- [ ] **Step 6: Router l'onglet**

Dans `TenantDetailScreen.tsx`, passer `available: true` sur `equipe`. Dans `[slug]/page.tsx`, charger `getTenantTeam` quand `tab === "equipe"` et rendre `<TenantTeamTab tenant={tenant} team={team} />`.

- [ ] **Step 7: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: suite verte, typecheck propre.

- [ ] **Step 8: Commit**

```bash
git add lib/platform/team.ts lib/platform/team.test.ts lib/platform/queries.ts components/platform/screens/TenantTeamTab.tsx components/platform/screens/TenantDetailScreen.tsx lib/impersonation/guard-coverage.test.ts "app/(admin)"
git commit -m "feat(support): add the platform team tab with owner password reset and creation"
```

---

### Task 13: Export JSON complet d'une boutique

Spec §10 : « Export JSON complet d'une boutique (produits, clientes, commandes, pages vitrine, codes promo, mouvements de stock), généré côté serveur et servi en téléchargement, tracé en `data_exported` — **filet de sécurité avant une suppression** ». Cette tâche précède donc délibérément la suppression définitive.

**Décision d'implémentation :** Server Action renvoyant le JSON sérialisé, que le client transforme en `Blob` pour déclencher le téléchargement — plutôt qu'un Route Handler. Un handler sous `/api` traverserait `isPathAllowedForZone`, où `/api/...` n'appartient à `ADMIN_PATHS` ni à `DASHBOARD_PATHS` : il ne serait joignable qu'en zone storefront, une surface publique non authentifiée. Passer par une Server Action garde la garde `currentSuperAdmin` au même endroit que toutes les autres actions plateforme. Contrepartie assumée : le payload transite par la réponse RSC, acceptable à l'échelle d'une boutique.

**Files:**
- Create: `lib/platform/export.ts`
- Test: `lib/platform/export.test.ts`
- Modify: `lib/impersonation/guard-coverage.test.ts`

**Interfaces:**
- Consumes: `currentSuperAdmin`, `recordPlatformAction`, `prisma`.
- Produces: `exportTenantData(tenantId: string): Promise<{ ok: true; filename: string; json: string } | { ok: false; error: string }>`

- [ ] **Step 1: Write the failing test**

Créer `lib/platform/export.test.ts`, avec l'idiome de mock de `lib/platform/lifecycle.test.ts`. Tests exigés :

```ts
describe("exportTenantData", () => {
  it("refuse un appelant qui n'est pas super_admin", async () => {
    authState.role = "owner";
    const result = await exportTenantData("t1");
    expect(result).toEqual({ ok: false, error: "Une erreur est survenue, réessayez." });
  });

  it("renvoie « Boutique introuvable. » pour un id inconnu", async () => {
    dbState.tenant = null;
    expect(await exportTenantData("inconnu")).toEqual({ ok: false, error: "Boutique introuvable." });
  });

  it("exporte les six collections du spec §10", async () => {
    const result = await exportTenantData("t1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const payload = JSON.parse(result.json);
    expect(Object.keys(payload)).toEqual(
      expect.arrayContaining([
        "tenant",
        "products",
        "customers",
        "orders",
        "storefrontPages",
        "promoCodes",
        "stockMovements",
        "exportedAt",
      ])
    );
  });

  it("nomme le fichier avec le slug et la date", async () => {
    const result = await exportTenantData("t1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.filename).toMatch(/^boutique-test-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it("trace data_exported avec le slug conservé dans metadata", async () => {
    await exportTenantData("t1");
    const audit = dbState.calls.auditCreate[0].data as Record<string, unknown>;
    expect(audit.action).toBe("data_exported");
    expect(audit.tenantId).toBe("t1");
    expect(audit.metadata).toMatchObject({ slug: "boutique-test" });
  });

  it("filtre chaque collection sur le tenant exporté", async () => {
    await exportTenantData("t1");
    for (const call of dbState.calls.findMany) {
      expect((call.where as Record<string, unknown>).tenantId).toBe("t1");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/platform/export.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write the implementation**

Créer `lib/platform/export.ts` :

```ts
"use server";

import { prisma } from "@/lib/db/client";
import { currentSuperAdmin } from "./guard";
import { recordPlatformAction } from "./audit";

export type ExportResult =
  | { ok: true; filename: string; json: string }
  | { ok: false; error: string };

const GENERIC_ERROR = "Une erreur est survenue, réessayez.";

/**
 * Export JSON complet d'une boutique (spec §10) — filet de sécurité avant une
 * suppression définitive. Chaque collection est filtrée par `tenantId` : ce
 * module n'est pas concerné par la claim « sans filtre » de `queries.ts`.
 *
 * Server Action plutôt que Route Handler : `/api/...` n'appartient ni à
 * ADMIN_PATHS ni à DASHBOARD_PATHS (lib/proxy/zones.ts), donc un handler ne
 * serait joignable qu'en zone storefront — une surface publique. La garde reste
 * ici, au même endroit que celle de toutes les autres actions plateforme.
 */
export async function exportTenantData(tenantId: string): Promise<ExportResult> {
  const actor = await currentSuperAdmin();
  if (!actor) return { ok: false, error: GENERIC_ERROR };

  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return { ok: false, error: "Boutique introuvable." };

    const [products, customers, orders, storefrontPages, promoCodes, stockMovements] = await Promise.all([
      prisma.product.findMany({ where: { tenantId } }),
      prisma.customer.findMany({ where: { tenantId } }),
      prisma.order.findMany({ where: { tenantId }, include: { lines: true } }),
      prisma.storefrontPage.findMany({ where: { tenantId } }),
      prisma.promoCode.findMany({ where: { tenantId } }),
      prisma.stockMovement.findMany({ where: { tenantId } }),
    ]);

    const exportedAt = new Date();
    const payload = {
      exportedAt: exportedAt.toISOString(),
      tenant,
      products,
      customers,
      orders,
      storefrontPages,
      promoCodes,
      stockMovements,
    };

    await recordPlatformAction({
      actorId: actor.userId,
      action: "data_exported",
      tenantId,
      metadata: {
        slug: tenant.slug,
        name: tenant.name,
        counts: {
          products: products.length,
          customers: customers.length,
          orders: orders.length,
          storefrontPages: storefrontPages.length,
          promoCodes: promoCodes.length,
          stockMovements: stockMovements.length,
        },
      },
    });

    const day = exportedAt.toISOString().slice(0, 10);
    return {
      ok: true,
      filename: `${tenant.slug}-${day}.json`,
      // `JSON.stringify` sérialise les Date en ISO 8601 et les Decimal Prisma en
      // nombre : aucune perte pour les types réellement présents dans ce schéma
      // (Int, String, String[], Json, DateTime, Boolean).
      json: JSON.stringify(payload, null, 2),
    };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}
```

- [ ] **Step 4: Ajouter l'exemption**

Dans `lib/impersonation/guard-coverage.test.ts` : `"platform/export.ts": ["exportTenantData"],`

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run lib/platform/export.test.ts lib/impersonation/guard-coverage.test.ts && npm run typecheck`
Expected: PASS, typecheck propre.

- [ ] **Step 6: Commit**

```bash
git add lib/platform/export.ts lib/platform/export.test.ts lib/impersonation/guard-coverage.test.ts
git commit -m "feat(support): add full tenant JSON export, traced as data_exported"
```

---

### Task 14: Onglet « Zone de danger » — suspendre, réactiver, archiver, exporter

L'UI de tout ce qui précède, **sans la suppression** (tâche 15).

**Files:**
- Create: `components/platform/screens/TenantDangerTab.tsx`
- Modify: `components/platform/screens/TenantDetailScreen.tsx`
- Modify: `app/(admin)/(console)/boutiques/[slug]/page.tsx`

**Interfaces:**
- Consumes: `suspendTenant`, `reactivateTenant`, `archiveTenant` (tâche 4), `exportTenantData` (tâche 13), `canTransition`/`STATUS_LABELS` (tâche 2), `FormMessage` (existant).
- Produces: `TenantDangerTab({ tenant }: { tenant: TenantDetail })`.

- [ ] **Step 1: Écrire le composant**

Créer `components/platform/screens/TenantDangerTab.tsx` :

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, adminBorder } from "@/lib/theme/tokens";
import { suspendTenant, reactivateTenant, archiveTenant } from "@/lib/platform/lifecycle";
import { exportTenantData } from "@/lib/platform/export";
import { canTransition } from "@/lib/platform/transitions";
import { FormMessage, type FormMessageState } from "@/components/platform/FormMessage";
import type { TenantDetail } from "@/lib/platform/queries";

function Card({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <section style={{ background: colors.surface, border: adminBorder, borderRadius: 16, padding: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>{title}</h2>
      <p style={{ fontSize: 14, color: colors.muted, margin: "0 0 14px" }}>{body}</p>
      {children}
    </section>
  );
}

function actionButton(danger: boolean, busy: boolean): React.CSSProperties {
  return {
    background: danger ? colors.danger : colors.primary,
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 600,
    cursor: busy ? "default" : "pointer",
    opacity: busy ? 0.7 : 1,
  };
}

/**
 * Onglet « Zone de danger » (spec §6, onglet 6). Chaque action n'est RENDUE que
 * si `canTransition` l'autorise, plutôt que rendue puis désactivée : la table du
 * spec §9 devient la seule source de vérité de ce qui est proposé, et l'écran ne
 * peut pas offrir une action que l'action serveur refusera.
 */
export function TenantDangerTab({ tenant }: { tenant: TenantDetail }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<FormMessageState>(null);
  const [busy, setBusy] = useState(false);

  async function run(label: string, action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    if (!window.confirm(`${label} « ${tenant.name} » ?`)) return;
    setMessage(null);
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setMessage({ kind: "ok", text: "Modification enregistrée." });
    router.refresh();
  }

  async function handleExport() {
    setMessage(null);
    setBusy(true);
    const result = await exportTenantData(tenant.id);
    setBusy(false);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    const url = URL.createObjectURL(new Blob([result.json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = result.filename;
    link.click();
    URL.revokeObjectURL(url);
    setMessage({ kind: "ok", text: `Export téléchargé (${result.filename}).` });
  }

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 760 }}>
      {canTransition(tenant.status, "suspended") && (
        <Card
          title="Suspendre la boutique"
          body="La vitrine devient indisponible et le back-office est bloqué. Les données restent intactes et la suspension est réversible à tout moment."
        >
          <label style={{ display: "block", fontSize: 13, color: colors.muted, marginBottom: 6 }}>
            Motif (facultatif, interne — jamais affiché aux clientes)
          </label>
          <input
            type="text"
            value={reason}
            maxLength={280}
            onChange={(event) => setReason(event.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: adminBorder,
              fontSize: 14,
              marginBottom: 12,
            }}
          />
          <button
            type="button"
            disabled={busy}
            style={actionButton(true, busy)}
            onClick={() => run("Suspendre", () => suspendTenant(tenant.id, { reason }))}
          >
            Suspendre
          </button>
        </Card>
      )}

      {canTransition(tenant.status, "active") && (
        <Card
          title="Réactiver la boutique"
          body="La vitrine et le back-office redeviennent accessibles immédiatement."
        >
          <button
            type="button"
            disabled={busy}
            style={actionButton(false, busy)}
            onClick={() => run("Réactiver", () => reactivateTenant(tenant.id))}
          >
            Réactiver
          </button>
        </Card>
      )}

      {canTransition(tenant.status, "archived") && (
        <Card
          title="Archiver la boutique"
          body="La boutique sort du parc : elle disparaît de la liste par défaut et n'est plus accessible ni en vitrine ni en back-office. Réversible, et préalable obligatoire à la suppression définitive."
        >
          <button
            type="button"
            disabled={busy}
            style={actionButton(true, busy)}
            onClick={() => run("Archiver", () => archiveTenant(tenant.id))}
          >
            Archiver
          </button>
        </Card>
      )}

      <Card
        title="Exporter les données"
        body="Télécharge un fichier JSON contenant produits, clientes, commandes, pages vitrine, codes promo et mouvements de stock. À faire avant toute suppression."
      >
        <button type="button" disabled={busy} style={actionButton(false, busy)} onClick={handleExport}>
          Exporter les données (JSON)
        </button>
      </Card>

      <FormMessage message={message} />
    </div>
  );
}
```

**Note pour l'implémenteur :** la section « Supprimer définitivement » est **absente à ce stade**, volontairement — elle est ajoutée en tâche 15, qui exige une confirmation explicite de l'utilisateur. Ne pas l'anticiper ici.

- [ ] **Step 2: Router l'onglet**

Dans `TenantDetailScreen.tsx` : `{ id: "danger", label: "Zone de danger", available: true }`.
Dans `[slug]/page.tsx` : `{tab === "danger" && <TenantDangerTab tenant={tenant} />}`.

- [ ] **Step 3: Run typecheck and full suite**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck propre, suite verte.

- [ ] **Step 4: Commit**

```bash
git add components/platform/screens/TenantDangerTab.tsx components/platform/screens/TenantDetailScreen.tsx "app/(admin)"
git commit -m "feat(lifecycle): add the danger zone tab for suspension, archival and export"
```

---

### Task 15: Suppression définitive ⚠️ DESTRUCTIF

> **ARRÊT OBLIGATOIRE.** Cette tâche ne doit pas être lancée sans **confirmation explicite de l'utilisateur**, conformément à `CLAUDE.md` §12 et au spec §9. La confirmation ne s'infère jamais — ni de l'approbation du plan, ni de l'approbation d'une tâche précédente. Elle doit être demandée séparément, juste avant d'exécuter cette tâche.
>
> Ce que la confirmation couvre : **écrire le code** de la suppression. Elle ne couvre **pas** l'exécution d'une suppression réelle sur la base de production — aucune boutique réelle ne doit être supprimée pendant l'implémentation, et les tests de cette tâche ne touchent jamais la vraie base (Prisma est mocké).
>
> **Aucune migration n'est nécessaire** — vérifié en base le 2026-07-31 : aucune FK n'est en `CASCADE`, la suppression est donc entièrement applicative, en `deleteMany` ordonnés. Si un implémenteur conclut qu'une migration est requise, il doit s'arrêter et demander.

**Files:**
- Create: `lib/platform/deletion.ts`
- Test: `lib/platform/deletion.test.ts`
- Modify: `lib/platform/lifecycle.ts` (ajout de `deleteTenant`)
- Modify: `lib/platform/lifecycle.test.ts`
- Modify: `lib/impersonation/guard-coverage.test.ts`
- Modify: `components/platform/screens/TenantDangerTab.tsx`

**Interfaces:**
- Consumes: `canTransition`/`transitionRefusal` (tâche 2), `deleteTenantSchema` (tâche 3).
- Produces:
  - `TENANT_DELETION_ORDER: readonly string[]` — l'ordre documenté, exporté pour le test.
  - `deleteTenantRows(tx: Prisma.TransactionClient, tenantId: string): Promise<void>`
  - `deleteTenant(tenantId: string, input: DeleteTenantInput): Promise<PlatformResult>`

**L'ordre de suppression et pourquoi il est ce qu'il est.** Relations vérifiées en base le 2026-07-31 : toutes en `NO ACTION`/`RESTRICT`, aucune en `CASCADE`. Chaque ligne doit donc partir avant celles dont elle dépend.

| # | Table | Filtre | Doit précéder |
|---|---|---|---|
| 1 | `OrderLine` | `order: { tenantId }` | `Order` (FK `orderId`), `Product` (FK `productId`) |
| 2 | `OrderStatusEvent` | `tenantId` | `Order`, `Profile` (FK `authorId`) |
| 3 | `StockMovement` | `tenantId` | `Product` (FK `productId`), `Profile` (FK `authorId`) |
| 4 | `Order` | `tenantId` | `Customer` (FK `customerId`) |
| 5 | `Customer` | `tenantId` | `Profile` (FK `profileId`) |
| 6 | `Notification` | `tenantId` | `Tenant` |
| 7 | `StorefrontPage` | `tenantId` | `Tenant` |
| 8 | `PromoCode` | `tenantId` | `Tenant` |
| 9 | `Product` | `tenantId` | `Tenant` |
| 10 | `Profile` | `tenantId` | `EmployeeRole` (FK `employeeRoleId`), `Tenant` |
| 11 | `EmployeeRole` | `tenantId` | `Tenant` |
| 12 | `Tenant` | `id` | — |

`PlatformAuditLog` n'est **jamais** supprimée : elle n'a délibérément aucune FK vers `Tenant` ni `Profile` (spec §1.3), précisément pour survivre à cette opération.

- [ ] **Step 1: Write the failing test for the deletion order**

Créer `lib/platform/deletion.test.ts` :

```ts
import { describe, it, expect, vi } from "vitest";
import { TENANT_DELETION_ORDER, deleteTenantRows } from "@/lib/platform/deletion";

function makeTx() {
  const calls: Array<{ model: string; args: Record<string, unknown> }> = [];
  const models = [
    "orderLine",
    "orderStatusEvent",
    "stockMovement",
    "order",
    "customer",
    "notification",
    "storefrontPage",
    "promoCode",
    "product",
    "profile",
    "employeeRole",
  ];
  const tx: Record<string, unknown> = {
    tenant: {
      delete: async (args: Record<string, unknown>) => {
        calls.push({ model: "tenant", args });
        return {};
      },
    },
  };
  for (const model of models) {
    tx[model] = {
      deleteMany: async (args: Record<string, unknown>) => {
        calls.push({ model, args });
        return { count: 0 };
      },
    };
  }
  return { tx, calls };
}

describe("TENANT_DELETION_ORDER", () => {
  it("supprime les enfants avant leurs parents", () => {
    const at = (model: string) => TENANT_DELETION_ORDER.indexOf(model);
    expect(at("orderLine")).toBeLessThan(at("order"));
    expect(at("orderLine")).toBeLessThan(at("product"));
    expect(at("orderStatusEvent")).toBeLessThan(at("order"));
    expect(at("orderStatusEvent")).toBeLessThan(at("profile"));
    expect(at("stockMovement")).toBeLessThan(at("product"));
    expect(at("stockMovement")).toBeLessThan(at("profile"));
    expect(at("order")).toBeLessThan(at("customer"));
    expect(at("customer")).toBeLessThan(at("profile"));
    expect(at("profile")).toBeLessThan(at("employeeRole"));
    expect(at("employeeRole")).toBeLessThan(at("tenant"));
  });

  it("couvre les onze tables porteuses d'un tenantId, plus OrderLine et Tenant", () => {
    expect(TENANT_DELETION_ORDER).toEqual([
      "orderLine",
      "orderStatusEvent",
      "stockMovement",
      "order",
      "customer",
      "notification",
      "storefrontPage",
      "promoCode",
      "product",
      "profile",
      "employeeRole",
      "tenant",
    ]);
  });

  it("ne supprime jamais PlatformAuditLog — le journal doit survivre (spec §1.3)", () => {
    expect(TENANT_DELETION_ORDER).not.toContain("platformAuditLog");
  });
});

describe("deleteTenantRows", () => {
  it("appelle chaque table dans l'ordre déclaré", async () => {
    const { tx, calls } = makeTx();
    await deleteTenantRows(tx as never, "t1");
    expect(calls.map((c) => c.model)).toEqual([...TENANT_DELETION_ORDER]);
  });

  it("filtre OrderLine par la boutique de sa commande, faute de tenantId propre", async () => {
    const { tx, calls } = makeTx();
    await deleteTenantRows(tx as never, "t1");
    expect(calls[0]).toEqual({ model: "orderLine", args: { where: { order: { tenantId: "t1" } } } });
  });

  it("filtre toutes les autres tables par tenantId, et Tenant par son id", async () => {
    const { tx, calls } = makeTx();
    await deleteTenantRows(tx as never, "t1");
    for (const call of calls.slice(1, -1)) {
      expect(call.args).toEqual({ where: { tenantId: "t1" } });
    }
    expect(calls[calls.length - 1]).toEqual({ model: "tenant", args: { where: { id: "t1" } } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/platform/deletion.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write the deletion module**

Créer `lib/platform/deletion.ts` :

```ts
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Ordre de suppression des lignes d'une boutique (spec §9). Vérifié contre la
 * base le 2026-07-31 : AUCUNE clé étrangère de ce schéma n'est en `CASCADE`
 * (toutes en `NO ACTION`/`RESTRICT`), donc chaque table doit partir avant celles
 * dont elle dépend. Toute nouvelle table portant un `tenantId` DOIT être ajoutée
 * ici, sans quoi la suppression échouera sur une violation de contrainte.
 *
 * `PlatformAuditLog` en est délibérément absente : elle n'a aucune FK vers
 * `Tenant` ni `Profile` précisément pour survivre à cette opération (spec §1.3) —
 * l'entrée `tenant_deleted` est la trace qu'on veut conserver.
 */
export const TENANT_DELETION_ORDER = [
  "orderLine", // FK orderId → Order, productId → Product
  "orderStatusEvent", // FK orderId → Order, authorId → Profile
  "stockMovement", // FK productId → Product, authorId → Profile
  "order", // FK customerId → Customer
  "customer", // FK profileId → Profile
  "notification",
  "storefrontPage",
  "promoCode",
  "product",
  "profile", // FK employeeRoleId → EmployeeRole
  "employeeRole",
  "tenant",
] as const;

/**
 * Supprime toutes les lignes d'une boutique, dans l'ordre ci-dessus. Reçoit un
 * client de transaction : l'appelant décide de la portée transactionnelle.
 */
export async function deleteTenantRows(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
  // OrderLine ne porte pas de tenantId — elle passe par sa commande.
  await tx.orderLine.deleteMany({ where: { order: { tenantId } } });
  await tx.orderStatusEvent.deleteMany({ where: { tenantId } });
  await tx.stockMovement.deleteMany({ where: { tenantId } });
  await tx.order.deleteMany({ where: { tenantId } });
  await tx.customer.deleteMany({ where: { tenantId } });
  await tx.notification.deleteMany({ where: { tenantId } });
  await tx.storefrontPage.deleteMany({ where: { tenantId } });
  await tx.promoCode.deleteMany({ where: { tenantId } });
  await tx.product.deleteMany({ where: { tenantId } });
  await tx.profile.deleteMany({ where: { tenantId } });
  await tx.employeeRole.deleteMany({ where: { tenantId } });
  await tx.tenant.delete({ where: { id: tenantId } });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/platform/deletion.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Write the failing test for `deleteTenant`**

Ajouter à `lib/platform/lifecycle.test.ts` :

```ts
describe("deleteTenant", () => {
  it("REFUS 1 — refuse de supprimer une boutique active (spec §9)", async () => {
    const result = await deleteTenant("t1", { confirmSlug: "boutique-test" });
    expect(result).toEqual({
      ok: false,
      error: "Seule une boutique archivée peut être supprimée définitivement. Archivez-la d'abord.",
    });
    expect(dbState.calls.deleteMany).toHaveLength(0);
  });

  it("REFUS 1 bis — refuse aussi de supprimer une boutique suspendue", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "suspended" };
    const result = await deleteTenant("t1", { confirmSlug: "boutique-test" });
    expect(result.ok).toBe(false);
    expect(dbState.calls.deleteMany).toHaveLength(0);
  });

  it("REFUS 2 — refuse un slug de confirmation incorrect, sans effet de bord (spec §11)", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "archived" };
    const result = await deleteTenant("t1", { confirmSlug: "boutique-tests" });
    expect(result).toEqual({
      ok: false,
      error: "Le slug saisi ne correspond pas à celui de la boutique.",
    });
    expect(dbState.calls.deleteMany).toHaveLength(0);
    expect(dbState.calls.auditCreate).toHaveLength(0);
  });

  it("supprime une boutique archivée dont le slug est confirmé", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "archived" };
    const result = await deleteTenant("t1", { confirmSlug: "boutique-test" });
    expect(result).toEqual({ ok: true });
    expect(dbState.calls.tenantDelete).toHaveLength(1);
  });

  it("écrit tenant_deleted en conservant le nom et le slug dans metadata (spec §9)", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "archived" };
    await deleteTenant("t1", { confirmSlug: "boutique-test" });
    const audit = dbState.calls.auditCreate[0].data as Record<string, unknown>;
    expect(audit.action).toBe("tenant_deleted");
    expect(audit.metadata).toMatchObject({ slug: "boutique-test", name: "Boutique Test" });
  });

  it("supprime les comptes Auth au mieux, après la transaction", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "archived" };
    dbState.profileIds = ["owner-1", "staff-1"];
    await deleteTenant("t1", { confirmSlug: "boutique-test" });
    expect(adminState.calls.deleteUser).toEqual(["owner-1", "staff-1"]);
  });

  it("réussit quand même si la suppression d'un compte Auth échoue — la base fait foi", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "archived" };
    dbState.profileIds = ["owner-1"];
    adminState.deleteUserThrows = true;
    expect(await deleteTenant("t1", { confirmSlug: "boutique-test" })).toEqual({ ok: true });
  });

  it("accepte un slug de confirmation avec des espaces autour (trim du schéma Zod)", async () => {
    dbState.tenant = { id: "t1", slug: "boutique-test", name: "Boutique Test", status: "archived" };
    expect(await deleteTenant("t1", { confirmSlug: "  boutique-test  " })).toEqual({ ok: true });
  });
});
```

**Note pour l'implémenteur :** le mock `@/lib/db/client` de `lifecycle.test.ts` doit être étendu pour capturer `deleteMany`/`delete` sur toutes les tables et `findMany` sur `profile` ; ajouter le mock `@/lib/supabase/admin`. Étendre l'état hoisté existant, ne pas dupliquer le fichier.

- [ ] **Step 6: Implémenter `deleteTenant`**

Ajouter à `lib/platform/lifecycle.ts` :

```ts
/**
 * Suppression définitive (spec §9). Réservée aux boutiques ARCHIVÉES et
 * confirmée par la saisie du slug — les deux refus du spec §11.
 *
 * Les lignes métier et le `Tenant` partent dans UNE transaction, avec l'entrée
 * `tenant_deleted` : « supprimé » et « tracé » sont le même événement. Les
 * comptes Supabase Auth sont supprimés APRÈS, au mieux et hors transaction :
 * Postgres et Auth sont deux systèmes sans transaction commune, et un compte
 * Auth orphelin est bénin (son `Profile` n'existe plus, donc aucune session ne
 * résout) là où une transaction annulée pour cette raison laisserait la
 * boutique à moitié supprimée.
 */
export async function deleteTenant(
  tenantId: string,
  input: DeleteTenantInput
): Promise<PlatformResult> {
  const actor = await currentSuperAdmin();
  if (!actor) return { ok: false, error: GENERIC_ERROR };

  const parsed = deleteTenantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Informations invalides." };
  }

  let slug = "";
  let profileIds: string[] = [];
  try {
    const before = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true, name: true, status: true },
    });
    if (!before) return { ok: false, error: NOT_FOUND_ERROR };
    slug = before.slug;

    // REFUS 1 (spec §9) : seule une boutique archivée peut être supprimée.
    const refusal = transitionRefusal(before.status as TenantStatus, "deleted");
    if (refusal) return { ok: false, error: refusal };

    // REFUS 2 (spec §11) : slug de confirmation incorrect, sans effet de bord.
    if (parsed.data.confirmSlug !== before.slug) {
      return { ok: false, error: "Le slug saisi ne correspond pas à celui de la boutique." };
    }

    const profiles = await prisma.profile.findMany({ where: { tenantId }, select: { id: true } });
    profileIds = profiles.map((p) => p.id);

    await prisma.$transaction(async (tx) => {
      await deleteTenantRows(tx, tenantId);
      await recordPlatformAction(
        {
          actorId: actor.userId,
          action: "tenant_deleted",
          tenantId,
          metadata: { slug: before.slug, name: before.name, profilesDeleted: profileIds.length },
        },
        tx
      );
    });
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  // Au mieux, hors transaction : la base fait foi, un compte Auth orphelin est bénin.
  const admin = createAdminClient();
  for (const id of profileIds) {
    try {
      await admin.auth.admin.deleteUser(id);
    } catch {
      // Ignoré volontairement : la boutique est déjà supprimée en base.
    }
  }

  updateTag(TENANTS_CACHE_TAG);
  revalidatePath("/boutiques");
  revalidatePath(`/boutiques/${slug}`);
  return { ok: true };
}
```

Ajouter les imports nécessaires en tête de `lifecycle.ts` : `createAdminClient`, `deleteTenantRows`, `deleteTenantSchema`, `DeleteTenantInput`.

- [ ] **Step 7: Compléter l'exemption**

Dans `lib/impersonation/guard-coverage.test.ts`, ajouter `"deleteTenant"` à la liste `"platform/lifecycle.ts"`.

- [ ] **Step 8: Brancher l'UI**

Dans `TenantDangerTab.tsx`, ajouter une section « Supprimer définitivement », **rendue uniquement si `canTransition(tenant.status, "deleted")`**. Quand elle ne l'est pas, afficher à la place une phrase expliquant qu'il faut archiver d'abord. La section contient :
- Un avertissement listant ce qui sera supprimé (produits, clientes, commandes, mouvements de stock, codes promo, pages vitrine, profils d'accès, comptes) et rappelant que le journal d'audit, lui, est conservé.
- Un lien « Exporter les données avant de supprimer » réutilisant `handleExport`.
- Un champ texte dont le `placeholder` est le slug, avec le libellé `Tapez « <slug> » pour confirmer`.
- Un bouton « Supprimer définitivement », **désactivé tant que la saisie ne correspond pas exactement au slug**, plus un `window.confirm` final.
- En cas de succès : `router.push("/boutiques")` — la fiche n'existe plus, y rester donnerait un 404.

- [ ] **Step 9: Run tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: suite verte, typecheck propre.

- [ ] **Step 10: Commit**

```bash
git add lib/platform/deletion.ts lib/platform/deletion.test.ts lib/platform/lifecycle.ts lib/platform/lifecycle.test.ts lib/impersonation/guard-coverage.test.ts components/platform/screens/TenantDangerTab.tsx
git commit -m "feat(lifecycle): add permanent tenant deletion, archived-only and slug-confirmed"
```

---

### Task 16: Parcours complet relu de bout en bout dans le code

**La tâche la plus importante du plan.** En phase 3, les 12 tâches ont toutes été approuvées individuellement et la fonctionnalité ne marchait pas du tout : `proxy.ts` et `lib/platform/guard.ts` n'appartenaient à aucune tâche. Une revue par tâche ne peut pas voir ce qu'aucune tâche ne possède.

Cette tâche n'écrit presque pas de code. Elle **lit** le trajet complet, en vérifiant à chaque flèche que l'étape suivante consomme bien ce que la précédente produit.

**Files:**
- Read: tous les fichiers touchés par les tâches 1 à 15
- Create: `lib/platform/lifecycle-walkthrough.test.ts`

**Interfaces:**
- Consumes: tout.
- Produces: un test d'intégration, plus un rapport écrit.

- [ ] **Step 1: Suspendre — relire la chaîne, fichier par fichier**

Ouvrir chaque fichier et vérifier la propriété nommée. Écrire OUI/NON pour chacune ; un seul NON arrête la tâche.

1. `components/platform/screens/TenantDangerTab.tsx` — le bouton « Suspendre » n'est rendu que si `canTransition(status, "suspended")`, et appelle bien `suspendTenant(tenant.id, { reason })`.
2. `lib/platform/lifecycle.ts` — `suspendTenant` écrit `status: "suspended"`, trace `tenant_suspended`, appelle `updateTag(TENANTS_CACHE_TAG)`.
3. `lib/tenant/registry.ts` — `loadTenants` est étiqueté `TENANTS_CACHE_TAG` **et** son `select` contient `status`. *(Sans le second, `updateTag` invalide un cache qui ne porte pas l'information — le trou exact de la phase 3.)*
4. `lib/tenant/index.ts` — `getCurrentTenantOrNull` renvoie un objet portant `status`.
5. `app/(storefront)/layout.tsx` — branche `suspended` → `StoreUnavailable`.
6. Les cinq pages de `app/(storefront)/` — toutes passées à `requireActiveStorefrontTenant()`. Le vérifier par `grep -rn "getCurrentTenantOrNull" "app/(storefront)"` : **le résultat attendu est le seul layout**.
7. `app/(dashboard)/layout.tsx` — branche bloquante, et le bandeau d'impersonation y est rendu.
8. `app/(auth)/connexion/page.tsx` — bloquée en zone dashboard, **pas** en zone plateforme.
9. `lib/auth/actions.ts` — `signIn` refuse ; `signInPlatform` est intact.
10. `proxy.ts` — inchangé, décision documentée.

- [ ] **Step 2: Vérifier — réactiver — archiver — supprimer**

- **Réactiver** : `reactivateTenant` remet `status: "active"` **et** efface `suspendedAt`, `suspendedReason`, `archivedAt`. Vérifier qu'une boutique archivée puis réactivée ne conserve aucun marqueur.
- **Archiver** : `listTenants()` sans option ne la renvoie plus ; `/boutiques?archivees=1` la renvoie ; la fiche reste accessible ; la vitrine rend un 404 (pas la page « indisponible ») ; « Entrer dans la boutique » est refusé côté action **et** désactivé côté bouton.
- **Supprimer** : la section n'apparaît que sur une boutique archivée ; le bouton reste désactivé tant que le slug ne correspond pas ; `TENANT_DELETION_ORDER` couvre toutes les tables porteuses d'un `tenantId` — le vérifier par `grep -n "tenantId" prisma/schema.prisma` et comparer table à table.

- [ ] **Step 3: Vérifier les trois invariants de la phase 3**

Rien de cette phase ne doit les avoir entamés (handover phase 3 §2) :

```bash
npx vitest run lib/impersonation/ proxy.test.ts
```

Puis relire :
1. `lib/impersonation/context.ts` — `resolveActorAndSession()` retourne toujours **avant** toute lecture du cookie quand `actor.role !== "super_admin"`.
2. `lib/impersonation/actions.ts` — `unlockImpersonationWrite` préserve toujours le `startedAt` d'origine.
3. `proxy.ts` — zone dashboard gardée sur l'identité **effective**, zone admin sur l'acteur **réel**.

- [ ] **Step 4: Écrire le test d'intégration du parcours**

Créer `lib/platform/lifecycle-walkthrough.test.ts` : un unique test qui enchaîne les transitions sur un état de tenant partagé et mis à jour par les mocks (et non re-stubé à la main entre les étapes — c'est le reproche fait au test « séquence complète » de la phase 3, handover §6) :

```ts
it("parcours complet : active → suspendue → active → archivée → supprimée", async () => {
  expect(await suspendTenant("t1", { reason: "Impayé" })).toEqual({ ok: true });
  expect(tenantRow.status).toBe("suspended");

  // Refus attendu à mi-parcours : on ne supprime pas une boutique suspendue.
  expect((await deleteTenant("t1", { confirmSlug: "boutique-test" })).ok).toBe(false);

  expect(await reactivateTenant("t1")).toEqual({ ok: true });
  expect(tenantRow.status).toBe("active");
  expect(tenantRow.suspendedReason).toBeNull();

  expect(await archiveTenant("t1")).toEqual({ ok: true });
  expect(tenantRow.status).toBe("archived");

  // Refus attendu : mauvais slug de confirmation.
  expect((await deleteTenant("t1", { confirmSlug: "mauvais-slug" })).ok).toBe(false);
  expect(tenantRow.status).toBe("archived");

  expect(await deleteTenant("t1", { confirmSlug: "boutique-test" })).toEqual({ ok: true });
  expect(deletedTenantIds).toEqual(["t1"]);

  // Le journal survit à la suppression (spec §1.3) : six entrées, la dernière tenant_deleted.
  expect(auditActions).toEqual([
    "tenant_suspended",
    "tenant_reactivated",
    "tenant_archived",
    "tenant_deleted",
  ]);
});
```

**Le point qui compte :** le mock `tenant.update` doit **muter** `tenantRow` pour que le `findUnique` suivant voie le nouvel état. Un mock qui renvoie un état figé rendrait ce test incapable d'attraper une transition mal appliquée — exactement la faiblesse relevée en phase 3.

- [ ] **Step 5: Run the full verification**

```bash
npx vitest run && npm run typecheck
```

Expected: **toute** la suite verte (≥ 419 tests de base + les nouveaux), typecheck sans sortie.

- [ ] **Step 6: Vérifier la base réelle, sans rien y modifier**

La suppression n'est **jamais** exécutée sur la base réelle pendant l'implémentation. Vérification en **lecture seule** que le schéma correspond aux hypothèses du code, via un script temporaire hors du dépôt :

```bash
npx tsx --env-file=.env ./.tmp-verify.ts
```

Le script contrôle : les 15 valeurs de `PlatformAction` sont présentes ; la boutique `foulard-teranga` est toujours `active` ; aucune FK n'est passée en `CASCADE` ; `PlatformAuditLog` n'a gagné aucune ligne inattendue. Supprimer le script après usage (`rm ./.tmp-verify.ts`).

- [ ] **Step 7: Rédiger le rapport et commiter**

Rapport (dans le message de commit ou une note de passation) : ce qui a été relu, les OUI/NON de l'étape 1, tout écart trouvé et sa correction.

```bash
git add lib/platform/lifecycle-walkthrough.test.ts
git commit -m "test(lifecycle): cover the full suspend → archive → delete walkthrough"
```

---

## Ce que ce plan NE fait PAS

Explicite, pour qu'aucune revue ne le compte comme un manque :

- **Onglet « Journal » de la fiche boutique** — spec §13 le place en **phase 5** (`/journal`, tableau de bord agrégé, annonces, liste « à relancer »). Il reste `available: false`.
- **Tableau de bord plateforme agrégé** (§10, « Boutiques par état, chiffre d'affaires total… ») — phase 5.
- **Annonces plateforme** et la valeur d'enum `NotificationType.annonce_plateforme` — phase 5. Vérifié en base : cet enum vaut aujourd'hui `nouvelle_commande, stock_bas, paiement_recu`, et **la phase 4 ne le modifie pas** (donc aucune migration).
- **Suspension automatique pour impayé** — hors scope v1 (spec « Hors scope »).
- **Édition des profils d'accès depuis la zone plateforme** — l'onglet Équipe est en lecture seule sauf pour la gérante (mot de passe, création). L'édition des `EmployeeRole` reste dans le back-office de la boutique, où elle existe déjà.
- **Playwright** — aucun harnais e2e dans ce dépôt (manque antérieur aux phases 1-4). Le spec §12 en décrit ; les mettre en place est un chantier propre, pas un sous-produit de cette phase.
- **Les deux constats multi-boutique de la phase 3** (cookie d'impersonation sans attribut `domain` ; `/admin` et `/platform` codés en dur) — inertes en mono-boutique, ce sont des décisions de conception à écrire, pas des correctifs.

## Points en suspens côté utilisateur, inchangés

- **`IMPERSONATION_COOKIE_SECRET` n'est pas défini dans Vercel** (confirmé le 2026-07-31) — bloquant avant tout déploiement de la phase 3 comme de la phase 4. Générer avec `openssl rand -base64 32`, puis l'ajouter dans Vercel → Settings → Environment Variables (Production).
- **Aucun domaine de production arrêté** (confirmé le 2026-07-31) — `Tenant.domains` vaut toujours `['localhost', 'foulard-teranga.localhost']`.
- **Le parcours navigateur en direct des phases 2 et 3 n'a pas encore remonté ses bugs.** `PlatformAuditLog` est **vide** en base au 2026-07-31 : aucune action des phases 2/3 n'a jamais tourné en réel. Les parcours authentifiés restent à la charge de l'utilisateur — aucun mot de passe n'est saisi à sa place.
- **Constat de base à trancher** : deux profils `owner` existent pour l'unique boutique. `getTenantBySlug` ne remonte que le **premier** par `createdAt`, donc « Entrer dans la boutique » et la réinitialisation du mot de passe ne visent que celui-là. L'onglet Équipe (tâche 12) les affichera tous les deux, ce qui rendra la situation visible ; décider ensuite s'il faut en désactiver un.
