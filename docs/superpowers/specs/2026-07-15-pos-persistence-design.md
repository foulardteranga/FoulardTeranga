# Spec — Persistance des ventes POS (« Encaisser »)

> Date : 2026-07-15 · Portée : rendre `encaisser()` réel (écriture Postgres, déduction de stock, fidélité) pour les ventes au comptoir. Explicitement identifié comme hors périmètre par `docs/superpowers/specs/2026-07-14-orders-workflow-design.md` (§2 : « sa vraie intégration commande… est un sous-projet futur distinct, correctement dimensionné ») — ce document est ce sous-projet.

## 1. Contexte

`components/dashboard/screens/PosScreen.tsx` / `lib/store/useBackoffice.ts` gèrent aujourd'hui un panier, un mode de paiement et une remise ligne par ligne, entièrement en mémoire côté client. `encaisser()` :
- si en ligne : construit un objet `ticket` éphémère (nombre d'articles, mode de paiement, total formaté) affiché dans une modale, vide le panier — **aucune écriture en base**, aucune déduction de stock, rien ne survit à un rechargement ;
- si hors-ligne (bascule démo dans la Sidebar) : incrémente un compteur `queued`, vide le panier — la vente est **perdue**, pas mise en file malgré le message affiché.

Aucun événement POS n'alimente `/admin/commandes`, `/admin/tableau-de-bord`, `/admin/inventaire` ni la fidélité client.

## 2. Périmètre — décisions validées

| Sujet | Décision |
|---|---|
| Modèle de données | Réutilise `Order`/`OrderLine` existants (pas de nouveau modèle « Vente ») — apparaît automatiquement dans Commandes et alimente le futur tableau de bord/finance sans travail supplémentaire. |
| Statut de la commande | `status: "livree"` dès la création — pas d'état transitoire « à valider », la vente est déjà payée et remise. Distinguée des livraisons web par `channel: "Boutique"`. |
| Paiement & remise | Nouveaux champs `Order.paymentMethod` et `OrderLine.discount` (voir §3.1) — conservés pour le reporting finance, pas seulement absorbés dans le prix final. |
| Fidélité | Une vente rattachée à une cliente existante fait gagner des points / met à jour son historique, exactement comme `confirmOrder` pour une commande web validée. |
| Mode hors-ligne réel (IndexedDB + resync) | **Hors périmètre.** Aucune infrastructure PWA/Service Worker/IndexedDB n'existe nulle part dans le projet (ni POS, ni vitrine) malgré la mention CLAUDE.md §5/§10 — la construire est un projet de fondation à part entière, qui bénéficiera aussi à la vitrine. Ce sous-projet se limite à l'encaissement connecté ; voir §2 (bouton hors-ligne) pour le comportement en attendant. |
| Bouton « mode hors-ligne » du POS | Désactive « Encaisser » avec un message honnête plutôt que le faux « mise en file » actuel — voir §3.5. Le toggle global (Sidebar) et sa bannière restent inchangés par ailleurs. |
| Vente sans cliente rattachée | Cas le plus fréquent au comptoir — valeurs par défaut sur les champs obligatoires d'`Order`, voir §3.3. |

## 3. Architecture

### 3.1 Schéma — migration Prisma

```prisma
enum PaymentMethod {
  espece
  mm
  mixte
}

model Order {
  // ... champs existants inchangés
  paymentMethod PaymentMethod?
}

model OrderLine {
  // ... champs existants inchangés
  discount Int @default(0)
}
```

`paymentMethod` est optionnel (`?`) : les commandes web existantes/futures n'en ont pas (payées au comptoir ou par accord direct, hors périmètre v1 — CLAUDE.md §4). `discount` par défaut `0` : aucune migration de données nécessaire, toutes les lignes existantes restent valides.

RLS : aucune policy nouvelle requise — `orders_update_staff`/`order_lines_*` existants couvrent déjà ces colonnes (une policy Postgres ne référence pas les colonnes individuellement).

### 3.2 Sécurité — même principe que `submitWebOrder`

Le panier client (`useBackoffice.cart`) n'est jamais la source du prix facturé. Le payload envoyé au Server Action est `{ productId, qty, discounted: boolean }[]` — **pas** de `price`/`discount` en FCFA. `encaisserVente` relit le prix courant de chaque produit en base (comme `buildOrderLines`) et calcule lui-même la remise (10 % fixe si `discounted`, arrondi — même règle que `toggleDiscount` aujourd'hui côté client, désormais recalculée côté serveur). Un panier localStorage trafiqué ne peut pas fausser le total encaissé.

