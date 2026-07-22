# Spec — Catalogue & stock (sous-projet 3/5 de la migration mock → Supabase)

> Date : 2026-07-13 · Portée : migrer `lib/data/catalog.ts` (actuellement un tableau mock statique) vers des lectures serveur depuis la table `Product` (créée et seedée au sous-projet 1, RLS lecture publique déjà active), consommées par la vitrine et le back-office. **Lecture seule** — aucune écriture Postgres (création/édition produit, ajustement de stock) dans ce sous-projet.

## 0. Contexte — la migration en 5 sous-projets

1. **Fondation DB** — ✅ terminé. `docs/superpowers/specs/2026-07-13-supabase-db-foundation-design.md`.
2. **Auth réelle** — ✅ terminé. `docs/superpowers/specs/2026-07-13-auth-design.md`.
3. **Catalogue & stock** (ce document) — `lib/data/catalog.ts` → lectures serveur Postgres.
4. **Commandes & workflow** — `useShop` → Server Actions + Postgres + Realtime.
5. **Clientes & fidélité** — `lib/data/clients.ts` → Postgres.

## 1. Objectif de ce sous-projet

`lib/data/catalog.ts` est aujourd'hui un tableau `Product[]` statique importé de façon synchrone par 5 vues vitrine, 5 écrans back-office et `lib/store/shopLogic.ts`. La table `Product` existe déjà en base (12 lignes seedées, ids `p1`..`p12` préservés, RLS `SELECT` publique). Ce sous-projet remplace la source de données par des lectures Prisma côté serveur, sans toucher au comportement visible ni aux tests existants au-delà des adaptations mécaniques nécessaires.

## 2. Périmètre — décisions validées

