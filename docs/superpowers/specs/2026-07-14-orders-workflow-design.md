# Spec — Commandes & workflow (sous-projet 4/5 de la migration mock → Supabase)

> Date : 2026-07-14 · Portée : migrer `useShop` (soumission de commande web, validation/refus par la gérante, déduction de stock) vers des Server Actions Prisma + Postgres. **Périmètre web uniquement** — le POS (« Encaisser ») reste hors périmètre.

## 0. Contexte — la migration en 5 sous-projets

1. **Fondation DB** — ✅ terminé. `docs/superpowers/specs/2026-07-13-supabase-db-foundation-design.md`.
2. **Auth réelle** — ✅ terminé. `docs/superpowers/specs/2026-07-13-auth-design.md`.
3. **Catalogue & stock** — ✅ terminé. `docs/superpowers/specs/2026-07-13-catalog-stock-design.md`.
4. **Commandes & workflow** (ce document) — `useShop` → Server Actions + Postgres.
5. **Clientes & fidélité** — `lib/data/clients.ts` → Postgres.

## 1. Objectif de ce sous-projet

`lib/store/useShop.ts` est aujourd'hui un store Zustand qui simule, côté client, des mutations sur un tableau `orders` mock statique et immuable (`lib/data/orders.ts`) : une commande web « soumise » est ajoutée en mémoire/localStorage, une validation applique une « surcharge » de statut (`statusOverrides`) et une « déduction » de stock (`stockDeductions`) — jamais une vraie écriture. Ce sous-projet remplace cette simulation par de vraies écritures Postgres via des Server Actions, ce qui rend caduque toute la couche de simulation, qui disparaît avec lui.

## 2. Périmètre — décisions validées

| Sujet | Décision |
|---|---|
| POS (« Encaisser ») | **Hors périmètre.** Reste un ticket décoratif sans écriture réelle, comme aujourd'hui. Sa vraie intégration commande (channel `Boutique`, confirmation immédiate) est un sous-projet futur distinct, correctement dimensionné. |
| Temps réel | **Pas de Supabase Realtime** pour ce sous-projet. Lecture serveur à chaque navigation + `revalidatePath` après chaque action (valider/refuser/soumettre). Réévaluable plus tard si le besoin de push instantané se confirme. |
| Toggle « Validation auto » | **Retiré.** Câblé mais inerte depuis le début du projet (Plan 2), aucune règle métier définie nulle part, contournerait le workflow central CLAUDE.md §4 (la gérante contacte toujours la cliente avant de valider). |
| Stock insuffisant à la validation | **Bloque la validation** avec un message clair (« Stock insuffisant pour *produit* »), transaction annulée, aucune écriture partielle. Le stock ne passe jamais sous zéro. |
| Page « Compte » vitrine (historique client) | **Hors périmètre** — reste sur `lib/data/clients.ts` (mock) jusqu'au sous-projet 5, cohérent avec l'absence de compte client réel en v1 (KYC seul, CLAUDE.md §4). |
| Couche d'accès aux données | Prisma Client (cohérent avec le sous-projet 3), Server Actions pour les mutations (CLAUDE.md §8). |

## 3. Architecture

### 3.1 Schéma — aucune migration nécessaire

Les tables `Order`/`OrderLine` (sous-projet 1) ont déjà tous les champs requis : `ref` auto-généré par séquence Postgres (`'#TER-' || nextval('orders_ref_seq')`), `status` (défaut `nouvelle`), `clientName`/`place`/`phone` directement sur `Order` (pas besoin d'un `Customer` réel pour la mini-fiche KYC), `vipAtOrder` (snapshot, restera `false` pour toute commande web tant que le sous-projet 5 n'existe pas). Zéro migration Prisma pour ce sous-projet.

### 3.2 Sécurité — invariants appliqués dans les Server Actions