### 3.3 Server Action (`lib/pos/actions.ts`, nouveau, `"use server"`)

```ts
export async function encaisserVente(input: {
  lines: Array<{ productId: string; qty: number; discounted: boolean }>;
  paymentMethod: "espece" | "mm" | "mixte";
  customerId?: string | null;
}): Promise<{ ok: true; ref: string } | { ok: false; error: string }>
```

Transaction Prisma (`Serializable`, comme `confirmOrder`) :
1. `requireZone("dashboard")` — même garde que les autres Server Actions du back-office.
2. Valide `input` (`lib/validators/pos.ts`, Zod) — panier non vide, `paymentMethod` connu.
3. Relit chaque produit par `productId`, vérifie `stock ≥ qty` agrégé (réutilise `aggregateQtyByProduct`, `lib/orders/stockCheck.ts`, inchangé) — stock insuffisant ⇒ transaction annulée, `{ok:false, error:"Stock insuffisant pour <produit>."}`.
4. Décrémente le stock de chaque produit.
5. Si `customerId` fourni : charge la cliente (valeurs **avant** mise à jour — sert de snapshot `vipAtOrder` juste en dessous), puis appelle `applyLoyaltyOrder` (§3.4) avec le total de la vente.
6. Construit `clientName`/`place`/`phone` :
   - cliente rattachée → ses valeurs réelles (chargées à l'étape 5) ;
   - sinon → `"Client comptoir"` / `"Vente en boutique"` / `""` (voir §3.6).
7. Crée `Order` (`channel: "Boutique"`, `status: "livree"`, `paymentMethod`, `vipAtOrder: customer?.vip ?? false` — statut VIP **avant** cette vente ; note : `confirmOrder` actuel ne renseigne jamais ce champ pour les commandes web, qui restent à `false` par défaut du schéma — la vente POS est donc le premier flux à le peupler correctement, sans régression puisque le champ n'était pas fiable avant —, `customerId`) + `OrderLine[]` (`discount` inclus) dans la même transaction.
8. `revalidatePath` : `/admin/commandes`, `/admin/tableau-de-bord`, `/admin/inventaire`, `/admin/clientes` (mêmes cibles que `confirmOrder`).
9. Retourne `{ok:true, ref: order.ref}`.

### 3.4 Helper partagé (`lib/customers/applyLoyaltyOrder.ts`, nouveau)

Extrait la logique aujourd'hui recopiée en dur dans `confirmOrder` (rattachement/màj cliente + `computeLoyalty`) :

```ts
export async function applyLoyaltyOrder(
  tx: PrismaTransactionClient,
  params: {
    tenantId: string;
    orderTotal: number;
    customerId?: string | null;   // connu (POS) → chargement direct
    clientName: string;           // sinon (web) → matching par téléphone normalisé
    phone: string;
    place: string;
  }
): Promise<{ customerId: string }>
```

Si `customerId` est fourni, charge directement cette cliente (chemin POS — la cliente existe déjà, sélectionnée via le picker) et ne met à jour que ses compteurs de fidélité (`ordersCount`/`totalSpent`/`points`/`vip`/`segment` via `computeLoyalty`) — `clientName`/`phone`/`place` ne sont pas réécrits, ils reflètent déjà la fiche. Sinon (`customerId` absent), reproduit le matching par téléphone normalisé de `confirmOrder` actuel (chemin web — la cliente peut ne pas encore exister) : crée la fiche si aucune correspondance, sinon la met à jour (nom/lieu compris, comme aujourd'hui). `confirmOrder` est refactoré pour appeler ce helper — comportement strictement identique, code en moins.

### 3.5 Intégration POS (`PosScreen.tsx`, `useBackoffice.ts`)

- `PayButton` devient asynchrone : construit le payload depuis `cart`/`pay`/`client.id`, appelle `encaisserVente`, gère un état `saving` (bouton désactivé, libellé « Encaissement… »).
  - Succès : `clearCart()`, `detachClient()`, ouvre le ticket (`{items, pay, total, ref}` — le `ref` réel remplace l'actuel ticket sans référence), toast succès.
  - Échec : toast d'erreur, panier **conservé** (la vendeuse ajuste la ligne en cause plutôt que de tout ressaisir).
- Quand `offline === true` : `PayButton` est désactivé, libellé remplacé par « Connexion requise » ; plus de branche `queued`/perte silencieuse.
- `useBackoffice.encaisser()` (logique 100 % locale) est retiré ; `ticket`/`closeTicket` restent (juste la source de vérité change).

### 3.6 Détail de commande (`OrdersScreen.tsx`) — conséquence mineure

Le bouton « Contacter la cliente (WhatsApp) » (déjà branché sur `whatsappLink(o.phone, …)`, cf. batch précédent) est masqué si `o.phone` est vide — cas d'une vente comptoir sans cliente rattachée, où il n'y a personne à contacter par ce biais.

## 4. Gestion d'erreur

Même contrat que `confirmOrder`/`submitWebOrder` : `encaisserVente` retourne toujours `{ok, ...}`, jamais d'exception non gérée (`try/catch` interne). Stock insuffisant, produit introuvable, ou échec `requireZone` ⇒ message clair renvoyé et affiché en toast, panier intact côté client.

## 5. Tests

- Fonction pure de calcul de remise serveur (10 % arrondi à partir du prix produit relu en base) : couverte par Vitest, même esprit que `buildOrderLines.test.ts`/`stockCheck.test.ts`.
- `applyLoyaltyOrder`/`encaisserVente` (Prisma + transaction) : non testés en isolation par Vitest — même choix que `confirmOrder` (disproportionné, nécessite une vraie DB) — vérifiés en navigateur via un parcours réel : vente avec cliente rattachée → visible dans Commandes (onglet Livrées) et dans la fiche cliente (points/historique) → stock décrémenté visible dans Inventaire ; vente sans cliente ; tentative avec stock insuffisant bloquée proprement ; toggle hors-ligne désactive bien « Encaisser ».
- `confirmOrder` : les comportements existants (idempotence, stock insuffisant, création/rattachement cliente) doivent rester inchangés après le refactor vers `applyLoyaltyOrder` — revérifiés en navigateur (pas de test Vitest préexistant à ce niveau, cf. §5 de la spec commandes).

## 6. Non-goals de ce sous-projet

- Vraie résilience hors-ligne (Service Worker, IndexedDB, resynchronisation) — projet de fondation séparé, POS et vitrine.
- Impression réelle du ticket (bouton « Imprimer » de `TicketModal` reste un no-op).
- Scanner de code-barres (bouton déjà décoratif dans le POS, inchangé).
- Écran Finance (`FinanceScreen`) — reste non branché à des données réelles, hors périmètre ici.
- Remise autre que le taux fixe 10 % actuel (pas de saisie libre d'un montant de remise).

## 7. Critères de réussite

- `npm run typecheck` propre, `npx vitest run` vert (nouveaux tests inclus).
- Parcours réel vérifié en navigateur : vente comptoir avec cliente rattachée (stock déduit, points/historique cliente mis à jour, commande visible dans `/admin/commandes` avec channel « Boutique » et statut « Livrée », paiement/remise visibles) ; vente sans cliente rattachée (valeurs par défaut correctes, bouton WhatsApp masqué) ; stock insuffisant bloqué avec message clair, panier conservé ; bouton « Encaisser » désactivé en mode hors-ligne avec message honnête.
- Aucune régression sur le parcours commande web existant (`confirmOrder` refactoré mais comportement identique).
