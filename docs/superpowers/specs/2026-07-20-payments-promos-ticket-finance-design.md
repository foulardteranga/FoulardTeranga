# Design — Paiements détaillés, promos & points, ticket WhatsApp, Finance/Marketing réels

Date : 2026-07-20
Statut : validé section par section avec la propriétaire du projet.
Périmètre : quatre lots séquentiels (approche validée), livrables et mergeables indépendamment, dans cet ordre.

## Contexte

- **Correction géographique** : la boutique est en **Côte d'Ivoire** (pas au Sénégal comme l'indique CLAUDE.md §1). Portefeuilles Mobile Money pertinents : **Orange Money, Wave, Moov Money, MTN MoMo**.
- Le POS enregistre déjà un mode de paiement (`espece | mm | mixte`, enum Prisma `PaymentMethod`, sélecteur 3 chips dans `PosScreen`, colonne `Order.paymentMethod`).
- Une modale de ticket (`components/dashboard/TicketModal.tsx`) s'affiche après `encaisserVente` (réf, nb articles, mode, total) avec un bouton « Imprimer » inerte.
- Les points de fidélité sont **dérivés** (`points = ⌊totalSpent / 1000⌋`, `lib/customers/loyalty.ts`), jamais dépensables. Seuil VIP : 150 points.
- `FinanceScreen` et `MarketingScreen` sont des maquettes 100 % statiques (`KPIS`/`TX`/`BREAKDOWN`, `PROMOS`/`STARS`/`DORMANT` en dur).
- `whatsappLink(phone, message?)` existe déjà dans `lib/format.ts`.

## Décisions (issues du brainstorming)

| Sujet | Décision |
|---|---|
| Modes de paiement | Détailler : Espèces, Orange Money, Wave, Moov Money, MTN MoMo, Mixte. `mm` conservé pour l'historique (« Mobile Money »), retiré des choix POS |
| Périmètre promos/points | POS **et** checkout web |
| Valeur d'un point | 1 point = **50 FCFA** de remise ; quantité au choix (gérante au POS, cliente au web) |
| Config d'un code promo | Essentiel : code, remise % ou montant fixe, achat minimum optionnel, période optionnelle, réservé VIP, actif/inactif |
| Cumul | Promo d'abord, points ensuite sur le restant, plancher 0 ; points gagnés calculés sur le montant réellement payé |
| Code expiré entre soumission web et validation | La gérante peut valider **sans** la remise promo, écart affiché |
| Ticket WhatsApp | Message **texte** formaté (wa.me pré-rempli) ; image = v2 |
| Marge Finance | **Retirée en v1** (pas de prix de revient en base) ; KPIs : CA, transactions, panier moyen, remises |
| Export Finance | Retiré en v1 (YAGNI) |

## Lot 1 — Modes de paiement détaillés

### Modèle

Enum Prisma `PaymentMethod` étendu (migration additive, `ALTER TYPE ... ADD VALUE`, appliquée via le MCP Supabase comme les précédentes) :

```prisma
enum PaymentMethod {
  espece
  mm            // legacy, ventes historiques uniquement — affiché « Mobile Money »
  orange_money
  wave
  moov_money
  mtn_momo
  mixte
}
```

### Code

- `lib/validators/pos.ts` : `paymentMethod: z.enum(["espece", "orange_money", "wave", "moov_money", "mtn_momo", "mixte"])` — `mm` volontairement absent (aucune nouvelle vente générique).
- Libellés centralisés dans un module partagé (`lib/payments/labels.ts`, création du dossier `lib/payments` prévu par CLAUDE.md §7) : `espece → Espèces`, `mm → Mobile Money`, `orange_money → Orange Money`, `wave → Wave`, `moov_money → Moov Money`, `mtn_momo → MTN MoMo`, `mixte → Mixte`. Consommé par PosScreen, TicketModal, OrdersScreen, FinanceScreen.
- `PosScreen` : la rangée de 3 chips devient une grille de 6 chips (2 rangées de 3, mêmes styles/icônes ; icône `mobileMoney` réutilisée pour les 4 portefeuilles).

## Lot 2 — Ticket de caisse WhatsApp

### Générateur pur

`lib/pos/ticketMessage.ts` — `buildTicketMessage(input): string`, testé unitairement :

```
🧾 *Foulard Teranga* — Reçu de caisse
Réf : #TER-1042 · 20/07/2026 14:32

• Foulard tissé main × 2 — 24 000 FCFA
• Turban wax × 1 — 8 500 FCFA

Sous-total : 32 500 FCFA
Code promo TERANGA10 : −3 250 FCFA
Points utilisés (20) : −1 000 FCFA
*Total payé : 28 250 FCFA* (Wave)

⭐ Points gagnés : 28 · Nouveau solde : 96
Merci de votre visite ! 🧡
```

