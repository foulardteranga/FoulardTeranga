# Spec — Clientes & fidélité (sous-projet 5/5 de la migration mock → Supabase)

> Date : 2026-07-14 · Portée : migrer `lib/data/clients.ts` (mock statique) vers Postgres, rattacher les commandes web confirmées à une fiche cliente, faire évoluer points/segment/compteurs en conséquence, et brancher les trois écrans consommateurs (fiche cliente dashboard, sélecteur POS, page Compte vitrine).

## 0. Contexte — la migration en 5 sous-projets

1. **Fondation DB** — ✅ terminé. `docs/superpowers/specs/2026-07-13-supabase-db-foundation-design.md`.
2. **Auth réelle** — ✅ terminé. `docs/superpowers/specs/2026-07-13-auth-design.md`.
3. **Catalogue & stock** — ✅ terminé. `docs/superpowers/specs/2026-07-13-catalog-stock-design.md`.
4. **Commandes & workflow** — ✅ terminé. `docs/superpowers/specs/2026-07-14-orders-workflow-design.md`.
5. **Clientes & fidélité** (ce document) — `lib/data/clients.ts` → Postgres.

## 1. Objectif de ce sous-projet

`lib/data/clients.ts` est un mock statique (6 clientes, historique d'achats partagé fixe) consommé à trois endroits, tous non connectés à une donnée réelle :

- `CustomersScreen` (dashboard `/admin/clientes`) — liste + fiche détaillée, filtrée par segment.
- `useBackoffice.attachClient()` (POS) — sélectionne toujours `clients[0]`, aucune recherche réelle.
- `AccountView` (vitrine `/compte`) — affiche toujours `clients[0]` en dur, aucune identité cliente.

Par ailleurs, **aucune commande réelle n'est aujourd'hui liée à une fiche cliente** : `submitWebOrder` (sous-projet 4) capture `clientName`/`phone`/`place` directement sur `Order` sans jamais toucher `Customer` ; `Order.customerId` existe dans le schéma mais n'est jamais renseigné. Ce sous-projet corrige ce manque en plus de la migration de données.

## 2. Périmètre — décisions validées

| Sujet | Décision |
|---|---|
| Migration des fiches clientes | Lecture réelle depuis Postgres (`Customer`, déjà créée et seedée au sous-projet 1), remplace `lib/data/clients.ts`. |
| Rattachement commande ↔ cliente | **À la validation de la commande** (`confirmOrder`), pas à la soumission — miroir exact de l'invariant central « le stock n'est déduit qu'à la validation » (CLAUDE.md §4). Une commande refusée ne crée ni ne modifie aucune fiche cliente. |
| Rapprochement des fiches | Par téléphone **normalisé** (chiffres uniquement, `+` de tête conservé) — le format KYC est libre (`lib/validators/kyc.ts`), une comparaison stricte de la chaîne brute créerait des doublons dès qu'une cliente saisit son numéro différemment d'une commande à l'autre. |
| Points / segment / VIP | Constantes serveur : `1 point / 1 000 FCFA` dépensé, seuil VIP `150 points`. Recalculés à chaque validation de commande, jamais côté client. Le panneau « Programme de fidélité » du dashboard reste décoratif (inputs non branchés) — le rendre éditable est un sous-projet à part. |
| Compteurs commandes/dépenses | Nouvelles colonnes `Customer.ordersCount`/`Customer.totalSpent`, incrémentées dans la même transaction Prisma que la déduction de stock — pas de calcul par agrégation à la lecture. |
| Sélecteur client POS | Rendu réel : liste des `Customer` du tenant chargée côté serveur et transmise en props, picker recherche nom/téléphone remplaçant le clic unique actuel. Le POS ne persiste toujours aucune vente en base (invariant déjà établi au sous-projet 4) — rattacher une cliente ne sert qu'à l'affichage du ticket en cours. |
| Page Compte vitrine | **Reste un stub assumé**, documenté comme dette : pointe vers une fiche cliente de démonstration réelle en base (au lieu du mock `clients[0]`) en l'absence de toute authentification cliente (aucun sous-projet d'auth cliente n'existe encore — seul `owner` a un compte Supabase Auth, sous-projet 2). Devenir une vraie page « mon compte » nécessite un futur sous-projet d'authentification cliente. |
| Recherche fiche cliente (dashboard) | Le champ recherche actuellement inerte devient fonctionnel — filtre client-side (nom/téléphone) sur la liste déjà chargée, même volume de données que le catalogue. |
| Historique d'achats (fiche cliente) | Remplace le mock partagé fixe (3 lignes identiques pour toute cliente) par les vraies commandes confirmées de la cliente sélectionnée. |
| Temps réel | Pas de Supabase Realtime (cohérent avec le sous-projet 4) — `revalidatePath` après chaque validation. |

## 3. Architecture

### 3.1 Schéma — une migration Prisma

```prisma
model Customer {
  // ... champs existants inchangés (id, tenantId, profileId, name, initials, phone, place, points, vip, segment, createdAt)
  ordersCount Int @default(0)
  totalSpent  Int @default(0)
}
```

Pas de changement de policy RLS — la table `Customer` a déjà ses policies depuis le sous-projet 1 (aucune colonne sensible ajoutée).

### 3.2 Rapprochement téléphone (`lib/customers/normalizePhone.ts`, nouveau, fonction pure)

```ts
export function normalizePhone(raw: string): string
```

Retire tout sauf chiffres et un éventuel `+` de tête (ex. `"+225 07 12 45 67 89"` → `"+22507124567 89"` → en pratique `"+2250712456789"`). Utilisé pour comparer, jamais pour stocker (le téléphone brut de la commande reste affiché tel que saisi).

### 3.3 Rattachement + calcul fidélité (`lib/customers/loyalty.ts`, nouveau, fonctions pures + intégration `confirmOrder`)

Constantes :

```ts
export const POINTS_PER_FCFA_UNIT = 1000; // 1 point par tranche de 1 000 FCFA
export const VIP_THRESHOLD_POINTS = 150;
```

Fonction pure testable :

```ts
export function computeLoyalty(totalSpent: number, ordersCount: number): {
  points: number;
  vip: boolean;
  segment: "VIP" | "Fidele" | "Nouvelle";
}
```

`points = Math.floor(totalSpent / POINTS_PER_FCFA_UNIT)`, `vip = points >= VIP_THRESHOLD_POINTS`, `segment = vip ? "VIP" : ordersCount === 1 ? "Nouvelle" : "Fidele"`. Une fois `vip` vrai, il reste vrai (propriété automatique : `points` ne décroît jamais en v1, aucun retrait de points prévu).

Intégration dans `confirmOrder` (`lib/orders/actions.ts`), **dans la même transaction Prisma** qui déduit déjà le stock, après la déduction et avant `order.update({status: "confirmee"})` :

1. `const normalized = normalizePhone(order.phone)`.
2. Chercher une `Customer` du tenant dont `normalizePhone(phone) === normalized` (comparaison faite en JS après lecture des candidats du tenant — le volume par boutique reste faible, pas d'index fonctionnel Postgres nécessaire pour v1).
3. Si trouvée : `newTotalSpent = customer.totalSpent + order.total`, `newOrdersCount = customer.ordersCount + 1`, `{points, vip, segment} = computeLoyalty(newTotalSpent, newOrdersCount)`, `update` avec ces valeurs + `name`/`place` rafraîchis avec ceux de la commande (garde l'adresse/nom à jour).
4. Sinon : `create` une nouvelle `Customer` (`name`, `phone` brut de la commande, `place`, `initials: initials(order.clientName)` via `lib/format.ts` déjà existant, `ordersCount: 1`, `totalSpent: order.total`, `{points, vip, segment} = computeLoyalty(order.total, 1)`).
5. `order.update({ where: { id: order.id }, data: { status: "confirmee", customerId: customer.id } })` (fusionné avec la mise à jour de statut existante, pas un appel séparé).

`rejectOrder` : aucun changement lié aux clientes.

### 3.4 Lectures (`lib/data/customers.server.ts`, nouveau — même scission client/serveur que `catalog.server.ts`/`orders.server.ts`)

```ts
export async function getCustomers(): Promise<Customer[]>
export async function getCustomerOrderHistory(customerId: string): Promise<{ ref: string; date: string; total: string }[]>
export function toCustomer(row: PrismaCustomer): Customer
```

`toCustomer` mappe les champs Prisma vers le type applicatif existant (`lib/data/types.ts`, inchangé) : `segment: "Fidele"` (Prisma, sans accent) → `seg: "Fidèle"` (applicatif, avec accent — même divergence déjà gérée pour `category`/`cat` dans `toProduct`), `totalSpent` (Int) → `spent: money(totalSpent)` (`lib/format.ts`, déjà existant), `ordersCount` → `orders`. `getCustomers()` : `orderBy: { createdAt: "asc" }` (cohérent avec `getCatalog`), scopé au tenant courant (`getCurrentTenant()`). `getCustomerOrderHistory` : lit les `Order` du client avec `status: "confirmee"`, triées `createdAt: "desc"`, mappées `{ ref, date: <formaté>, total: money(total) }`.

### 3.5 Appelants

- **`app/(dashboard)/clientes/page.tsx`** devient Server Component async : `const customers = await getCustomers();`, transmis en prop à `CustomersScreen`. `CustomersScreen` reçoit `customers: Customer[]` au lieu d'importer `clients`/`customerHistory` du mock. L'historique d'achats est préchargé **pour toutes les clientes en une fois**, côté serveur, dans la même page (`Promise.all(customers.map(c => getCustomerOrderHistory(c.id)))`, transmis en prop `historyByCustomerId: Record<string, {...}[]>`) — volume identique à celui du catalogue (6 clientes aujourd'hui), pas besoin d'une Server Action déclenchée côté client à chaque sélection.
- **Champ recherche `CustomersScreen`** : filtre client-side (`toLowerCase().includes()`) sur `name`/`phone` de la liste `customers` déjà chargée, combiné au filtre de segment existant.
- **`useBackoffice.ts`** : `attachClient` change de signature — `attachClient: (customer: Customer) => void` au lieu de `attachClient: () => void` (qui prenait toujours `clients[0]`). Suppression de l'import `clients` du mock.
- **Écran POS** (composant appelant `attachClient`) : reçoit `customers: Customer[]` en prop depuis sa page Server Component (même pattern que le catalogue transmis au POS au sous-projet 3), affiche un petit picker (champ recherche + liste filtrée nom/téléphone) au lieu du bouton actuel qui attachait directement `clients[0]`.
- **`app/(storefront)/compte/page.tsx`** devient Server Component async : lit la première `Customer` du tenant courant (`getCustomers()`, prend `[0]` — stub assumé, documenté en §6 Non-goals) et son historique, transmis en props à `AccountView`. `AccountView` n'importe plus `clients`/`customerHistory` du mock.

### 3.6 Suppressions

- `lib/data/clients.ts` (mock) — supprimé entièrement, plus aucun import résiduel (`clients`, `customerHistory`).

## 4. Gestion d'erreur

Le rattachement cliente vit **à l'intérieur** de la transaction `confirmOrder` déjà existante (isolation `Serializable`) — toute erreur (ex. contrainte Prisma inattendue) fait échouer la transaction entière et renvoie `{ok: false, error: "Une erreur est survenue, réessayez."}` comme aujourd'hui ; aucune déduction de stock ni mise à jour de commande ne peut committer sans le rattachement cliente correspondant (tout ou rien, cohérent avec le sous-projet 4). `getCustomers`/`getCustomerOrderHistory` suivent le choix déjà fait pour `getCatalog` (lectures pures dans des Server Components, exception laissée remonter — pas de `{ok, ...}` requis pour des lectures non déclenchées par un clic).

## 5. Données existantes (seed sous-projet 1) — migration de données ponctuelle

Les 6 `Customer` et 7 `Order` seedées au sous-projet 1 sont une copie fidèle du mock, mais sans lien `customerId` (le mécanisme n'existait pas encore), et les nouvelles colonnes `ordersCount`/`totalSpent` démarreraient à `0` par défaut — ce qui ferait régresser visuellement la démo (ex. « Aya Koffi » perdrait ses « 14 commandes · 420 000 FCFA » déjà visibles dans `/admin/clientes`).

Un script ponctuel (exécuté une fois pendant l'implémentation, pas du code applicatif permanent — même esprit que le `UPDATE createdAt` du sous-projet 3) :

1. Rattache chaque `Order` seedée à sa `Customer` par correspondance exacte `clientName` (les deux jeux de seed ont été construits comme copie fidèle du même mock, les noms correspondent tels quels).
2. Renseigne `ordersCount`/`totalSpent` des 6 `Customer` avec les valeurs déjà présentes dans le mock d'origine (`orders`/`spent`), pour que l'affichage reste identique après la migration. `points`/`vip`/`segment` déjà seedés au sous-projet 1 restent inchangés par ce script (déjà cohérents avec le mock).

## 6. Non-goals de ce sous-projet

- Page Compte vitrine reste un stub (pas d'authentification cliente réelle) — dette explicitement documentée, à traiter dans un futur sous-projet dédié.
- Panneau « Programme de fidélité » (ratio points, seuil VIP, promo anniversaire) reste décoratif — formule en constantes serveur, pas de table de config éditable.
- POS ne persiste toujours aucune vente réelle en base (invariant du sous-projet 4, inchangé) — attacher une cliente au POS ne sert qu'à l'affichage du ticket en cours.
- Pas de retrait de points ni de dégradation de segment (VIP → Fidèle) en v1.
- Pas de Supabase Realtime.
- Pas de fusion manuelle de doublons de fiches clientes (si la normalisation téléphone ne suffit pas à rapprocher deux commandes d'une même personne, par exemple avec/sans indicatif pays, deux fiches distinctes coexisteront) — un outil de fusion est hors périmètre.

## 7. Tests

- **Vitest** : `normalizePhone` (formats variés : espaces, tirets, parenthèses, avec/sans indicatif) ; `computeLoyalty` (cas limites : 1ère commande, franchissement exact du seuil 150 points, second achat sans franchissement, un point acquis une fois VIP ne fait jamais redescendre le segment) ; recherche client-side nom/téléphone (`CustomersScreen`/picker POS) si extraite en fonction pure.
- **`npm run typecheck`**, **`npx next build --webpack`** (Turbopack reste cassé par le chemin du dossier, note connue depuis le Plan 1).
- **Parcours navigateur réel** (comme les sous-projets 3 et 4) : soumettre une commande web avec un numéro déjà connu en base mais formaté différemment (ex. sans espaces) → valider côté dashboard → vérifier en base (`execute_sql`) que c'est la fiche cliente existante qui est incrémentée, pas une nouvelle → vérifier l'affichage dans `/admin/clientes` (points/segment/historique à jour) → vérifier que le picker POS retrouve bien la cliente par recherche nom/téléphone → vérifier que `/compte` (vitrine) affiche des données réelles issues de Postgres (pas le mock).

## 8. Critères de réussite

- `npm run test` vert, `npm run typecheck` propre, `npx next build --webpack` réussit.
- `lib/data/clients.ts` n'existe plus ; aucun import résiduel (`grep` vide sur `clients`, `customerHistory`, `data/clients`).
- Parcours réel vérifié en navigateur : commande web validée → fiche cliente créée ou mise à jour correctement (pas de doublon pour un numéro reformaté) → points/segment/compteurs cohérents avec la formule → historique d'achats de la fiche reflète les vraies commandes confirmées → picker POS fonctionnel → page Compte vitrine affiche une fiche réelle issue de Postgres.
- Les 6 fiches clientes de démo (seed sous-projet 1) affichent des compteurs identiques à avant la migration (pas de régression visuelle de la démo).
