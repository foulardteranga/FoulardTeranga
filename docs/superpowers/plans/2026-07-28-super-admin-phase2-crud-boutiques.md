# Super-admin plateforme — Phase 2 (CRUD boutiques) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au prestataire (`super_admin`) un espace plateforme utilisable : il s'y connecte, voit son parc de boutiques, en crée une complète (compte gérante + données par défaut), et édite l'identité et les modules de chaque boutique — chaque action étant tracée dans `PlatformAuditLog`.

**Architecture:** La zone `admin` existe déjà dans le routage (`lib/proxy/zones.ts`, `proxy.ts`) mais est dormante. On l'ouvre : `/connexion` devient un chemin autorisé de la zone, `proxy.ts` publie la zone résolue dans un en-tête `x-zone` et redirige les accès refusés vers la connexion plateforme. Les écrans vivent sous `app/(admin)/(console)/`, protégés par un layout garde. Toutes les requêtes sans filtre `tenantId` sont concentrées dans `lib/platform/queries.ts`, toutes les mutations dans `lib/platform/actions.ts`, toutes deux derrière un garde `super_admin` partagé (`lib/platform/guard.ts`). La logique décidable sans base (paliers → modules, normalisation de domaines, schémas Zod, données provisionnées par défaut) est extraite en modules purs testés unitairement ; les écrans, non testables dans le harnais actuel, sont vérifiés à la main dans le navigateur.

**Tech Stack:** Next.js 16.2 (App Router, Server Components, Server Actions), React 19.2, TypeScript strict, Prisma 7 sur Supabase Postgres, Supabase Auth (`createAdminClient()` pour la création de comptes), Zod 4, Vitest 4 (environnement `node`).

---

## Global Constraints

Ces règles s'appliquent à **toutes** les tâches ci-dessous. Elles proviennent de `CLAUDE.md`, du spec `docs/superpowers/specs/2026-07-26-super-admin-platform-design.md` et du handover `docs/superpowers/HANDOVER-super-admin-phase-2.md`.

