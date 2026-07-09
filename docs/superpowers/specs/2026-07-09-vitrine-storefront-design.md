# Spec — Vitrine e-commerce, branchée au back-office (multi-tenant ready)

> Date : 2026-07-09 · Portée : implémenter `Foulard Teranga - Vitrine.dc.html` en React/Next et la brancher logiquement au back-office déjà en place. Prototype client/mock, sans backend réel — mais architecture prête pour le multi-tenant SaaS et un déploiement agnostique (Vercel ou autre).

## 1. Objectif

Recréer fidèlement la vitrine publique de la maquette (Home à blocs, Catalogue, Produit, Panier, Checkout/KYC, Confirmation, Compte) et la **connecter au back-office** existant :

- **Catalogue unique partagé** entre vitrine, POS et inventaire (stock réellement commun).
- **Boucle de commande complète** : une demande client (KYC) crée une commande visible dans `/commandes`, dont la **validation par la gérante déduit le stock** — reflété sur la vitrine.
- **Aperçu-éditeur de blocs** sur la Home (réordonner / masquer / renommer), tel que dans la maquette.

Contraintes non-négociables reprises de CLAUDE.md : stock déduit **uniquement à la validation** ; total **recalculé côté store** (jamais de confiance au total client) ; KYC minimal ; FR produit / EN code ; TypeScript strict, jamais de `any`.

