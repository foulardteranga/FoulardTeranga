# Design — Journal des mouvements de stock & ajustement manuel

Date : 2026-07-21
Statut : validé section par section avec la propriétaire du projet.

## Contexte

La carte « Derniers mouvements » du tiroir produit (`components/dashboard/screens/InventoryScreen.tsx`) affiche une constante `HISTORY` en dur (3 lignes fictives : « Entrée atelier +12 », « Vente boutique −3 », « Ajustement inventaire −1 »). Le même tiroir a un bouton **« Ajuster » sans aucun `onClick`** — décoratif, jamais implémenté.

Aujourd'hui le stock ne bouge que via deux chemins, tous deux dans des transactions Prisma Serializable existantes :
- `encaisserVente` (`lib/pos/actions.ts:54`) — vente comptoir, décrément immédiat.
- `confirmOrder` (`lib/orders/actions.ts:141`) — validation d'une commande web par la gérante, décrément à la validation (jamais avant, invariant central du projet).

Aucun ajustement manuel n'existe : impossible de corriger un écart d'inventaire, une casse, ou une réception d'atelier sans passer par une vente factice.

## Décisions (issues du brainstorming)

| Sujet | Décision |
|---|---|
| Périmètre | Journal (lecture) **+** ajustement manuel fonctionnel (le bouton « Ajuster » devient réel) |
| Raisons d'ajustement manuel | Réception (entrée atelier), Perte ou casse, Correction d'inventaire |
| Saisie | Écart signé (+/−) pour les trois raisons — pas de saisie de stock cible |
| Traçabilité | Chaque mouvement (vente ou ajustement) enregistre son auteur (profil dashboard) |
| Portée du journal affiché | 5 derniers mouvements par produit, tous types confondus, pas de pagination |
| Rétro-remplissage | Aucun — on journalise uniquement à partir de ce chantier (YAGNI, comme les migrations non destructives précédentes) |

## Modèle de données

Migration Prisma additive :

```prisma
enum StockMovementReason {
  vente_pos
  vente_web
  reception
  perte
  correction
}

model StockMovement {
  id        String              @id @default(cuid())
  tenantId  String
  productId String
  authorId  String              @db.Uuid   // Profile.id — jamais null, seules des sessions dashboard authentifiées écrivent du stock
  delta     Int                             // signé : +12, -3…
  reason    StockMovementReason
  note      String?                         // libre, optionnel (surtout utile pour « correction »)
  createdAt DateTime            @default(now())

  tenant  Tenant  @relation(fields: [tenantId], references: [id])
  product Product @relation(fields: [productId], references: [id])
  author  Profile @relation(fields: [authorId], references: [id])

  @@index([tenantId, productId, createdAt])
}
```

`Product`, `Tenant` et `Profile` gagnent chacun la relation inverse `stockMovements StockMovement[]`.

**RLS** : activée, lecture/écriture réservées aux rôles dashboard (owner/staff) du tenant — même forme exacte que les policies `PromoCode` du lot 3 (fonction `"current_role"()` quotée, `current_tenant_id()`, cast `::"Role"`). Vérification `get_advisors` après application : aucune nouvelle alerte.

## Instrumentation des ventes existantes

Dans `encaisserVente` et `confirmOrder`, **juste après le décrément de stock**, à l'intérieur de la même transaction Serializable : insertion d'une ligne `StockMovement` par produit décrémenté (`reason: "vente_pos"` ou `"vente_web"`, `delta: -qty` agrégé par produit — même agrégation que `aggregateQtyByProduct` déjà utilisée pour la vérification de stock). L'auteur est la session dashboard déjà vérifiée par `requireZone("dashboard")` dans ces deux actions ; un appel `getSession()` supplémentaire fournit `userId`. Aucune commande antérieure à ce chantier ne reçoit de mouvement rétroactif.

## Ajustement manuel

**Validator Zod** (`lib/validators/stockMovement.ts`) : `productId` (string), `delta` (entier non nul), `reason` (`"reception" | "perte" | "correction"`), `note` (optionnelle, ≤ 200 caractères).

**Server Action `adjustStock`** (`lib/inventory/actions.ts`, même pattern que `createProduct`/`uploadProductImage`) :
1. `requireZone("dashboard")` + Zod.
2. Transaction : relit le produit scopé au tenant (`where: { id, tenantId }`), calcule le nouveau stock, **refuse si négatif** (« Stock insuffisant pour cet ajustement — stock actuel : X. »).
3. Met à jour `Product.stock`, insère la ligne `StockMovement` (`reason` choisie, `delta`, `note`, `authorId` = session courante).
4. `revalidatePath` des écrans affichant le stock (inventaire, tableau de bord, POS).

**UI** : le bouton « Ajuster » ouvre un petit formulaire inline dans le tiroir (sélecteur de raison à 3 options, champ écart avec bascule +/− via le pavé numérique tactile existant, note optionnelle, bouton de confirmation). Erreur serveur affichée en rouge sous le formulaire, pattern déjà utilisé partout dans l'app.

## Lecture & affichage

**Lecture serveur** (`lib/data/stockMovements.server.ts`) :

```ts
export interface StockMovementView {
  date: string;         // formaté FR, même helper que orderStatus.ts
  reasonLabel: string;  // libellé FR de la raison
  delta: number;
  authorName: string;   // Profile.name
}
export async function getRecentStockMovements(productId: string, limit?: number): Promise<StockMovementView[]>;
```

Libellés FR par raison : `vente_pos` → « Vente boutique », `vente_web` → « Vente en ligne », `reception` → « Entrée atelier / Réception », `perte` → « Perte ou casse », `correction` → « Correction d'inventaire ». Jointure vers `Profile` pour le nom, scopée au tenant courant, triée par date décroissante, plafonnée à 5.

**Écran** : la constante `HISTORY` disparaît. La carte affiche `date · raison · par {auteur}` à gauche, écart signé coloré (vert positif, rouge négatif) à droite — même structure visuelle qu'aujourd'hui, l'auteur en plus. État vide FR (« Aucun mouvement enregistré ») pour un produit sans historique.

## Tests

Vitest sur le validator (`delta` non nul, raisons valides) et sur toute fonction pure extraite (libellés de raison si factorisés). Le garde-fou stock négatif est vérifié en conditions réelles (navigateur + base), cohérent avec la façon dont les autres transactions du projet ont été validées.

## Hors périmètre (explicitement)

- Rétro-remplissage des mouvements historiques.
- Pagination / historique complet au-delà des 5 derniers mouvements.
- Export CSV du journal.
- Stock tripartite (interne/sous-traitance/matériel, CLAUDE.md §2) — hors sujet, chantier à part entière.
