# Super-admin plateforme — Phase 1 : Fondations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser le socle multi-boutique — colonnes de cycle de vie et de périmètre sur `Tenant`, table d'audit, résolution du tenant depuis la base, et permissions par intersection — sans qu'aucun écran existant ne change de comportement pour la boutique en service.

**Architecture:** Les migrations Prisma ajoutent le cycle de vie (`status`, `plan`, `enabledModules`) à `Tenant`, rendent `Profile.tenantId` nullable pour les comptes plateforme, créent `PlatformAuditLog`, et suppriment la policy RLS `tenants_update_owner` qui ouvre un chemin d'écriture PostgREST détournable. Côté application, `lib/tenant` cesse de lire un tableau codé en dur et résout l'hôte depuis la base via `unstable_cache`, `proxy.ts` transmet le hostname au lieu d'un id de tenant, et `hasModuleAccess` devient l'intersection entre les modules activés pour la boutique et les permissions de l'employé.

**Tech Stack:** Next.js 16.2 (App Router, Server Components, `proxy.ts`), React 19.2, TypeScript strict, Prisma 7.8 + PostgreSQL (Supabase), Vitest 4, Zod 4.

## Global Constraints

- **Spec de référence :** `docs/superpowers/specs/2026-07-26-super-admin-platform-design.md`. Toute divergence doit être signalée, pas improvisée.
- **Aucun `any`** — TypeScript strict, `unknown` + narrowing si nécessaire (`CLAUDE.md` §8).
- **Server Components par défaut**, `"use client"` seulement si interactivité ; mutations par Server Actions validées par Zod.
- **Résultats typés** `{ ok: true } | { ok: false; error: string }`, jamais d'exception silencieuse. Messages utilisateur en français.
- **Jamais de `service_role` côté client**, jamais de contournement de RLS depuis le navigateur.
- **`unstable_cache` et non `use cache`** : `cacheTag()` lève une erreur sans `cacheComponents: true` dans `next.config.ts`, et activer ce drapeau changerait la sémantique de cache de toute l'application — hors périmètre de cette phase.
- **Commandes** : tests `npx vitest run <fichier>`, typecheck `npm run typecheck`.
- **Migrations — `npx prisma migrate dev` est inutilisable dans ce projet, ne jamais l'invoquer.** Vérifié en pratique (Task 1) : cette commande rejoue tout l'historique dans une base de calque (« shadow database ») vierge que Prisma crée elle-même, laquelle n'a pas le schéma `auth` de Supabase — la première migration RLS (`auth.uid()`) y échoue systématiquement avec `schema "auth" does not exist`. Confirmation supplémentaire : la table `_prisma_migrations` **n'existe pas** sur le projet réel (vérifié par `execute_sql`) — aucune migration de ce dépôt n'a jamais transité par le moteur de migration Prisma. Le vrai flux, utilisé par toutes les migrations existantes (`list_migrations` via Supabase MCP en fait foi) :
  1. Écrire à la main le fichier `prisma/migrations/<timestamp>_<name>/migration.sql` (le contenu exact est donné dans chaque tâche — aucune génération requise).
  2. L'appliquer à la vraie base avec l'outil MCP **`mcp__supabase__apply_migration`** (`name`, `query`) — jamais avec la CLI Prisma.
  3. Vérifier avec `npx prisma db execute --stdin` (sans danger : exécute du SQL direct sur `DIRECT_URL`, ne touche à aucune base de calque) ou avec `mcp__supabase__execute_sql` pour une lecture seule.
  4. `npx prisma generate` (déjà relancé par `postinstall` à chaque `npm install`) resynchronise le client typé sur `schema.prisma` — cette étape ne dépend d'aucune base et fonctionne normalement.
- **Commits** : Conventional Commits, une préoccupation par commit.
- **Le fichier de proxy s'appelle `proxy.ts`** (convention Next.js 16) — ne jamais créer `middleware.ts`.

## Correction apportée au spec

Le spec §1 donnait `enabledModules String[] @default([])`, ce qui contredit la
contrainte `tenant_min_modules` ajoutée en §4 (`dash` toujours présent) : toute
insertion omettant le champ échouerait. **Le défaut retenu est la liste du
palier `essentiel`**, cohérent avec `plan @default(essentiel)`. Cette
correction est appliquée en Task 1 et le spec est mis à jour en Task 9.

## Structure des fichiers

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `prisma/schema.prisma` | Modèles et enums | 1, 2, 3 |
| `prisma/migrations/*/migration.sql` | DDL, contraintes, policies | 1, 2, 3, 4 |
| `prisma/tests/rls_phase1.sql` | Assertions RLS exécutables | 3, 4 |
| `scripts/seed-super-admin.ts` | Création du premier compte plateforme | 5 |
| `lib/tenant/registry.ts` | Résolution hôte → tenant depuis la base | 6 |
| `lib/tenant/index.ts` | Accès au tenant courant (avec et sans null) | 6 |
| `lib/tenant/actions.ts` | Invalidation du cache après mutation | 6 |
| `proxy.ts` | Transmission du hostname | 6 |
| `app/(storefront)/layout.tsx` | Hôte inconnu → 404 | 6 |
| `lib/auth/session.ts` | `Session` élargie, intersection des modules | 7 |
| `app/(dashboard)/equipe/page.tsx` | Passe les modules activés à l'écran | 8 |
| `components/dashboard/screens/EquipeScreen.tsx` | Liste filtrée des modules | 8 |

---

### Task 1: Cycle de vie et périmètre sur `Tenant`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_tenant_lifecycle_modules/migration.sql`

**Interfaces:**
- Consumes: rien.
- Produces: `TenantStatus` (`active` | `suspended` | `archived`), `TenantPlan` (`essentiel` | `pro`), et sur `Tenant` : `status`, `plan`, `enabledModules: string[]`, `suspendedAt`, `suspendedReason`, `archivedAt`. Contrainte `tenant_min_modules` garantissant `'dash' = any("enabledModules")`.

- [ ] **Step 1: Ajouter les enums et les champs au schéma Prisma**

Dans `prisma/schema.prisma`, après l'enum `PromoKind` :

```prisma
enum TenantStatus {
  active
  suspended
  archived
}

enum TenantPlan {
  essentiel
  pro
}
```

Puis dans `model Tenant`, après `createdAt DateTime @default(now())` :

```prisma
  status          TenantStatus @default(active)
  plan            TenantPlan   @default(essentiel)
  enabledModules  String[]     @default(["pos", "dash", "orders", "inv", "cust", "theme", "vitrine", "boutique"])
  suspendedAt     DateTime?
  suspendedReason String?
  archivedAt      DateTime?
```

- [ ] **Step 2: Créer le dossier de migration**

`npx prisma migrate dev` est inutilisable dans ce projet (cf. Global
Constraints) : créer le fichier à la main, en suivant la convention de nommage
des migrations existantes (`ls prisma/migrations/` pour le format).