| Sujet | Décision |
|---|---|
| Couche d'accès aux données | **Prisma Client** (conforme à CLAUDE.md §5), pas le client `supabase-js` utilisé pour l'auth. |
| Écriture (création/édition produit, ajustement stock) | **Hors périmètre** — lecture seule. Les boutons décoratifs d'`InventoryScreen` (« Produit », « Enregistrer ») restent des no-ops comme aujourd'hui. |
| Cache (`use cache` / Cache Components) | **Pas de cache explicite** pour ce sous-projet — fetch direct à chaque requête. Catalogue petit (12 produits), pas de Realtime avant le sous-projet 4 ; à ajouter plus tard si la perf le justifie. |
| Architecture composants clients | Fetch dans un Server Component parent, données passées en props aux composants clients existants (voir §3.3) — pas de refetch client (TanStack Query rejeté ici : coûterait un aller-retour réseau évitable au premier rendu) ni de refonte complète en Server Components (rejeté : dépasserait le périmètre annoncé en touchant l'UX de filtres déjà revue au Plan 2). |
| Correctif inclus | `DashboardScreen.tsx` bascule son alerte stock bas sur le stock **effectif** (au lieu du stock de base), pour rester cohérent avec `InventoryScreen` depuis la Tâche 13 du Plan 1 — corrigé au passage puisque ce sous-projet touche déjà tous les sites d'appel de stock. |

## 3. Architecture

### 3.1 Client Prisma

Prisma 7 avec le générateur `prisma-client` (déjà configuré dans `prisma/schema.prisma`, sortie `lib/generated/prisma`) **exige un driver adapter** — sans lui, `PrismaClient` lève `PrismaClientInitializationError` (code `P2038`). Nouvelle dépendance : `@prisma/adapter-pg`.

`lib/db/client.ts` (nouveau) :

```ts
import { PrismaClient } from "@/lib/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

Singleton sur `globalThis` pour survivre au Hot Module Reload de `next dev` sans épuiser le pool de connexions du pooler Supabase.

**Action utilisateur bloquante** : `DATABASE_URL`/`DIRECT_URL` dans `.env` pointent encore vers `postgresql://postgres:***@localhost:5432/postgres` (placeholders jamais remplacés depuis le sous-projet 1 — aucun code applicatif n'avait encore instancié `PrismaClient`). Il faut le vrai mot de passe Postgres du projet Supabase `vqqwviknffequjvxmojo`, récupéré par l'utilisateur sur le dashboard (Project Settings → Database → Connection string, variante *pooled* pour `DATABASE_URL` avec `?pgbouncer=true`, variante *direct* pour `DIRECT_URL`). Le plan d'implémentation isolera cette étape dans une tâche qui s'arrête et demande explicitement à l'utilisateur de coller les deux URLs dans `.env` avant de continuer — même pattern que le provisioning du compte owner au sous-projet 2. Aucune manipulation du mot de passe par l'agent.

### 3.2 `lib/data/catalog.ts` — lectures serveur + fonctions pures reparamétrées

**Nouvelles fonctions async (lisent Prisma) :**

```ts
export async function getCatalog(): Promise<Product[]>;
export async function getProductById(id: string): Promise<Product | null>;
```

Le tenant est résolu comme partout ailleurs dans l'app via `lib/tenant/registry.ts` (déjà utilisé par `proxy.ts`) — pas de nouveau mécanisme de résolution. Le mapping ligne Prisma → type `Product` applicatif se fait une seule fois, à la frontière, via une fonction pure `toProduct(row): Product` :
- `category` (colonne DB) → `cat` (champ du type `Product`).
- Tous les autres champs (`name`, `variant`, `price`, `stock`, `swatch`, `colors`, `motif`, `lengths`, `description`, `oldPrice`, `badge`, `featured`) correspondent déjà 1:1 entre le schéma Prisma et `lib/data/types.ts`.

**Fonctions pures existantes, reparamétrées (zéro changement de comportement) :**

```ts
export function newestProducts(products: Product[], limit = 4): Product[];
export function featuredProduct(products: Product[]): Product | undefined;
export function relatedTo(products: Product[], productId: string, limit = 4): Product[];
export function filterCatalog(products: Product[], filters: CatalogFilters): Product[];
```

Elles ne ferment plus sur la constante `catalog` — chaque appelant fetch une fois (`getCatalog()`) et passe le tableau. `categories` et `storefrontCategories` (constantes de catégories, pas de données produit) sont inchangées.

### 3.3 Appelants — fetch serveur + props vers les composants clients

- `app/(storefront)/produit/[id]/page.tsx` : `generateStaticParams` devient async (`(await getCatalog()).map(p => p.id)`) ; la page appelle `getProductById(id)` et garde son `notFound()` si `null`.
- Blocks Home (`ProductGridBlock`, `FeaturedProductBlock`) et vues (`CatalogView`, `ProductView`) : perdent leur import direct de `lib/data/catalog` et reçoivent leurs produits (`products: Product[]` ou `product: Product`) en props depuis le Server Component parent (page Home / page Catalogue / page Produit) qui fait l'unique appel `getCatalog()`/`getProductById()` par requête — pas d'appel dupliqué par bloc. Le reste de leur logique (interactivité panier via `useShop`/`useStorefront`, filtres client dans `CatalogView`) est inchangé.
- `CategoryTilesBlock` (déjà Server Component) : bascule simplement son import `catalog` synchrone vers des produits reçus en props (même fetch parent que les autres blocks Home).
- Écrans back-office : chacun est aujourd'hui rendu directement par le composant de page "use client" correspondant. Chaque route gagne une fine coquille Server Component (`page.tsx`) qui appelle `getCatalog()` et rend l'écran client existant avec les produits en prop :
  - `app/(dashboard)/inventaire/page.tsx` → `InventoryScreen`
  - `app/(dashboard)/tableau-de-bord/page.tsx` → `DashboardScreen`
  - `app/(dashboard)/marketing/page.tsx` → `MarketingScreen`
  - `app/(dashboard)/personnalisation/page.tsx` → `ThemeScreen`
  - `app/(dashboard)/pos/page.tsx` → `PosScreen`

### 3.4 Stock effectif (`lib/store/shopLogic.ts`)

`computeEffectiveStock` fait aujourd'hui `catalog.find(p => p.id === productId)` en interne — dépendance directe à la constante statique qui disparaît. Nouvelle signature, stock de base passé explicitement :

```ts
export function computeEffectiveStock(productId: string, baseStock: number, deductions: Record<string, number>): number {
  const deducted = deductions[productId] ?? 0;
  return Math.max(0, baseStock - deducted);
}
```

Tous les appelants ont déjà l'objet `product`/`p` en scope : l'appel devient `computeEffectiveStock(p.id, p.stock, stockDeductions)`. Sites à mettre à jour : `ProductGridBlock`, `FeaturedProductBlock`, `CatalogView`, `ProductView`, `InventoryScreen` (2 sites : table + tiroir d'édition). Bénéfice : `shopLogic.ts` (logique panier/commande partagée) n'importe plus `lib/data/catalog` du tout — meilleure séparation entre logique de commande pure et source de données produit.

**Correctif inclus** : `DashboardScreen.tsx` (alerte « stock bas ») filtre aujourd'hui `catalog.filter(p => p.stock <= 9)` — stock de base, pas effectif, incohérent avec `InventoryScreen` depuis la Tâche 13 du Plan 1. Corrigé pour utiliser `computeEffectiveStock` avant le filtre `<= 9`.

## 4. Gestion d'erreur

`getCatalog()`/`getProductById()` laissent remonter toute erreur Prisma sans `try/catch` silencieux (CLAUDE.md §8 : pas d'exception avalée). `ProductPage` garde son `notFound()` existant si `getProductById` renvoie `null`. Pas de nouveau composant d'erreur global — l'écran d'erreur par défaut de Next.js suffit pour ce sous-projet en lecture seule.

## 5. Tests

- `lib/data/catalog.test.ts` (20 tests actuels) : les tests des fonctions pures (`newestProducts`, `featuredProduct`, `relatedTo`, `filterCatalog`) passent désormais un tableau `Product[]` de fixture (copie exacte des 12 produits mock actuels) en argument au lieu de s'appuyer sur l'import `catalog` — même objets, mêmes assertions, seule la façon de fournir les données change.
- `toProduct()` (mapping DB → `Product`) : nouveau test unitaire avec une ligne Prisma factice, vérifiant `category` → `cat` et les types.
- `getCatalog()`/`getProductById()` : non testées en isolation par Vitest (nécessiterait une vraie connexion DB ou un mock Prisma lourd, disproportionné pour une lecture simple) — vérifiées par lecture directe via `mcp__supabase__execute_sql` (comptage/contenu) et vérification live navigateur, même méthode que la fondation DB au sous-projet 1.
- `shopLogic.test.ts` : les 4 tests de `computeEffectiveStock` sont mis à jour pour la nouvelle signature à 3 arguments (ex. `computeEffectiveStock("p1", 24, {})`), même couverture.
- Vérification live navigateur obligatoire (catalogue, fiche produit, accueil, inventaire, dashboard) — pattern qui a trouvé de vrais bugs aux sous-projets précédents (bug de réactivité Zustand, boucle de redirection).

## 6. Non-goals de ce sous-projet

- Aucune écriture Postgres (création/édition produit, ajustement de stock) — no-ops décoratifs inchangés dans `InventoryScreen`.
- Pas de cache explicite (`use cache` / Cache Components).
- Pas de stock tripartite réel (colonnes Sous-traitance/Matériel d'`InventoryScreen` restent des calculs fictifs `p.stock * 0.4` etc., inchangés — évolution future notée dans la spec de fondation DB §2.1).
- Pas de pagination serveur (12 produits, catalogue entier tenu en une requête).
- Pas de Realtime (sous-projet 4, avec les commandes).

## 7. Critères de réussite

- `npm run test` reste entièrement vert, `npm run typecheck` propre.
- Plus aucun import de la constante `catalog` statique dans le code applicatif (`app/`, `components/`) — seule la fixture de test la conserve.
- Catalogue, fiche produit, accueil et inventaire affichent les 12 produits réels lus depuis Postgres (vérifié via `execute_sql` + navigateur en direct).
- `InventoryScreen` affiche le stock interne réel (colonne « Interne ») et l'alerte stock bas du `DashboardScreen` utilise le stock effectif, pas le stock de base.
- `DATABASE_URL`/`DIRECT_URL` dans `.env` pointent vers le projet Supabase réel (plus `localhost`).