**Géographie** : la boutique est basée à **Abidjan, Côte d'Ivoire (+225)** — cohérent avec le mock back-office existant (clientes, commandes). Mais la clientèle peut commander **depuis toute la sous-région ou au-delà** : le champ téléphone du KYC n'est **pas verrouillé sur un préfixe fixe** (contrairement à la maquette d'origine qui codait `+221` en dur) — saisie libre d'un numéro international, validée en format souple (cf. §7).

## 2. Décisions validées

| Sujet | Décision |
|---|---|
| Catalogue | **Source unique partagée** — enrichir `lib/data/catalog.ts` (ids `p1…p12` conservés) avec les champs vitrine. |
| Boucle commande | **Complète** — store partagé persistant ; KYC → commande `nouvelle` (Web) → validation déduit le stock. |
| Éditeur de blocs | **Inclus tel quel** (aperçu démo dans la vitrine ; le vrai `/(editor)` reste un chantier distinct). |
| Niveau technique | **Mock client** — pas de Supabase/Prisma/auth réelle/PWA. Zustand + localStorage. |
| Séparation public/privé | **Zones par hôte** : sous-domaines en prod, fallback préfixe de chemin en dev. |
| Couches SaaS | **Posées maintenant, fines** : `lib/tenant`, `proxy.ts`, garde auth placeholder dans `lib/auth`. |
| Portabilité | **Agnostique plateforme** — proxy standard Next.js + `request.headers.host` ; aucune API propriétaire Vercel en dépendance dure. |
| Entrée `/` | `/` = **vitrine publique**. Back-office servi sous `admin.` (prod) / `/admin/*` (dev). |

## 3. Architecture des routes & zones

### 3.1 Résolution par hôte (`proxy.ts`, middleware Next 16)

Le middleware standard résout **zone + tenant** à partir du hostname, sans dépendance propriétaire :

```
proxy.ts  ── request.headers.host ──▶
  PROD:
    admin.<domaine>              → zone = dashboard   (privé owner/staff)
    platform.<domaine>           → zone = admin       (privé super_admin)
    apex / {tenant}.<domaine> / domaine-custom → zone = storefront (public) + tenantId
  DEV (localhost / *.local):
    /admin/*                     → zone = dashboard   (rewrite : retire le préfixe /admin)
    /platform/*                  → zone = admin       (rewrite : retire /platform)
    reste                        → zone = storefront + tenant par défaut
```

Responsabilités de `proxy.ts` :
1. Déterminer la zone (host en prod, préfixe de chemin en dev).
2. Résoudre le `tenantId` (via `lib/tenant`, cf. §5) et l'injecter en en-tête `x-tenant-id`.
3. **Garde privé/public** : pour les zones `dashboard`/`admin`, appeler la garde `lib/auth` (placeholder v1) ; rediriger si non autorisé. La zone `storefront` est publique.
4. Rewrites internes pour que les chemins servis restent propres et identiques quelle que soit la zone.

Le résolveur `domaine → tenant` est une **map en mémoire** en v1 (`lib/tenant/registry.ts`), remplaçable par une requête DB sans toucher au reste. Aucune API Vercel Domains/Edge Config n'est requise.

### 3.2 Groupes de routes

```
app/
  (storefront)/          # PUBLIC — vitrine cliente
    layout.tsx           # chrome vitrine (header, drawer, bottom-tab, offline, toast)
    page.tsx             # Home (blocs)
    catalogue/page.tsx
    produit/[id]/page.tsx
    panier/page.tsx
    commander/page.tsx        # checkout / KYC
    confirmation/page.tsx
    compte/page.tsx
  (dashboard)/           # PRIVÉ owner/staff — existant, inchangé côté chemins (/pos, /commandes, …)
  (admin)/               # PRIVÉ super_admin — quasi vide en v1 (placeholder page)
  layout.tsx             # root (fonts, globals) — inchangé
```

- Les chemins **publics** : `/`, `/catalogue`, `/produit/[id]`, `/panier`, `/commander`, `/confirmation`, `/compte`.
- Les chemins **privés** internes restent ceux du back-office actuel (`/pos`, `/commandes`…) ; l'URL externe est préfixée/sous-domaine par le proxy. **Aucun renommage des dossiers `(dashboard)` existants.**
- `app/page.tsx` actuel (`redirect("/pos")`) est **remplacé** par la Home vitrine (`(storefront)/page.tsx`). Un accès dev au back-office se fait via `/admin` (rewrite proxy).

### 3.3 Rendu

Pages = Server Components légers qui lisent le catalogue et le tenant côté serveur ; l'interactivité (panier, filtres, sélection variante, KYC, mode blocs) est isolée dans des composants `"use client"`. Aucune donnée privilégiée exposée au client (cohérent CLAUDE.md §8).

## 4. Couche données — catalogue canonique unique

### 4.1 Type `Product` étendu (`lib/data/types.ts`)

Champs actuels conservés (`id, cat, name, variant, price, stock, swatch`). Ajouts (tous rétro-compatibles) :

```ts
export type ProductCategory = "Foulards" | "Turbans" | "Tissus" | "Accessoires";

export interface Product {
  id: string;
  cat: ProductCategory;
  name: string;
  variant: string;         // conservé (POS/inventaire)
  price: number;
  stock: number;           // stock de base ; le stock effectif vit dans useShop (cf. §6)
  swatch: string;
  // --- champs vitrine ---
  colors: string[];        // hex, 1er = couleur principale (dégradé vignette)
  motif: string;           // "Wax" | "Bazin" | "Uni" | "Kente" | "Tie & dye" | …
  lengths: string[];       // ex. ["90 × 90 cm", "Sur-mesure"] ou ["Taille unique"]
  description: string;
  oldPrice?: number;       // prix barré éventuel
  badge?: string;          // "Nouveau" | "★ Coup de cœur" | "★ VIP"
  featured?: boolean;      // mise en avant "Produit vedette"
}
```

### 4.2 `lib/data/catalog.ts`

- Les 12 produits existants sont **enrichis** des champs ci-dessus (couleurs, motif, longueurs, description, badges) en s'inspirant du dataset `_products` de la maquette.
- Re-catégoriser les turbans en `"Turbans"`.
- `categories` élargi pour couvrir l'union ; helper `storefrontCategories = ["Foulards","Turbans","Accessoires"]` pour la nav vitrine (les Tissus restent visibles au catalogue mais hors vignettes d'accueil).
- Helpers dérivés purs (sélecteurs) : `newestProducts()`, `featuredProduct()`, `relatedTo(id)`, `filterCatalog(filters)` — réutilisables vitrine et éditeur.