Run:
```bash
mkdir -p "prisma/migrations/$(date -u +%Y%m%d%H%M%S)_tenant_lifecycle_modules"
```
Note le chemin exact créé (avec l'horodatage réel) — il sera réutilisé aux
étapes suivantes.

- [ ] **Step 3: Écrire la migration complète (DDL + contrainte)**

Créer `migration.sql` dans le dossier créé à l'étape précédente, avec ce
contenu complet — le DDL correspondant aux champs ajoutés à l'étape 1, suivi
d'un backfill et de la contrainte :

```sql
create type "TenantStatus" as enum ('active', 'suspended', 'archived');
create type "TenantPlan" as enum ('essentiel', 'pro');

alter table "Tenant"
  add column "status" "TenantStatus" not null default 'active',
  add column "plan" "TenantPlan" not null default 'essentiel',
  add column "enabledModules" text[] not null default array['pos','dash','orders','inv','cust','theme','vitrine','boutique'],
  add column "suspendedAt" timestamp(3),
  add column "suspendedReason" text,
  add column "archivedAt" timestamp(3);

-- Les boutiques existantes précèdent la notion de périmètre : elles avaient
-- accès à tout. On les aligne sur le palier complet avant d'imposer le socle,
-- sinon la contrainte ci-dessous échouerait sur des lignes à tableau vide.
update "Tenant"
set "enabledModules" = array['pos','dash','orders','inv','cust','mkt','fin','theme','vitrine','boutique'],
    "plan" = 'pro'
where cardinality("enabledModules") = 0;

-- Socle minimal : sans « dash », une gérante se connecterait sans aucun écran
-- accessible et atterrirait sur sa propre page de connexion, sans issue
-- (cf. spec §4). La contrainte rend cet état impossible, même si une écriture
-- contourne le validateur Zod.
alter table "Tenant" add constraint tenant_min_modules
  check ('dash' = any("enabledModules"));
```

- [ ] **Step 4: Appliquer la migration via Supabase MCP**

Appliquer le contenu exact du `migration.sql` créé à l'étape 3 avec l'outil MCP
`mcp__supabase__apply_migration`, paramètres `name: "tenant_lifecycle_modules"`
et `query` = le contenu complet du fichier. S'il apparaît différé, charger
d'abord son schéma via ToolSearch (`select:mcp__supabase__apply_migration`).

Expected : l'outil confirme l'application sans erreur.

Puis régénérer le client Prisma sur le schéma mis à jour :

Run: `npx prisma generate`
Expected : `Generated Prisma Client` sans erreur.

- [ ] **Step 4b: Piège à vérifier — le backfill du Step 3 ne s'exécute jamais**

`ADD COLUMN ... DEFAULT x` remplit **immédiatement** les lignes déjà en base
avec `x`, au moment même de l'`ALTER TABLE` du Step 3 — avant que l'`UPDATE ...
WHERE cardinality(...) = 0` de ce même fichier ne s'exécute. Aucune ligne
existante n'a donc jamais de tableau vide à cet instant : ce backfill est mort
à l'écriture, quel que soit l'ordre des instructions dans le fichier. Constaté
en pratique lors de la première exécution de cette tâche : la boutique
`foulard-teranga` restait sur `plan = essentiel` avec 8 modules après le
Step 4, alors que l'intention (rappelée par le commentaire du Step 3
lui-même) était qu'elle reçoive le palier complet.

Vérifier maintenant, avant de continuer :
```bash
npx prisma db execute --stdin <<'SQL'
select slug, plan, "enabledModules" from "Tenant";
SQL
```
Si `foulard-teranga` n'a pas `plan = pro` et les dix modules, le piège vient de
se reproduire — passer au Step 4c pour le corriger. S'il les a déjà (fenêtre
de migration déjà passée par une exécution précédente de cette tâche), passer
directement au Step 5.

- [ ] **Step 4c: Migration corrective — ne jamais réécrire une migration déjà appliquée**

Une migration une fois appliquée à la vraie base (Step 4) ne se corrige
**jamais** en réécrivant son fichier : `prisma/migrations/` doit rester le
reflet exact de ce qui a été réellement exécuté sous chaque nom, conformément à
l'historique que tient Supabase (`list_migrations` via MCP). Toute correction
se fait en avant, via une **nouvelle** migration.

Créer le dossier et le fichier :
```bash
mkdir -p "prisma/migrations/$(date -u +%Y%m%d%H%M%S)_tenant_lifecycle_modules_fix_backfill"
```

Contenu de `migration.sql` — resserre le défaut pour les futures boutiques
(sans toucher aux lignes déjà en base, par construction de
`alter column ... set default`) et corrige directement la ligne déjà affectée :

```sql
alter table "Tenant" alter column "plan" set default 'essentiel';
alter table "Tenant" alter column "enabledModules" set default array['pos','dash','orders','inv','cust','theme','vitrine','boutique'];

update "Tenant"
set "plan" = 'pro',
    "enabledModules" = array['pos','dash','orders','inv','cust','mkt','fin','theme','vitrine','boutique']
where slug = 'foulard-teranga';
```

Appliquer avec `mcp__supabase__apply_migration`,
`name: "tenant_lifecycle_modules_fix_backfill"`, `query` = le contenu
complet ci-dessus.

- [ ] **Step 5: Vérifier le backfill et la contrainte en base**

Run:
```bash
npx prisma db execute --stdin <<'SQL'
select slug, plan, "enabledModules" from "Tenant";
SQL
```
Expected: la boutique `foulard-teranga` a `plan = pro` et les dix modules.

Puis vérifier que la contrainte mord :
```bash
npx prisma db execute --stdin <<'SQL'
update "Tenant" set "enabledModules" = array['pos'] where slug = 'foulard-teranga';
SQL
```
Expected: ÉCHEC avec `new row for relation "Tenant" violates check constraint "tenant_min_modules"`.

- [ ] **Step 6: Vérifier le typecheck**

Run: `npm run typecheck`
Expected: aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(tenant): add lifecycle status, plan and enabled modules with minimum-module floor"
```

---

### Task 2: `Profile.tenantId` nullable pour les comptes plateforme

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_profile_tenant_nullable/migration.sql`

**Interfaces:**
- Consumes: rien.
- Produces: `Profile.tenantId` de type `String?`, relation `tenant Tenant?`, et contrainte `profile_tenant_role_coherent` imposant `super_admin ⟺ tenantId IS NULL`.

- [ ] **Step 1: Rendre le champ et la relation optionnels**

Dans `prisma/schema.prisma`, `model Profile` :

```prisma
  tenantId       String?
```

et plus bas, la relation :

```prisma
  tenant            Tenant?            @relation(fields: [tenantId], references: [id])
```

- [ ] **Step 2: Créer le dossier de migration**

`npx prisma migrate dev` est inutilisable dans ce projet (cf. Global
Constraints) : créer le fichier à la main.

Run:
```bash
mkdir -p "prisma/migrations/$(date -u +%Y%m%d%H%M%S)_profile_tenant_nullable"
```

- [ ] **Step 3: Écrire la migration (colonne optionnelle + contrainte de cohérence)**

