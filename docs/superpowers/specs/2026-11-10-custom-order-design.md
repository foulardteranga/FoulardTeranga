# Spec — Commande personnalisée (sur mesure, sans produit catalogue)

> Date : 2026-11-10 · Portée : ajouter un bouton « + Commande personnalisée » dans `OrdersScreen` (`/admin/commandes`) permettant à la gérante d'enregistrer une demande de confection sur mesure (tissu, modèle, prix, date de livraison), intégrée au même workflow de validation que les commandes catalogue, mais sans ligne produit ni déduction de stock.

## 1. Contexte & objectif

Aujourd'hui, toute `Order` a des `OrderLine` pointant vers un `Product`/`ProductVariant` du catalogue (stock déduit à la validation, cf. `confirmOrder`). Une commande personnalisée (ex. un boubou sur mesure dans un tissu apporté par la cliente) n'a pas de produit catalogue correspondant — elle doit donc pouvoir exister **sans aucune `OrderLine`**, avec un prix saisi manuellement par la gérante, tout en restant visible et pilotable dans les mêmes onglets (À valider/Confirmées/En préparation/Livrées/Refusées/Archivées) que les commandes normales.

Décisions validées avec l'utilisateur (résumé) :

| Sujet | Décision |
|---|---|
| Intégration | Même liste, même workflow que les commandes catalogue (pas de section séparée) — badge « Personnalisée ». |
| Couleur du tissu | Réutilise le sélecteur déjà existant (nuancier `lib/colors/catalog.ts`, favoris boutique, couleur sur mesure) — **sélection unique**, pas multi-variantes. |
| Photo du modèle | Upload d'image, en réutilisant le composant/route existants (`ProductPhotosField` → `uploadProductImageClient` → `/api/inventory/upload-image`). |
| Champs additionnels | Acompte versé (FCFA) — pas de champ « mesures/instructions ». |
| Lieu de livraison | Obligatoire, comme pour les commandes normales. |
| Édition après création | Hors scope v1 : seuls nom/lieu/téléphone restent éditables via `EditOrderModal` existante, comme aujourd'hui (pas d'édition des champs de confection une fois la commande créée). |

## 2. Architecture

### 2.1 Schéma — `prisma/schema.prisma`

```prisma
model Order {
  // ... champs existants inchangés ...
  isCustom              Boolean   @default(false)
  customColorName        String?
  customColorHex         String?
  customFabricNote       String?  // motif / matière, texte libre
  customModel            String?  // modèle à confectionner, texte libre
  customModelImageUrl    String?
  customDueDate          DateTime?
  customDeposit          Int?     // FCFA, acompte versé
}
```

Tous les nouveaux champs sont optionnels (sauf `isCustom`, `@default(false)`) : migration additive, aucune colonne `NOT NULL` sans défaut, aucune donnée existante affectée. `total`, `clientName`, `place`, `phone`, `channel` (= `"Boutique"`, saisie en interne) restent les champs existants déjà obligatoires, réutilisés tels quels — `total` est le prix saisi à la main.

Pas de nouvelle table, donc **pas de nouvelle policy RLS** : `orders_insert_public` (`for insert with check (true)`, `prisma/migrations/20260713120100_rls/migration.sql` L.85-86) couvre déjà l'insertion, et les policies `orders_select_staff`/`orders_update_staff` existantes couvrent la lecture/mise à jour sans changement.

### 2.2 Point technique critique — `confirmOrder` ne doit pas recalculer le total

`confirmOrder` (`lib/orders/actions.ts` L.134-277) recalcule aujourd'hui `subtotal` depuis `order.lines.reduce((sum, l) => sum + l.lineTotal, 0)`, puis réapplique remises/points via `applyDiscounts`, et écrase `order.total` avec le résultat. Pour une commande personnalisée (0 ligne), `subtotal` vaudrait `0` et **écraserait le prix saisi par la gérante à 0 FCFA** — bug silencieux à corriger explicitement :