Les lignes remises/points n'apparaissent que si non nulles ; le bloc points seulement si une cliente est rattachée. Nom de boutique et téléphone viennent du tenant.

### Câblage

- L'état `ticket` de `useBackoffice` est enrichi : lignes (nom, qté, total ligne), remises, points gagnés/nouveau solde, téléphone de la cliente rattachée (ou `null`). `encaisserVente` retourne les champs nécessaires (il a déjà tout sous la main dans la transaction).
- `TicketModal` : bouton « Envoyer sur WhatsApp » (à côté d'« Imprimer », qui déclenche désormais `window.print()` au lieu de fermer — correctif au passage). Lien : `whatsappLink(phone, message)` si téléphone connu, sinon `https://wa.me/?text=...` (WhatsApp ouvre le choix du contact) — petit helper ajouté à `lib/format.ts`.

## Lot 3 — Codes promo & points dépensables

### Modèle

```prisma
enum PromoKind {
  percent
  amount
}

model PromoCode {
  id        String    @id @default(cuid())
  tenantId  String
  code      String            // stocké en MAJUSCULES, normalisé à la saisie
  kind      PromoKind
  value     Int               // % (1-100) si percent, FCFA si amount
  minTotal  Int?              // achat minimum en FCFA
  startsAt  DateTime?
  endsAt    DateTime?
  vipOnly   Boolean   @default(false)
  active    Boolean   @default(true)
  usedCount Int       @default(0)
  createdAt DateTime  @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, code])
  @@index([tenantId])
}
```

RLS activée : lecture/écriture réservées aux rôles dashboard (owner/staff) du tenant ; **aucun accès anon/customer** (la validation d'un code au checkout passe par une Server Action Prisma, jamais par PostgREST). Vérification `get_advisors` après migration.

`Order` gagne quatre colonnes (défauts 0/null, migration additive) :

```prisma
promoCode      String?   // copie texte du code appliqué (historique stable)
promoDiscount  Int       @default(0)   // FCFA
pointsUsed     Int       @default(0)   // nb de points débités
pointsDiscount Int       @default(0)   // FCFA (= pointsUsed × 50 au taux du moment)
```

**`Order.total` garde son sens : montant réellement payé** (sous-total lignes − remises, plancher 0). Le sous-total reste dérivable de `lines`.

### Points : de dérivés à solde réel

- `Customer.points` devient un **solde** (gagné − dépensé). État initial : les valeurs actuelles (aucun point encore dépensé → aucune migration de données).
- `lib/customers/loyalty.ts` révisé :
  - `POINT_VALUE_FCFA = 50` (nouvelle constante métier, non éditable en v1).
  - Gain par vente : `⌊montant payé / 1000⌋`, **crédité** au solde (plus de recalcul global).
  - **VIP/segment découplés du solde** : VIP si `totalSpent ≥ 150 000` FCFA (équivalent exact du seuil actuel de 150 points « à vie ») ; dépenser ses points ne fait jamais perdre le statut. `computeLoyalty` est adapté en conséquence ; `applyLoyaltyOrder` crédite le gain et met à jour segment/VIP depuis `totalSpent`.

### Moteur de remises (pur, partagé, testé)

`lib/discounts/` :

- `validatePromo(promo, { now, subtotal, isVip }) → { ok: true } | { ok: false; reason }` — raisons FR : « Code inconnu ou inactif », « Code expiré », « Code pas encore actif », « Achat minimum de X FCFA non atteint », « Réservé aux clientes VIP ».
- `applyDiscounts({ subtotal, promo?, pointsRequested, pointsBalance }) → { promoDiscount, pointsUsed, pointsDiscount, total }` — promo d'abord (percent arrondi au FCFA, amount plafonné au sous-total), points ensuite **plafonnés** à la fois au solde et au restant à payer (total jamais négatif, aucun point gâché).

### Flux POS (`encaisserVente` étendu)

Champs d'entrée ajoutés au validator : `promoCode?` (string) et `pointsRequested?` (int ≥ 0, seulement si `customerId` présent). Dans la transaction Serializable existante :

1. lookup du code (par `tenantId` + code normalisé) → `validatePromo` (contexte VIP de la cliente rattachée) ; code invalide = erreur bloquante FR (la gérante corrige avant d'encaisser) ;
2. `applyDiscounts` → montants ; `pointsUsed` débité du solde de la cliente ; `usedCount` du code incrémenté ;
3. `applyLoyaltyOrder` crédite les points gagnés **sur le montant payé** ;
4. l'ordre est créé avec les 4 nouvelles colonnes renseignées.

### Flux web

- **Checkout** : champ « Code promo » (toutes) ; section « Utiliser mes points » (cliente connectée uniquement, solde affiché, saisie via `NumericField` avec max pré-calculé). Une Server Action de prévisualisation (`previewDiscount`) valide le code et renvoie les montants pour affichage — lecture seule.
- **`submitWebOrder`** : enregistre l'**intention** (code + points demandés + montants prévisualisés dans les 4 colonnes) mais **ne débite rien** : ni points, ni compteur promo, ni stock. Les points demandés sont plafonnés au solde du moment pour l'affichage.
- **`confirmOrder`** (transaction Serializable existante) : **re-valide** le code (actif/période/minimum/VIP au moment de la validation) et **re-plafonne** les points au solde courant ; recalcule les montants définitifs, débite points + stock + incrémente `usedCount`, crédite les points gagnés. Si le code n'est plus valide, la commande reste validable **sans** la remise promo ; l'écran Commandes affiche l'écart (total demandé vs total final) avant le clic.
- **`rejectOrder`** : inchangé — ne touche à rien.

### UI Marketing (partie promos, même lot)

La carte « Promotions » devient réelle : liste des codes du tenant (code, description dérivée, période, `usedCount`, badge actif/inactif), toggle actif/inactif en un clic, bouton « Créer un code » ouvrant un drawer (patterns de formulaire de l'inventaire : champs texte, `NumericField` pour valeur/minimum, dates natives). Server Actions `lib/marketing/actions.ts` : `createPromoCode`, `setPromoCodeActive` — `requireZone("dashboard")` + Zod (`lib/validators/promo.ts`), résultats typés FR.

## Lot 4 — Finance & Marketing sur données réelles

### Lectures serveur

`lib/data/finance.server.ts` (même pattern de scission que `catalog.server.ts`) :

- `getFinanceSnapshot()` — **KPIs du jour** (fuseau boutique) : CA encaissé, nombre de transactions, panier moyen, total des remises accordées ; **ventilation 30 jours** par mode de paiement (montant + %) ; **journal** : commandes des 30 derniers jours (plafond 50) — réf, date/heure, canal, mode, total.
- Comptent comme CA : POS `livree` + web `confirmee`/`preparation`/`livree`. Exclues : `nouvelle`, `refusee`. Les commandes web comptées mais sans `paymentMethod` apparaissent dans la ventilation sous « À encaisser ».

`lib/data/marketing.server.ts` :

- `getProductSalesStats()` — sur 30 jours : **stars** = top 4 par quantité vendue (jointure `OrderLine` × commandes comptées comme CA), avec CA réel par produit ; **dormants** = produits en stock sans aucune vente, triés par ancienneté de dernière vente (jamais vendus = depuis `createdAt`).
- `getPromoCodes()` — liste pour la carte Promotions (lot 3).

### Écrans

- `app/(dashboard)/finance/page.tsx` et `marketing/page.tsx` deviennent des Server Components qui fetchent et passent en props (pattern existant). `FinanceScreen`/`MarketingScreen` perdent leurs constantes mockées ; mise en page conservée.
- KPI « Marge brute »/« Taux de marge » remplacés par « Panier moyen » et « Remises accordées ». Bouton « Export » retiré.
- Les vignettes produit réutilisent la miniature image (repli dégradé) comme ailleurs.

## Erreurs, sécurité, tests

- Résultats typés `{ ok } | { ok: false; error }` FR partout (pattern existant) ; aucune confiance au client : codes, points et totaux toujours recalculés serveur.
- Nouvelle table → migration + RLS + vérification `get_advisors` (convention projet).
- Vitest : `ticketMessage` (remises présentes/absentes, cliente ou non), moteur `validatePromo`/`applyDiscounts` (tous plafonds, cumul, arrondis percent, plancher 0), `computeLoyalty` révisé (solde, VIP par `totalSpent`), validators `promo`/`pos` étendus, agrégations pures de finance si extraites.
- Chaque lot : `npm run test` + `npm run typecheck` + `npx next build --webpack` verts avant merge.

## Hors périmètre (explicitement)

- Édition/suppression d'un code promo existant (v1 : créer + activer/désactiver).
- Limites d'usage par cliente ou totales sur un code.
- Ticket image (v2), impression thermique.
- Prix de revient / marge.
- Taux de points éditable par la gérante.