Créer `migration.sql` dans le dossier créé à l'étape précédente :

```sql
alter table "Profile" alter column "tenantId" drop not null;

-- Un compte plateforme (super_admin) n'appartient à aucune boutique ; tout
-- autre rôle en a obligatoirement une. Exprimé en base pour que l'incohérence
-- soit impossible plutôt que seulement déconseillée (spec §1).
alter table "Profile" add constraint profile_tenant_role_coherent
  check ((role = 'super_admin' and "tenantId" is null)
      or (role <> 'super_admin' and "tenantId" is not null));
```

- [ ] **Step 4: Appliquer la migration via Supabase MCP**

Appliquer avec `mcp__supabase__apply_migration`, `name: "profile_tenant_nullable"`,
`query` = le contenu complet du fichier ci-dessus. Puis `npx prisma generate`.
Expected : succès. Les lignes existantes (un `owner` avec `tenantId` renseigné,
créé par la migration `seed_owner_profile`) satisfont la contrainte.

- [ ] **Step 5: Vérifier que la contrainte rejette une incohérence**

Run:
```bash
npx prisma db execute --stdin <<'SQL'
insert into "Profile" (id, "tenantId", role, name)
values ('00000000-0000-0000-0000-0000000000ff', 'foulard-teranga', 'super_admin', 'Incoherent');
SQL
```
Expected: ÉCHEC avec `violates check constraint "profile_tenant_role_coherent"`.

- [ ] **Step 6: Vérifier le typecheck**

Run: `npm run typecheck`
Expected: aucune erreur. `lib/team/actions.ts` et `lib/data/team.server.ts` filtrent sur `tenantId` avec une valeur non nulle, ce qui reste valide face à un champ optionnel.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(auth): allow platform profiles without a tenant"
```

---

### Task 3: Table `PlatformAuditLog` et ses policies

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_platform_audit_log/migration.sql`
- Create: `prisma/tests/rls_phase1.sql`

**Interfaces:**
- Consumes: rien.
- Produces: enum `PlatformAction` et modèle `PlatformAuditLog` (`id`, `actorId`, `action`, `tenantId?`, `targetId?`, `metadata`, `createdAt`), lisible et insérable par `super_admin` uniquement. Consommé par les phases 2 à 5.

- [ ] **Step 1: Ajouter l'enum et le modèle**

Dans `prisma/schema.prisma` :

```prisma
enum PlatformAction {
  tenant_created
  tenant_updated
  tenant_suspended
  tenant_reactivated
  tenant_archived
  tenant_deleted
  modules_changed
  owner_created
  owner_password_reset
  employee_role_edited
  impersonation_started
  impersonation_write_unlocked
  impersonation_ended
  data_exported
  announcement_sent
}

/// Journal des actions du prestataire. Volontairement sans clé étrangère vers
/// Tenant ni Profile : la trace doit survivre à la suppression définitive
/// d'une boutique, or une FK la ferait disparaître en cascade (spec §1).
model PlatformAuditLog {
  id        String         @id @default(cuid())
  actorId   String         @db.Uuid
  action    PlatformAction
  tenantId  String?
  targetId  String?
  metadata  Json           @default("{}")
  createdAt DateTime       @default(now())

  @@index([tenantId, createdAt])
  @@index([actorId, createdAt])
}
```

- [ ] **Step 2: Créer le dossier de migration**

`npx prisma migrate dev` est inutilisable dans ce projet (cf. Global
Constraints) : créer le fichier à la main.

Run:
```bash
mkdir -p "prisma/migrations/$(date -u +%Y%m%d%H%M%S)_platform_audit_log"
```

- [ ] **Step 3: Écrire la migration complète (DDL + RLS)**

Créer `migration.sql` dans le dossier créé à l'étape précédente. Le type
`jsonb` (minuscules) et le style suivent la convention déjà en place dans
`prisma/migrations/20260715120000_storefront_page/migration.sql` pour les
colonnes `Json` de ce projet :

```sql
create type "PlatformAction" as enum (
  'tenant_created', 'tenant_updated', 'tenant_suspended', 'tenant_reactivated',
  'tenant_archived', 'tenant_deleted', 'modules_changed', 'owner_created',
  'owner_password_reset', 'employee_role_edited', 'impersonation_started',
  'impersonation_write_unlocked', 'impersonation_ended', 'data_exported',
  'announcement_sent'
);

create table "PlatformAuditLog" (
  "id"        text not null,
  "actorId"   uuid not null,
  "action"    "PlatformAction" not null,
  "tenantId"  text,
  "targetId"  text,
  "metadata"  jsonb not null default '{}',
  "createdAt" timestamp(3) not null default current_timestamp,
  constraint "PlatformAuditLog_pkey" primary key ("id")
);

create index "PlatformAuditLog_tenantId_createdAt_idx" on "PlatformAuditLog"("tenantId", "createdAt");
create index "PlatformAuditLog_actorId_createdAt_idx" on "PlatformAuditLog"("actorId", "createdAt");

-- Journal réservé au prestataire : ni owner, ni staff, ni customer n'y accèdent.
alter table "PlatformAuditLog" enable row level security;

create policy "platform_audit_all_super_admin" on "PlatformAuditLog"
  for all using (public.current_role() = 'super_admin')
  with check (public.current_role() = 'super_admin');
```

- [ ] **Step 4: Appliquer la migration via Supabase MCP**

Appliquer avec `mcp__supabase__apply_migration`, `name: "platform_audit_log"`,
`query` = le contenu complet du fichier ci-dessus. Puis `npx prisma generate`.
Expected : succès, client Prisma régénéré avec `prisma.platformAuditLog`.

- [ ] **Step 5: Écrire le test RLS**

Créer `prisma/tests/rls_phase1.sql` :

```sql
-- Assertions RLS de la phase 1. Exécuter avec :
--   npx prisma db execute --file prisma/tests/rls_phase1.sql
-- Un échec se manifeste par une exception « ASSERTION ... » et interrompt le script.

begin;

-- Un profil owner de référence pour endosser son identité dans les tests.
-- 3529e5b3-… est l'owner créé par 20260713210000_seed_owner_profile.

-- 1. PlatformAuditLog : une gérante ne lit rien.
set local role authenticated;
set local request.jwt.claims = '{"sub":"3529e5b3-304f-48ea-bc0f-ec82a74e8ae0"}';

do $$
declare visible int;
begin
  select count(*) into visible from "PlatformAuditLog";
  if visible <> 0 then
    raise exception 'ASSERTION ÉCHOUÉE : un owner voit % ligne(s) de PlatformAuditLog, attendu 0', visible;
  end if;
end $$;

-- 2. PlatformAuditLog : une gérante ne peut pas y écrire.
do $$
begin
  begin
    insert into "PlatformAuditLog" (id, "actorId", action)
    values ('test-audit-1', '3529e5b3-304f-48ea-bc0f-ec82a74e8ae0', 'tenant_created');
    raise exception 'ASSERTION ÉCHOUÉE : un owner a pu écrire dans PlatformAuditLog';
  exception
    when insufficient_privilege then null;
  end;
end $$;

rollback;
```