- **Le panier (`localStorage`, sous contrôle du client) n'est jamais la source du prix.** `submitWebOrder` relit le `price` **actuel** de chaque produit depuis Postgres par `productId` et recalcule `unitPrice`/`lineTotal`/`total` à partir de ces prix serveur — un panier localStorage trafiqué ne peut pas fausser le total. C'est un vrai correctif de sécurité par rapport au mock actuel (`buildWebOrder` ne faisait que sommer les lignes du panier client sans revérifier chaque prix unitaire).
- **Insertion atomique commande + lignes.** La spec de fondation DB (sous-projet 1, §3) avait explicitement noté que la policy RLS `order_lines_insert_public` est plus permissive que prévu (`with check (true)`, pas de garantie d'appartenance à la bonne commande). `submitWebOrder` insère `Order` et `OrderLine[]` ensemble, côté serveur, dans une transaction Prisma unique — la cohérence commande/lignes ne repose jamais sur la RLS seule.
- **Déduction de stock atomique et idempotente.** `confirmOrder` : transaction Prisma qui (1) relit la commande et vérifie `status === "nouvelle"` (idempotence — remplace `applyConfirmOnce`), (2) vérifie que chaque `OrderLine.qty` ≤ `Product.stock` courant, (3) si tout est suffisant, décrémente chaque `Product.stock` et passe `Order.status` à `"confirmee"` — tout ou rien ; si un seul produit manque de stock, la transaction échoue entièrement (aucune déduction partielle) et renvoie l'erreur.

### 3.3 Server Actions (`lib/orders/actions.ts`, nouveau, `"use server"`)

```ts
export async function submitWebOrder(
  kyc: KycInput,
  cartLines: { productId: string; qty: number }[]
): Promise<{ ok: true; ref: string; id: string } | { ok: false; error: string }>

export async function confirmOrder(
  orderId: string
): Promise<{ ok: true } | { ok: false; error: string }>

export async function rejectOrder(
  orderId: string
): Promise<{ ok: true } | { ok: false; error: string }>
```

- `submitWebOrder` : valide `kyc` avec `kycSchema` (déjà partagé client/serveur, `lib/validators/kyc.ts`, inchangé). Relit chaque produit du panier par `productId` — un id inconnu fait échouer l'action proprement (`{ok: false, error: "..."}`), pas d'exception. Construit `Order` (`channel: "Web"`, `status` par défaut du schéma, `vipAtOrder: false`) + `OrderLine[]` (`nameAtOrder`/`unitPrice` figés au moment de la commande, comme le prescrit déjà le schéma) dans une seule transaction. Retourne le `ref` généré par Postgres.
- `confirmOrder`/`rejectOrder` : appelées depuis `OrdersScreen` (boutons Valider/Refuser). Après succès, `revalidatePath("/admin/commandes")` et `revalidatePath("/admin/tableau-de-bord")` (compteur) pour rafraîchir sans Realtime.
- Toutes trois retournent `{ok, ...}` — jamais d'exception non gérée vers l'appelant (CLAUDE.md §8), y compris pour les erreurs Prisma inattendues (`try/catch` interne, converties en `{ok: false, error: "Une erreur est survenue, réessayez."}`). Ceci diffère volontairement du choix du sous-projet 3 pour `getCatalog`/`getProductById` (laisser remonter l'exception) : ces Server Actions sont déclenchées par un clic utilisateur direct (pas seulement un rendu Server Component), donc une erreur doit produire un message inline géré, jamais un crash de page.

### 3.4 Lectures (`lib/data/orders.server.ts`, nouveau)

```ts
export async function getOrders(): Promise<Order[]>
export async function getOrderByRef(ref: string): Promise<Order | null>
export async function getPendingOrdersCount(): Promise<number>
```

Même scission client/serveur que `lib/data/catalog.ts`/`catalog.server.ts` (sous-projet 3) pour éviter la fuite `next/headers` déjà rencontrée et corrigée à ce sous-projet-là : ce nouveau fichier n'est importé que par des Server Components (pages), jamais par un Client Component. `getOrders()` inclut les lignes (`include: { lines: true }`), mappées vers le type applicatif `Order`/`OrderLine` existant (`lib/data/types.ts`, inchangé). `statusMeta` (métadonnées d'affichage des badges, `lib/data/orderStatus.ts`) reste une constante pure, inchangée.

### 3.5 Appelants

- **`CheckoutView`** (`"use client"`, inchangé pour le reste) : `handleSubmit` appelle directement `submitWebOrder(result.data, cartLines)` (Server Action importée et invoquée depuis un Client Component — même mécanisme que `signIn`/`signOut` au sous-projet 2) au lieu de `useShop().submitWebOrder`. Le `setTimeout` artificiel de 600 ms est retiré (l'appel réseau réel donne déjà la latence perçue). Redirection vers `/confirmation?ref=<ref renvoyé par l'action>`.
- **`app/(storefront)/confirmation/page.tsx`** devient un Server Component async : lit `?ref=` via `searchParams`, appelle `getOrderByRef(ref)`, passe `order: Order | null` en prop à `ConfirmView`. `ConfirmView` n'importe plus `useShop` ; affiche un état « commande introuvable » propre si `order` est `null` (remplace le `ref` factice `#TER-0000` actuel).
- **`app/(dashboard)/commandes/page.tsx`** : Server Component qui appelle `getOrders()` et passe `orders` à `OrdersScreen`. `OrdersScreen` reçoit `orders: Order[]` en prop au lieu de `useShop((s) => s.orders)` ; les callbacks `onValidate`/`onRefuse` appellent directement `confirmOrder(order.id)`/`rejectOrder(order.id)`. Le toggle « Validation auto » et son UI sont retirés.
- **`DashboardScreen`** (déjà migré au sous-projet 3 pour les produits) : sa page (`app/(dashboard)/tableau-de-bord/page.tsx`) ajoute `getOrders()`, transmis en prop `orders: Order[]` ; la carte « Commandes à valider » filtre directement `order.status === "nouvelle"` (plus de `computeEffectiveStatus`/`statusOverrides`).
- **`app/(dashboard)/layout.tsx`** (déjà Server Component, fetch `session` depuis le sous-projet 2) : ajoute `const pendingCount = await getPendingOrdersCount();`, transmis en prop à `Sidebar`/`MobileNav`, qui perdent leur appel au hook `useNewOrdersCount()`.

### 3.6 Suppressions

Postgres devenant la seule source de vérité, toute la couche de simulation disparaît :

- `lib/store/useShop.ts` — supprimé entièrement.
- `lib/store/useNewOrdersCount.ts` — supprimé (remplacé par la prop `pendingCount` depuis le layout).
- `lib/data/orders.ts` (mock statique) — supprimé, remplacé par `lib/data/orders.server.ts`.
- `lib/store/shopLogic.ts` — `computeEffectiveStatus`, `countPending`, `applyConfirmDeductions`, `applyConfirmOnce`, `buildWebOrder` supprimées (logique absorbée par les transactions Prisma des Server Actions). `computeEffectiveStock` est également supprimée : elle existait pour soustraire un overlay de déductions en session (`useShop.stockDeductions`) à un stock de base — ce mécanisme disparaît puisque `confirmOrder` décrémente désormais réellement `Product.stock` en base. Ses six appelants restants (`ProductGridBlock`, `FeaturedProductBlock`, `CatalogView`, `ProductView`, `InventoryScreen`, `DashboardScreen`) passent tous déjà le `product`/`p` complet en scope : chaque appel `computeEffectiveStock(p.id, p.stock, stockDeductions)` devient simplement `p.stock` — lecture directe, plus d'appel de fonction, `stockDeductions`/`useShop` retirés de ces fichiers.
- `lib/validators/kyc.ts` — inchangé, réutilisé côté serveur dans `submitWebOrder`.

## 4. Gestion d'erreur

Les trois Server Actions renvoient toujours `{ok, ...}`, jamais d'exception non gérée vers le client (CLAUDE.md §8) — `try/catch` interne autour de chaque transaction Prisma. `CheckoutView`/`OrdersScreen` affichent le message d'erreur inline (ex. « Stock insuffisant pour Foulard soie Kente », « Ce produit n'existe plus ») sans crash de page. Ce choix diffère volontairement de celui du sous-projet 3 pour `getCatalog`/`getProductById` (exception laissée remonter) : ces fonctions-ci sont des lectures pures dans des Server Components, tandis que les Server Actions de ce sous-projet sont déclenchées par un clic utilisateur et doivent toujours produire un retour géré.

## 5. Tests

- Fonction pure extraite pour la construction total/lignes à partir de prix serveur (testable sans DB, même esprit que `buildWebOrder` actuel mais avec des prix non issus du client) : couverte par Vitest.
- `validateKyc`/`kycSchema` : déjà couvert, inchangé.
- `submitWebOrder`/`confirmOrder`/`rejectOrder` (Prisma + transactions) : non testées en isolation par Vitest (même choix qu'au sous-projet 3 pour `getCatalog`, disproportionné pour ces opérations simples) — vérifiées via `execute_sql` + navigateur en direct, **cette fois avec un vrai parcours de bout en bout cliqué** (panier → KYC → soumission → visible dans `/admin/commandes` → validation gérante → stock déduit visible dans `/admin/inventaire`), parcours que le sous-projet 2 n'avait jamais pu tester en direct faute d'outils navigateur disponibles à l'époque.
- Suppression des tests de la mécanique retirée (`shopLogic.test.ts` : describe blocks de `computeEffectiveStatus`, `countPending`, `applyConfirmDeductions`, `applyConfirmOnce`, `buildWebOrder`).

## 6. Non-goals de ce sous-projet

- POS (« Encaisser ») reste décoratif, aucune commande réelle créée depuis le comptoir.
- Pas de Supabase Realtime.
- Pas de « Validation auto » fonctionnelle (toggle retiré).
- Pas de changement à la page « Compte » vitrine (reste sur `lib/data/clients.ts`).
- Pas de lien `Customer` réel sur les commandes web (sous-projet 5).
- Bouton « Modifier » une commande reste un no-op (inchangé).
- Pas de notification e-mail (CLAUDE.md §4 la mentionne pour plus tard, hors périmètre ici comme le Realtime).

## 7. Critères de réussite

- `npm run test` vert, `npm run typecheck` propre, `npx next build --webpack` réussit.
- Parcours réel vérifié en navigateur : panier → checkout → commande visible dans `/admin/commandes` → validation → stock décrémenté visible dans `/admin/inventaire` et `/admin/tableau-de-bord` → tentative de validation avec stock insuffisant bloquée proprement avec message clair.
- `lib/store/useShop.ts`, `lib/store/useNewOrdersCount.ts` et `lib/data/orders.ts` n'existent plus ; aucun import résiduel (`grep` vide).
- Aucune écriture Postgres possible avec un total ou des prix falsifiés depuis le client (vérifié en modifiant manuellement le panier localStorage avant soumission).