Les écrans back-office (POS, Inventaire) lisent la **même liste** ; comme on n'ajoute que des champs, leur logique existante n'est pas modifiée.

## 5. Multi-tenant (fin)

`lib/tenant/` :

```ts
export interface Tenant {
  id: string;
  slug: string;            // sous-domaine
  name: string;            // "Foulard Teranga"
  theme: ThemeTokens;      // logo, palette, typo — abstrait par boutique (CLAUDE.md §6)
  domains: string[];       // hôtes custom mappés
}
export function resolveTenantFromHost(host: string): Tenant;  // map en mémoire (registry.ts)
export function getCurrentTenant(): Tenant;                    // lit x-tenant-id (server), défaut v1
```

En v1, une seule boutique (`foulard-teranga`). **Toutes les requêtes/stores storefront portent un `tenantId`** même constant, pour que le passage multi-tenant soit un filtrage, pas une réécriture. Le thème est déjà exposé via variables CSS (`globals.css`) ; `getCurrentTenant().theme` alimentera ces variables plus tard.

`lib/auth/` (placeholder) : `getSession()` renvoie un owner mock ; `requireZone(zone)` est la garde appelée par `proxy.ts`. Quand Supabase Auth arrivera, seule cette couche change.

### 5.1 Une vitrine par tenant (vision cible, posée sans être construite en v1)

Chaque tenant aura à terme **sa propre boutique complète**, isolée et à son image — la v1 ne construit qu'un seul tenant, mais chaque pièce ci-dessus est déjà scopée pour que l'ajout d'un 2ᵉ tenant soit un **filtrage**, jamais une réécriture :

| Dimension | Isolation par tenant | Porté par |
|---|---|---|
| Adresse | domaine/sous-domaine propre | `proxy.ts` + `resolveTenantFromHost` |
| Catalogue & stock | produits, prix, stock effectif propres | `useShop` scopé `tenantId` |
| Commandes | file isolée par boutique | `useShop` scopé `tenantId` |
| Identité visuelle | logo, palette, typo propres | `Tenant.theme` → variables CSS |
| Composition de page | Home = blocs propres (ordre/visibilité) | modèle *flexible content* + `blocks/registry.ts` |

Ce qui reste **hors périmètre v1** (cf. §11) mais que cette architecture rend possible sans refonte : persistance réelle avec `tenant_id` + RLS, provisioning/onboarding d'une boutique, auth scoping par tenant, éditeur de vitrine complet par tenant.

## 6. Stores (Zustand)

### 6.1 `lib/store/useShop.ts` — métier partagé + **persistant (localStorage)**

Lu par la **vitrine et le back-office**. Scopé par tenant (clé de persistance incluant `tenantId`).

État :
- `orders: Order[]` — seed depuis `lib/data/orders.ts` + commandes créées via la vitrine.
- `statusOverrides: Record<orderId, OrderStatus>` — migré ici depuis `useBackoffice` (source unique de vérité du statut).
- `stockDeductions: Record<productId, number>` — quantités déduites (stock effectif = `product.stock - deduction`).