- [ ] **Step 6: Exécuter le test RLS**

Run: `npx prisma db execute --file prisma/tests/rls_phase1.sql`
Expected: aucune sortie d'erreur — les deux assertions passent.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/tests
git commit -m "feat(platform): add PlatformAuditLog table with super_admin-only RLS"
```

---

### Task 4: Supprimer la policy `tenants_update_owner`

**Files:**
- Create: `prisma/migrations/<timestamp>_drop_tenants_update_owner/migration.sql`
- Modify: `prisma/tests/rls_phase1.sql`

**Interfaces:**
- Consumes: `prisma/tests/rls_phase1.sql` (Task 3).
- Produces: aucun chemin d'écriture PostgREST sur `Tenant` pour un `owner`.

**Contexte — pourquoi cette suppression est sûre.** La policy autorise un
`owner` à écrire **toutes** les colonnes de sa ligne `Tenant`, dont `domains`,
un tableau libre que `resolveTenantFromHost` consulte pour router les hôtes :
une gérante peut y inscrire le domaine d'une autre boutique et détourner son
trafic. Le commentaire de la migration d'origine affirme la policy nécessaire à
l'écran Personnalisation ; c'est inexact. `current_role()` dépend de
`auth.uid()`, donc du JWT Supabase, et Prisma se connecte via `DATABASE_URL`
sans JWT — si Prisma était soumis à la RLS, toutes les écritures de
l'application échoueraient. Le seul écrivain de `Tenant` est
`lib/tenant/actions.ts`, marqué `"use server"`.

- [ ] **Step 1: Confirmer qu'aucun client navigateur n'écrit sur `Tenant`**

Run: `grep -rn "from(\"Tenant\")\|from('Tenant')" --include="*.ts" --include="*.tsx" lib app components`
Expected: aucun résultat. Si un résultat apparaît dans un fichier `"use client"`, **arrêter** et signaler : la suppression casserait ce chemin.

- [ ] **Step 2: Créer la migration**

Créer `prisma/migrations/<timestamp>_drop_tenants_update_owner/migration.sql` — remplacer `<timestamp>` par l'horodatage au format `AAAAMMJJHHMMSS` :

```sql
-- La policy autorisait un owner à écrire TOUTES les colonnes de sa ligne
-- Tenant via PostgREST (clé anonyme + JWT de la gérante), dont « domains » —
-- soit le détournement du trafic vitrine d'une autre boutique dès qu'une
-- seconde existe. Elle ne sert aucun besoin applicatif : l'écran
-- Personnalisation persiste via la Server Action updateTenantTheme, qui passe
-- par Prisma et contourne la RLS (spec §5).
drop policy "tenants_update_owner" on "Tenant";
```

- [ ] **Step 3: Appliquer la migration via Supabase MCP**

`npx prisma migrate dev` est inutilisable dans ce projet (cf. Global
Constraints). Appliquer avec `mcp__supabase__apply_migration`,
`name: "drop_tenants_update_owner"`, `query` = le contenu complet du fichier
ci-dessus. Aucun changement de schéma Prisma dans cette tâche (RLS pure), donc
pas de `prisma generate` à relancer.
Expected : succès.

- [ ] **Step 4: Étendre le test RLS**

Dans `prisma/tests/rls_phase1.sql`, avant le `rollback;` final :

```sql
-- 3. Tenant : une gérante ne peut plus écrire sa propre ligne via PostgREST.
do $$
begin
  begin
    update "Tenant" set "domains" = array['boutique-voisine.ci'] where id = 'foulard-teranga';
    if found then
      raise exception 'ASSERTION ÉCHOUÉE : un owner a pu écrire Tenant.domains';
    end if;
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- 4. Tenant : la lecture publique reste ouverte (la vitrine en dépend).
do $$
declare visible int;
begin
  select count(*) into visible from "Tenant";
  if visible = 0 then
    raise exception 'ASSERTION ÉCHOUÉE : la lecture publique de Tenant est cassée';
  end if;
end $$;
```

- [ ] **Step 5: Exécuter le test RLS**

Run: `npx prisma db execute --file prisma/tests/rls_phase1.sql`
Expected: aucune erreur — les quatre assertions passent.

- [ ] **Step 6: Vérifier que l'écran Personnalisation persiste toujours**

Run: `npx vitest run lib/tenant`
Expected: PASS. Puis vérification manuelle : lancer `npm run dev`, se connecter en gérante, modifier le nom de la boutique dans Personnalisation, enregistrer, recharger — la valeur persiste. C'est ce test qui prouve que la policy supprimée n'était pas le chemin d'écriture applicatif.

- [ ] **Step 7: Commit**

```bash
git add prisma/migrations prisma/tests
git commit -m "fix(security): drop tenants_update_owner policy allowing domain hijacking"
```

---

### Task 5: Script de création du premier compte plateforme

**Files:**
- Create: `scripts/seed-super-admin.ts`

**Interfaces:**
- Consumes: `createAdminClient()` de `lib/supabase/admin.ts`, `prisma` de `lib/db/client.ts`.
- Produces: un utilisateur Supabase Auth et son `Profile` (`role = super_admin`, `tenantId = null`).

**Pourquoi un script et non une migration :** créer un utilisateur Supabase Auth
demande un hachage de mot de passe correct. L'écrire à la main en SQL dans
`auth.users` est fragile et dépendant de la version de GoTrue ; l'API
`admin.auth.admin.createUser` est le chemin supporté, déjà utilisé par
`createEmployee`.

- [ ] **Step 1: Écrire le script**

Créer `scripts/seed-super-admin.ts` :

```ts
/**
 * Crée le premier compte plateforme (super_admin). À exécuter une seule fois :
 *   SUPER_ADMIN_EMAIL=… SUPER_ADMIN_PASSWORD=… SUPER_ADMIN_NAME=… \
 *     npx tsx scripts/seed-super-admin.ts
 *
 * Idempotent : si un super_admin existe déjà, le script s'arrête sans rien faire.
 */
import { prisma } from "@/lib/db/client";
import { createAdminClient } from "@/lib/supabase/admin";