- **Aucune migration n'est nécessaire en phase 2.** Le schéma livré par la phase 1 suffit (`Tenant.status/plan/enabledModules`, `Profile.tenantId` nullable, `PlatformAuditLog`). Si une tâche semble en exiger une, **s'arrêter et demander** — ne pas en inventer une.
- **`npx prisma migrate dev` est interdit dans ce projet** (la shadow database n'a pas le schéma `auth` de Supabase). Si une migration devenait nécessaire : fichier SQL écrit à la main + `mcp__supabase__apply_migration`. Voir handover §2.1.
- **`npm run lint` est cassé sur `main`, avant tout ce travail** (`next lint` → `Invalid project directory ... /lint`, bug d'outillage Next 16.2). Ne jamais compter cet échec contre son propre travail. Les filets sont `npm run typecheck` et `npx vitest run`.
- **TypeScript strict, jamais de `any`** (préférer `unknown` + narrowing).
- **Server Components par défaut**, `"use client"` seulement pour l'interactivité. Mutations via Server Actions validées par Zod.
- **Résultats typés** : `{ ok: true } | { ok: false; error: string }`, messages en français, repli générique `« Une erreur est survenue, réessayez. »`. Jamais d'exception silencieuse.
- **La RLS n'est PAS la garde principale.** Prisma se connecte sans JWT et contourne la RLS. Le garde réel est le contrôle de rôle en tête de chaque Server Action / fonction de requête. Voir handover §2.2.
- **`lib/platform/queries.ts` est le seul module autorisé à requêter sans filtre `tenantId`.** Partout ailleurs l'absence de ce filtre est une fuite de données.
- **Toute mutation de boutique invalide le cache** : `updateTag(TENANTS_CACHE_TAG)` depuis la Server Action (et non `revalidateTag`, qui exige 2 arguments dans cette version et ne fait que marquer stale). Voir handover §2.4.
- **Le fichier de proxy s'appelle `proxy.ts`** (convention Next 16). Ne jamais créer `middleware.ts`.
- **Les deux contraintes CHECK mordent à la création** : `enabledModules` doit contenir `dash` (`tenant_min_modules`) et un `Profile` non-`super_admin` doit avoir un `tenantId` (`profile_tenant_role_coherent`).
- **Commits en Conventional Commits**, message en anglais, corps optionnel. Un commit par tâche minimum.
- **Ne jamais utiliser `pkill -f "next dev"`** : cela tue le serveur d'autres sessions Claude Code travaillant en parallèle sur ce dépôt. Capturer le PID (`lsof -ti:PORT`) et ne tuer que celui-là ; si le port 3000 est occupé, en prendre un autre.
- **Copier `.env` dans le worktree** s'il y en a un (il est git-ignoré, et `prisma generate` échoue sans lui au `npm install`).

### Deux décisions déjà tranchées avec l'utilisateur (2026-07-28)

1. **Le domaine de production est enregistré via l'onglet Identité construit ici** (tâche 12), pas par SQL direct anticipé. Aucune tâche de ce plan ne modifie `Tenant.domains` en base directement.
2. **Les deux constats « dictés par le plan » de la phase 1 sont corrigés dans cette phase** — tâche 14 (frontière d'erreur du layout dashboard, bruit de logs de `ProductPage` sur hôte inconnu).

---

## Structure des fichiers

**Modules purs (testés unitairement, aucune dépendance base/réseau)**

| Fichier | Responsabilité |
|---|---|
| `lib/platform/plans.ts` | Correspondance palier → modules, libellés des paliers |
| `lib/platform/domains.ts` | Normalisation et validation d'hôtes saisis à la main |
| `lib/platform/provisioning.ts` | Données provisionnées à la création (profils d'accès, page vitrine) |
| `lib/validators/platform.ts` | Schémas Zod de la zone plateforme + normalisation de slug |

**Serveur (garde `super_admin` en tête de chaque fonction)**

| Fichier | Responsabilité |
|---|---|
| `lib/platform/guard.ts` | `currentSuperAdmin()` / `requireSuperAdmin()` — garde partagé |
| `lib/platform/audit.ts` | Écriture d'une entrée `PlatformAuditLog`, utilisable dans une transaction |
| `lib/platform/queries.ts` | **Seul** module autorisé à requêter sans filtre `tenantId` |
| `lib/platform/actions.ts` | Server Actions : `createTenant`, `updateTenantIdentity`, `updateTenantModules` |

**Routage & auth (fichiers existants modifiés)**

| Fichier | Modification |
|---|---|
| `lib/proxy/zones.ts` | `ADMIN_PATHS` étendu, ajout de `platformPath()` |
| `proxy.ts` | En-tête `x-zone`, redirection d'accès refusé vers la connexion plateforme |
| `lib/auth/actions.ts` | `signInPlatform()`, `signOutPlatform()` |
| `components/auth/LoginView.tsx` | Prop `variant` (`"dashboard" | "platform"`) |
| `app/(auth)/connexion/page.tsx` | Choisit la variante d'après `x-zone` |

**Écrans de la zone plateforme (vérifiés à la main, pas de test automatisé possible)**

| Fichier | Responsabilité |
|---|---|
| `app/(admin)/(console)/layout.tsx` | Garde `super_admin` + chrome de la zone |
| `components/platform/PlatformShell.tsx` | Barre latérale, en-tête, déconnexion |
| `app/(admin)/(console)/boutiques/page.tsx` | Liste du parc (déplacée depuis `app/(admin)/boutiques/page.tsx`) |
| `components/platform/screens/TenantListScreen.tsx` | Tableau du parc, repli en cartes sur mobile |
| `app/(admin)/(console)/boutiques/nouvelle/page.tsx` | Formulaire de création |
| `components/platform/screens/NewTenantScreen.tsx` | Formulaire client de création |
| `app/(admin)/(console)/boutiques/[slug]/page.tsx` | Fiche boutique (onglets par `?onglet=`) |
| `components/platform/screens/TenantDetailScreen.tsx` | En-tête de fiche + navigation d'onglets |
| `components/platform/screens/TenantIdentityForm.tsx` | Onglet Identité |
| `components/platform/screens/TenantModulesForm.tsx` | Onglet Modules |

**Dette de la phase 1 (tâche 14)**

| Fichier | Modification |
|---|---|
| `app/(dashboard)/layout.tsx` | Frontière d'erreur autour de la résolution du tenant |
| `app/(storefront)/produit/[id]/page.tsx` | Garde d'hôte inconnu avant tout accès aux données |

### Piège de routage à connaître avant de commencer

**Il ne peut pas exister deux fichiers `page.tsx` résolvant `/connexion`.** Next.js refuse au build deux pages parallèles sur le même chemin, et les groupes de routes (`(auth)`, `(admin)`) n'affectent pas l'URL. Or la zone dashboard **et** la zone plateforme servent toutes deux `/connexion` (chemins réécrits par `proxy.ts`, cf. spec §6 : « les zones étant des espaces de chemins distincts »).

**Conséquence structurante :** on ne crée **pas** `app/(admin)/connexion/page.tsx`. La page existante `app/(auth)/connexion/page.tsx` sert les deux zones et choisit sa variante d'après l'en-tête `x-zone` posé par `proxy.ts` (tâche 5). C'est pour cela que la tâche 5 est un prérequis strict de la tâche 6.

Le même piège attend la phase 5 avec `/tableau-de-bord`, déjà pris par le dashboard : le noter, ne pas le traiter ici.

---

### Task 1: Correspondance palier → modules

**Files:**
- Create: `lib/platform/plans.ts`
- Test: `lib/platform/plans.test.ts`

**Interfaces:**
- Consumes: `MODULE_IDS`, `ModuleId` (`lib/nav.ts`) ; `TenantPlan` (`lib/generated/prisma/enums.ts`)
- Produces: `PLAN_MODULES: Record<TenantPlan, ModuleId[]>`, `PLAN_LABELS: Record<TenantPlan, string>`, `modulesForPlan(plan: TenantPlan): ModuleId[]`

Rappel spec §1.1 : `plan` n'est qu'un **pré-remplissage**, jamais une règle contraignante. La source de vérité de l'accès est `enabledModules` seul.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `lib/platform/plans.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { MODULE_IDS } from "@/lib/nav";
import { PLAN_MODULES, PLAN_LABELS, modulesForPlan } from "./plans";

describe("modulesForPlan", () => {
  it("donne au palier essentiel tout sauf marketing et finance", () => {
    const modules = modulesForPlan("essentiel");
    expect(modules).toEqual(["pos", "dash", "orders", "inv", "cust", "theme", "vitrine", "boutique"]);
    expect(modules).not.toContain("mkt");
    expect(modules).not.toContain("fin");
  });

  it("donne au palier pro tous les modules connus", () => {
    expect([...modulesForPlan("pro")].sort()).toEqual([...MODULE_IDS].sort());
  });

  it("inclut toujours dash, exigé par la contrainte tenant_min_modules", () => {
    expect(modulesForPlan("essentiel")).toContain("dash");
    expect(modulesForPlan("pro")).toContain("dash");
  });

  it("renvoie une copie : muter le résultat ne corrompt pas la table des paliers", () => {
    const modules = modulesForPlan("essentiel");
    modules.pop();
    expect(modulesForPlan("essentiel")).toHaveLength(8);
    expect(PLAN_MODULES.essentiel).toHaveLength(8);
  });

  it("nomme les deux paliers en français pour l'UI", () => {
    expect(PLAN_LABELS).toEqual({ essentiel: "Essentiel", pro: "Pro" });
  });
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
npx vitest run lib/platform/plans.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./plans"`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `lib/platform/plans.ts` :

```ts
import { MODULE_IDS, type ModuleId } from "@/lib/nav";
import type { TenantPlan } from "@/lib/generated/prisma/enums";

/** Palier « essentiel » : tout sauf marketing et finance (spec §1.1). */
const ESSENTIEL_MODULES: ModuleId[] = [
  "pos",
  "dash",
  "orders",
  "inv",
  "cust",
  "theme",
  "vitrine",
  "boutique",
];

export const PLAN_MODULES: Record<TenantPlan, ModuleId[]> = {
  essentiel: ESSENTIEL_MODULES,
  pro: [...MODULE_IDS],
};

export const PLAN_LABELS: Record<TenantPlan, string> = {
  essentiel: "Essentiel",
  pro: "Pro",
};

/**
 * Pré-remplissage des modules d'un palier. Copie défensive : l'appelant ajuste
 * ensuite librement les cases — `plan` ne contraint rien (spec §1.1).
 */
export function modulesForPlan(plan: TenantPlan): ModuleId[] {
  return [...PLAN_MODULES[plan]];
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

```bash
npx vitest run lib/platform/plans.test.ts
```

Attendu : SUCCÈS — 5 tests passent.

- [ ] **Step 5: Commit**

```bash
git add lib/platform/plans.ts lib/platform/plans.test.ts && git commit -m "feat(platform): map tenant plans to their module sets"
```

---

### Task 2: Normalisation et validation des domaines

**Files:**
- Create: `lib/platform/domains.ts`
- Test: `lib/platform/domains.test.ts`

**Interfaces:**
- Consumes: rien
- Produces: `normalizeDomain(raw: string): string`, `isValidDomain(host: string): boolean`, `parseDomains(raw: string): { ok: true; domains: string[] } | { ok: false; error: string }`

Pourquoi ce module : `Tenant.domains` alimente `resolveTenantFromHost`, qui compare des hôtes **déjà normalisés** (minuscules, sans port). Une entrée saisie `https://Boutique.CI/` ne matcherait jamais. La normalisation à la saisie évite un domaine « enregistré mais qui ne résout pas », symptôme difficile à diagnostiquer.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `lib/platform/domains.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { normalizeDomain, isValidDomain, parseDomains } from "./domains";

describe("normalizeDomain", () => {
  it("retire le schéma, le chemin, le port et met en minuscules", () => {
    expect(normalizeDomain("  HTTPS://Boutique.CI:443/accueil  ")).toBe("boutique.ci");
  });

  it("retire le point final d'un FQDN absolu", () => {
    expect(normalizeDomain("boutique.ci.")).toBe("boutique.ci");
  });

  it("laisse un hôte déjà normalisé inchangé", () => {
    expect(normalizeDomain("foulard-teranga.localhost")).toBe("foulard-teranga.localhost");
  });
});

describe("isValidDomain", () => {
  it("accepte un hôte simple sans point (localhost)", () => {
    expect(isValidDomain("localhost")).toBe(true);
  });

  it("accepte un domaine avec tirets et sous-domaines", () => {
    expect(isValidDomain("boutique-du-plateau.ci")).toBe(true);
  });

  it("refuse un hôte contenant une espace", () => {
    expect(isValidDomain("boutique du plateau.ci")).toBe(false);
  });

  it("refuse une étiquette commençant ou finissant par un tiret", () => {
    expect(isValidDomain("-boutique.ci")).toBe(false);
    expect(isValidDomain("boutique-.ci")).toBe(false);
  });

  it("refuse une chaîne vide", () => {
    expect(isValidDomain("")).toBe(false);
  });
});

describe("parseDomains", () => {
  it("découpe sur les retours à la ligne et les virgules, en normalisant", () => {
    expect(parseDomains("Boutique.CI\nhttps://www.boutique.ci, localhost")).toEqual({
      ok: true,
      domains: ["boutique.ci", "www.boutique.ci", "localhost"],
    });
  });

  it("dédoublonne après normalisation", () => {
    expect(parseDomains("boutique.ci\nBOUTIQUE.CI:443")).toEqual({
      ok: true,
      domains: ["boutique.ci"],
    });
  });

  it("ignore les lignes vides", () => {
    expect(parseDomains("\n\nboutique.ci\n\n")).toEqual({ ok: true, domains: ["boutique.ci"] });
  });

  it("renvoie une liste vide pour une saisie vide", () => {
    expect(parseDomains("   ")).toEqual({ ok: true, domains: [] });
  });

  it("échoue en nommant le domaine fautif", () => {
    expect(parseDomains("boutique.ci\nnon valide.ci")).toEqual({
      ok: false,
      error: "Domaine invalide : « non valide.ci ».",
    });
  });
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
npx vitest run lib/platform/domains.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./domains"`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `lib/platform/domains.ts` :

```ts
/**
 * Normalise un hôte saisi à la main pour qu'il corresponde exactement à ce que
 * `resolveTenantFromHost` compare : minuscules, sans schéma, sans port, sans
 * chemin, sans point final.
 */
export function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .replace(/\.$/, "");
}

const LABEL = "[a-z0-9](?:[a-z0-9-]*[a-z0-9])?";
const DOMAIN_RE = new RegExp(`^${LABEL}(?:\\.${LABEL})*$`);

export function isValidDomain(host: string): boolean {
  return host.length > 0 && host.length <= 253 && DOMAIN_RE.test(host);
}

/**
 * Découpe une saisie libre (une entrée par ligne ou séparées par des virgules),
 * normalise chaque entrée, dédoublonne, et refuse à la première entrée invalide
 * en la nommant — un domaine silencieusement ignoré serait pire qu'un refus.
 */
export function parseDomains(
  raw: string
): { ok: true; domains: string[] } | { ok: false; error: string } {
  const parts = raw
    .split(/[\n,]/)
    .map(normalizeDomain)
    .filter((d) => d.length > 0);

  const seen = new Set<string>();
  const domains: string[] = [];
  for (const domain of parts) {
    if (!isValidDomain(domain)) {
      return { ok: false, error: `Domaine invalide : « ${domain} ».` };
    }
    if (seen.has(domain)) continue;
    seen.add(domain);
    domains.push(domain);
  }
  return { ok: true, domains };
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

```bash
npx vitest run lib/platform/domains.test.ts
```

Attendu : SUCCÈS — 12 tests passent.

- [ ] **Step 5: Commit**

```bash
git add lib/platform/domains.ts lib/platform/domains.test.ts && git commit -m "feat(platform): normalize and validate operator-entered domains"
```

---

### Task 3: Schémas Zod de la zone plateforme

**Files:**
- Create: `lib/validators/platform.ts`
- Test: `lib/validators/platform.test.ts`

**Interfaces:**
- Consumes: `MODULE_IDS` (`lib/nav.ts`)
- Produces: `normalizeSlug(raw: string): string`, `tenantSlugSchema`, `tenantModulesSchema`, `createTenantSchema` / `CreateTenantInput`, `tenantIdentitySchema` / `TenantIdentityInput`, `tenantModulesFormSchema` / `TenantModulesInput`

Rappel spec §12 et handover §4 (piège 6) : l'écran Modules doit **refuser de décocher `dash`** côté Zod, en miroir de la contrainte base `tenant_min_modules`. Modèle suivi : `z.enum(MODULE_IDS)` comme dans `lib/validators/team.ts`.

Note de conception : le slug est normalisé par une **fonction séparée** appelée avant le parse, pas par un transform Zod. Cela garde le schéma purement validant (donc réutilisable côté client pour afficher une erreur sans muter la saisie) et rend la normalisation testable seule.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `lib/validators/platform.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import {
  normalizeSlug,
  tenantSlugSchema,
  tenantModulesSchema,
  createTenantSchema,
  tenantIdentitySchema,
  tenantModulesFormSchema,
} from "./platform";

describe("normalizeSlug", () => {
  it("met en minuscules et retire les espaces de bord", () => {
    expect(normalizeSlug("  Boutique-Du-Plateau  ")).toBe("boutique-du-plateau");
  });
});

describe("tenantSlugSchema", () => {
  it("accepte minuscules, chiffres et tirets", () => {
    expect(tenantSlugSchema.safeParse("foulard-teranga-2").success).toBe(true);
  });

  it("refuse les majuscules", () => {
    const r = tenantSlugSchema.safeParse("Foulard");
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Minuscules, chiffres et tirets uniquement.");
  });

  it("refuse un tiret en tête ou en fin", () => {
    expect(tenantSlugSchema.safeParse("-foulard").success).toBe(false);
    expect(tenantSlugSchema.safeParse("foulard-").success).toBe(false);
  });

  it("refuse moins de 3 caractères", () => {
    expect(tenantSlugSchema.safeParse("ab").success).toBe(false);
  });
});

describe("tenantModulesSchema", () => {
  it("accepte une sélection contenant dash", () => {
    expect(tenantModulesSchema.safeParse(["dash", "pos"]).success).toBe(true);
  });

  it("refuse une sélection sans dash, en miroir de tenant_min_modules", () => {
    const r = tenantModulesSchema.safeParse(["pos", "orders"]);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe(
        "Le module Tableau de bord ne peut pas être désactivé."
      );
    }
  });

  it("refuse un identifiant de module inconnu", () => {
    expect(tenantModulesSchema.safeParse(["dash", "compta"]).success).toBe(false);
  });

  it("refuse une sélection vide", () => {
    expect(tenantModulesSchema.safeParse([]).success).toBe(false);
  });
});

const VALID_CREATE = {
  slug: "boutique-du-plateau",
  name: "Boutique du Plateau",
  plan: "essentiel" as const,
  primaryColor: "#26326B",
  accentColor: "#D07A34",
  logoText: "BDP",
  domains: ["boutique-du-plateau.ci"],
  ownerName: "Aya Koné",
  ownerEmail: "aya@example.com",
  ownerPassword: "motdepasse1",
};

describe("createTenantSchema", () => {
  it("accepte une saisie complète et valide", () => {
    expect(createTenantSchema.safeParse(VALID_CREATE).success).toBe(true);
  });

  it("refuse une couleur qui n'est pas un hex à 6 chiffres", () => {
    expect(createTenantSchema.safeParse({ ...VALID_CREATE, primaryColor: "bleu" }).success).toBe(false);
  });

  it("refuse un mot de passe de moins de 8 caractères", () => {
    const r = createTenantSchema.safeParse({ ...VALID_CREATE, ownerPassword: "court" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("8 caractères minimum.");
  });

  it("refuse un email de gérante invalide", () => {
    expect(createTenantSchema.safeParse({ ...VALID_CREATE, ownerEmail: "aya" }).success).toBe(false);
  });

  it("accepte une liste de domaines absente et la remplace par une liste vide", () => {
    const { domains: _omitted, ...withoutDomains } = VALID_CREATE;
    const r = createTenantSchema.safeParse(withoutDomains);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.domains).toEqual([]);
  });
});

describe("tenantIdentitySchema", () => {
  it("accepte une identité complète", () => {
    const r = tenantIdentitySchema.safeParse({
      name: "Boutique du Plateau",
      slug: "boutique-du-plateau",
      tagline: "Élégance ivoirienne",
      primaryColor: "#26326B",
      accentColor: "#D07A34",
      logoText: "BDP",
      font: "Playfair Display",
      whatsappPhone: "+225 07 00 00 00 00",
      domains: [],
    });
    expect(r.success).toBe(true);
  });

  it("refuse une police hors des deux polices supportées", () => {
    const r = tenantIdentitySchema.safeParse({
      name: "Boutique du Plateau",
      slug: "boutique-du-plateau",
      primaryColor: "#26326B",
      accentColor: "#D07A34",
      logoText: "BDP",
      font: "Comic Sans",
      domains: [],
    });
    expect(r.success).toBe(false);
  });
});

describe("tenantModulesFormSchema", () => {
  it("accepte palier + modules cohérents", () => {
    expect(tenantModulesFormSchema.safeParse({ plan: "pro", modules: ["dash", "fin"] }).success).toBe(true);
  });

  it("refuse des modules sans dash même avec un palier valide", () => {
    expect(tenantModulesFormSchema.safeParse({ plan: "pro", modules: ["fin"] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
npx vitest run lib/validators/platform.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./platform"`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `lib/validators/platform.ts` :

```ts
import { z } from "zod";
import { MODULE_IDS } from "@/lib/nav";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Normalisation appliquée AVANT le parse (et non par un transform Zod) pour que
 * le schéma reste purement validant : la même instance sert à afficher une
 * erreur côté client sans réécrire la saisie sous les doigts de l'opérateur.
 */
export function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export const tenantSlugSchema = z
  .string()
  .trim()
  .min(3, "Le slug doit contenir au moins 3 caractères.")
  .max(40, "40 caractères maximum.")
  .regex(SLUG_RE, "Minuscules, chiffres et tirets uniquement.");

const hexColor = z.string().trim().regex(HEX_RE, "Couleur invalide.");

/**
 * Miroir applicatif de la contrainte base `tenant_min_modules` : `dash` ne peut
 * jamais être décoché (spec §12). La contrainte CHECK reste la garde ultime,
 * mais elle produirait une erreur Postgres brute au lieu d'un message lisible.
 */
export const tenantModulesSchema = z
  .array(z.enum(MODULE_IDS))
  .min(1, "Sélectionnez au moins un module.")
  .refine((modules) => modules.includes("dash"), {
    message: "Le module Tableau de bord ne peut pas être désactivé.",
  });

export const createTenantSchema = z.object({
  slug: tenantSlugSchema,
  name: z.string().trim().min(2, "Le nom de la boutique est requis.").max(60, "60 caractères maximum."),
  plan: z.enum(["essentiel", "pro"]),
  primaryColor: hexColor,
  accentColor: hexColor,
  logoText: z.string().trim().min(1, "Le logo texte est requis.").max(24, "24 caractères maximum."),
  domains: z.array(z.string()).default([]),
  ownerName: z.string().trim().min(2, "Le nom de la gérante est requis."),
  ownerEmail: z.string().trim().email("Adresse email invalide."),
  ownerPassword: z.string().min(8, "8 caractères minimum."),
});
export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export const tenantIdentitySchema = z.object({
  name: z.string().trim().min(2, "Le nom de la boutique est requis.").max(60, "60 caractères maximum."),
  slug: tenantSlugSchema,
  tagline: z.string().trim().max(120, "120 caractères maximum.").default(""),
  primaryColor: hexColor,
  accentColor: hexColor,
  logoText: z.string().trim().min(1, "Le logo texte est requis.").max(24, "24 caractères maximum."),
  font: z.enum(["Playfair Display", "Inter"]),
  whatsappPhone: z
    .string()
    .trim()
    .regex(/^[0-9+()\-\s]{0,20}$/, "Numéro invalide.")
    .default(""),
  domains: z.array(z.string()).default([]),
});
export type TenantIdentityInput = z.infer<typeof tenantIdentitySchema>;

export const tenantModulesFormSchema = z.object({
  plan: z.enum(["essentiel", "pro"]),
  modules: tenantModulesSchema,
});
export type TenantModulesInput = z.infer<typeof tenantModulesFormSchema>;
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

```bash
npx vitest run lib/validators/platform.test.ts
```

Attendu : SUCCÈS — 17 tests passent.

Si `z.string().email()` est déprécié dans la version de Zod installée et produit un avertissement, garder `z.string().email()` : `lib/validators/team.ts` l'utilise déjà, la cohérence prime sur la migration d'API, qui n'est pas le sujet de cette phase.

- [ ] **Step 5: Commit**

```bash
git add lib/validators/platform.ts lib/validators/platform.test.ts && git commit -m "feat(platform): add zod schemas for tenant creation, identity and modules"
```

---

### Task 4: Données provisionnées à la création

**Files:**
- Create: `lib/platform/provisioning.ts`
- Test: `lib/platform/provisioning.test.ts`

**Interfaces:**
- Consumes: `defaultPage`, `StorefrontPageContent` (`lib/storefront/pageContent.ts`)
- Produces: `DefaultEmployeeRole { name: string; permissions: string[] }`, `defaultEmployeeRoles(enabledModules: string[]): DefaultEmployeeRole[]`, `initialStorefrontPage(shopName: string): StorefrontPageContent`

Spec §8, « Données par défaut provisionnées » : profils d'accès « Vendeuse » (`pos`, `orders`, `inv`) et « Gérant adjoint » (tous les modules **activés de la boutique** sauf `theme` et `vitrine`) ; page d'accueil publiée, blocs Hero / ProductGrid / Contact renseignés depuis le nom de la boutique.

Les deux profils sont **bornés aux modules activés** : provisionner une permission pour un module désactivé créerait exactement l'incohérence UI/données déjà notée en dette phase 1.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `lib/platform/provisioning.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { defaultEmployeeRoles, initialStorefrontPage } from "./provisioning";
import { modulesForPlan } from "./plans";

describe("defaultEmployeeRoles", () => {
  it("crée Vendeuse et Gérant adjoint pour le palier essentiel", () => {
    const roles = defaultEmployeeRoles(modulesForPlan("essentiel"));
    expect(roles.map((r) => r.name)).toEqual(["Vendeuse", "Gérant adjoint"]);
  });

  it("limite Vendeuse à pos, orders et inv", () => {
    const roles = defaultEmployeeRoles(modulesForPlan("pro"));
    expect(roles[0]).toEqual({ name: "Vendeuse", permissions: ["pos", "orders", "inv"] });
  });

  it("exclut theme et vitrine de Gérant adjoint", () => {
    const adjoint = defaultEmployeeRoles(modulesForPlan("pro"))[1];
    expect(adjoint.permissions).not.toContain("theme");
    expect(adjoint.permissions).not.toContain("vitrine");
    expect(adjoint.permissions).toContain("fin");
  });

  it("ne provisionne jamais une permission pour un module désactivé", () => {
    const roles = defaultEmployeeRoles(["dash", "pos"]);
    expect(roles).toEqual([
      { name: "Vendeuse", permissions: ["pos"] },
      { name: "Gérant adjoint", permissions: ["dash", "pos"] },
    ]);
  });

  it("omet un profil qui n'aurait aucune permission", () => {
    expect(defaultEmployeeRoles(["theme", "vitrine"])).toEqual([]);
  });
});

describe("initialStorefrontPage", () => {
  it("conserve tous les blocs par défaut", () => {
    const page = initialStorefrontPage("Boutique du Plateau");
    expect(page.blocks).toHaveLength(10);
    expect(page.blocks.map((b) => b.type)).toContain("hero");
  });

  it("renseigne le hero avec le nom de la boutique", () => {
    const hero = initialStorefrontPage("Boutique du Plateau").blocks.find((b) => b.type === "hero");
    expect(hero?.settings.title).toBe("Boutique du Plateau");
    expect(hero?.settings.subtitle).toBe("Découvrez les créations de Boutique du Plateau.");
  });

  it("renseigne la grille produits et le bloc contact", () => {
    const page = initialStorefrontPage("Boutique du Plateau");
    expect(page.blocks.find((b) => b.type === "grid")?.settings.title).toBe(
      "Les nouveautés de Boutique du Plateau"
    );
    expect(page.blocks.find((b) => b.type === "contact")?.settings.locationTitle).toBe(
      "Boutique du Plateau"
    );
  });

  it("laisse les autres blocs sur leurs valeurs par défaut", () => {
    const story = initialStorefrontPage("Boutique du Plateau").blocks.find((b) => b.type === "story");
    expect(story?.visible).toBe(true);
    expect(story?.settings).toBeDefined();
  });
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
npx vitest run lib/platform/provisioning.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./provisioning"`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `lib/platform/provisioning.ts` :

```ts
import { defaultPage, type StorefrontPageContent } from "@/lib/storefront/pageContent";

export interface DefaultEmployeeRole {
  name: string;
  permissions: string[];
}

const VENDEUSE_MODULES = ["pos", "orders", "inv"];
const ADJOINT_EXCLUDED = new Set(["theme", "vitrine"]);

/**
 * Profils d'accès provisionnés à la création (spec §8), bornés aux modules
 * réellement activés : une permission pour un module désactivé serait inerte
 * mais ferait diverger l'UI et les données.
 */
export function defaultEmployeeRoles(enabledModules: string[]): DefaultEmployeeRole[] {
  const enabled = new Set(enabledModules);
  const roles: DefaultEmployeeRole[] = [];

  const vendeuse = VENDEUSE_MODULES.filter((id) => enabled.has(id));
  if (vendeuse.length > 0) roles.push({ name: "Vendeuse", permissions: vendeuse });

  const adjoint = enabledModules.filter((id) => !ADJOINT_EXCLUDED.has(id));
  if (adjoint.length > 0) roles.push({ name: "Gérant adjoint", permissions: adjoint });

  return roles;
}

/**
 * Page d'accueil provisionnée : blocs par défaut, avec hero / grille / contact
 * renseignés au nom de la boutique pour qu'elle ne s'ouvre pas sur le contenu
 * d'exemple d'une autre boutique.
 */
export function initialStorefrontPage(shopName: string): StorefrontPageContent {
  const page = defaultPage();
  return {
    blocks: page.blocks.map((block) => {
      if (block.type === "hero") {
        return {
          ...block,
          settings: {
            ...block.settings,
            eyebrow: "BIENVENUE",
            title: shopName,
            subtitle: `Découvrez les créations de ${shopName}.`,
          },
        };
      }
      if (block.type === "grid") {
        return { ...block, settings: { ...block.settings, title: `Les nouveautés de ${shopName}` } };
      }
      if (block.type === "contact") {
        return { ...block, settings: { ...block.settings, locationTitle: shopName } };
      }
      return block;
    }),
  };
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

```bash
npx vitest run lib/platform/provisioning.test.ts
```

Attendu : SUCCÈS — 9 tests passent.

- [ ] **Step 5: Commit**

```bash
git add lib/platform/provisioning.ts lib/platform/provisioning.test.ts && git commit -m "feat(platform): provision default employee roles and storefront page"
```

---

### Task 5: Ouvrir la zone plateforme dans le routage

**Files:**
- Modify: `lib/proxy/zones.ts` (ligne 18, et ajout d'une fonction après `dashboardPath`)
- Modify: `proxy.ts` (lignes 3-9 imports, 29-39 redirection, 72-73 en-têtes)
- Test: `lib/proxy/zones.test.ts` (ajout de cas)

**Interfaces:**
- Consumes: `usesPathRouting` (privé au module), `Zone` (`lib/auth`)
- Produces: `ADMIN_PATHS = ["/boutiques", "/connexion"]`, `platformPath(hostname: string, path: string): string`, en-tête de requête `x-zone` valant `"storefront" | "dashboard" | "admin"`

Handover §4 (piège 1) : sans `/connexion` dans `ADMIN_PATHS` **et** sans adapter la redirection de `proxy.ts:33`, le prestataire ne peut littéralement pas se connecter — un accès refusé le renvoie sur la vitrine.

`platformPath` est le miroir exact de `dashboardPath` : en développement la zone est portée par le préfixe de chemin `/platform`, en production par le sous-domaine `platform.*` (le chemin nu est alors déjà sur le bon hôte).

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à la fin de `lib/proxy/zones.test.ts` :

```ts
import { platformPath, ADMIN_PATHS } from "@/lib/proxy/zones";

describe("platformPath", () => {
  it("préfixe /platform en développement (résolution par chemin)", () => {
    expect(platformPath("localhost:3000", "/connexion")).toBe("/platform/connexion");
  });

  it("laisse le chemin nu en production (résolution par sous-domaine)", () => {
    expect(platformPath("platform.foulard-teranga.com", "/connexion")).toBe("/connexion");
  });

  it("préfixe aussi sur les URLs de prévisualisation Vercel", () => {
    expect(platformPath("mon-app-abc.vercel.app", "/boutiques")).toBe("/platform/boutiques");
  });
});

describe("zone admin — chemins autorisés", () => {
  it("déclare /connexion comme chemin de la zone plateforme", () => {
    expect(ADMIN_PATHS).toContain("/connexion");
  });

  it("autorise /connexion dans la zone admin", () => {
    expect(isPathAllowedForZone("admin", "/connexion")).toBe(true);
  });

  it("autorise la fiche d'une boutique et le formulaire de création", () => {
    expect(isPathAllowedForZone("admin", "/boutiques/nouvelle")).toBe(true);
    expect(isPathAllowedForZone("admin", "/boutiques/foulard-teranga")).toBe(true);
  });

  it("refuse toujours un chemin de dashboard dans la zone admin", () => {
    expect(isPathAllowedForZone("admin", "/pos")).toBe(false);
  });

  it("refuse toujours /connexion et /boutiques en zone storefront", () => {
    expect(isPathAllowedForZone("storefront", "/connexion")).toBe(false);
    expect(isPathAllowedForZone("storefront", "/boutiques")).toBe(false);
  });
});
```

Si l'import en tête du fichier existe déjà, fusionner les noms importés dans la ligne d'import existante plutôt que d'ajouter un second import du même module.

- [ ] **Step 2: Lancer les tests et vérifier qu'ils échouent**

```bash
npx vitest run lib/proxy/zones.test.ts
```

Attendu : ÉCHEC — `platformPath is not a function` et `expected [ '/boutiques' ] to contain '/connexion'`.

- [ ] **Step 3: Étendre `lib/proxy/zones.ts`**

Remplacer la ligne 18 :

```ts
export const ADMIN_PATHS = ["/boutiques"] as const;
```

par :

```ts
export const ADMIN_PATHS = ["/boutiques", "/connexion"] as const;
```

Puis ajouter, juste après la fonction `dashboardPath` (après la ligne 93) :

```ts
/**
 * Miroir de `dashboardPath` pour la zone plateforme : préfixe `/platform` en
 * développement (résolution par chemin), chemin nu en production (le
 * sous-domaine `platform.*` porte déjà la zone). Sans lui, une redirection vers
 * `/connexion` en développement retomberait en zone storefront, où ce chemin est
 * interdit → redirection silencieuse vers `/`, exactement le comportement qui
 * rendait la zone plateforme inaccessible.
 */
export function platformPath(hostname: string, path: string): string {
  const host = hostname.split(":")[0].toLowerCase();
  return usesPathRouting(host) ? `/platform${path}` : path;
}
```

- [ ] **Step 4: Lancer les tests et vérifier qu'ils passent**

```bash
npx vitest run lib/proxy/zones.test.ts
```

Attendu : SUCCÈS — tous les tests du fichier passent, anciens compris.

- [ ] **Step 5: Adapter `proxy.ts`**

Remplacer la ligne d'import (lignes 3-9) :

```ts
import {
  resolveZone,
  isPathAllowedForZone,
  dashboardPath,
  moduleForPath,
  MODULE_ID_PATHS,
} from "@/lib/proxy/zones";
```

par :

```ts
import {
  resolveZone,
  isPathAllowedForZone,
  dashboardPath,
  platformPath,
  moduleForPath,
  MODULE_ID_PATHS,
} from "@/lib/proxy/zones";
```

Remplacer le bloc de redirection (lignes 29-39) :

```ts
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
```

par :

```ts
    if (!isRoleAllowedForZone(zone, session?.role ?? null)) {
      // Chaque zone privée a désormais sa propre page de connexion : le
      // prestataire refusé sur /boutiques atterrit sur la connexion plateforme,
      // pas sur la vitrine. Pas de boucle possible : /connexion sort de ce bloc
      // (condition d'entrée plus haut).
      const target =
        zone === "dashboard"
          ? dashboardPath(hostname, "/connexion")
          : platformPath(hostname, "/connexion");
      const redirectUrl = new URL(target, request.url);
      redirectUrl.searchParams.set("next", rewrittenPathname);
      const redirect = NextResponse.redirect(redirectUrl);
      authDraft.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }
```

Remplacer le bloc d'en-têtes (lignes 72-73) :

```ts
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-host", hostname);
```

par :

```ts
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-host", hostname);
  // La zone résolue est publiée pour les Server Components : `/connexion` est un
  // chemin partagé par la zone dashboard et la zone plateforme (Next.js interdit
  // deux `page.tsx` sur le même chemin), et seule cette information permet à la
  // page de savoir laquelle des deux elle sert.
  requestHeaders.set("x-zone", zone);
```

- [ ] **Step 6: Vérifier la suite complète et les types**

```bash
npx vitest run && npm run typecheck
```

Attendu : tous les tests passent (272 d'avant + les nouveaux), `typecheck` sans sortie.

- [ ] **Step 7: Commit**

```bash
git add lib/proxy/zones.ts lib/proxy/zones.test.ts proxy.ts && git commit -m "feat(platform): open the admin zone with its own login path and x-zone header"
```

---

### Task 6: Connexion plateforme

**Files:**
- Modify: `lib/auth/actions.ts` (ajout de deux actions)
- Modify: `components/auth/LoginView.tsx` (prop `variant`)
- Modify: `app/(auth)/connexion/page.tsx`

**Interfaces:**
- Consumes: `platformPath` (tâche 5), en-tête `x-zone` (tâche 5), `resolveSession` (`lib/auth`), `validateLogin` (`lib/validators/auth.ts`), `SignInState` (existant)
- Produces: `signInPlatform(prev: SignInState, formData: FormData): Promise<SignInState>`, `signOutPlatform(): Promise<void>`, prop `LoginView({ variant }: { variant?: "dashboard" | "platform" })`

Point de sécurité **à ne pas omettre** : sans vérification de rôle après authentification, une gérante qui se connecte sur `/platform/connexion` obtient une session valide, est redirigée vers `/platform/boutiques`, y est refusée par `proxy.ts`, et renvoyée sur `/platform/connexion` — une boucle de redirection sans explication. `signInPlatform` doit donc vérifier `role === "super_admin"` et **déconnecter** sinon.

- [ ] **Step 1: Ajouter les deux Server Actions**

Dans `lib/auth/actions.ts`, remplacer la ligne d'import de zones :

```ts
import { dashboardPath } from "@/lib/proxy/zones";
```

par :

```ts
import { dashboardPath, platformPath } from "@/lib/proxy/zones";
import { resolveSession } from "@/lib/auth";
```

Puis ajouter à la fin du fichier :

```ts
/**
 * Connexion à la zone plateforme. Vérifie le rôle après authentification et
 * déconnecte sinon : un compte de gérante authentifié puis refusé par `proxy.ts`
 * rebondirait indéfiniment entre /connexion et /boutiques, sans message.
 */
export async function signInPlatform(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const result = validateLogin({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!result.ok) return { ok: false, errors: result.errors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(result.data);
  if (error) return { ok: false, errors: {}, formError: "Email ou mot de passe incorrect." };

  const session = await resolveSession(supabase);
  if (session?.role !== "super_admin") {
    await supabase.auth.signOut();
    return { ok: false, errors: {}, formError: "Ce compte n'a pas accès à l'espace plateforme." };
  }

  const next = String(formData.get("next") ?? "/boutiques");
  // Même garde que signIn : un seul "/" en tête, ni "//" ni "/\".
  const safeNext = /^\/(?!\/|\\)/.test(next) ? next : "/boutiques";
  const hostname = (await headers()).get("host") ?? "localhost";
  redirect(platformPath(hostname, safeNext));
}

export async function signOutPlatform(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const hostname = (await headers()).get("host") ?? "localhost";
  redirect(platformPath(hostname, "/connexion"));
}
```

- [ ] **Step 2: Vérifier que les types passent**

```bash
npm run typecheck
```

Attendu : aucune sortie. Si TypeScript signale un import circulaire ou un `resolveSession` introuvable, importer depuis `@/lib/auth/session` au lieu de `@/lib/auth`.

- [ ] **Step 3: Paramétrer `LoginView`**

Dans `components/auth/LoginView.tsx` :

Remplacer la ligne 5 :

```ts
import { signIn, type SignInState } from "@/lib/auth/actions";
```

par :

```ts
import { signIn, signInPlatform, type SignInState } from "@/lib/auth/actions";
```

Remplacer la signature et les trois premières lignes du corps (lignes 9-12) :

```ts
export function LoginView() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/pos";
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signIn, null);
```

par :

```ts
export function LoginView({ variant = "dashboard" }: { variant?: "dashboard" | "platform" }) {
  const isPlatform = variant === "platform";
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? (isPlatform ? "/boutiques" : "/pos");
  const [state, formAction, pending] = useActionState<SignInState, FormData>(
    isPlatform ? signInPlatform : signIn,
    null
  );
```

Remplacer le titre et le sous-titre de la carte (le `<h1>` valant `Espace Back-Office` et le `<p>` qui le suit) :

```tsx
              <h1
                style={{
                  fontFamily: fonts.display,
                  fontSize: 26,
                  fontWeight: 600,
                  color: colors.ink,
                  marginBottom: 6,
                  letterSpacing: "-0.01em",
                }}
              >
                Espace Back-Office
              </h1>
              <p style={{ fontSize: 14, color: colors.muted, lineHeight: 1.5, margin: 0 }}>
                Saisissez vos identifiants pour accéder à votre espace de gestion.
              </p>
```

par :

```tsx
              <h1
                style={{
                  fontFamily: fonts.display,
                  fontSize: 26,
                  fontWeight: 600,
                  color: colors.ink,
                  marginBottom: 6,
                  letterSpacing: "-0.01em",
                }}
              >
                {isPlatform ? "Espace Plateforme" : "Espace Back-Office"}
              </h1>
              <p style={{ fontSize: 14, color: colors.muted, lineHeight: 1.5, margin: 0 }}>
                {isPlatform
                  ? "Console prestataire : administration du parc de boutiques."
                  : "Saisissez vos identifiants pour accéder à votre espace de gestion."}
              </p>
```

Enfin, remplacer les deux occurrences du nom de marque affiché (`Foulard Teranga`, une dans le panneau de gauche, une dans le badge mobile) par :

```tsx
              {isPlatform ? "Console plateforme" : "Foulard Teranga"}
```

en veillant à conserver les attributs `style` existants de chaque élément.

- [ ] **Step 4: Brancher la page `/connexion` sur la zone**

Remplacer entièrement `app/(auth)/connexion/page.tsx` :

```tsx
import { Suspense } from "react";
import { headers } from "next/headers";
import { LoginView } from "@/components/auth/LoginView";

/**
 * Page partagée par la zone dashboard et la zone plateforme : Next.js refuse
 * deux `page.tsx` résolvant le même chemin, et `proxy.ts` réécrit les deux
 * zones vers `/connexion`. L'en-tête `x-zone`, posé par `proxy.ts`, est la
 * seule information qui distingue les deux appels.
 */
export default async function ConnexionPage() {
  const zone = (await headers()).get("x-zone");
  return (
    <Suspense fallback={<div style={{ maxWidth: 380, margin: "96px auto" }} />}>
      <LoginView variant={zone === "admin" ? "platform" : "dashboard"} />
    </Suspense>
  );
}
```

- [ ] **Step 5: Vérifier types et tests**

```bash
npm run typecheck && npx vitest run
```

Attendu : aucune sortie de `typecheck`, tous les tests passent.

- [ ] **Step 6: Vérifier à la main dans le navigateur**

Démarrer le serveur de développement (via l'outil de prévisualisation, jamais via un `pkill`), puis :

1. Ouvrir `http://localhost:3000/platform/boutiques` **non authentifié** → doit rediriger vers `http://localhost:3000/platform/connexion?next=/boutiques` et afficher « Espace Plateforme ».
2. Ouvrir `http://localhost:3000/admin/pos` non authentifié → doit toujours afficher « Espace Back-Office » (aucune régression).
3. Se connecter sur `/platform/connexion` avec le compte **gérante** → doit rester sur la page avec le message « Ce compte n'a pas accès à l'espace plateforme. », **sans boucle de redirection**.
4. Se connecter avec le compte **super_admin** → doit atterrir sur `/platform/boutiques` (l'écran d'attente actuel suffit à ce stade).

Retrouver les adresses des comptes avec :

```bash
npx prisma db execute --stdin <<< 'select id, role, name, email from "Profile" order by role;'
```

- [ ] **Step 7: Commit**

```bash
git add lib/auth/actions.ts components/auth/LoginView.tsx "app/(auth)/connexion/page.tsx" && git commit -m "feat(platform): add platform sign-in reusing the shared login screen"
```

---

### Task 7: Garde `super_admin` et journal d'audit

**Files:**
- Create: `lib/platform/guard.ts`
- Create: `lib/platform/audit.ts`
- Test: `lib/platform/audit.test.ts`

**Interfaces:**
- Consumes: `getSession`, `Session` (`lib/auth`) ; `prisma` (`lib/db/client`) ; `Prisma`, `PlatformAction` (`lib/generated/prisma`)
- Produces:
  - `currentSuperAdmin(): Promise<Session | null>` — `null` si la session n'est pas `super_admin`
  - `requireSuperAdmin(): Promise<Session>` — lève `Error("Accès plateforme refusé.")`
  - `PlatformDb = typeof prisma | Prisma.TransactionClient`
  - `PlatformAuditEntry { actorId: string; action: PlatformAction; tenantId?: string | null; targetId?: string | null; metadata?: Record<string, unknown> }`
  - `recordPlatformAction(entry: PlatformAuditEntry, db?: PlatformDb): Promise<void>`

Deux formes de garde parce que les deux appelants n'ont pas le même contrat : les **Server Actions** renvoient un résultat typé (`currentSuperAdmin` → `null` → message générique), les **Server Components** sont déjà protégés par le layout et doivent échouer bruyamment si on les atteint autrement (`requireSuperAdmin` → exception).

`recordPlatformAction` accepte un client de transaction pour que l'audit de création soit écrit **dans la même transaction** que la boutique : « boutique créée » et « création tracée » deviennent le même événement, indissociables. `PlatformAuditLog` n'ayant aucune clé étrangère (spec §1.3), rien ne s'y oppose.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `lib/platform/audit.test.ts` :

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({ prisma: { platformAuditLog: { create: vi.fn() } } }));

import { recordPlatformAction } from "./audit";

interface CapturedCreate {
  data: Record<string, unknown>;
}

function fakeDb() {
  const calls: CapturedCreate[] = [];
  const db = {
    platformAuditLog: {
      create: async (args: CapturedCreate) => {
        calls.push(args);
        return {};
      },
    },
  };
  return { db, calls };
}

describe("recordPlatformAction", () => {
  it("écrit l'action avec son acteur et sa boutique", async () => {
    const { db, calls } = fakeDb();
    await recordPlatformAction(
      { actorId: "a-1", action: "tenant_created", tenantId: "t-1" },
      db as never
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].data).toMatchObject({ actorId: "a-1", action: "tenant_created", tenantId: "t-1" });
  });

  it("remplit tenantId, targetId et metadata par des valeurs neutres quand ils sont absents", async () => {
    const { db, calls } = fakeDb();
    await recordPlatformAction({ actorId: "a-1", action: "announcement_sent" }, db as never);
    expect(calls[0].data).toEqual({
      actorId: "a-1",
      action: "announcement_sent",
      tenantId: null,
      targetId: null,
      metadata: {},
    });
  });

  it("transmet les métadonnées fournies", async () => {
    const { db, calls } = fakeDb();
    await recordPlatformAction(
      { actorId: "a-1", action: "modules_changed", tenantId: "t-1", metadata: { before: ["dash"], after: ["dash", "fin"] } },
      db as never
    );
    expect(calls[0].data.metadata).toEqual({ before: ["dash"], after: ["dash", "fin"] });
  });
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
npx vitest run lib/platform/audit.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./audit"`.

- [ ] **Step 3: Écrire les deux modules**

Créer `lib/platform/guard.ts` :

```ts
import { getSession, type Session } from "@/lib/auth";

/**
 * Session du prestataire, ou `null` si l'appelant n'en est pas un. Forme
 * destinée aux Server Actions, qui renvoient un résultat typé plutôt que de
 * lever (CLAUDE.md §8).
 */
export async function currentSuperAdmin(): Promise<Session | null> {
  const session = await getSession();
  return session?.role === "super_admin" ? session : null;
}

/**
 * Forme destinée aux Server Components de la zone plateforme, déjà protégés par
 * le layout : y arriver sans être `super_admin` est un défaut de garde, pas un
 * cas utilisateur — il doit être bruyant.
 */
export async function requireSuperAdmin(): Promise<Session> {
  const session = await currentSuperAdmin();
  if (!session) throw new Error("Accès plateforme refusé.");
  return session;
}
```

Créer `lib/platform/audit.ts` :

```ts
import { prisma } from "@/lib/db/client";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { PlatformAction } from "@/lib/generated/prisma/enums";

/** Client Prisma ordinaire ou client de transaction — l'audit doit pouvoir vivre dans les deux. */
export type PlatformDb = typeof prisma | Prisma.TransactionClient;

export interface PlatformAuditEntry {
  /** Toujours le vrai super_admin, jamais une identité empruntée (spec §1.3). */
  actorId: string;
  action: PlatformAction;
  tenantId?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Écrit une entrée du journal prestataire. Passer `db` permet d'inscrire la
 * trace dans la même transaction que l'action tracée : « fait » et « tracé »
 * deviennent alors le même événement.
 */
export async function recordPlatformAction(
  entry: PlatformAuditEntry,
  db: PlatformDb = prisma
): Promise<void> {
  await db.platformAuditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      tenantId: entry.tenantId ?? null,
      targetId: entry.targetId ?? null,
      metadata: (entry.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

```bash
npx vitest run lib/platform/audit.test.ts && npm run typecheck
```

Attendu : SUCCÈS — 3 tests passent, `typecheck` sans sortie.

- [ ] **Step 5: Commit**

```bash
git add lib/platform/guard.ts lib/platform/audit.ts lib/platform/audit.test.ts && git commit -m "feat(platform): add super_admin guard and audit log writer"
```

---

### Task 8: Requêtes inter-boutiques

**Files:**
- Create: `lib/platform/queries.ts`
- Test: `lib/platform/queries.test.ts`

**Interfaces:**
- Consumes: `requireSuperAdmin` (tâche 7), `prisma` (`lib/db/client`), `TenantStatus`/`TenantPlan` (`lib/generated/prisma/enums`)
- Produces:
  - `TenantListItem { id, slug, name, status, plan, enabledModules, domains, createdAt, ownerName, productCount, orderCount }`
  - `TenantDetail { id, slug, name, tagline, primaryColor, accentColor, font, logoText, whatsappPhone, domains, status, plan, enabledModules, createdAt, owner }` avec `owner: { id: string; name: string; email: string } | null`
  - `listTenants(): Promise<TenantListItem[]>`
  - `getTenantBySlug(slug: string): Promise<TenantDetail | null>`
  - `findTenantByDomain(domain: string, exceptTenantId?: string): Promise<{ id: string; slug: string; name: string } | null>`
  - `tenantSlugExists(slug: string, exceptTenantId?: string): Promise<boolean>`

Spec §7 : **seul module autorisé à requêter sans filtre `tenantId`**, chaque fonction commençant par le garde `super_admin`. Le commentaire de tête du fichier doit le dire, pour qu'une revue future ne prenne pas ces requêtes pour une fuite.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `lib/platform/queries.test.ts` :

```ts
import { describe, it, expect, vi } from "vitest";

// Session de gérante : aucune fonction de ce module ne doit lui répondre.
vi.mock("@/lib/auth", () => ({
  getSession: async () => ({
    userId: "u1",
    name: "Aya",
    role: "owner",
    tenantId: "t1",
    permissions: [],
    enabledModules: ["dash"],
  }),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    tenant: {
      findMany: async () => {
        throw new Error("la base ne doit jamais être atteinte sans garde");
      },
      findUnique: async () => {
        throw new Error("la base ne doit jamais être atteinte sans garde");
      },
      findFirst: async () => {
        throw new Error("la base ne doit jamais être atteinte sans garde");
      },
    },
  },
}));

import { listTenants, getTenantBySlug, findTenantByDomain, tenantSlugExists } from "./queries";

describe("lib/platform/queries — garde super_admin", () => {
  it("refuse listTenants à une gérante", async () => {
    await expect(listTenants()).rejects.toThrow("Accès plateforme refusé.");
  });

  it("refuse getTenantBySlug à une gérante", async () => {
    await expect(getTenantBySlug("foulard-teranga")).rejects.toThrow("Accès plateforme refusé.");
  });

  it("refuse findTenantByDomain à une gérante", async () => {
    await expect(findTenantByDomain("boutique.ci")).rejects.toThrow("Accès plateforme refusé.");
  });

  it("refuse tenantSlugExists à une gérante", async () => {
    await expect(tenantSlugExists("foulard-teranga")).rejects.toThrow("Accès plateforme refusé.");
  });
});
```

Le mock de `prisma` qui lève sur chaque méthode est délibéré : il transforme « le garde a été oublié » en échec de test explicite, au lieu d'un test vacuously vrai qui passerait aussi si la fonction ne consultait jamais la base.

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
npx vitest run lib/platform/queries.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./queries"`.

- [ ] **Step 3: Écrire l'implémentation**

Créer `lib/platform/queries.ts` :

```ts
import { prisma } from "@/lib/db/client";
import { requireSuperAdmin } from "./guard";
import type { TenantPlan, TenantStatus } from "@/lib/generated/prisma/enums";

/**
 * SEUL module du dépôt autorisé à requêter sans filtre `tenantId` (spec §7).
 * Partout ailleurs, l'absence de ce filtre est une fuite de données inter-
 * boutiques. Chaque fonction commence donc par `requireSuperAdmin()` : le
 * « sans filtre » reste un choix délibéré, concentré et relisable.
 */

export interface TenantListItem {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  plan: TenantPlan;
  enabledModules: string[];
  domains: string[];
  createdAt: Date;
  ownerName: string | null;
  productCount: number;
  orderCount: number;
}

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
  owner: { id: string; name: string; email: string } | null;
}

export async function listTenants(): Promise<TenantListItem[]> {
  await requireSuperAdmin();
  const rows = await prisma.tenant.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { products: true, orders: true } },
      profiles: { where: { role: "owner" }, select: { name: true }, take: 1 },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    plan: row.plan,
    enabledModules: row.enabledModules,
    domains: row.domains,
    createdAt: row.createdAt,
    ownerName: row.profiles[0]?.name ?? null,
    productCount: row._count.products,
    orderCount: row._count.orders,
  }));
}

export async function getTenantBySlug(slug: string): Promise<TenantDetail | null> {
  await requireSuperAdmin();
  const row = await prisma.tenant.findUnique({
    where: { slug },
    include: {
      profiles: { where: { role: "owner" }, select: { id: true, name: true, email: true }, take: 1 },
    },
  });
  if (!row) return null;
  const owner = row.profiles[0];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    primaryColor: row.primaryColor,
    accentColor: row.accentColor,
    font: row.font,
    logoText: row.logoText,
    whatsappPhone: row.whatsappPhone ?? "",
    domains: row.domains,
    status: row.status,
    plan: row.plan,
    enabledModules: row.enabledModules,
    createdAt: row.createdAt,
    owner: owner ? { id: owner.id, name: owner.name, email: owner.email ?? "" } : null,
  };
}

/**
 * Unicité inter-boutiques de `domains` (spec §11). `domains` est un tableau :
 * aucune contrainte base ne peut l'assurer, c'est donc une vérification
 * applicative — d'où l'importance de passer par ce point unique.
 */
export async function findTenantByDomain(
  domain: string,
  exceptTenantId?: string
): Promise<{ id: string; slug: string; name: string } | null> {
  await requireSuperAdmin();
  const row = await prisma.tenant.findFirst({
    where: {
      domains: { has: domain },
      ...(exceptTenantId ? { NOT: { id: exceptTenantId } } : {}),
    },
    select: { id: true, slug: true, name: true },
  });
  return row;
}

export async function tenantSlugExists(slug: string, exceptTenantId?: string): Promise<boolean> {
  await requireSuperAdmin();
  const row = await prisma.tenant.findFirst({
    where: { slug, ...(exceptTenantId ? { NOT: { id: exceptTenantId } } : {}) },
    select: { id: true },
  });
  return row !== null;
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

```bash
npx vitest run lib/platform/queries.test.ts && npm run typecheck
```

Attendu : SUCCÈS — 4 tests passent, `typecheck` sans sortie.

- [ ] **Step 5: Commit**

```bash
git add lib/platform/queries.ts lib/platform/queries.test.ts && git commit -m "feat(platform): add guarded cross-tenant queries"
```

---

### Task 9: Layout de zone et liste du parc

**Files:**
- Create: `app/(admin)/(console)/layout.tsx`
- Create: `components/platform/PlatformShell.tsx`
- Create: `app/(admin)/(console)/boutiques/page.tsx`
- Create: `components/platform/screens/TenantListScreen.tsx`
- Delete: `app/(admin)/boutiques/page.tsx`

**Interfaces:**
- Consumes: `listTenants`, `TenantListItem` (tâche 8) ; `currentSuperAdmin` (tâche 7) ; `platformPath` (tâche 5) ; `signOutPlatform` (tâche 6) ; `PLAN_LABELS` (tâche 1) ; `colors`, `fonts` (`lib/theme/tokens.ts`)
- Produces: `PlatformShell({ userName, children })`, `TenantListScreen({ tenants })`

Le groupe de routes imbriqué `(console)` existe pour une raison précise : `/connexion` ne doit **pas** hériter du chrome de la console (barre latérale, bouton de déconnexion), et un layout posé à `app/(admin)/layout.tsx` s'appliquerait à tout. Les groupes de routes n'affectent pas les URLs : `/boutiques` reste `/boutiques`.

Spec §6, « Responsive » : ces écrans sont pensés pour le bureau, avec un repli en cartes empilées sur mobile. Exception assumée au mobile-first de `CLAUDE.md` §10.

- [ ] **Step 1: Créer le chrome de la zone**

Créer `components/platform/PlatformShell.tsx` :

```tsx
import Link from "next/link";
import { colors, fonts, adminBorder } from "@/lib/theme/tokens";
import { signOutPlatform } from "@/lib/auth/actions";

export function PlatformShell({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", background: colors.ivory, color: colors.ink, fontFamily: fonts.ui }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "14px 24px",
          background: colors.surface,
          borderBottom: adminBorder,
        }}
      >
        <Link
          href="/boutiques"
          style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: 600, color: colors.ink, textDecoration: "none" }}
        >
          Console plateforme
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/boutiques" style={{ fontSize: 14, color: colors.muted, textDecoration: "none" }}>
            Boutiques
          </Link>
          <span style={{ fontSize: 13, color: colors.muted }}>{userName}</span>
          <form action={signOutPlatform}>
            <button
              type="submit"
              style={{
                border: `1px solid ${colors.borderField}`,
                background: "transparent",
                borderRadius: 10,
                padding: "7px 14px",
                fontSize: 13,
                color: colors.ink,
                cursor: "pointer",
              }}
            >
              Se déconnecter
            </button>
          </form>
        </nav>
      </header>

      <main style={{ padding: "28px 24px 56px", maxWidth: 1180, margin: "0 auto" }}>{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Créer le layout garde**

Créer `app/(admin)/(console)/layout.tsx` :

```tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { currentSuperAdmin } from "@/lib/platform/guard";
import { platformPath } from "@/lib/proxy/zones";
import { PlatformShell } from "@/components/platform/PlatformShell";

/**
 * Groupe de routes `(console)` : le chrome ne doit pas envelopper `/connexion`,
 * servie par la même zone. Les groupes de routes n'affectent pas les URLs.
 * Ce garde double celui de `proxy.ts` — défense en profondeur, pas redondance :
 * lui seul protège si le matcher du proxy évolue.
 */
export default async function PlatformConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSuperAdmin();
  if (!session) {
    const hostname = (await headers()).get("host") ?? "localhost";
    redirect(platformPath(hostname, "/connexion"));
  }
  return <PlatformShell userName={session.name}>{children}</PlatformShell>;
}
```

- [ ] **Step 3: Créer l'écran de liste**

Créer `components/platform/screens/TenantListScreen.tsx` :

```tsx
import Link from "next/link";
import { colors, fonts, adminBorder } from "@/lib/theme/tokens";
import { PLAN_LABELS } from "@/lib/platform/plans";
import type { TenantListItem } from "@/lib/platform/queries";

const STATUS_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  active: { bg: colors.bgSuccess, fg: colors.fgSuccess, label: "Active" },
  suspended: { bg: colors.bgWarning, fg: colors.fgWarning, label: "Suspendue" },
  archived: { bg: colors.bgInfo, fg: colors.fgInfo, label: "Archivée" },
};

export function TenantListScreen({ tenants }: { tenants: TenantListItem[] }) {
  return (
    <div>
      <style>{`
        .ft-parc-table { width: 100%; border-collapse: collapse; }
        .ft-parc-table th, .ft-parc-table td { text-align: left; padding: 12px 14px; font-size: 14px; }
        .ft-parc-table thead th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: ${colors.muted}; }
        .ft-parc-table tbody tr + tr { border-top: 1px solid ${colors.faintLine}; }
        .ft-parc-cards { display: none; }
        @media (max-width: 820px) {
          .ft-parc-table-wrap { display: none; }
          .ft-parc-cards { display: grid; gap: 12px; }
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
        <div>
          <h1 style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: 600, margin: 0 }}>Parc de boutiques</h1>
          <p style={{ color: colors.muted, fontSize: 14, margin: "4px 0 0" }}>
            {tenants.length === 0
              ? "Aucune boutique pour le moment."
              : `${tenants.length} boutique${tenants.length > 1 ? "s" : ""} administrée${tenants.length > 1 ? "s" : ""}.`}
          </p>
        </div>
        <Link
          href="/boutiques/nouvelle"
          style={{
            background: colors.primary,
            color: "#fff",
            borderRadius: 12,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Nouvelle boutique
        </Link>
      </div>

      <div className="ft-parc-table-wrap" style={{ background: colors.surface, border: adminBorder, borderRadius: 16, overflowX: "auto" }}>
        <table className="ft-parc-table">
          <thead>
            <tr>
              <th>Boutique</th>
              <th>Gérante</th>
              <th>État</th>
              <th>Palier</th>
              <th>Modules</th>
              <th>Produits</th>
              <th>Commandes</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => {
              const status = STATUS_STYLES[tenant.status] ?? STATUS_STYLES.active;
              return (
                <tr key={tenant.id}>
                  <td>
                    <Link href={`/boutiques/${tenant.slug}`} style={{ color: colors.primary, fontWeight: 600, textDecoration: "none" }}>
                      {tenant.name}
                    </Link>
                    <div style={{ color: colors.muted, fontSize: 12 }}>{tenant.slug}</div>
                  </td>
                  <td>{tenant.ownerName ?? <span style={{ color: colors.muted }}>—</span>}</td>
                  <td>
                    <span style={{ background: status.bg, color: status.fg, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
                      {status.label}
                    </span>
                  </td>
                  <td>{PLAN_LABELS[tenant.plan]}</td>
                  <td>{tenant.enabledModules.length}</td>
                  <td>{tenant.productCount}</td>
                  <td>{tenant.orderCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="ft-parc-cards">
        {tenants.map((tenant) => {
          const status = STATUS_STYLES[tenant.status] ?? STATUS_STYLES.active;
          return (
            <Link
              key={tenant.id}
              href={`/boutiques/${tenant.slug}`}
              style={{ background: colors.surface, border: adminBorder, borderRadius: 14, padding: 16, textDecoration: "none", color: colors.ink, display: "block" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{tenant.name}</div>
                  <div style={{ color: colors.muted, fontSize: 12 }}>{tenant.slug}</div>
                </div>
                <span style={{ background: status.bg, color: status.fg, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
                  {status.label}
                </span>
              </div>
              <div style={{ color: colors.muted, fontSize: 13, marginTop: 10 }}>
                {PLAN_LABELS[tenant.plan]} · {tenant.productCount} produits · {tenant.orderCount} commandes
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Déplacer la page `/boutiques`**

Supprimer `app/(admin)/boutiques/page.tsx` et créer `app/(admin)/(console)/boutiques/page.tsx` :

```tsx
import { listTenants } from "@/lib/platform/queries";
import { TenantListScreen } from "@/components/platform/screens/TenantListScreen";

export default async function BoutiquesPage() {
  const tenants = await listTenants();
  return <TenantListScreen tenants={tenants} />;
}
```

```bash
git rm "app/(admin)/boutiques/page.tsx"
```

- [ ] **Step 5: Vérifier types et tests**

```bash
npm run typecheck && npx vitest run
```

Attendu : aucune sortie de `typecheck`, tous les tests passent.

- [ ] **Step 6: Vérifier à la main dans le navigateur**

Connecté en `super_admin`, ouvrir `http://localhost:3000/platform/boutiques` :

1. L'en-tête « Console plateforme » et le nom du prestataire s'affichent.
2. La boutique `foulard-teranga` apparaît, avec le nom de sa gérante, l'état « Active », le palier « Pro », 10 modules, et des comptes de produits/commandes **non nuls** — les confronter à la base :

```bash
npx prisma db execute --stdin <<< 'select t.slug, t.status, t.plan, cardinality(t."enabledModules") as modules, (select count(*) from "Product" p where p."tenantId" = t.id) as produits, (select count(*) from "Order" o where o."tenantId" = t.id) as commandes from "Tenant" t;'
```

3. Réduire la fenêtre sous 820 px : le tableau cède la place aux cartes empilées.
4. Cliquer « Se déconnecter » → retour sur `/platform/connexion`.

- [ ] **Step 7: Commit**

```bash
git add "app/(admin)" components/platform && git commit -m "feat(platform): add console layout and tenant fleet list"
```

---

### Task 10: Action de création d'une boutique

**Files:**
- Create: `lib/platform/actions.ts`
- Test: `lib/platform/actions.test.ts`

**Interfaces:**
- Consumes: `currentSuperAdmin` (tâche 7), `recordPlatformAction` (tâche 7), `findTenantByDomain`/`tenantSlugExists` (tâche 8), `createTenantSchema`/`normalizeSlug` (tâche 3), `modulesForPlan` (tâche 1), `parseDomains` (tâche 2), `defaultEmployeeRoles`/`initialStorefrontPage` (tâche 4), `createAdminClient` (`lib/supabase/admin.ts`), `TENANTS_CACHE_TAG` (`lib/tenant`)
- Produces: `PlatformResult = { ok: true } | { ok: false; error: string }`, `createTenant(input: CreateTenantInput): Promise<{ ok: true; slug: string } | { ok: false; error: string }>`

Ordre imposé par le spec §8, à respecter à la lettre : **compte Auth d'abord** (l'échec le plus fréquent, « email déjà utilisé », coûte alors zéro écriture en base), puis **une seule** transaction Prisma, puis suppression au mieux du compte Auth si la transaction échoue. Précédent à copier : `createEmployee` (`lib/team/actions.ts:103-156`).

Les deux contraintes CHECK mordent ici : `enabledModules` contient toujours `dash` (garanti par `modulesForPlan`, tous les paliers l'incluent) et le `Profile` de la gérante porte le `tenantId` de la boutique créée.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `lib/platform/actions.test.ts` :

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: async () => ({
    userId: "u1",
    name: "Aya",
    role: "owner",
    tenantId: "t1",
    permissions: [],
    enabledModules: ["dash"],
  }),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    $transaction: async () => {
      throw new Error("la base ne doit jamais être atteinte sans garde");
    },
    tenant: {
      findFirst: async () => {
        throw new Error("la base ne doit jamais être atteinte sans garde");
      },
    },
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("aucun compte Auth ne doit être créé sans garde");
  },
}));

import { createTenant } from "./actions";

const denied = { ok: false, error: "Une erreur est survenue, réessayez." };

const VALID_INPUT = {
  slug: "boutique-du-plateau",
  name: "Boutique du Plateau",
  plan: "essentiel" as const,
  primaryColor: "#26326B",
  accentColor: "#D07A34",
  logoText: "BDP",
  domains: [],
  ownerName: "Aya Koné",
  ownerEmail: "aya@example.com",
  ownerPassword: "motdepasse1",
};

describe("createTenant — réservée au prestataire", () => {
  it("refuse une gérante sans toucher ni à la base ni à Supabase Auth", async () => {
    expect(await createTenant(VALID_INPUT)).toEqual(denied);
  });
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
npx vitest run lib/platform/actions.test.ts
```

Attendu : ÉCHEC — `Failed to resolve import "./actions"`.

- [ ] **Step 3: Écrire l'implémentation**

Créer `lib/platform/actions.ts` :

```ts
"use server";

import { revalidatePath, updateTag } from "next/cache";
import { prisma } from "@/lib/db/client";
import { Prisma } from "@/lib/generated/prisma/client";
import { TENANTS_CACHE_TAG } from "@/lib/tenant";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentSuperAdmin } from "./guard";
import { recordPlatformAction } from "./audit";
import { findTenantByDomain, tenantSlugExists } from "./queries";
import { modulesForPlan } from "./plans";
import { defaultEmployeeRoles, initialStorefrontPage } from "./provisioning";
import { createTenantSchema, normalizeSlug, type CreateTenantInput } from "@/lib/validators/platform";

export type PlatformResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = "Une erreur est survenue, réessayez.";

/**
 * Crée une boutique complète : compte Auth de la gérante, puis une transaction
 * unique (Tenant + profils d'accès + page vitrine + Profile owner + audit).
 * L'ordre est imposé par le spec §8 : l'échec le plus fréquent (« email déjà
 * utilisé ») est découvert avant toute écriture en base.
 */
export async function createTenant(
  input: CreateTenantInput
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const actor = await currentSuperAdmin();
  if (!actor) return { ok: false, error: GENERIC_ERROR };

  const parsed = createTenantSchema.safeParse({ ...input, slug: normalizeSlug(input.slug) });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Informations invalides." };
  }
  const data = parsed.data;

  if (await tenantSlugExists(data.slug)) {
    return { ok: false, error: "Ce slug est déjà utilisé." };
  }

  for (const domain of data.domains) {
    const conflict = await findTenantByDomain(domain);
    if (conflict) {
      return { ok: false, error: `Le domaine « ${domain} » est déjà rattaché à ${conflict.name}.` };
    }
  }

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: data.ownerEmail,
    password: data.ownerPassword,
    email_confirm: true,
  });
  if (createError || !created.user) {
    if (createError?.code === "email_exists") return { ok: false, error: "Cet email est déjà utilisé." };
    return { ok: false, error: GENERIC_ERROR };
  }
  const ownerId = created.user.id;

  const modules = modulesForPlan(data.plan);
  const page = initialStorefrontPage(data.name);

  try {
    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug: data.slug,
          name: data.name,
          primaryColor: data.primaryColor,
          accentColor: data.accentColor,
          logoText: data.logoText,
          domains: data.domains,
          plan: data.plan,
          enabledModules: modules,
        },
      });

      const roles = defaultEmployeeRoles(modules);
      if (roles.length > 0) {
        await tx.employeeRole.createMany({
          data: roles.map((role) => ({
            tenantId: tenant.id,
            name: role.name,
            permissions: role.permissions,
          })),
        });
      }

      await tx.storefrontPage.create({
        data: {
          tenantId: tenant.id,
          slug: "home",
          draft: page as unknown as Prisma.InputJsonValue,
          published: page as unknown as Prisma.InputJsonValue,
          publishedAt: new Date(),
        },
      });

      await tx.profile.create({
        data: {
          id: ownerId,
          tenantId: tenant.id,
          role: "owner",
          name: data.ownerName,
          email: data.ownerEmail,
        },
      });

      // Audit écrit dans la même transaction : PlatformAuditLog n'a aucune clé
      // étrangère (spec §1.3), donc « créée » et « tracée » sont indissociables.
      await recordPlatformAction(
        {
          actorId: actor.userId,
          action: "tenant_created",
          tenantId: tenant.id,
          metadata: { slug: data.slug, name: data.name, plan: data.plan, modules },
        },
        tx
      );
      await recordPlatformAction(
        {
          actorId: actor.userId,
          action: "owner_created",
          tenantId: tenant.id,
          targetId: ownerId,
          metadata: { email: data.ownerEmail, name: data.ownerName },
        },
        tx
      );
    });
  } catch {
    await admin.auth.admin.deleteUser(ownerId).catch(() => {
      // Rattrapage au mieux, comme dans createEmployee : le compte Auth orphelin
      // ne peut pas être signalé utilement ici, et sans Profile il ne donne accès
      // à aucune zone privilégiée.
    });
    return { ok: false, error: GENERIC_ERROR };
  }

  updateTag(TENANTS_CACHE_TAG);
  revalidatePath("/boutiques");
  return { ok: true, slug: data.slug };
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

```bash
npx vitest run lib/platform/actions.test.ts && npm run typecheck
```

Attendu : SUCCÈS — 1 test passe, `typecheck` sans sortie.

- [ ] **Step 5: Commit**

```bash
git add lib/platform/actions.ts lib/platform/actions.test.ts && git commit -m "feat(platform): create a tenant with its owner and default data"
```

---

### Task 11: Écran de création d'une boutique

**Files:**
- Create: `app/(admin)/(console)/boutiques/nouvelle/page.tsx`
- Create: `components/platform/screens/NewTenantScreen.tsx`

**Interfaces:**
- Consumes: `createTenant` (tâche 10), `parseDomains` (tâche 2), `modulesForPlan`/`PLAN_LABELS` (tâche 1), `normalizeSlug` (tâche 3), `NAV`/`MODULE_IDS` (`lib/nav.ts`), `colors`/`fonts` (`lib/theme/tokens.ts`)
- Produces: `NewTenantScreen()`

Note de routage : `/boutiques/nouvelle` est un segment statique, `/boutiques/[slug]` un segment dynamique. Next.js donne priorité au statique — aucune ambiguïté, et il n'y a rien à faire pour cela.

Le palier pré-remplit l'aperçu des modules, sans les rendre modifiables ici : l'ajustement fin se fait dans l'onglet Modules (tâche 13), conformément au spec §8 qui dérive `enabledModules` du palier à la création.

- [ ] **Step 1: Créer l'écran de formulaire**

Créer `components/platform/screens/NewTenantScreen.tsx` :

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { colors, fonts, adminBorder } from "@/lib/theme/tokens";
import { createTenant } from "@/lib/platform/actions";
import { parseDomains } from "@/lib/platform/domains";
import { normalizeSlug } from "@/lib/validators/platform";
import { modulesForPlan, PLAN_LABELS } from "@/lib/platform/plans";
import { NAV } from "@/lib/nav";
import type { TenantPlan } from "@/lib/generated/prisma/enums";

const EMPTY = {
  name: "",
  slug: "",
  plan: "essentiel" as TenantPlan,
  primaryColor: "#26326B",
  accentColor: "#D07A34",
  logoText: "",
  domainsRaw: "",
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
};

const labelStyle = { display: "flex", flexDirection: "column" as const, gap: 6, fontSize: 13, fontWeight: 600 };
const inputStyle = {
  border: `1px solid ${colors.borderField}`,
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  color: colors.ink,
  background: "#fff",
};

export function NewTenantScreen() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const domains = parseDomains(form.domainsRaw);
    if (!domains.ok) {
      setError(domains.error);
      return;
    }

    setSaving(true);
    const result = await createTenant({
      slug: normalizeSlug(form.slug),
      name: form.name,
      plan: form.plan,
      primaryColor: form.primaryColor,
      accentColor: form.accentColor,
      logoText: form.logoText,
      domains: domains.domains,
      ownerName: form.ownerName,
      ownerEmail: form.ownerEmail,
      ownerPassword: form.ownerPassword,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/boutiques/${result.slug}`);
  }

  const previewModules = modulesForPlan(form.plan);

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 760 }}>
      <Link href="/boutiques" style={{ fontSize: 13, color: colors.muted, textDecoration: "none" }}>
        ← Retour au parc
      </Link>
      <h1 style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: 600, margin: "10px 0 24px" }}>
        Nouvelle boutique
      </h1>

      <section style={{ background: colors.surface, border: adminBorder, borderRadius: 16, padding: 20, marginBottom: 18 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Identité</h2>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <label style={labelStyle}>
            Nom de la boutique
            <input
              required
              value={form.name}
              onChange={(e) => {
                set("name", e.target.value);
                if (!form.slug) set("slug", normalizeSlug(e.target.value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
              }}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Slug (sous-domaine)
            <input
              required
              value={form.slug}
              onChange={(e) => set("slug", e.target.value)}
              placeholder="boutique-du-plateau"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Logo texte
            <input required value={form.logoText} onChange={(e) => set("logoText", e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Couleur principale
            <input type="color" value={form.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} style={{ ...inputStyle, padding: 4, height: 42 }} />
          </label>
          <label style={labelStyle}>
            Couleur d'accent
            <input type="color" value={form.accentColor} onChange={(e) => set("accentColor", e.target.value)} style={{ ...inputStyle, padding: 4, height: 42 }} />
          </label>
        </div>
        <label style={{ ...labelStyle, marginTop: 14 }}>
          Domaines personnalisés (un par ligne, optionnel)
          <textarea
            value={form.domainsRaw}
            onChange={(e) => set("domainsRaw", e.target.value)}
            rows={3}
            placeholder="boutique-du-plateau.ci"
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>
      </section>

      <section style={{ background: colors.surface, border: adminBorder, borderRadius: 16, padding: 20, marginBottom: 18 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Palier</h2>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {(["essentiel", "pro"] as const).map((plan) => (
            <label key={plan} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input type="radio" name="plan" checked={form.plan === plan} onChange={() => set("plan", plan)} />
              {PLAN_LABELS[plan]}
            </label>
          ))}
        </div>
        <p style={{ color: colors.muted, fontSize: 13, marginTop: 12, marginBottom: 0 }}>
          Modules activés à la création : {previewModules.map((id) => NAV.find((n) => n.id === id)?.label ?? id).join(", ")}.
          Ajustables ensuite dans l'onglet Modules.
        </p>
      </section>

      <section style={{ background: colors.surface, border: adminBorder, borderRadius: 16, padding: 20, marginBottom: 18 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Compte de la gérante</h2>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <label style={labelStyle}>
            Nom
            <input required value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Email
            <input required type="email" autoComplete="off" value={form.ownerEmail} onChange={(e) => set("ownerEmail", e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Mot de passe initial
            <input required type="text" autoComplete="off" minLength={8} value={form.ownerPassword} onChange={(e) => set("ownerPassword", e.target.value)} style={inputStyle} />
          </label>
        </div>
        <p style={{ color: colors.muted, fontSize: 13, marginTop: 12, marginBottom: 0 }}>
          À communiquer à la gérante, qui le changera à sa première connexion.
        </p>
      </section>

      {error && (
        <p style={{ background: colors.bgDanger, color: colors.fgDanger, borderRadius: 10, padding: "10px 14px", fontSize: 14 }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        style={{
          background: colors.primary,
          color: "#fff",
          border: "none",
          borderRadius: 12,
          padding: "12px 22px",
          fontSize: 14,
          fontWeight: 600,
          cursor: saving ? "default" : "pointer",
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? "Création…" : "Créer la boutique"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Créer la page**

Créer `app/(admin)/(console)/boutiques/nouvelle/page.tsx` :

```tsx
import { NewTenantScreen } from "@/components/platform/screens/NewTenantScreen";

export default function NouvelleBoutiquePage() {
  return <NewTenantScreen />;
}
```

- [ ] **Step 3: Vérifier types et tests**

```bash
npm run typecheck && npx vitest run
```

Attendu : aucune sortie de `typecheck`, tous les tests passent.

- [ ] **Step 4: Créer une vraie boutique de test et vérifier la base**

Connecté en `super_admin`, ouvrir `http://localhost:3000/platform/boutiques/nouvelle` et créer une boutique nommée « Boutique Test », slug `boutique-test`, palier Essentiel, sans domaine, avec un email de gérante inutilisé.

Puis **vérifier soi-même en base**, sans se fier au message de succès :

```bash
npx prisma db execute --stdin <<< 'select t.slug, t.plan, t.status, t."enabledModules", (select count(*) from "EmployeeRole" e where e."tenantId" = t.id) as profils, (select count(*) from "StorefrontPage" s where s."tenantId" = t.id) as pages, (select count(*) from "Profile" p where p."tenantId" = t.id and p.role = '"'"'owner'"'"') as gerantes from "Tenant" t where t.slug = '"'"'boutique-test'"'"';'
```

Attendu : 1 ligne, `plan = essentiel`, 8 modules contenant `dash`, `profils = 2`, `pages = 1`, `gerantes = 1`.

```bash
npx prisma db execute --stdin <<< 'select action, "tenantId", "targetId" from "PlatformAuditLog" order by "createdAt" desc limit 5;'
```

Attendu : deux entrées `tenant_created` et `owner_created` portant l'id de la nouvelle boutique.

- [ ] **Step 5: Vérifier les cas d'erreur**

1. Recréer la même boutique avec le même slug → « Ce slug est déjà utilisé. » et **aucune** nouvelle ligne dans `PlatformAuditLog`.
2. Créer une boutique avec un slug libre mais l'email de gérante déjà utilisé → « Cet email est déjà utilisé. », **aucune** nouvelle ligne `Tenant` :

```bash
npx prisma db execute --stdin <<< 'select count(*) from "Tenant";'
```

3. Saisir un domaine invalide (`ma boutique.ci`) → « Domaine invalide : « ma boutique.ci ». » sans appel serveur.

- [ ] **Step 6: Nettoyer la boutique de test**

La boutique de test doit disparaître avant la fin de la phase — la suppression définitive n'arrivant qu'en phase 4, la supprimer maintenant par SQL direct, dans l'ordre des dépendances. **Demander confirmation à l'utilisateur avant d'exécuter cette suppression** (opération destructive, `CLAUDE.md` §12), et n'inclure aucun autre slug que `boutique-test` :

```bash
npx prisma db execute --stdin <<< 'begin; delete from "StorefrontPage" where "tenantId" in (select id from "Tenant" where slug = '"'"'boutique-test'"'"'); delete from "Profile" where "tenantId" in (select id from "Tenant" where slug = '"'"'boutique-test'"'"'); delete from "EmployeeRole" where "tenantId" in (select id from "Tenant" where slug = '"'"'boutique-test'"'"'); delete from "Tenant" where slug = '"'"'boutique-test'"'"'; commit;'
```

Le compte Supabase Auth de la gérante de test reste orphelin : le supprimer depuis le tableau de bord Supabase, ou le laisser, sans `Profile` il n'ouvre aucune zone privilégiée.

- [ ] **Step 7: Commit**

```bash
git add "app/(admin)" components/platform && git commit -m "feat(platform): add the tenant creation screen"
```

---

### Task 12: Fiche boutique et onglet Identité

**Files:**
- Create: `app/(admin)/(console)/boutiques/[slug]/page.tsx`
- Create: `components/platform/screens/TenantDetailScreen.tsx`
- Create: `components/platform/screens/TenantIdentityForm.tsx`
- Modify: `lib/platform/actions.ts` (ajout de `updateTenantIdentity`)
- Test: `lib/platform/actions.test.ts` (ajout d'un cas)

**Interfaces:**
- Consumes: `getTenantBySlug`/`TenantDetail` (tâche 8), `tenantIdentitySchema`/`TenantIdentityInput`/`normalizeSlug` (tâche 3), `parseDomains` (tâche 2), `findTenantByDomain`/`tenantSlugExists` (tâche 8), `recordPlatformAction` (tâche 7)
- Produces: `updateTenantIdentity(tenantId: string, input: TenantIdentityInput): Promise<PlatformResult>`, `TenantDetailScreen({ tenant, tab })`, `TenantIdentityForm({ tenant })`

**C'est cet écran qui débloque le déploiement** : le handover §5 note qu'aucun hôte de production n'est enregistré dans `Tenant.domains`, que la vitrine renvoie 404 sur tout autre domaine que `localhost`, et que la gérante ne peut plus corriger `domains` elle-même depuis la suppression (justifiée) de `tenants_update_owner`. Le champ Domaines de cet onglet est la voie prévue pour l'enregistrer.

La fiche compte six onglets au spec §6 ; la phase 2 en livre deux (Identité, Modules) et affiche les quatre autres désactivés, pour que la navigation ne mente pas sur ce qui existe.

- [ ] **Step 1: Écrire le test de garde qui échoue**

Ajouter à `lib/platform/actions.test.ts`, dans un nouveau bloc après celui de `createTenant` :

```ts
import { updateTenantIdentity } from "./actions";

describe("updateTenantIdentity — réservée au prestataire", () => {
  it("refuse une gérante sans toucher à la base", async () => {
    const result = await updateTenantIdentity("t1", {
      name: "Boutique du Plateau",
      slug: "boutique-du-plateau",
      tagline: "",
      primaryColor: "#26326B",
      accentColor: "#D07A34",
      logoText: "BDP",
      font: "Playfair Display",
      whatsappPhone: "",
      domains: [],
    });
    expect(result).toEqual(denied);
  });
});
```

Fusionner l'import avec celui de `createTenant` déjà présent en tête du fichier plutôt que d'en ajouter un second.

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
npx vitest run lib/platform/actions.test.ts
```

Attendu : ÉCHEC — `updateTenantIdentity is not a function`.

- [ ] **Step 3: Ajouter l'action**

Ajouter à la fin de `lib/platform/actions.ts` :

```ts
/**
 * Met à jour l'identité d'une boutique : nom, slug, thème, WhatsApp et surtout
 * `domains` — seule voie applicative depuis la suppression de la policy
 * `tenants_update_owner` (spec §5).
 */
export async function updateTenantIdentity(
  tenantId: string,
  input: TenantIdentityInput
): Promise<PlatformResult> {
  const actor = await currentSuperAdmin();
  if (!actor) return { ok: false, error: GENERIC_ERROR };

  const parsed = tenantIdentitySchema.safeParse({ ...input, slug: normalizeSlug(input.slug) });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Informations invalides." };
  }
  const data = parsed.data;

  if (await tenantSlugExists(data.slug, tenantId)) {
    return { ok: false, error: "Ce slug est déjà utilisé." };
  }

  for (const domain of data.domains) {
    const conflict = await findTenantByDomain(domain, tenantId);
    if (conflict) {
      return { ok: false, error: `Le domaine « ${domain} » est déjà rattaché à ${conflict.name}.` };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          name: data.name,
          slug: data.slug,
          tagline: data.tagline,
          primaryColor: data.primaryColor,
          accentColor: data.accentColor,
          logoText: data.logoText,
          font: data.font,
          whatsappPhone: data.whatsappPhone || null,
          domains: data.domains,
        },
      });
      await recordPlatformAction(
        {
          actorId: actor.userId,
          action: "tenant_updated",
          tenantId,
          metadata: { slug: data.slug, name: data.name, domains: data.domains },
        },
        tx
      );
    });
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }

  updateTag(TENANTS_CACHE_TAG);
  revalidatePath("/boutiques");
  revalidatePath(`/boutiques/${data.slug}`);
  return { ok: true };
}
```

Compléter l'import des validateurs en tête de fichier :

```ts
import {
  createTenantSchema,
  tenantIdentitySchema,
  normalizeSlug,
  type CreateTenantInput,
  type TenantIdentityInput,
} from "@/lib/validators/platform";
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

```bash
npx vitest run lib/platform/actions.test.ts && npm run typecheck
```

Attendu : SUCCÈS — 2 tests passent, `typecheck` sans sortie.

- [ ] **Step 5: Créer le formulaire d'identité**

Créer `components/platform/screens/TenantIdentityForm.tsx` :

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, adminBorder } from "@/lib/theme/tokens";
import { updateTenantIdentity } from "@/lib/platform/actions";
import { parseDomains } from "@/lib/platform/domains";
import { normalizeSlug } from "@/lib/validators/platform";
import type { TenantDetail } from "@/lib/platform/queries";

const labelStyle = { display: "flex", flexDirection: "column" as const, gap: 6, fontSize: 13, fontWeight: 600 };
const inputStyle = {
  border: `1px solid ${colors.borderField}`,
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  color: colors.ink,
  background: "#fff",
};

export function TenantIdentityForm({ tenant }: { tenant: TenantDetail }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: tenant.name,
    slug: tenant.slug,
    tagline: tenant.tagline,
    primaryColor: tenant.primaryColor,
    accentColor: tenant.accentColor,
    logoText: tenant.logoText,
    font: tenant.font === "Inter" ? "Inter" : "Playfair Display",
    whatsappPhone: tenant.whatsappPhone,
    domainsRaw: tenant.domains.join("\n"),
  });
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    const domains = parseDomains(form.domainsRaw);
    if (!domains.ok) {
      setMessage({ kind: "error", text: domains.error });
      return;
    }

    setSaving(true);
    const result = await updateTenantIdentity(tenant.id, {
      name: form.name,
      slug: normalizeSlug(form.slug),
      tagline: form.tagline,
      primaryColor: form.primaryColor,
      accentColor: form.accentColor,
      logoText: form.logoText,
      font: form.font === "Inter" ? "Inter" : "Playfair Display",
      whatsappPhone: form.whatsappPhone,
      domains: domains.domains,
    });
    setSaving(false);

    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setMessage({ kind: "ok", text: "Identité enregistrée." });
    // Le slug fait partie de l'URL : après un changement, rester sur l'ancienne
    // adresse afficherait un 404 au prochain rafraîchissement.
    const nextSlug = normalizeSlug(form.slug);
    if (nextSlug !== tenant.slug) router.replace(`/boutiques/${nextSlug}?onglet=identite`);
    else router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: colors.surface, border: adminBorder, borderRadius: 16, padding: 20, maxWidth: 760 }}>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <label style={labelStyle}>
          Nom de la boutique
          <input required value={form.name} onChange={(e) => set("name", e.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Slug (sous-domaine)
          <input required value={form.slug} onChange={(e) => set("slug", e.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Logo texte
          <input required value={form.logoText} onChange={(e) => set("logoText", e.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Police
          <select value={form.font} onChange={(e) => set("font", e.target.value)} style={inputStyle}>
            <option value="Playfair Display">Playfair Display</option>
            <option value="Inter">Inter</option>
          </select>
        </label>
        <label style={labelStyle}>
          Couleur principale
          <input type="color" value={form.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} style={{ ...inputStyle, padding: 4, height: 42 }} />
        </label>
        <label style={labelStyle}>
          Couleur d'accent
          <input type="color" value={form.accentColor} onChange={(e) => set("accentColor", e.target.value)} style={{ ...inputStyle, padding: 4, height: 42 }} />
        </label>
        <label style={labelStyle}>
          Numéro WhatsApp
          <input value={form.whatsappPhone} onChange={(e) => set("whatsappPhone", e.target.value)} style={inputStyle} />
        </label>
      </div>

      <label style={{ ...labelStyle, marginTop: 14 }}>
        Accroche
        <input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={120} style={inputStyle} />
      </label>

      <label style={{ ...labelStyle, marginTop: 14 }}>
        Domaines (un par ligne)
        <textarea value={form.domainsRaw} onChange={(e) => set("domainsRaw", e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
        <span style={{ fontWeight: 400, color: colors.muted, fontSize: 12 }}>
          Le domaine nu suffit : les sous-domaines admin. et platform. sont résolus automatiquement.
        </span>
      </label>

      {message && (
        <p
          style={{
            background: message.kind === "ok" ? colors.bgSuccess : colors.bgDanger,
            color: message.kind === "ok" ? colors.fgSuccess : colors.fgDanger,
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 14,
          }}
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        style={{
          marginTop: 16,
          background: colors.primary,
          color: "#fff",
          border: "none",
          borderRadius: 12,
          padding: "11px 20px",
          fontSize: 14,
          fontWeight: 600,
          cursor: saving ? "default" : "pointer",
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Créer la fiche et sa navigation d'onglets**

Créer `components/platform/screens/TenantDetailScreen.tsx` :

```tsx
import Link from "next/link";
import { colors, fonts, adminBorder } from "@/lib/theme/tokens";
import { PLAN_LABELS } from "@/lib/platform/plans";
import type { TenantDetail } from "@/lib/platform/queries";

export type TenantTab = "identite" | "modules";

/** Les six onglets du spec §6. Ceux non livrés en phase 2 sont visibles mais inertes. */
const TABS: { id: string; label: string; available: boolean }[] = [
  { id: "apercu", label: "Vue d'ensemble", available: false },
  { id: "modules", label: "Modules", available: true },
  { id: "equipe", label: "Équipe", available: false },
  { id: "identite", label: "Identité", available: true },
  { id: "journal", label: "Journal", available: false },
  { id: "danger", label: "Zone de danger", available: false },
];

export function TenantDetailScreen({
  tenant,
  tab,
  children,
}: {
  tenant: TenantDetail;
  tab: TenantTab;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Link href="/boutiques" style={{ fontSize: 13, color: colors.muted, textDecoration: "none" }}>
        ← Retour au parc
      </Link>

      <header style={{ margin: "10px 0 20px" }}>
        <h1 style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: 600, margin: 0 }}>{tenant.name}</h1>
        <p style={{ color: colors.muted, fontSize: 14, margin: "4px 0 0" }}>
          {tenant.slug} · {PLAN_LABELS[tenant.plan]} · {tenant.enabledModules.length} modules ·{" "}
          {tenant.owner ? `Gérante : ${tenant.owner.name}` : "Aucune gérante rattachée"}
        </p>
      </header>

      <nav style={{ display: "flex", gap: 4, flexWrap: "wrap", borderBottom: adminBorder, marginBottom: 20 }}>
        {TABS.map((item) =>
          item.available ? (
            <Link
              key={item.id}
              href={`/boutiques/${tenant.slug}?onglet=${item.id}`}
              style={{
                padding: "9px 14px",
                fontSize: 14,
                fontWeight: tab === item.id ? 600 : 400,
                color: tab === item.id ? colors.primary : colors.muted,
                borderBottom: `2px solid ${tab === item.id ? colors.primary : "transparent"}`,
                textDecoration: "none",
              }}
            >
              {item.label}
            </Link>
          ) : (
            <span
              key={item.id}
              title="Disponible dans une prochaine phase"
              style={{ padding: "9px 14px", fontSize: 14, color: colors.disabled }}
            >
              {item.label}
            </span>
          )
        )}
      </nav>

      {children}
    </div>
  );
}
```

`TenantDetailScreen` ne rend pas les formulaires lui-même : la page les lui passe en `children`. C'est ce qui lui permet de rester un Server Component tout en accueillant des formulaires clients.

- [ ] **Step 7: Créer la page de fiche**

Créer `app/(admin)/(console)/boutiques/[slug]/page.tsx` :

```tsx
import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/platform/queries";
import { TenantDetailScreen, type TenantTab } from "@/components/platform/screens/TenantDetailScreen";
import { TenantIdentityForm } from "@/components/platform/screens/TenantIdentityForm";

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

  const tab: TenantTab = onglet === "modules" ? "modules" : "identite";
  return (
    <TenantDetailScreen tenant={tenant} tab={tab}>
      <TenantIdentityForm tenant={tenant} />
    </TenantDetailScreen>
  );
}
```

L'onglet Modules est branché à la tâche suivante ; jusque-là, `?onglet=modules` affiche l'onglet Identité, ce qui est visible et sans risque.

- [ ] **Step 8: Vérifier types et tests**

```bash
npm run typecheck && npx vitest run
```

Attendu : aucune sortie de `typecheck`, tous les tests passent.

- [ ] **Step 9: Vérifier à la main dans le navigateur**

1. Depuis `/platform/boutiques`, cliquer sur « Foulard Teranga » → la fiche s'ouvre sur l'onglet Identité, pré-remplie avec les valeurs réelles.
2. Modifier l'accroche, enregistrer → message « Identité enregistrée. », valeur persistée après rafraîchissement :

```bash
npx prisma db execute --stdin <<< 'select slug, name, tagline, domains from "Tenant" where slug = '"'"'foulard-teranga'"'"';'
```

3. Vérifier que l'audit s'est alimenté :

```bash
npx prisma db execute --stdin <<< 'select action, "tenantId", metadata from "PlatformAuditLog" order by "createdAt" desc limit 3;'
```

Attendu : une entrée `tenant_updated`.

4. Saisir un domaine déjà rattaché à une autre boutique (à tester seulement s'il existe une seconde boutique) → message nommant la boutique en conflit.
5. Ouvrir `/platform/boutiques/slug-inexistant` → page 404.

- [ ] **Step 10: Enregistrer le domaine de production**

C'est le moment prévu pour lever le point bloquant du handover §5. **Demander à l'utilisateur le domaine de production exact**, puis l'ajouter par le champ Domaines de cet écran (une seule entrée de domaine nu suffit : le retrait des préfixes `admin.`/`platform.` est implémenté depuis la phase 1). Vérifier ensuite :

```bash
npx prisma db execute --stdin <<< 'select slug, domains from "Tenant";'
```

Si l'utilisateur n'a pas encore de domaine arrêté, le noter comme reste-à-faire explicite dans le rapport de fin de phase plutôt que d'inventer une valeur.

- [ ] **Step 11: Commit**

```bash
git add lib/platform/actions.ts lib/platform/actions.test.ts "app/(admin)" components/platform && git commit -m "feat(platform): add tenant detail page with the identity tab"
```

---

### Task 13: Onglet Modules

**Files:**
- Create: `components/platform/screens/TenantModulesForm.tsx`
- Modify: `lib/platform/actions.ts` (ajout de `updateTenantModules`)
- Modify: `app/(admin)/(console)/boutiques/[slug]/page.tsx` (branchement de l'onglet)
- Test: `lib/platform/actions.test.ts` (ajout d'un cas)

**Interfaces:**
- Consumes: `tenantModulesFormSchema`/`TenantModulesInput` (tâche 3), `modulesForPlan`/`PLAN_LABELS` (tâche 1), `recordPlatformAction` (tâche 7), `TenantDetail` (tâche 8)
- Produces: `updateTenantModules(tenantId: string, input: TenantModulesInput): Promise<PlatformResult>`, `TenantModulesForm({ tenant })`

Deux gardes concentriques sur `dash` : le schéma Zod (message lisible) et la contrainte base `tenant_min_modules` (garantie ultime). La case `dash` est aussi **désactivée dans l'UI**, pour que le refus se comprenne avant d'être déclenché.

Choisir un palier **pré-remplit** les cases sans les figer (spec §1.1) : la source de vérité de l'accès reste `enabledModules` seul.

- [ ] **Step 1: Écrire le test de garde qui échoue**

Ajouter à `lib/platform/actions.test.ts` :

```ts
describe("updateTenantModules — réservée au prestataire", () => {
  it("refuse une gérante sans toucher à la base", async () => {
    const result = await updateTenantModules("t1", { plan: "pro", modules: ["dash", "pos"] });
    expect(result).toEqual(denied);
  });
});
```

Ajouter `updateTenantModules` à l'import existant depuis `./actions`.

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
npx vitest run lib/platform/actions.test.ts
```

Attendu : ÉCHEC — `updateTenantModules is not a function`.

- [ ] **Step 3: Ajouter l'action**

Ajouter à la fin de `lib/platform/actions.ts` :

```ts
/**
 * Ajuste le périmètre fonctionnel d'une boutique. `plan` n'est qu'un
 * pré-remplissage (spec §1.1) : on enregistre les deux, mais seule
 * `enabledModules` gouverne l'accès (`hasModuleAccess`).
 */
export async function updateTenantModules(
  tenantId: string,
  input: TenantModulesInput
): Promise<PlatformResult> {
  const actor = await currentSuperAdmin();
  if (!actor) return { ok: false, error: GENERIC_ERROR };

  const parsed = tenantModulesFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Informations invalides." };
  }
  const data = parsed.data;

  try {
    const before = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true, plan: true, enabledModules: true },
    });
    if (!before) return { ok: false, error: "Boutique introuvable." };

    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: { plan: data.plan, enabledModules: data.modules },
      });
      await recordPlatformAction(
        {
          actorId: actor.userId,
          action: "modules_changed",
          tenantId,
          metadata: {
            planBefore: before.plan,
            planAfter: data.plan,
            modulesBefore: before.enabledModules,
            modulesAfter: data.modules,
          },
        },
        tx
      );
    });

    updateTag(TENANTS_CACHE_TAG);
    revalidatePath("/boutiques");
    revalidatePath(`/boutiques/${before.slug}`);
    return { ok: true };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}
```

Compléter l'import des validateurs :

```ts
import {
  createTenantSchema,
  tenantIdentitySchema,
  tenantModulesFormSchema,
  normalizeSlug,
  type CreateTenantInput,
  type TenantIdentityInput,
  type TenantModulesInput,
} from "@/lib/validators/platform";
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

```bash
npx vitest run lib/platform/actions.test.ts && npm run typecheck
```

Attendu : SUCCÈS — 3 tests passent, `typecheck` sans sortie.

- [ ] **Step 5: Créer le formulaire des modules**

Créer `components/platform/screens/TenantModulesForm.tsx` :

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, adminBorder } from "@/lib/theme/tokens";
import { updateTenantModules } from "@/lib/platform/actions";
import { modulesForPlan, PLAN_LABELS } from "@/lib/platform/plans";
import { MODULE_IDS, NAV, type ModuleId } from "@/lib/nav";
import type { TenantDetail } from "@/lib/platform/queries";
import type { TenantPlan } from "@/lib/generated/prisma/enums";

const MODULE_LABELS: Record<string, string> = Object.fromEntries(
  MODULE_IDS.map((id) => [id, NAV.find((n) => n.id === id)?.label ?? id])
);

export function TenantModulesForm({ tenant }: { tenant: TenantDetail }) {
  const router = useRouter();
  const [plan, setPlan] = useState<TenantPlan>(tenant.plan);
  const [modules, setModules] = useState<string[]>(tenant.enabledModules);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  function applyPlan(next: TenantPlan) {
    setPlan(next);
    setModules(modulesForPlan(next));
  }

  function toggle(id: string) {
    // `dash` est le socle : la contrainte base tenant_min_modules l'exige, la
    // case est désactivée, et ce garde ferme le dernier chemin.
    if (id === "dash") return;
    setModules((current) =>
      current.includes(id) ? current.filter((m) => m !== id) : [...current, id]
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setSaving(true);
    const result = await updateTenantModules(tenant.id, { plan, modules: modules as ModuleId[] });
    setSaving(false);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setMessage({ kind: "ok", text: "Périmètre enregistré." });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: colors.surface, border: adminBorder, borderRadius: 16, padding: 20, maxWidth: 760 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>Palier</h2>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 8 }}>
        {(["essentiel", "pro"] as const).map((id) => (
          <label key={id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input type="radio" name="plan" checked={plan === id} onChange={() => applyPlan(id)} />
            {PLAN_LABELS[id]}
          </label>
        ))}
      </div>
      <p style={{ color: colors.muted, fontSize: 13, marginTop: 0 }}>
        Choisir un palier pré-remplit les cases ci-dessous ; elles restent librement ajustables.
      </p>

      <h2 style={{ fontSize: 15, fontWeight: 600, margin: "20px 0 12px" }}>Modules activés</h2>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {MODULE_IDS.map((id) => (
          <label
            key={id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 14,
              color: id === "dash" ? colors.muted : colors.ink,
            }}
          >
            <input
              type="checkbox"
              checked={modules.includes(id)}
              disabled={id === "dash"}
              onChange={() => toggle(id)}
            />
            {MODULE_LABELS[id]}
            {id === "dash" && <span style={{ fontSize: 12 }}>(socle)</span>}
          </label>
        ))}
      </div>

      {message && (
        <p
          style={{
            background: message.kind === "ok" ? colors.bgSuccess : colors.bgDanger,
            color: message.kind === "ok" ? colors.fgSuccess : colors.fgDanger,
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 14,
          }}
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        style={{
          marginTop: 16,
          background: colors.primary,
          color: "#fff",
          border: "none",
          borderRadius: 12,
          padding: "11px 20px",
          fontSize: 14,
          fontWeight: 600,
          cursor: saving ? "default" : "pointer",
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Brancher l'onglet dans la page**

Remplacer entièrement `app/(admin)/(console)/boutiques/[slug]/page.tsx` :

```tsx
import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/platform/queries";
import { TenantDetailScreen, type TenantTab } from "@/components/platform/screens/TenantDetailScreen";
import { TenantIdentityForm } from "@/components/platform/screens/TenantIdentityForm";
import { TenantModulesForm } from "@/components/platform/screens/TenantModulesForm";

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

  const tab: TenantTab = onglet === "modules" ? "modules" : "identite";
  return (
    <TenantDetailScreen tenant={tenant} tab={tab}>
      {tab === "modules" ? <TenantModulesForm tenant={tenant} /> : <TenantIdentityForm tenant={tenant} />}
    </TenantDetailScreen>
  );
}
```

- [ ] **Step 7: Vérifier types et tests**

```bash
npm run typecheck && npx vitest run
```

Attendu : aucune sortie de `typecheck`, tous les tests passent.

- [ ] **Step 8: Vérifier à la main, y compris l'effet réel sur l'accès**

Sur `/platform/boutiques/foulard-teranga?onglet=modules` :

1. La case « Tableau de bord » est cochée et **désactivée**.
2. Choisir le palier Essentiel → Marketing et Finance se décochent automatiquement.
3. Enregistrer, puis vérifier en base :

```bash
npx prisma db execute --stdin <<< 'select slug, plan, "enabledModules" from "Tenant" where slug = '"'"'foulard-teranga'"'"';'
```

4. **Vérifier l'effet réel côté gérante** — c'est le test qui compte : ouvrir le dashboard connecté en `owner`, constater que Marketing et Finance ont disparu de la navigation, et qu'un accès direct à `/admin/finance` redirige vers un module autorisé.
5. Remettre le palier Pro, enregistrer, et **confirmer que Finance et Marketing sont revenus** dans le dashboard de la gérante. La boutique doit finir la tâche avec ses 10 modules, comme avant.

```bash
npx prisma db execute --stdin <<< 'select action, metadata from "PlatformAuditLog" where action = '"'"'modules_changed'"'"' order by "createdAt" desc limit 2;'
```

Attendu : deux entrées, avec `modulesBefore`/`modulesAfter` cohérents avec les deux enregistrements.

- [ ] **Step 9: Commit**

```bash
git add lib/platform/actions.ts lib/platform/actions.test.ts "app/(admin)" components/platform && git commit -m "feat(platform): add the modules tab with plan presets"
```

---

### Task 14: Dette reportée de la phase 1

**Files:**
- Modify: `app/(dashboard)/layout.tsx` (lignes 17-22)
- Modify: `app/(storefront)/produit/[id]/page.tsx` (lignes 16-23)

**Interfaces:**
- Consumes: `getCurrentTenantOrNull` (`lib/tenant`), `notFound` (`next/navigation`)
- Produces: aucun export nouveau

Les deux constats du handover §5, « Points Importants, dictés par le plan » — décision utilisateur du 2026-07-28 : à corriger dans cette phase.

Constat 1 : `ProductPage` appelle `getCatalog() → getCurrentTenant()` indépendamment du layout. Next rendant layout et page en parallèle, un hôte inconnu produit une exception non capturée dans les logs **en plus** du 404 correct rendu par le garde du layout. Bruit de logs, pas d'erreur de réponse.

Constat 2 : `app/(dashboard)/layout.tsx` appelle `getCurrentTenant()` sans `try/catch` — un hôte non résolu lève une erreur brute au lieu d'une réponse contrôlée.

- [ ] **Step 1: Rendre `ProductPage` silencieuse sur hôte inconnu**

Remplacer dans `app/(storefront)/produit/[id]/page.tsx` :

```tsx
import { notFound } from "next/navigation";
import { getCatalog, getProductById } from "@/lib/data/catalog.server";
```

par :

```tsx
import { notFound } from "next/navigation";
import { getCurrentTenantOrNull } from "@/lib/tenant";
import { getCatalog, getProductById } from "@/lib/data/catalog.server";
```

puis remplacer le corps de `ProductPage` :

```tsx
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();
  const products = await getCatalog();
  const related = relatedTo(products, product.id);
  return <ProductView product={product} related={related} />;
}
```

par :

```tsx
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  // Le layout rend déjà un 404 sur hôte inconnu, mais Next rend layout et page
  // en parallèle : sans ce garde, ce segment appelle getCurrentTenant() et lève
  // une exception non capturée dans les logs, en plus du 404 correct.
  if (!(await getCurrentTenantOrNull())) notFound();

  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();
  const products = await getCatalog();
  const related = relatedTo(products, product.id);
  return <ProductView product={product} related={related} />;
}
```

- [ ] **Step 2: Poser une frontière d'erreur dans le layout dashboard**

Remplacer dans `app/(dashboard)/layout.tsx` :

```tsx
import { getCurrentTenant } from "@/lib/tenant";
```

par :

```tsx
import { notFound } from "next/navigation";
import { getCurrentTenantOrNull } from "@/lib/tenant";
```

puis remplacer :

```tsx
  const [session, pendingCount, notifications, tenant] = await Promise.all([
    getSession(),
    getPendingOrdersCount(),
    getNotifications(),
    getCurrentTenant(),
  ]);
```

par :

```tsx
  // `proxy.ts` est censé n'acheminer ici que des hôtes résolus, mais un hôte
  // inconnu produisait une exception brute plutôt qu'une réponse contrôlée.
  const tenant = await getCurrentTenantOrNull();
  if (!tenant) notFound();

  const [session, pendingCount, notifications] = await Promise.all([
    getSession(),
    getPendingOrdersCount(),
    getNotifications(),
  ]);
```

Note : la résolution du tenant passe désormais avant les trois autres appels au lieu d'être parallélisée avec eux. C'est délibéré — `getPendingOrdersCount()` et `getNotifications()` résolvent eux-mêmes le tenant et lèveraient sur un hôte inconnu, ce qui reproduirait exactement le bruit de logs qu'on supprime. La résolution étant en cache (`unstable_cache`, `lib/tenant/registry.ts`), le coût de la sérialisation est celui d'une lecture de cache.

- [ ] **Step 3: Vérifier types et tests**

```bash
npm run typecheck && npx vitest run
```

Attendu : aucune sortie de `typecheck`, tous les tests passent.

- [ ] **Step 4: Vérifier le comportement sur hôte inconnu**

Un hôte inconnu se simule sans toucher au DNS, en forçant l'en-tête `Host` :

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Host: inconnu.example" http://localhost:3000/
```

Attendu : `404`.

Vérifier ensuite qu'aucune exception « Aucune boutique ne correspond à cet hôte » n'apparaît dans les logs du serveur de développement pour ces requêtes, puis :

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/admin/pos
```

Attendu : `200` sur la vitrine, et la redirection habituelle vers la connexion sur le dashboard — aucune régression sur l'hôte connu.

Vérifier enfin une fiche produit sur hôte inconnu :

```bash
npx prisma db execute --stdin <<< 'select id from "Product" limit 1;'
```

puis, avec cet identifiant :

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Host: inconnu.example" "http://localhost:3000/produit/<ID>"
```

Attendu : `404`, sans exception dans les logs.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/layout.tsx" "app/(storefront)/produit/[id]/page.tsx" && git commit -m "fix(storefront): return a controlled 404 for unknown hosts instead of throwing"
```

---

### Task 15: Vérification de bout en bout et régression RLS

**Files:**
- Modify: `docs/superpowers/HANDOVER-super-admin-phase-2.md` (marquer les points traités)

**Interfaces:**
- Consumes: tout ce qui précède
- Produces: aucun code

Cette phase **n'ajoute aucune table et aucune migration** : la règle `CLAUDE.md` §12 (« toute nouvelle table → migration + policy RLS + test ») ne se déclenche donc pas. On vérifie en revanche que la phase 1 n'a pas régressé.

- [ ] **Step 1: Rejouer les assertions RLS de la phase 1**

```bash
npx prisma db execute --file prisma/tests/rls_phase1.sql
```

Attendu : **aucune sortie** — les 6 assertions passent. Toute ligne `ASSERTION ÉCHOUÉE` est un blocage : ne pas continuer, diagnostiquer d'abord.

- [ ] **Step 2: Vérifier qu'aucune migration n'a été introduite**

```bash
git diff --name-only main...HEAD -- prisma/
```

Attendu : soit aucune sortie, soit uniquement des fichiers de test. Si un dossier `prisma/migrations/` apparaît, **s'arrêter et demander** — la phase 2 n'en prévoit aucune, et le flux de migration de ce projet n'utilise jamais la CLI Prisma (handover §2.1).

Vérifier également que l'historique appliqué en base correspond toujours au dossier :

```bash
npx prisma db execute --stdin <<< 'select count(*) from "Tenant";'
```

- [ ] **Step 3: Vérifier la suite complète**

```bash
npx vitest run && npm run typecheck
```

Attendu : tous les tests passent (272 de la phase 1 + les ~50 ajoutés ici), `typecheck` sans sortie. Rappel : `npm run lint` échoue pour une raison préexistante d'outillage — ne pas la compter contre ce travail.

- [ ] **Step 4: Parcours complet dans le navigateur**

Dans l'ordre, sans court-circuit :

1. `/platform/boutiques` non authentifié → connexion plateforme.
2. Connexion en `super_admin` → liste du parc.
3. Fiche d'une boutique → onglet Identité → modification → persistée.
4. Onglet Modules → changement de palier → effet visible dans le dashboard de la gérante → retour à l'état initial.
5. Déconnexion → retour à la connexion plateforme.
6. Connexion en `owner` sur `/admin/connexion` → dashboard intact, aucune régression.
7. Vitrine publique sur `localhost` → intacte.

- [ ] **Step 5: Confronter l'audit à la réalité**

```bash
npx prisma db execute --stdin <<< 'select action, count(*) from "PlatformAuditLog" group by action order by 2 desc;'
```

Attendu : au moins `tenant_created`, `owner_created`, `tenant_updated` et `modules_changed` présents, avec des comptes cohérents avec les actions réellement effectuées pendant cette phase. Une action effectuée sans trace correspondante est un défaut à corriger avant de clore.

- [ ] **Step 6: Mettre à jour le handover**

Dans `docs/superpowers/HANDOVER-super-admin-phase-2.md`, section 5 :

- Si le domaine de production a été enregistré (tâche 12, étape 10), remplacer le bloc « Bloquant avant tout déploiement » par une note indiquant la date et le domaine enregistré.
- Retirer les deux puces « Points Importants, dictés par le plan », désormais corrigées (tâche 14), et les mentionner comme traitées.

Ne pas réécrire le reste du document : il reste la trace de la phase 1.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/HANDOVER-super-admin-phase-2.md && git commit -m "docs: record phase 2 resolutions in the handover"
```

---

### Task 16: Finition UI avec Impeccable

**Files:**
- Modify: `components/platform/**` (au jugement de la skill)

**Interfaces:**
- Consumes: tous les écrans plateforme livrés par les tâches 9 à 13
- Produces: aucun changement d'interface programmatique — cette tâche ne touche ni aux Server Actions, ni aux requêtes, ni au routage

Handover §4 (piège 7) : Impeccable intervient en phase 2 **une fois la logique des écrans en place**, ce qui est le cas à ce stade. Demande initiale de l'utilisateur, confirmée au brainstorming.

- [ ] **Step 1: Vérifier que le point de départ est propre**

```bash
git status --short && npx vitest run && npm run typecheck
```

Attendu : arbre propre, tests verts, types propres. Ne pas lancer de finition UI sur une base instable.

- [ ] **Step 2: Invoquer la skill**

Invoquer la skill `impeccable` sur les écrans de la zone plateforme : `TenantListScreen`, `NewTenantScreen`, `TenantDetailScreen`, `TenantIdentityForm`, `TenantModulesForm`, `PlatformShell`.

Contraintes à lui transmettre :

- Ces écrans sont **pensés pour le bureau**, avec repli en cartes empilées sur mobile — exception assumée au mobile-first de `CLAUDE.md` §10 (spec §6, « Responsive »).
- Le back-office préfère les **bordures fines aux ombres** (`adminBorder`, `lib/theme/tokens.ts`).
- Les couleurs viennent de `lib/theme/tokens.ts`, pas de valeurs littérales. La zone plateforme n'utilise **pas** les variables CSS de thème d'une boutique (`--color-*`) : elle appartient au prestataire, pas à une cliente.
- Accessibilité : sémantique HTML, labels, focus visibles, contrastes AA (`CLAUDE.md` §8).
- **Aucun changement de comportement** : les Server Actions appelées, leurs arguments et les messages d'erreur restent identiques.

- [ ] **Step 3: Vérifier après finition**

```bash
npm run typecheck && npx vitest run
```

Attendu : aucune sortie de `typecheck`, tous les tests passent.

Puis reprendre le parcours navigateur de la tâche 15, étape 4, dans son intégralité : une finition UI qui casse la création d'une boutique est une régression, pas une amélioration.

- [ ] **Step 4: Commit**

```bash
git add components/platform && git commit -m "style(platform): polish the console screens"
```

---

## Ce que la phase 2 ne fait pas

À rappeler dans le rapport de fin de phase, pour que la phase 3 parte du bon pied :

- **Pas d'impersonation** (contexte d'acteur, cookie signé, `requireWritableSession`, bandeau, mode intervention) — phase 3.
- **Pas de cycle de vie** (suspension, archivage, suppression définitive, zone de danger, export JSON, diagnostic, reset de mot de passe, onglet Équipe plateforme) — phase 4. Les quatre onglets correspondants sont visibles mais inertes.
- **Pas de pilotage** (tableau de bord agrégé, `/journal`, annonces, liste « à relancer ») — phase 5. `PlatformAuditLog` est **alimenté** par cette phase mais n'a pas encore d'écran de lecture.
- **Pas de correctif** sur les points « mineurs » du handover §5 (clé `localStorage` littérale de `useStorefront`, validation `MODULE_IDS` statique de `lib/validators/team.ts`, modules désactivés listés par `EquipeScreen`, impasse du `staff` sans module, `registry.test.ts` mockant un `revalidateTag` disparu). Ils restent au backlog.
- **Piège connu pour la phase 5** : `/tableau-de-bord` est déjà un chemin du dashboard. Le tableau de bord plateforme prévu au spec §6 ne peut pas être un second `page.tsx` sur ce chemin — il faudra appliquer la même technique que `/connexion` (branchement sur l'en-tête `x-zone`) ou choisir un autre chemin pour la zone plateforme.