- Si `order.isCustom` : ignorer le recalcul de remise/total (pas de code promo, pas de points sur une commande personnalisée — champs `promoCode`/`promoDiscount`/`pointsUsed`/`pointsDiscount` restent à leurs valeurs par défaut `null`/`0`), conserver `order.total` tel quel dans le `tx.order.update`.
- Les boucles de déduction de stock (`variantDemand`/`demand`, dérivées de `order.lines`) sont déjà des no-op pour une commande sans ligne — aucun changement nécessaire là.
- `applyLoyaltyOrder` continue de s'appliquer normalement (la cliente d'une commande personnalisée gagne des points comme toute autre cliente) — aucun changement nécessaire.
- `archiveOrder`/`restoreOrder` : les boucles de réconciliation de stock sont elles aussi dérivées de `order.lines`, donc déjà no-op — aucun changement nécessaire.

### 2.3 Validation — `lib/validators/customOrder.ts` (nouveau)

```ts
export const customOrderSchema = z.object({
  clientName: z.string().trim().min(2, "Merci d'indiquer le nom."),
  place: z.string().trim().min(2, "Indiquez où livrer."),
  phone: z.string().trim().regex(/^[0-9+()\-\s]{6,20}$/, "Un numéro pour la joindre."),
  colorName: z.string().trim().max(60).optional(),
  colorHex: z.string().trim().regex(/^#[0-9a-fA-F]{3,6}$/).optional(),
  fabricNote: z.string().trim().max(200).optional(),
  model: z.string().trim().max(200).optional(),
  modelImageUrl: z.string().trim().url().optional(),
  dueDate: z.coerce.date().optional(),
  total: z.coerce.number().int().min(100, "Indiquez un prix."),
  deposit: z.coerce.number().int().min(0).optional(),
});
```

Mêmes règles que `orderEditSchema`/`kycSchema` pour nom/lieu/téléphone (cohérence des messages d'erreur dans toute l'app).

### 2.4 Server Action — `lib/orders/actions.ts` (ajout `createCustomOrder`)

```ts
export async function createCustomOrder(
  input: CustomOrderInput
): Promise<{ ok: true; ref: string } | { ok: false; error: string }>
```

Squelette identique aux autres actions dashboard : `requireZone("dashboard")` → `getSession()` → `requireWritableSession()` → `customOrderSchema.safeParse` → `prisma.$transaction` (créé `Order` avec `channel: "Boutique"`, `isCustom: true`, aucune `OrderLine`, puis `OrderStatusEvent({status: "nouvelle", authorId: session.userId})` — à la différence de `submitWebOrder`, l'auteur est connu puisque c'est la gérante/staff qui saisit) → `createNotification` (même type `nouvelle_commande`) → `revalidatePath("/admin/commandes")` + `/admin/tableau-de-bord"`.

### 2.5 Lecture — `lib/data/orders.server.ts` / `lib/data/types.ts`

- `Order` (type, `lib/data/types.ts` L.94-129) : ajoute `isCustom: boolean`, `customColorName: string | null`, `customColorHex: string | null`, `customFabricNote: string | null`, `customModel: string | null`, `customModelImageUrl: string | null`, `customDueDate: string | null` (formatée), `customDeposit: number | null`.
- `toOrder()` (`lib/data/orders.server.ts` L.18) : mappe ces champs depuis la ligne Prisma, formate `customDueDate` et `customDeposit` (via `money()`) comme le reste des champs d'affichage.

### 2.6 UI