async function main(): Promise<void> {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME;

  if (!email || !password || !name) {
    throw new Error(
      "SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD et SUPER_ADMIN_NAME sont requis."
    );
  }

  const existing = await prisma.profile.findFirst({ where: { role: "super_admin" } });
  if (existing) {
    console.log(`Un compte plateforme existe déjà (${existing.name}). Rien à faire.`);
    return;
  }

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) {
    throw new Error(`Création du compte Auth impossible : ${error?.message ?? "inconnue"}`);
  }

  try {
    await prisma.profile.create({
      data: { id: created.user.id, tenantId: null, role: "super_admin", name, email },
    });
  } catch (cause) {
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {
      // Rattrapage au mieux : l'utilisateur Auth orphelin ne peut pas être
      // signalé utilement ici, mais le Profile n'existe pas donc il ne peut
      // pas se connecter à une zone privilégiée.
    });
    throw cause;
  }

  console.log(`Compte plateforme créé pour ${email}. Changez ce mot de passe à la première connexion.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Vérifier le typecheck**

Run: `npm run typecheck`
Expected: aucune erreur.

- [ ] **Step 3: Exécuter le script**

Run:
```bash
SUPER_ADMIN_EMAIL="prestataire@example.com" SUPER_ADMIN_PASSWORD="<mot de passe fort>" SUPER_ADMIN_NAME="Prestataire" npx tsx scripts/seed-super-admin.ts
```
Expected: `Compte plateforme créé pour prestataire@example.com.`

- [ ] **Step 4: Vérifier l'idempotence**

Run: la même commande une seconde fois.
Expected: `Un compte plateforme existe déjà (Prestataire). Rien à faire.` — aucun doublon créé.

- [ ] **Step 5: Vérifier la cohérence en base**

Run:
```bash
npx prisma db execute --stdin <<'SQL'
select role, "tenantId", name from "Profile" where role = 'super_admin';
SQL
```
Expected: une ligne, `tenantId` à `NULL` — ce qui prouve aussi que la contrainte de Task 2 accepte bien ce cas.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-super-admin.ts
git commit -m "feat(platform): add one-off script seeding the first super_admin account"
```

---

### Task 6: Résolution du tenant depuis la base

**Files:**
- Modify: `lib/tenant/registry.ts`
- Modify: `lib/tenant/index.ts`
- Modify: `lib/tenant/actions.ts:35`
- Modify: `proxy.ts:10,70-72`
- Modify: `app/(storefront)/layout.tsx`
- Modify: `app/(storefront)/produit/[id]/page.tsx:10`
- Modify: `lib/store/useStorefront.ts:96`
- Test: `lib/tenant/registry.test.ts` (réécrit)

**Interfaces:**
- Consumes: `prisma` de `lib/db/client.ts`.
- Produces:
  - `TENANTS_CACHE_TAG: "tenants"` — étiquette de cache à invalider après toute mutation de boutique.
  - `resolveTenantFromHost(host: string): Promise<Tenant | null>` — `null` pour un hôte inconnu.
  - `getCurrentTenantOrNull(): Promise<Tenant | null>`.
  - `getCurrentTenant(): Promise<Tenant>` — **signature inchangée**, lève si l'hôte est inconnu. Les 25 appelants existants ne changent pas.

**Note de séquencement :** `proxy.ts` cesse d'émettre `x-tenant-id` et
`getCurrentTenant()` cesse de le lire dans la même tâche. Ces deux changements
doivent être livrés ensemble — séparés, l'application est cassée entre les deux.

- [ ] **Step 1: Écrire les tests de résolution**

Remplacer intégralement `lib/tenant/registry.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/db/client", () => ({
  prisma: { tenant: { findMany: () => findMany() } },
}));

// unstable_cache exécute simplement la fonction en test : on veut vérifier la
// logique de résolution, pas le comportement de cache de Next.js.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown) => fn,
  revalidateTag: vi.fn(),
}));

const { resolveTenantFromHost } = await import("@/lib/tenant/registry");

const ROWS = [
  {
    id: "foulard-teranga",
    slug: "foulard-teranga",
    name: "Foulard Teranga",
    primaryColor: "#26326B",
    accentColor: "#D07A34",
    logoText: "Foulard Teranga",
    domains: ["localhost", "foulard-teranga.localhost"],
  },
  {
    id: "boutique-voisine",
    slug: "boutique-voisine",
    name: "Boutique Voisine",
    primaryColor: "#0E9F6E",
    accentColor: "#C9A227",
    logoText: "Boutique Voisine",
    domains: ["boutique-voisine.ci"],
  },
];

beforeEach(() => {
  findMany.mockReset();
  findMany.mockResolvedValue(ROWS);
});

describe("resolveTenantFromHost", () => {
  it("résout par sous-domaine canonique", async () => {
    const tenant = await resolveTenantFromHost("foulard-teranga.plateforme.app");
    expect(tenant?.id).toBe("foulard-teranga");
  });

  it("résout par domaine personnalisé enregistré", async () => {
    const tenant = await resolveTenantFromHost("boutique-voisine.ci");
    expect(tenant?.id).toBe("boutique-voisine");
  });

  it("résout localhost vers la boutique qui le déclare", async () => {
    const tenant = await resolveTenantFromHost("localhost:3000");
    expect(tenant?.id).toBe("foulard-teranga");
  });

  it("ignore la casse et le port", async () => {
    const tenant = await resolveTenantFromHost("BOUTIQUE-VOISINE.CI:8080");
    expect(tenant?.id).toBe("boutique-voisine");
  });

  it("renvoie null pour un hôte inconnu au lieu de retomber sur une boutique", async () => {
    expect(await resolveTenantFromHost("inconnu.example.com")).toBeNull();
  });

  it("expose le thème de la boutique résolue", async () => {
    const tenant = await resolveTenantFromHost("boutique-voisine.ci");
    expect(tenant?.theme).toEqual({
      primaryColor: "#0E9F6E",
      accentColor: "#C9A227",
      logoText: "Boutique Voisine",
    });
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `npx vitest run lib/tenant/registry.test.ts`
Expected: FAIL — `resolveTenantFromHost` est encore synchrone et renvoie `DEFAULT_TENANT` pour un hôte inconnu.

- [ ] **Step 3: Réécrire le registry**

Remplacer intégralement `lib/tenant/registry.ts` :

```ts
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/client";
import type { Tenant } from "./types";

/** Étiquette de cache à invalider après toute mutation de boutique. */
export const TENANTS_CACHE_TAG = "tenants";

interface TenantRow {
  id: string;
  slug: string;
  name: string;
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
    theme: {
      primaryColor: row.primaryColor,
      accentColor: row.accentColor,
      logoText: row.logoText,
    },
    domains: row.domains,
  };
}

/**
 * Charge le parc entier en une requête plutôt qu'une requête par hôte : la
 * correspondance se fait ensuite en mémoire, et le cache n'a qu'une seule
 * entrée à invalider. Adapté à un parc de quelques dizaines de boutiques.
 */
const loadTenants = unstable_cache(
  async (): Promise<TenantRow[]> =>
    prisma.tenant.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        primaryColor: true,
        accentColor: true,
        logoText: true,
        domains: true,
      },
    }),
  ["tenants-all"],
  { tags: [TENANTS_CACHE_TAG] }
);

function stripPort(host: string): string {
  return host.split(":")[0].toLowerCase();
}

/**
 * Résout un hôte vers sa boutique. Renvoie `null` si aucune ne correspond :
 * un repli sur une boutique par défaut afficherait, en multi-boutique, la
 * vitrine d'une cliente sur un domaine qui ne lui appartient pas (spec §2).
 */
