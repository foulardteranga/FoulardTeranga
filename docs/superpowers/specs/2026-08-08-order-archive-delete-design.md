# Spec — Archivage & suppression des commandes (avec journal d'audit)

> Date : 2026-08-08 · Portée : ajouter aux commandes (`Order`) un cycle **archiver → restaurer/supprimer**, réservé à owner+staff, avec réconciliation automatique du stock et un journal d'audit **immuable, réservé à la gérante (owner)**, qui survit à la suppression définitive de la commande.

## 1. Contexte & objectif

Aujourd'hui `lib/orders/actions.ts` ne permet que de faire progresser une commande dans son cycle de vie (`nouvelle → confirmee → preparation → livree`, ou `nouvelle → refusee`) — aucune action ne permet de la retirer de la liste. La gérante veut pouvoir **nettoyer** ses commandes (erreurs de saisie, doublons, tests) sans risquer une suppression accidentelle irréversible : d'où un garde-fou en deux temps — **archiver d'abord, supprimer ensuite** — avec traçabilité complète de qui a fait quoi et pourquoi, consultable uniquement par la gérante.

Décisions validées en amont avec l'utilisateur (résumé) :

| Sujet | Décision |
|---|---|
| Qui peut archiver / supprimer | **owner et staff**, tous deux — pas de restriction supplémentaire au-delà du garde `requireZone("dashboard")` déjà utilisé par les autres actions. |
| Motif texte | **Obligatoire à la suppression définitive** (traçabilité), **optionnel à l'archivage**. |
| Stock d'une commande déjà validée (`confirmee`/`preparation`/`livree`) | **Restauré automatiquement à l'archivage**, re-déduit automatiquement à la restauration (échoue proprement si le stock n'est plus suffisant). |
| Restauration (désarchivage) | **Possible**, tant que la commande n'a pas été supprimée définitivement. |
| Statuts archivables | **N'importe lequel** (`nouvelle`, `confirmee`, `preparation`, `livree`, `refusee`). |
| Consultation du journal d'audit | **Onglet dédié « Journal d'audit », réservé à owner** — staff ne peut pas le lire (RLS + garde applicatif), même si staff peut déclencher les actions qui l'alimentent. |
| Emplacement des commandes archivées dans l'UI | **Nouvel onglet dédié « Archivées »** dans `OrdersScreen` (visible owner+staff), distinct du journal d'audit. |

## 2. Architecture

### 2.1 Schéma — `prisma/schema.prisma`

```prisma
enum OrderStatus {
  nouvelle
  confirmee
  preparation
  livree
  refusee
  archivee   // nouveau
}

enum OrderAuditAction {
  archived
  restored
  deleted
}

model Order {
  // ... champs existants inchangés ...
  previousStatus OrderStatus?   // nouveau : statut au moment de l'archivage, pour la restauration
  archivedAt     DateTime?      // nouveau
}

/// Journal des archivages/restaurations/suppressions de commandes, réservé à
/// owner. Volontairement sans clé étrangère vers Order (miroir exact de
/// PlatformAuditLog, schema.prisma L.348-359) : la trace doit survivre à la
/// suppression définitive d'une commande, or une FK la ferait disparaître en
/// cascade.
model OrderAuditLog {
  id             String            @id @default(cuid())
  tenantId       String
  orderRef       String            // ref texte, pas de FK — survit à la suppression
  action         OrderAuditAction
  reason         String?
  actorId        String            @db.Uuid
  actorRole      Role
  stockReconciled Boolean          @default(false)
  orderSnapshot  Json              // état complet de la commande + lignes au moment de l'action
  createdAt      DateTime          @default(now())

  @@index([tenantId, createdAt])
  @@index([orderRef])
}
```

`previousStatus` est nécessaire car `archivee` remplace `status` (pas un champ séparé) : sans lui, restaurer une commande ne saurait pas si elle doit redevenir `confirmee`, `preparation` ou `livree`. Ce choix mirrore le pattern `Tenant.status` + `suspendedAt`/`archivedAt` (schema.prisma L.117-119) plutôt que d'ajouter un booléen `archived` séparé — un seul champ `status` reste la source de vérité affichée partout (`statusMeta`, filtres `OrdersScreen`).

### 2.2 Sécurité — invariants appliqués dans les Server Actions

- **Réconciliation de stock atomique, dans la même transaction que le changement de statut.** À l'archivage d'une commande dont le statut ∈ `{confirmee, preparation, livree}` (donc déjà déduite par `confirmOrder`, `lib/orders/actions.ts` L.156-173), chaque `OrderLine` restaure la quantité (`Product.stock` incrémenté) et une `StockMovement(delta: +qty, reason: "correction", note: "Archivage \${ref}")` est créée — réutilise le motif `correction` déjà existant (`StockMovementReason`, schema.prisma L.60-65 ; libellé « Correction d'inventaire », `lib/data/stockMovementLabels.ts`). Sur restauration, la même quantité est re-déduite (`StockMovement(delta: -qty, reason: "correction", note: "Restauration \${ref}")`) — **si le stock courant est insuffisant, la transaction échoue entièrement** (même règle que `confirmOrder`, message « Stock insuffisant pour *produit*. »), la commande reste archivée.
- **Suppression bloquée si non archivée.** `deleteOrderPermanently` vérifie `order.status === "archivee"` avant tout ; sinon retourne une erreur métier propre (pas d'exception) — aucune suppression directe depuis un autre statut, ni côté action ni côté RLS (§2.4).
- **Le journal survit à la suppression.** `orderSnapshot` (commande + `OrderLine[]` sérialisés) et `OrderAuditLog` sont écrits **avant** le `prisma.order.delete` dans la même transaction Prisma, sur une table sans FK vers `Order` — identique au commentaire déjà présent sur `PlatformAuditLog` (schema.prisma L.344-347).
- **Motif obligatoire uniquement à la suppression.** Validé par un nouveau schéma Zod (`lib/validators/orderArchive.ts`), miroir de `orderEditSchema` : `reason: z.string().trim().min(3, "Merci d'indiquer un motif.")` pour `deleteOrderPermanently`, absent/optionnel pour `archiveOrder`.

### 2.3 Server Actions (`lib/orders/actions.ts`, ajouts)

```ts
export async function archiveOrder(
  ref: string,
  reason?: string
): Promise<{ ok: true } | { ok: false; error: string }>

export async function restoreOrder(
  ref: string
): Promise<{ ok: true } | { ok: false; error: string }>

export async function deleteOrderPermanently(
  ref: string,
  reason: string
): Promise<{ ok: true } | { ok: false; error: string }>
```

Toutes trois suivent exactement le squelette des actions existantes (`rejectOrder`, `markPreparing`) : `requireZone("dashboard")` → `getSession()` → `requireWritableSession()` → `prisma.$transaction` → `revalidatePath("/admin/commandes")`, retour `{ok, ...}` jamais d'exception non gérée (CLAUDE.md §8).

- `archiveOrder(ref, reason?)` : charge la commande + lignes, refuse si déjà `archivee` (idempotent, comme `rejectOrder` L.305) ; si `status` dans `{confirmee, preparation, livree}`, restaure le stock (§2.2) et pose `stockReconciled: true` sur le log ; fixe `previousStatus: order.status`, `status: "archivee"`, `archivedAt: now()` ; insère `OrderAuditLog(action: "archived")`.
- `restoreOrder(ref)` : refuse si `status !== "archivee"` ; la décision de re-déduire le stock est **déduite directement de `order.previousStatus`** (`∈ {confirmee, preparation, livree}` ⇒ re-déduction, `∈ {nouvelle, refusee}` ⇒ aucun mouvement de stock) — déterministe, sans relire `OrderAuditLog` ; restaure `status: order.previousStatus`, efface `previousStatus`/`archivedAt` ; insère `OrderAuditLog(action: "restored")`.
- `deleteOrderPermanently(ref, reason)` : `orderDeleteSchema.safeParse({ reason })`, refuse si `status !== "archivee"` (« Seule une commande archivée peut être supprimée. ») ; construit `orderSnapshot` depuis la commande + `OrderLine[]` + `OrderStatusEvent[]` déjà chargés ; insère `OrderAuditLog(action: "deleted")` **puis** `tx.order.delete({ where: { id: order.id } })` (cascade Prisma existante sur `OrderLine`/`OrderStatusEvent`, sans impact car déjà capturés dans le snapshot).

### 2.4 RLS — `prisma/migrations/<timestamp>_order_archive_delete/migration.sql`

```sql
alter type "OrderStatus" add value 'archivee';

create policy "orders_delete_staff" on "Order"
  for delete using (
    "tenantId" = public.current_tenant_id()
    and public.current_role() in ('owner', 'staff')
    and status = 'archivee'
  );

create table "OrderAuditLog" ( ... );  -- cf. §2.1
alter table "OrderAuditLog" enable row level security;

create policy "order_audit_log_select_owner" on "OrderAuditLog"
  for select using (
    "tenantId" = public.current_tenant_id() and public.current_role() = 'owner'
  );
```

⚠️ Note d'implémentation : `ALTER TYPE ... ADD VALUE` doit être exécuté dans une migration **séparée et antérieure** à toute migration qui référence `'archivee'` dans une policy/requête (contrainte Postgres : une valeur d'enum ajoutée ne peut pas être utilisée dans la même transaction). Prévoir donc deux migrations Prisma successives plutôt qu'une seule.

Aujourd'hui `Order` n'a **aucune policy DELETE** (`prisma/migrations/20260713120100_rls/migration.sql` L.83-98) : par défaut-deny RLS, la suppression est actuellement bloquée pour tout le monde. La nouvelle policy réplique la condition `status = 'archivee'` déjà imposée côté Server Action, en défense en profondeur (CLAUDE.md §9). Aucun INSERT policy sur `OrderAuditLog` : les écritures passent uniquement par Prisma via le pooler (rôle serveur), jamais depuis le client — miroir exact de `PlatformAuditLog` qui n'a qu'une policy `for all` réservée à `super_admin` (ici scindée en un SELECT owner-only, sans INSERT policy publique).

### 2.5 UI

- **`lib/data/orderStatus.ts`** : ajoute une entrée `archivee` à `statusMeta` (badge gris neutre, ex. `{ label: "Archivée", bg: "#EDEDED", color: "#5b5b5b", dot: "#9a9a9a" }`).
- **`components/dashboard/screens/OrdersScreen.tsx`** : ajoute une entrée à `FILTERS` (L.18-25) : `["archivees", "Archivées", "archivee"]`. C'est le mécanisme de tab existant qui devient l'« onglet dédié » — pas de nouveau composant. Le filtre `["all", "Toutes", null]` **exclut explicitement `archivee`** (`o.status !== "archivee"`) pour que l'archivage retire effectivement la commande du flux courant.
  - Sur les cartes de l'onglet **Archivées** : bouton « Restaurer » (`restoreOrder`) et bouton icône corbeille « Supprimer » (`deleteOrderPermanently`) — ce dernier ouvre une modale de confirmation avec un champ texte motif **requis** (« Cette action est irréversible. Motif de la suppression : » + textarea, bouton désactivé tant que vide).
  - Sur les cartes des autres onglets (actives) : bouton toggle/icône « Archiver » (`archiveOrder`) ouvrant une modale de confirmation simple (texte : « La commande sera archivée{stock restauré si applicable}. » + champ motif optionnel).
- **Nouvelle page `app/(dashboard)/journal-audit/page.tsx`** + **`components/dashboard/screens/OrderAuditLogScreen.tsx`** : Server Component qui appelle une nouvelle lecture `getOrderAuditLog()` (`lib/data/orderAudit.server.ts`, miroir de `getOrders`) — retourne `[]` silencieusement si l'appelant n'est pas owner (la RLS bloquerait de toute façon, mais un guard applicatif explicite évite une page vide sans explication ; message « Réservé à la gérante. » si staff accède directement à l'URL, cf. `requireZone`/rôles autorisés à étendre pour ce guard-only-owner). Liste filtrable par action (archivée/restaurée/supprimée), par vendeur (`actorId` → nom via jointure `Profile`), par période — table simple, cohérente visuellement avec `InventoryScreen`/mouvements de stock déjà existants.
- **Entrée de navigation** (`Sidebar`/`MobileNav`) : nouveau lien « Journal d'audit », **affiché uniquement si `session.role === "owner"`** (même pattern que les entrées déjà conditionnées par rôle dans ces composants).

## 3. Gestion d'erreur

Mêmes conventions que le reste de `lib/orders/actions.ts` : chaque action retourne `{ok, ...}`, jamais d'exception non gérée. Messages connus propagés tels quels (« Commande introuvable. », « Stock insuffisant pour *produit*. », « Seule une commande archivée peut être supprimée. », « Merci d'indiquer un motif. ») ; toute erreur Prisma inattendue retombe sur « Une erreur est survenue, réessayez. ».

## 4. Tests

- **Vitest** (`lib/orders/actions.test.ts` ou fichier dédié) :
  - `archiveOrder` restaure le stock correctement pour chaque statut source (`confirmee`/`preparation`/`livree`), ne touche pas au stock depuis `nouvelle`/`refusee`.
  - `restoreOrder` re-déduit le stock et échoue proprement (message clair, transaction annulée) si le stock a changé entre-temps et devient insuffisant.
  - `deleteOrderPermanently` refuse un motif vide/trop court (Zod), refuse une commande non archivée, écrit un `OrderAuditLog` avec `orderSnapshot` complet avant suppression.
  - Garde-fous : les trois actions échouent proprement pour un rôle `customer` ou une session absente (même test pattern que les actions existantes).
- **Playwright** (parcours réel) : archiver une commande `confirmee` → apparaît dans l'onglet Archivées, stock visible incrémenté dans `/admin/inventaire` ; restaurer → repasse dans son onglet d'origine, stock re-décrémenté ; tenter de supprimer sans motif → bouton désactivé/erreur inline ; supprimer avec motif → la commande disparaît de toutes les listes, l'entrée apparaît dans `/admin/journal-audit` (connecté en owner) avec le motif et le snapshot ; connecté en staff, `/admin/journal-audit` est inaccessible ou vide avec message explicite.

## 5. Non-goals de ce sous-projet

- Pas de suppression en masse (« archiver/supprimer tout ») — action commande par commande uniquement.
- Pas d'export du journal d'audit (CSV/PDF) — hors périmètre, réévaluable plus tard.
- Pas de notification temps réel à l'archivage/suppression (pas de `createNotification` dédié) — le journal d'audit owner-only suffit pour ce sous-projet ; un futur besoin de « voir en direct qu'un vendeur vient de supprimer » resterait un ajout Realtime séparé.
- Le staff ne voit **jamais** le journal d'audit, même en lecture seule — uniquement les onglets Actives/Archivées de `OrdersScreen`.

## 6. Critères de réussite

- `npm run test` vert, `npm run typecheck` propre, `npx next build --webpack` réussit.
- Migration Prisma + policy RLS appliquées ; `select`/`insert`/`update`/`delete` testés en tant que owner, staff, et customer via `execute_sql` (Supabase MCP) pour confirmer l'isolation (staff ne lit jamais `OrderAuditLog`, seule une commande `archivee` est supprimable).
- Parcours vérifié en navigateur : archiver une commande confirmée → stock restauré visible → restaurer → stock re-déduit visible → archiver à nouveau → supprimer avec motif → entrée visible dans le Journal d'audit (owner) → invisible/inaccessible pour un compte staff.
- Aucune régression sur les actions existantes (`confirmOrder`, `rejectOrder`, `markPreparing`, `markDelivered`) ni sur le filtre `["all", "Toutes", null]`, qui ne doit plus jamais inclure une commande `archivee`.