- **`components/dashboard/screens/OrdersScreen.tsx`** :
  - Bouton « + Commande personnalisée » à côté de la rangée de filtres (ouvre `CustomOrderModal`).
  - Nouveau composant `CustomOrderModal` (nouveau fichier `components/orders/CustomOrderModal.tsx`) : champs nom/téléphone/lieu (inputs simples, comme `EditOrderModal`), sélecteur de couleur **simplifié à sélection unique** (réutilise `searchColors`/`COLOR_CATALOG`/`generateShades`/`getTenantColors`/`CustomColorModal` — logique de `ProductVariantsField` adaptée : cliquer sur une teinte la sélectionne et désélectionne l'ancienne, au lieu de toggler une liste), champ texte « Motif / matière », champ texte « Modèle à confectionner », upload photo (réutilise `ProductPhotosField`-style : `prepareImageForUpload` + `uploadProductImageClient`, un seul slot image au lieu de `image`+`gallery`), `<input type="date">` pour la date de livraison (cohérent avec `MarketingScreen`), `NumericField mode="money"` pour le prix et l'acompte. Bouton « Enregistrer » appelle `createCustomOrder`, désactivé tant que nom/lieu/téléphone/prix ne sont pas valides.
  - Liste des cartes (`list.map`) : si `o.isCustom`, remplace `{o.items} articles · {o.channel} · {o.ago}` par `Commande personnalisée · {o.ago}`, et affiche un badge « Personnalisée » à côté du badge de statut.
  - `OrderDetail` : si `o.isCustom`, remplace la section « Panier » par une section « Détails de la confection » (pastille couleur + nom, motif/matière, modèle, miniature photo si présente, date de livraison souhaitée, acompte versé / reste à payer calculé = `total − deposit`). Le reste (timeline, mini-fiche cliente, bouton WhatsApp, actions valider/refuser/modifier/archiver) reste strictement identique.

## 3. Gestion d'erreur

Mêmes conventions que le reste de `lib/orders/actions.ts` : `{ok, ...}` systématique, jamais d'exception non gérée ; message « Informations invalides. » sur échec Zod, « Une erreur est survenue, réessayez. » pour toute erreur Prisma/upload inattendue. L'upload de la photo peut échouer indépendamment de la création de la commande (comme `ProductPhotosField` aujourd'hui) — en cas d'échec, l'utilisateur garde la main et peut réessayer ou ignorer la photo (champ optionnel).

## 4. Tests

- **Vitest** :
  - `customOrderSchema` : rejette prix absent/< 100, téléphone invalide, accepte sans couleur/photo/date/acompte (tous optionnels).
  - `createCustomOrder` : crée une `Order` avec `isCustom: true`, 0 `OrderLine`, `channel: "Boutique"` ; échoue proprement pour une session absente/`customer`.
  - `confirmOrder` sur une commande `isCustom` : `total` reste inchangé après validation (non écrasé à 0), aucun mouvement de stock créé, `pointsUsed`/`promoDiscount` restent à 0.
  - `archiveOrder`/`restoreOrder` sur une commande `isCustom` confirmée : aucune tentative de réconciliation de stock (no-op), statut transite normalement.
- **Playwright** : créer une commande personnalisée depuis le bouton → apparaît dans « À valider » avec le badge « Personnalisée » → valider → le prix affiché est bien celui saisi (pas 0) → le détail affiche tissu/modèle/photo/date/acompte → le reste du parcours (WhatsApp, préparation, livraison, archivage) fonctionne sans régression sur les commandes catalogue existantes.

## 5. Non-goals de ce sous-projet

- Pas d'édition des champs de confection (tissu/modèle/photo/date/acompte) après création — seuls nom/lieu/téléphone restent modifiables via la modale existante.
- Pas de champ « mesures/instructions spéciales » (explicitement écarté par l'utilisateur).
- Pas de code promo ni de points de fidélité appliqués à une commande personnalisée (seul l'acompte existe comme mécanisme de paiement partiel).
- Pas de création de commande personnalisée depuis la vitrine publique ou le POS — uniquement depuis `OrdersScreen` (back-office).

## 6. Critères de réussite

- `npm run test` vert, `npm run typecheck` propre, `npx next build --webpack` réussit.
- Migration Prisma additive appliquée (aucune policy RLS à ajouter, vérifié que `orders_insert_public` couvre bien l'insertion depuis `createCustomOrder`).
- Parcours vérifié en navigateur : bouton « + Commande personnalisée » → modale (couleur, photo, tissu, modèle, prix, acompte, date) → commande visible dans « À valider » avec badge → validation → prix correct conservé → détail affiche la section confection → archivage/suppression fonctionnent comme pour une commande normale.
- Aucune régression sur les commandes catalogue existantes (`confirmOrder`, `archiveOrder`, `restoreOrder`, filtres d'onglets).