export async function resolveTenantFromHost(host: string): Promise<Tenant | null> {
  const normalized = stripPort(host);
  const rows = await loadTenants();

  const bySubdomain = rows.find((t) => normalized === `${t.slug}.plateforme.app`);
  if (bySubdomain) return toTenant(bySubdomain);

  const byDomain = rows.find((t) => t.domains.includes(normalized));
  if (byDomain) return toTenant(byDomain);

  return null;
}
```

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `npx vitest run lib/tenant/registry.test.ts`
Expected: PASS — six tests.

- [ ] **Step 5: Adapter l'accès au tenant courant**

Remplacer le contenu de `lib/tenant/index.ts` :

```ts
import { headers } from "next/headers";
import { resolveTenantFromHost } from "./registry";
import type { Tenant } from "./types";

export type { Tenant, ThemeTokens } from "./types";
export { resolveTenantFromHost, TENANTS_CACHE_TAG } from "./registry";

/** Boutique correspondant à l'hôte de la requête, ou `null` si aucune. */
export async function getCurrentTenantOrNull(): Promise<Tenant | null> {
  const h = await headers();
  const host = h.get("x-tenant-host");
  if (!host) return null;
  return resolveTenantFromHost(host);
}

/**
 * Boutique courante, garantie non nulle. Réservé aux contextes où une boutique
 * valide est un invariant (dashboard, Server Actions). La vitrine, seul endroit
 * où un hôte inconnu est un scénario utilisateur légitime, utilise
 * `getCurrentTenantOrNull` et rend un 404.
 */
export async function getCurrentTenant(): Promise<Tenant> {
  const tenant = await getCurrentTenantOrNull();
  if (!tenant) throw new Error("Aucune boutique ne correspond à cet hôte.");
  return tenant;
}
```

- [ ] **Step 6: Transmettre le hostname depuis le proxy**

Dans `proxy.ts`, supprimer la ligne 10 :

```ts
import { resolveTenantFromHost } from "@/lib/tenant/registry";
```

et remplacer les lignes 70-72 :

```ts
  const tenant = resolveTenantFromHost(hostname);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-id", tenant.id);
```

par :

```ts
  // La résolution du tenant est faite côté serveur applicatif (lib/tenant),
  // où elle est mise en cache : la garder ici imposerait un aller-retour SQL
  // sur chaque requête de vitrine publique.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-host", hostname);
```

- [ ] **Step 7: Rendre un 404 sur un hôte inconnu**

Dans `app/(storefront)/layout.tsx`, remplacer l'import et le début du composant :

```ts
import { notFound } from "next/navigation";
import { getCurrentTenantOrNull } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/data/tenant.server";
```

```tsx
export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  // Un hôte qui ne correspond à aucune boutique ne doit pas afficher la
  // vitrine d'une cliente au hasard (spec §2).
  if (!(await getCurrentTenantOrNull())) notFound();

  const { phone } = await getTenantSettings();
```

le reste du composant est inchangé.

- [ ] **Step 8: Reprendre les deux derniers consommateurs de `DEFAULT_TENANT`**

La suppression de `DEFAULT_TENANT` casse deux fichiers hors de `lib/tenant`.

Dans `app/(storefront)/produit/[id]/page.tsx`, remplacer l'import de
`DEFAULT_TENANT` par celui de `getCurrentTenant`, puis remplacer la ligne 10 :

```tsx
  const products = await getCatalog(DEFAULT_TENANT.id);
```

par :

```tsx
  const tenant = await getCurrentTenant();
  const products = await getCatalog(tenant.id);
```

Dans `lib/store/useStorefront.ts`, la valeur sert de préfixe de clé
`localStorage` dans un store client, qui ne peut pas résoudre le tenant côté
serveur. Remplacer la ligne 96 :

```ts
      name: `ft-storefront-store-${DEFAULT_TENANT.id}`,
```

par :

```ts
      // Clé littérale : ce store client n'a pas accès à la résolution serveur
      // du tenant. Conserver la valeur historique préserve les paniers déjà
      // enregistrés chez les visiteuses. Rendre cette clé propre à chaque
      // boutique est une tâche de la phase 2 (cf. « Ce que cette phase ne
      // fait pas »).
      name: "ft-storefront-store-foulard-teranga",
```

- [ ] **Step 9: Invalider le cache après une mutation de boutique**

Dans `lib/tenant/actions.ts`, ajouter l'import :

```ts
import { revalidatePath, revalidateTag } from "next/cache";
import { TENANTS_CACHE_TAG } from "@/lib/tenant";
```

et après `revalidatePath("/")` (ligne 36), ajouter :

```ts
  // Sans cela, un changement de nom ou de couleur resterait invisible tant que
  // l'entrée de cache du parc n'a pas expiré.
  revalidateTag(TENANTS_CACHE_TAG);