Actions :
- `submitWebOrder(kyc, cartLines) → Order` : recalcule le total serveur-side, crée une commande `status:"nouvelle"`, `channel:"Web"`, réf `#TER-XXXX`, **lignes avec `productId`** (nécessaire à la déduction), place/téléphone tels que saisis par la cliente (peuvent être hors Côte d'Ivoire — cf. §1). N'affecte PAS le stock.
- `confirmOrder(orderId)` : passe `confirmee` **et applique la déduction de stock** pour chaque ligne portant un `productId`. Idempotent (ne déduit qu'une fois).
- `rejectOrder(orderId)` : passe `refusee`, stock inchangé.
- `setOrderStatus(orderId, status)` : transitions ultérieures (préparation, livrée).
- Sélecteurs : `effectiveStock(productId)`, `pendingCount()`.

Invariants : déduction **au seul passage `confirmee`** ; total calculé dans l'action, jamais reçu du client.

### 6.2 `lib/store/useStorefront.ts` — UI vitrine locale

- `cart: StoreCartLine[]` (**persisté** — esprit panier hors-ligne) : `{ key, productId, name, variant, colorHex, price, qty }`.
- `offline: boolean` (toggle net-dot header, indépendant du offline back-office).
- `toast`, `menuOpen`.
- Éditeur de blocs : `blocksMode`, `blockOrder: BlockId[]`, `blockHidden: Record<BlockId, boolean>`, `blockNames`.
- Form KYC : `kyc { name, place, phone, note, wa }`, `kycTouched`, `sending`.
- Actions panier : `addToCart(product, variant, qty)`, `incLine`, `rmLine`, `clearCart` ; `moveBlock`, `toggleHideBlock`, `renameBlock` ; `showToast` ; `toggleOffline`.

Le **panier vitrine est distinct du panier POS** (`useBackoffice.cart`) : client ≠ caissière.

## 7. Boucle commande — flux détaillé

```
Vitrine  /produit/[id]  → addToCart → /panier → "Valider le panier" → /commander
/commander : KYC (nom·lieu·téléphone) validé par Zod (schéma partagé lib/validators)
           → submitKyc() → useShop.submitWebOrder() crée l'ordre PENDING
           → redirection /confirmation (réf + suivi statut)
Back-office /commandes : la commande apparaît dans "À valider" ;
           useNewOrdersCount (badge sidebar/nav) l'inclut
Gérante   → "Valider" → useShop.confirmOrder() → statut confirmee + STOCK DÉDUIT
Vitrine   : le produit reflète le stock réduit (repasse "Épuisé" si 0)
           → "Refuser" → rejectOrder() → stock inchangé
```

Validation KYC via **Zod** (`lib/validators/kyc.ts`) : `name` requis, `place` requis (texte libre — ville/pays si hors Abidjan), `phone` requis en **format international souple** (accepte `+225…` par défaut mais aussi tout autre indicatif — pas de préfixe verrouillé dans l'UI, contrairement à la maquette source). Schéma prêt à être réutilisé par une future Server Action.

Composant champ téléphone : input libre avec placeholder indicatif (`+225 …`) plutôt que le préfixe fixe non éditable de la maquette (`+221` en dur) — la cliente peut saisir un indicatif différent.

## 8. Retouches back-office (ciblées, non destructives)

1. `components/dashboard/screens/OrdersScreen.tsx` : lit `orders` + statut depuis `useShop` (au lieu de l'import statique `orders` et `useBackoffice.orderStatus`) ; `onValidate` → `useShop.confirmOrder` ; `onRefuse` → `useShop.rejectOrder`.
2. `lib/store/useNewOrdersCount.ts` : compte les `nouvelle` depuis `useShop`.
3. `lib/store/useBackoffice.ts` : `orderStatus`/`setOrderStatus`/`toggleAuto` liés aux commandes migrent vers `useShop` (le reste — POS, offline caisse, ticket, toasts — reste dans `useBackoffice`).
4. Inventaire : afficher le **stock effectif** (`effectiveStock`) pour que la déduction soit visible (retouche d'affichage, pas de refonte).

Aucun autre écran modifié dans sa logique.

## 9. Composants vitrine

```
components/storefront/
  StoreHeader.tsx  MobileMenu.tsx  BottomTab.tsx  StoreOfflineBanner.tsx  StoreToast.tsx
  ProductCard.tsx  AvailabilityChip.tsx  LoyaltyBadge.tsx  Breadcrumb.tsx
  blocks/
    registry.ts            # BlockId → { component, defaultName } (préfigure l'éditeur, SECTIONS.md §1)
    HeroBlock.tsx  CategoryTilesBlock.tsx  ProductGridBlock.tsx  LoyaltyBannerBlock.tsx
    FeaturedProductBlock.tsx  StoryBlock.tsx  LookbookBlock.tsx  NewsletterBlock.tsx  ContactBlock.tsx
    BlockFrame.tsx         # cadre commun + barre d'outils "mode éditeur" (drag/↑↓/œil/renommer)
  views/
    CatalogView.tsx  ProductView.tsx  CartView.tsx  CheckoutView.tsx  ConfirmView.tsx  AccountView.tsx
```

- Vignettes via dégradés `swatch` / `stripe(hex)` (pas d'images), fidèle à la maquette.
- États catalogue reproduits : `ready` / `loading` (skeleton `ftpulse`) / `empty` / `error`, plus bandeau offline.
- Home rendue par la **liste ordonnée `blockOrder`** filtrée par `blockHidden` → chaque `BlockId` mappé via `registry.ts`. Ordre par défaut : `hero, cats, grid, loyalty, featured, story, look, news, contact` (identique maquette).

## 10. Fidélité au design

- Tokens existants (`app/globals.css`, `lib/theme/tokens.ts`) ; Playfair Display + Inter déjà chargés dans `app/layout.tsx`.
- Densité « confortable » vitrine (DESIGN.md §14) ; breakpoint **860px** (comme le back-office).
- Boutons, champs, cartes, badges, overlays conformes à DESIGN.md §5–11 ; zones tactiles ≥ 44px, focus visibles, contrastes AA.
- Animations `ftfade`, `ftpulse`, `ftspin`, `fttoast` portées dans `globals.css`.

## 11. Hors périmètre

- Supabase / Prisma / RLS / auth réelle / Service Worker PWA / Realtime.
- Éditeur de vitrine complet en drag-and-drop `/(editor)` (l'aperçu Home est une démo).
- Espace compte client réel (reste mock statique : Awa Diallo, 340 pts).
- Facturation SaaS, impersonation super-admin (page `(admin)` = placeholder).
- Paiement en ligne (par design : demande à confirmer, sans paiement).

## 12. Vérification

1. `npm run typecheck` (strict, zéro `any`) + `next build` OK.
2. Parcours réel via serveur de dev :
   - Ajouter au panier → `/panier` → `/commander` → KYC → `/confirmation` (réf générée).
   - La commande apparaît dans `/admin/commandes` (« À valider »), badge incrémenté.
   - « Valider » → stock du/des produit(s) décrémenté → visible sur `/produit/[id]` et `/catalogue` (passe « Épuisé » si 0).
   - « Refuser » → stock inchangé.
   - Mode éditeur Home : réordonner / masquer / renommer un bloc fonctionne.
   - Responsive mobile (bottom-tab, drawer) et offline (bannières) OK.
3. Séparation zones : `/` = vitrine ; `/admin/*` = back-office en dev ; garde placeholder active.

## 13. Risques & notes

- **Migration du statut de commande** de `useBackoffice` vers `useShop` : vérifier que `commandes/page.tsx` (props `initialSel`) et tout consommateur du badge suivent la nouvelle source.
- **Persistance localStorage + SSR** : les stores partagés doivent gérer l'hydratation (pattern `skipHydration` / lecture client) pour éviter les mismatch Server/Client.
- **Next 16 `proxy.ts`** : confirmer l'API exacte du middleware/proxy via Context7 avant implémentation (rename middleware→proxy en Next 16 mentionné dans CLAUDE.md §5).
- **Champ téléphone KYC non verrouillé** : à la différence de la maquette (préfixe `+221` fixe), l'implémentation doit laisser un champ libre — attention à ne pas réintroduire par erreur un préfixe codé en dur en portant le composant de la maquette.