```

- [ ] **Step 10: Vérifier la suite complète et le typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: PASS sur toute la suite, aucune erreur de type. Le typecheck est ici le filet décisif : il échouera sur tout consommateur résiduel de `DEFAULT_TENANT` ou `TENANTS`. Le fichier `lib/proxy/zones.test.ts` n'est pas concerné (il ne teste pas la résolution du tenant).

- [ ] **Step 11: Vérifier le comportement réel**

Run: `npm run dev`
Expected: `http://localhost:3000` affiche la vitrine normalement (l'hôte `localhost` est déclaré dans les `domains` du seed). Vérifier ensuite qu'un hôte non déclaré rend bien un 404 :

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Host: inconnu.example.com" http://localhost:3000/
```
Expected: `404`.

- [ ] **Step 12: Commit**

```bash
git add lib/tenant proxy.ts "app/(storefront)/layout.tsx" "app/(storefront)/produit/[id]/page.tsx" lib/store/useStorefront.ts
git commit -m "feat(tenant): resolve tenants from the database with cache invalidation"
```

---

### Task 7: `Session` élargie et permissions par intersection

**Files:**
- Modify: `lib/auth/session.ts:6-12,33-38,46-65`
- Test: `lib/auth/index.test.ts`

**Interfaces:**
- Consumes: `Tenant.enabledModules` (Task 1).
- Produces: `Session` gagnant `tenantId: string | null` et `enabledModules: string[]` ; `hasModuleAccess(session, moduleId)` conserve sa signature à deux arguments et applique désormais l'intersection.

- [ ] **Step 1: Écrire les tests**

Dans `lib/auth/index.test.ts`, remplacer le helper `fakeSupabase` pour qu'il porte la boutique jointe :

```ts
function fakeSupabase(
  user: { id: string } | null,
  profile: {
    role: string;
    name: string;
    active?: boolean;
    tenantId?: string | null;
    employeeRole?: { permissions: string[] } | null;
    tenant?: { enabledModules: string[] } | null;
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

const ALL_MODULES = ["pos", "dash", "orders", "inv", "cust", "mkt", "fin", "theme", "vitrine", "boutique"];

function session(over: Partial<Session> = {}): Session {
  return {
    userId: "u1",
    name: "N",
    role: "owner",
    tenantId: "t1",
    permissions: [],
    enabledModules: ALL_MODULES,
    ...over,
  };
}
```

Remplacer intégralement le bloc `describe("hasModuleAccess", …)` :

```ts
describe("hasModuleAccess", () => {
  it("accorde à owner tous les modules activés pour sa boutique", () => {
    const owner = session();
    expect(hasModuleAccess(owner, "fin")).toBe(true);
    expect(hasModuleAccess(owner, "pos")).toBe(true);
  });

  it("refuse à owner un module désactivé pour sa boutique", () => {
    const owner = session({ enabledModules: ["pos", "dash"] });
    expect(hasModuleAccess(owner, "fin")).toBe(false);
  });

  it("refuse à owner un identifiant hors MODULE_IDS comme « equipe »", () => {
    // « equipe » n'est pas un module cochable : il a sa propre garde owner.
    expect(hasModuleAccess(session(), "equipe")).toBe(false);
  });

  it("accorde à staff les seuls modules à la fois activés et dans ses permissions", () => {
    const staff = session({ role: "staff", permissions: ["pos", "orders"] });
    expect(hasModuleAccess(staff, "pos")).toBe(true);
    expect(hasModuleAccess(staff, "fin")).toBe(false);
  });

  it("refuse à staff un module permis mais désactivé pour la boutique", () => {
    const staff = session({ role: "staff", permissions: ["fin"], enabledModules: ["pos", "dash"] });
    expect(hasModuleAccess(staff, "fin")).toBe(false);
  });

  it("refuse les sessions customer et nulles", () => {
    expect(hasModuleAccess(null, "pos")).toBe(false);
    expect(hasModuleAccess(session({ role: "customer" }), "pos")).toBe(false);
  });

  it("refuse tout à un compte plateforme, qui ne travaille pas dans le dashboard", () => {
    const platform = session({ role: "super_admin", tenantId: null, enabledModules: [] });
    expect(hasModuleAccess(platform, "pos")).toBe(false);
  });
});
```

Puis, dans `describe("resolveSession", …)`, remplacer les trois tests qui comparent une session complète :

```ts
  it("returns the session when both the user and its profile exist", async () => {
    const result = await resolveSession(
      fakeSupabase(
        { id: "u1" },
        { role: "owner", name: "Aïcha Koné", tenantId: "t1", tenant: { enabledModules: ["pos", "dash"] } }
      )
    );
    expect(result).toEqual({
      userId: "u1",
      name: "Aïcha Koné",
      role: "owner",
      tenantId: "t1",
      permissions: [],
      enabledModules: ["pos", "dash"],
    });
  });

  it("loads the staff member's module permissions from their EmployeeRole", async () => {
    const result = await resolveSession(
      fakeSupabase(
        { id: "u1" },
        {
          role: "staff",
          name: "Awa",
          active: true,
          tenantId: "t1",
          employeeRole: { permissions: ["pos", "orders"] },
          tenant: { enabledModules: ["pos", "dash", "orders"] },
        }
      )
    );
    expect(result).toEqual({
      userId: "u1",
      name: "Awa",
      role: "staff",
      tenantId: "t1",
      permissions: ["pos", "orders"],
      enabledModules: ["pos", "dash", "orders"],
    });
  });

  it("defaults staff permissions to an empty array when no EmployeeRole is assigned", async () => {
    const result = await resolveSession(
      fakeSupabase(
        { id: "u1" },
        { role: "staff", name: "Awa", active: true, tenantId: "t1", employeeRole: null, tenant: { enabledModules: ["pos"] } }
      )
    );
    expect(result).toEqual({
      userId: "u1",
      name: "Awa",
      role: "staff",
      tenantId: "t1",
      permissions: [],
      enabledModules: ["pos"],
    });
  });

  it("donne un périmètre vide à un compte plateforme sans boutique", async () => {
    const result = await resolveSession(
      fakeSupabase({ id: "u9" }, { role: "super_admin", name: "Prestataire", tenantId: null, tenant: null })
    );
    expect(result).toEqual({
      userId: "u9",
      name: "Prestataire",
      role: "super_admin",
      tenantId: null,
      permissions: [],
      enabledModules: [],
    });
  });
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npx vitest run lib/auth/index.test.ts`
Expected: FAIL — `Session` n'a ni `tenantId` ni `enabledModules`, et `hasModuleAccess` accorde encore tout à `owner`.

- [ ] **Step 3: Élargir `Session` et appliquer l'intersection**

Dans `lib/auth/session.ts`, remplacer l'interface `Session` :

```ts
export interface Session {
  userId: string;
  name: string;
  role: Role;
  /** Boutique de rattachement. `null` pour un compte plateforme (super_admin). */
  tenantId: string | null;
  /** Modules dashboard autorisés — pertinent uniquement pour `staff`. Toujours [] pour owner/super_admin/customer. */
  permissions: string[];
  /** Modules activés pour la boutique (Tenant.enabledModules). Borne supérieure de tout accès. */
  enabledModules: string[];
}
```

remplacer `hasModuleAccess` :

```ts
/**
 * Accès à un module du dashboard : intersection entre le périmètre accordé à
 * la boutique par le prestataire (`enabledModules`) et le droit de la personne.
 * `owner` a tout ce que sa boutique a — mais rien de plus (spec §4). La gestion
 * d'équipe ("equipe") n'est volontairement PAS un module régulier : elle se
 * vérifie séparément via `session.role === "owner"`.
 */
export function hasModuleAccess(session: Session | null, moduleId: string): boolean {
  if (!session) return false;
  if (!session.enabledModules.includes(moduleId)) return false;
  if (session.role === "owner") return true;
  if (session.role !== "staff") return false;
  return session.permissions.includes(moduleId);
}
```

et remplacer le corps de `resolveSession` à partir de la requête :

```ts
  const { data: profile } = await supabase
    .from("Profile")
    .select(
      "role, name, active, tenantId, employeeRole:EmployeeRole(permissions), tenant:Tenant(enabledModules)"
    )
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;
  if (profile.active === false) return null;

  const role = profile.role as Role;
  const employeeRole = profile.employeeRole as unknown as { permissions: string[] } | null;
  const tenant = profile.tenant as unknown as { enabledModules: string[] } | null;
  const permissions = role === "staff" ? (employeeRole?.permissions ?? []) : [];

  return {
    userId: user.id,
    name: profile.name,
    role,
    tenantId: (profile.tenantId as string | null) ?? null,
    permissions,
    enabledModules: tenant?.enabledModules ?? [],
  };
```

- [ ] **Step 4: Lancer les tests pour les voir passer**

Run: `npx vitest run lib/auth/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Vérifier la suite complète et le typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: PASS partout. `proxy.ts` appelle `hasModuleAccess(session, moduleId)` avec la même signature — aucune modification requise.

- [ ] **Step 6: Vérifier le comportement réel**

Run: `npm run dev`, se connecter en gérante.
Expected: tous les onglets du back-office restent visibles, la boutique existante ayant été alignée sur les dix modules en Task 1. Puis retirer un module et vérifier qu'il disparaît :

```bash
npx prisma db execute --stdin <<'SQL'
update "Tenant" set "enabledModules" = array['pos','dash','orders','inv','cust','theme','vitrine','boutique'] where slug = 'foulard-teranga';
SQL
```
Recharger le back-office : l'onglet Finance a disparu, et `http://localhost:3000/admin/finance` redirige. Restaurer ensuite les dix modules.

- [ ] **Step 7: Commit**

```bash
git add lib/auth
git commit -m "feat(auth): gate dashboard modules on the tenant's enabled perimeter"
```

---

### Task 8: Écran Équipe filtré sur les modules activés

**Files:**
- Modify: `app/(dashboard)/equipe/page.tsx`
- Modify: `components/dashboard/screens/EquipeScreen.tsx:19,134`

**Interfaces:**
- Consumes: `getSession()` de `lib/auth` (Task 7).
- Produces: `EquipeScreen` acceptant une prop `enabledModules: string[]` et ne proposant que ces modules à la configuration d'un profil d'accès.

**Pourquoi :** sans ce filtre, la gérante coche `fin` dans un profil d'accès,
l'employé ne voit toujours pas la Finance, et rien n'explique pourquoi —
l'intersection de Task 7 l'a neutralisée en amont (spec §4).

- [ ] **Step 1: Passer les modules activés à l'écran**

Remplacer `app/(dashboard)/equipe/page.tsx` :

```tsx
import { getEmployeeRoles, getEmployees } from "@/lib/data/team.server";
import { getSession } from "@/lib/auth";
import { EquipeScreen } from "@/components/dashboard/screens/EquipeScreen";

export default async function EquipePage() {
  const [roles, employees, session] = await Promise.all([
    getEmployeeRoles(),
    getEmployees(),
    getSession(),
  ]);
  return (
    <EquipeScreen
      roles={roles}
      employees={employees}
      enabledModules={session?.enabledModules ?? []}
    />
  );
}
```

- [ ] **Step 2: Accepter et appliquer la prop dans le composant**

Dans `components/dashboard/screens/EquipeScreen.tsx`, remplacer la signature du composant (ligne 25) :

```tsx
export function EquipeScreen({ roles, employees }: { roles: EmployeeRoleView[]; employees: EmployeeView[] }) {
```

par :

```tsx
export function EquipeScreen({
  roles,
  employees,
  enabledModules,
}: {
  roles: EmployeeRoleView[];
  employees: EmployeeView[];
  /** Modules activés pour la boutique : seuls ceux-ci sont configurables. */
  enabledModules: string[];
}) {
```

Remplacer ensuite l'itération de la ligne 134 :

```tsx
                  {MODULE_IDS.map((id) => (
```

par :

```tsx
                  {MODULE_IDS.filter((id) => enabledModules.includes(id)).map((id) => (
```

Le reste du corps de l'itération est inchangé.

- [ ] **Step 3: Vérifier le typecheck**

Run: `npm run typecheck`
Expected: aucune erreur.

- [ ] **Step 4: Vérifier la suite de tests**

Run: `npx vitest run`
Expected: PASS. Aucun test existant ne rend `EquipeScreen`.

- [ ] **Step 5: Vérifier le comportement réel**

Run: `npm run dev`, se connecter en gérante, ouvrir Équipe et créer un profil d'accès.
Expected: les dix modules sont proposés. Puis retirer `fin` et `mkt` de la boutique :

```bash
npx prisma db execute --stdin <<'SQL'
update "Tenant" set "enabledModules" = array['pos','dash','orders','inv','cust','theme','vitrine','boutique'] where slug = 'foulard-teranga';
SQL
```
Recharger Équipe : Finance et Marketing ne sont plus proposés à la configuration. Vérifier qu'un `EmployeeRole` créé auparavant avec `fin` conserve bien cette valeur en base — elle doit rester stockée, sans effet, pour redevenir active si le module est réactivé :

```bash
npx prisma db execute --stdin <<'SQL'
select name, permissions from "EmployeeRole";
SQL
```
Expected: la permission `fin` est toujours présente dans la ligne. Restaurer ensuite les dix modules.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/equipe/page.tsx" components/dashboard/screens/EquipeScreen.tsx
git commit -m "feat(team): only offer modules enabled for the tenant when configuring access profiles"
```

---

### Task 9: Aligner le spec sur le défaut retenu

**Files:**
- Modify: `docs/superpowers/specs/2026-07-26-super-admin-platform-design.md`

**Interfaces:**
- Consumes: la correction établie en Task 1.
- Produces: un spec cohérent avec le code livré.

- [ ] **Step 1: Corriger le défaut de `enabledModules`**

Dans le spec §1, remplacer :

```prisma
  enabledModules  String[]     @default([])
```

par :

```prisma
  enabledModules  String[]     @default(["pos", "dash", "orders", "inv", "cust", "theme", "vitrine", "boutique"])
```

et ajouter juste après le bloc de code :

```markdown
Le défaut correspond au palier `essentiel`, cohérent avec `plan @default(essentiel)`.
Un défaut vide serait incompatible avec la contrainte `tenant_min_modules` (§4) :
toute insertion omettant le champ échouerait.
```

- [ ] **Step 2: Vérifier la cohérence**

Run: `grep -n 'default(\[\])' docs/superpowers/specs/2026-07-26-super-admin-platform-design.md`
Expected: aucun résultat.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-07-26-super-admin-platform-design.md
git commit -m "docs(spec): align enabledModules default with the minimum-module constraint"
```

---

## Vérification de fin de phase

- [ ] **Suite complète**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: PASS partout.

- [ ] **Assertions RLS**

Run: `npx prisma db execute --file prisma/tests/rls_phase1.sql`
Expected: aucune erreur.

- [ ] **Non-régression fonctionnelle**

Avec `npm run dev`, vérifier que la boutique en service est inchangée : la vitrine s'affiche sur `localhost:3000`, la gérante se connecte, tous ses onglets sont présents, et l'écran Personnalisation persiste une modification de nom.

## Ce que cette phase ne fait pas

Volontairement absents, traités par les phases suivantes du spec §13 :

- L'application de la suspension dans les layouts (phase 4) — les colonnes
  existent, rien ne les lit encore.
- Toute route de la zone plateforme, y compris `/connexion` (phase 2). La zone
  reste dormante et `app/(admin)/boutiques/page.tsx` demeure un écran d'attente.
- Toute écriture dans `PlatformAuditLog` (phase 2) — la table et ses policies
  existent, aucun appelant ne l'alimente.
- Le contexte d'acteur et l'impersonation (phase 3).
- **La clé de panier propre à chaque boutique.** `lib/store/useStorefront.ts`
  garde une clé `localStorage` littérale (Task 6, Step 8). En mono-boutique
  c'est sans conséquence ; dès la seconde boutique, deux vitrines partageraient
  le même panier côté navigateur. À traiter en phase 2, en faisant descendre le
  slug du tenant jusqu'au store client.
- Le validateur Zod refusant de décocher `dash` (spec §12) : il appartient à
  l'écran Modules, construit en phase 2. La contrainte `tenant_min_modules`
  garantit déjà l'invariant en base d'ici là.
