# Archivage & suppression des commandes — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter le spec `docs/superpowers/specs/2026-08-08-order-archive-delete-design.md` — owner et staff peuvent archiver une commande (n'importe quel statut), la restaurer, ou la supprimer définitivement une fois archivée (motif obligatoire), avec réconciliation automatique du stock et un journal d'audit immuable consultable uniquement par la gérante.

**Architecture:** Nouveau statut `archivee` sur `Order` (+ `previousStatus`/`archivedAt` pour la restauration) et nouvelle table `OrderAuditLog` sans FK vers `Order` (survit à la suppression, miroir de `PlatformAuditLog`). Trois nouvelles Server Actions dans `lib/orders/actions.ts` (`archiveOrder`, `restoreOrder`, `deleteOrderPermanently`) suivent le squelette exact des actions existantes (`rejectOrder`, `confirmOrder`) : garde d'auth → transaction Prisma → `revalidatePath`. Le stock est réconcilié via le motif `correction` déjà utilisé pour les ajustements manuels d'inventaire. L'UI réutilise le mécanisme d'onglets existant de `OrdersScreen` (nouvel onglet « Archivées ») et une nouvelle page dashboard `/admin/journal-audit`, visible uniquement pour owner.

**Tech Stack:** Next.js 16.2 (Server Actions), Prisma 7 + Supabase Postgres (DDL via MCP), Zod 4, Vitest.

## Global Constraints

- Langue produit : FR (libellés, erreurs). Code/commits : EN. TypeScript strict, jamais de `any`.
- `npm run build` (Turbopack) est **cassé** par le nom du dossier parent (é NFD) — utiliser `npx next build --webpack` pour vérifier le build. `npm run test` et `npm run typecheck` fonctionnent normalement.
- Migrations DDL appliquées au projet Supabase **via le MCP Supabase** (`apply_migration`), SQL committé sous `prisma/migrations/<timestamp>_<name>/migration.sql`, puis `npx prisma generate` localement. Toute nouvelle table → RLS + vérification `get_advisors` (aucune nouvelle alerte de sécurité attendue).
- Toute mutation de `Product.stock` reste dans une transaction Prisma `Serializable` (`isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 10000`), avec des opérations atomiques (`{ increment: … }`/`{ decrement: … }`) — convention déjà en place pour `encaisserVente`/`confirmOrder`.
- Résultats typés `{ ok: true, ... } | { ok: false; error: string }`, messages d'erreur en français, jamais d'exception non gérée.
- Owner ET staff peuvent archiver, restaurer et supprimer (définitivement, uniquement depuis l'état archivé) — pas de restriction de rôle au-delà de `requireZone("dashboard")`.
- Motif obligatoire (min 3 caractères) à la suppression définitive ; optionnel à l'archivage.
- Le journal d'audit (`/admin/journal-audit`) est réservé à owner — garde applicative dans la page **et** policy RLS `SELECT`.
- Suivant la convention déjà en place dans `lib/orders/actions.ts` (aucune des actions existantes `confirmOrder`/`rejectOrder`/`markPreparing`/`markDelivered` n'a de test Vitest unitaire — transactions Prisma non mockées dans ce fichier, vérifiées en conditions réelles), les trois nouvelles actions suivent la même règle : pas de nouveau fichier de mock Prisma dans ce plan, vérification via `execute_sql` + navigateur à la tâche finale.
- Après chaque tâche : `npm run test` et `npm run typecheck` doivent être verts.

---

### Task 1: Migration 1/2 — statut `archivee` sur `Order`

**Files:**
- Modify: `prisma/schema.prisma` (enum `OrderStatus`, model `Order`)
- Create: `prisma/migrations/20260808120000_order_archive_status/migration.sql`

**Interfaces:**
- Consumes: rien (première tâche).
- Produces : la valeur d'enum `OrderStatus.archivee` et les champs `Order.previousStatus`/`Order.archivedAt`, consommés par toutes les tâches suivantes.

⚠️ Cette tâche ajoute **uniquement** la valeur d'enum et les colonnes — pas encore la table `OrderAuditLog` ni les policies RLS qui la référencent (Task 2). Raison : `ALTER TYPE ... ADD VALUE` ne peut pas être utilisé dans la même transaction qu'une commande qui référence cette nouvelle valeur (contrainte Postgres) ; deux migrations séparées évitent le problème.

- [ ] **Step 1: Étendre `prisma/schema.prisma`**

Dans l'enum `OrderStatus`, ajouter `archivee` :

```prisma
enum OrderStatus {
  nouvelle
  confirmee
  preparation
  livree
  refusee
  archivee
}
```

Dans `model Order`, ajouter deux champs après `createdAt` :

```prisma
model Order {
  id             String         @id @default(cuid())
  tenantId       String
  ref            String         @unique @default(dbgenerated("('#TER-' || nextval('orders_ref_seq'))"))
  customerId     String?
  clientName     String
  place          String
  phone          String
  channel        OrderChannel
  paymentMethod  PaymentMethod?
  status         OrderStatus    @default(nouvelle)
  vipAtOrder     Boolean        @default(false)
  total          Int
  promoCode      String?
  promoDiscount  Int            @default(0)
  pointsUsed     Int            @default(0)
  pointsDiscount Int            @default(0)
  createdAt      DateTime       @default(now())
  previousStatus OrderStatus?
  archivedAt     DateTime?

  tenant       Tenant             @relation(fields: [tenantId], references: [id])
  customer     Customer?          @relation(fields: [customerId], references: [id])
  lines        OrderLine[]
  statusEvents OrderStatusEvent[]

  @@index([tenantId])
}
```

(Seuls `previousStatus`/`archivedAt` sont nouveaux ; le reste du model est inchangé, reproduit ici pour situer l'insertion.)

- [ ] **Step 2: Créer la migration SQL**

`prisma/migrations/20260808120000_order_archive_status/migration.sql` :

```sql
ALTER TYPE "OrderStatus" ADD VALUE 'archivee';

ALTER TABLE "Order" ADD COLUMN "previousStatus" "OrderStatus";
ALTER TABLE "Order" ADD COLUMN "archivedAt" TIMESTAMP(3);
```

- [ ] **Step 3: Appliquer via MCP et vérifier**

`mcp__supabase__apply_migration` avec `name: "order_archive_status"` et le SQL ci-dessus. Puis vérifier :

```sql
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'OrderStatus'::regtype ORDER BY enumsortorder;
-- attendu : nouvelle, confirmee, preparation, livree, refusee, archivee
SELECT column_name FROM information_schema.columns WHERE table_name = 'Order' AND column_name IN ('previousStatus', 'archivedAt');
```

- [ ] **Step 4: Régénérer et vérifier**

Run: `npx prisma generate && npm run typecheck && npm run test`
Expected: generate OK, typecheck propre, tous les tests actuels verts (aucun nouveau test dans cette tâche).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260808120000_order_archive_status
git commit -m "feat(orders): add archivee order status with previousStatus/archivedAt"
```

---

### Task 2: Migration 2/2 — `OrderAuditLog` + RLS

**Files:**
- Modify: `prisma/schema.prisma` (nouvel enum `OrderAuditAction`, nouveau model `OrderAuditLog`)
- Create: `prisma/migrations/20260808120100_order_audit_log/migration.sql`

**Interfaces:**
- Consumes: la valeur d'enum `archivee` (Task 1, doit être committée en base avant cette migration).
- Produces : le modèle Prisma `OrderAuditLog` (accessible via `prisma.orderAuditLog`/`tx.orderAuditLog`) et la policy DELETE sur `Order` — consommés par Task 5 (écriture) et Task 6 (lecture).

- [ ] **Step 1: Étendre `prisma/schema.prisma`**

Ajouter après l'enum `PlatformAction` :

```prisma
enum OrderAuditAction {
  archived
  restored
  deleted
}
```

Ajouter le model après `PlatformAuditLog` :

```prisma
/// Journal des archivages/restaurations/suppressions de commandes, réservé à
/// owner. Volontairement sans clé étrangère vers Order (miroir de
/// PlatformAuditLog ci-dessus) : la trace doit survivre à la suppression
/// définitive d'une commande, or une FK la ferait disparaître en cascade.
model OrderAuditLog {
  id              String            @id @default(cuid())
  tenantId        String
  orderRef        String
  action          OrderAuditAction
  reason          String?
  actorId         String            @db.Uuid
  actorRole       Role
  stockReconciled Boolean           @default(false)
  orderSnapshot   Json
  createdAt       DateTime          @default(now())

  @@index([tenantId, createdAt])
  @@index([orderRef])
}
```

- [ ] **Step 2: Vérifier la forme exacte des policies existantes sur `Order`**

Avant d'écrire la nouvelle policy DELETE, vérifier avec `mcp__supabase__execute_sql` la forme actuellement en base (elle a déjà divergé une fois entre migrations dans ce projet — `public.current_role()` vs `"current_role"()` bare) :

```sql
SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'Order';
```

Adapter le SQL de l'étape suivante pour imiter exactement la forme trouvée (fonctions `current_tenant_id()`/`current_role()`, avec ou sans préfixe `public.`, casts `::"Role"` ou non).

- [ ] **Step 3: Créer la migration SQL**

`prisma/migrations/20260808120100_order_audit_log/migration.sql` (forme de référence — à ajuster selon le Step 2 si elle diverge) :

```sql
CREATE TYPE "OrderAuditAction" AS ENUM ('archived', 'restored', 'deleted');

CREATE TABLE "OrderAuditLog" (
  "id"              TEXT NOT NULL,
  "tenantId"        TEXT NOT NULL,
  "orderRef"        TEXT NOT NULL,
  "action"          "OrderAuditAction" NOT NULL,
  "reason"          TEXT,
  "actorId"         UUID NOT NULL,
  "actorRole"       "Role" NOT NULL,
  "stockReconciled" BOOLEAN NOT NULL DEFAULT false,
  "orderSnapshot"   JSONB NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderAuditLog_tenantId_createdAt_idx" ON "OrderAuditLog"("tenantId", "createdAt");
CREATE INDEX "OrderAuditLog_orderRef_idx" ON "OrderAuditLog"("orderRef");

-- Lecture réservée à owner ; écriture ouverte à owner+staff (ce sont eux qui
-- déclenchent archiveOrder/restoreOrder/deleteOrderPermanently).
ALTER TABLE "OrderAuditLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_audit_log_insert_staff" ON "OrderAuditLog"
  FOR INSERT TO authenticated
  WITH CHECK ("tenantId" = current_tenant_id() AND "current_role"() = ANY (ARRAY['owner'::"Role", 'staff'::"Role"]));

CREATE POLICY "order_audit_log_select_owner" ON "OrderAuditLog"
  FOR SELECT TO authenticated
  USING ("tenantId" = current_tenant_id() AND "current_role"() = 'owner'::"Role");

-- Aujourd'hui "Order" n'a aucune policy DELETE (default-deny RLS) : la
-- suppression est actuellement bloquée pour tout le monde. Autorisée
-- uniquement pour une commande déjà archivée.
CREATE POLICY "orders_delete_staff" ON "Order"
  FOR DELETE TO authenticated
  USING (
    "tenantId" = current_tenant_id()
    AND "current_role"() = ANY (ARRAY['owner'::"Role", 'staff'::"Role"])
    AND status = 'archivee'::"OrderStatus"
  );
```

- [ ] **Step 4: Appliquer via MCP et vérifier**

`mcp__supabase__apply_migration` avec `name: "order_audit_log"` et le SQL ajusté. Puis vérifier :

```sql
SELECT relrowsecurity FROM pg_class WHERE relname = 'OrderAuditLog';   -- attendu: true
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'OrderAuditLog';  -- attendu: les 2 policies
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'Order' AND policyname = 'orders_delete_staff';  -- attendu: 1 ligne
```

Lancer `mcp__supabase__get_advisors` (type security) : aucune **nouvelle** advisory concernant `OrderAuditLog`/`Order`.

- [ ] **Step 5: Régénérer et vérifier**

Run: `npx prisma generate && npm run typecheck && npm run test`
Expected: generate OK, typecheck propre, tout vert.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260808120100_order_audit_log
git commit -m "feat(orders): OrderAuditLog model, order delete policy, audit log RLS"
```

---

### Task 3: Types & métadonnées de statut

**Files:**
- Modify: `lib/data/types.ts` (type `OrderStatus`, interface `Order`)
- Modify: `lib/data/orderStatus.ts` (`statusMeta`)
- Modify: `lib/data/orders.server.ts` (`toOrder`)
- Modify: `components/orders/OrderStatusTimeline.tsx`
- Modify: `lib/data/orderStatus.test.ts`

**Interfaces:**
- Consumes: rien de nouveau côté DB (Task 1/2 déjà appliquées).
- Produces (consommés par Tasks 5, 7) :

```ts
// lib/data/types.ts
export type OrderStatus = "nouvelle" | "confirmee" | "preparation" | "livree" | "refusee" | "archivee";
export interface Order { /* ...champs existants... */ archivedAt: string | null; }

// lib/data/orderStatus.ts
export const statusMeta: Record<OrderStatus, { label: string; bg: string; color: string; dot: string }>;
```

- [ ] **Step 1: Écrire le test (échec attendu)**

Remplacer la ligne d'import en tête de `lib/data/orderStatus.test.ts` :

```ts
import { formatOrderAgo, formatOrderDate } from "@/lib/data/orderStatus";
```

par :

```ts
import { formatOrderAgo, formatOrderDate, statusMeta } from "@/lib/data/orderStatus";
```

Ajouter à la fin du fichier :

```ts
describe("statusMeta", () => {
  it("a un badge pour le statut archivee", () => {
    expect(statusMeta.archivee.label).toBe("Archivée");
  });
});
```

Run: `npx vitest run lib/data/orderStatus.test.ts` → FAIL (`statusMeta.archivee` est `undefined`).

- [ ] **Step 2: `lib/data/types.ts` — ajouter le statut et le champ**

Remplacer :

```ts
export type OrderStatus =
  | "nouvelle"
  | "confirmee"
  | "preparation"
  | "livree"
  | "refusee";
```

par :

```ts
export type OrderStatus =
  | "nouvelle"
  | "confirmee"
  | "preparation"
  | "livree"
  | "refusee"
  | "archivee";
```

Dans `interface Order`, ajouter un champ après `promoStillValid` :

```ts
  /** false SEULEMENT pour une commande `nouvelle` dont le code ne passe plus (écart à afficher). */
  promoStillValid: boolean;
  /** Date/heure d'archivage formatée, `null` si la commande n'est pas (ou plus) archivée. */
  archivedAt: string | null;
}
```

- [ ] **Step 3: `lib/data/orderStatus.ts` — ajouter le badge**

Dans `statusMeta`, ajouter une entrée après `refusee` :

```ts
  refusee: { label: "Refusée", bg: "#F8E5E3", color: "#9c352d", dot: "#C4453B" },
  archivee: { label: "Archivée", bg: "#EDEDED", color: "#5b5b5b", dot: "#9a9a9a" },
};
```

- [ ] **Step 4: `lib/data/orders.server.ts` — mapper `archivedAt`**

Dans `toOrder()`, ajouter le champ dans l'objet retourné, juste après `promoStillValid` :

```ts
    promoStillValid: promoValidity.get(row.id) ?? true,
    archivedAt: row.archivedAt ? formatOrderDate(row.archivedAt) : null,
  };
}
```

- [ ] **Step 5: `components/orders/OrderStatusTimeline.tsx` — bannière dédiée**

Sans cette étape, une commande `archivee` afficherait la timeline standard avec **toutes** les étapes marquées « non atteintes » (`STEPS.findIndex` renvoie `-1`, aucun statut de `STEPS` ne vaut `archivee`) — trompeur. Ajouter une branche avant celle de `refusee` :

```tsx
export function OrderStatusTimeline({
  status,
  events,
  showAuthor = false,
}: {
  status: OrderStatus;
  events: OrderStatusEventView[];
  showAuthor?: boolean;
}) {
  if (status === "archivee") {
    return (
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", background: statusMeta.archivee.bg, borderRadius: 12, padding: "14px 16px" }}>
        <Icon path={ICONS.infoAlt} size={18} stroke={statusMeta.archivee.color} strokeWidth={2} style={{ flex: "none", marginTop: 1 }} />
        <div>
          <div style={{ font: `600 14.5px ${fonts.ui}`, color: statusMeta.archivee.color }}>Commande archivée</div>
          <div style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
            Restaurez-la pour reprendre son suivi, ou supprimez-la définitivement.
          </div>
        </div>
      </div>
    );
  }

  if (status === "refusee") {
```

(Le `if (status === "refusee") { ... }` existant reste inchangé juste en dessous — seule la nouvelle branche `archivee` est insérée avant.)

- [ ] **Step 6: Vérifier**

Run: `npx vitest run lib/data/orderStatus.test.ts` → PASS.
Run: `npm run typecheck && npm run test` → propre, tout vert.

- [ ] **Step 7: Commit**

```bash
git add lib/data/types.ts lib/data/orderStatus.ts lib/data/orders.server.ts components/orders/OrderStatusTimeline.tsx lib/data/orderStatus.test.ts
git commit -m "feat(orders): archivee status metadata, archivedAt mapping, dedicated timeline banner"
```

---

### Task 4: Validators — motif d'archivage/suppression (TDD)

**Files:**
- Create: `lib/validators/orderArchive.ts`
- Create: `lib/validators/orderArchive.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces (consommés par Task 5) :

```ts
export const orderArchiveSchema: ZodSchema<{ reason?: string }>;
export type OrderArchiveInput = z.infer<typeof orderArchiveSchema>;
export const orderDeleteSchema: ZodSchema<{ reason: string }>;
export type OrderDeleteInput = z.infer<typeof orderDeleteSchema>;
```

- [ ] **Step 1: Écrire les tests (échec attendu)**

`lib/validators/orderArchive.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { orderArchiveSchema, orderDeleteSchema } from "./orderArchive";

describe("orderArchiveSchema", () => {
  it("accepte l'absence de motif", () => {
    expect(orderArchiveSchema.safeParse({}).success).toBe(true);
  });

  it("accepte un motif optionnel", () => {
    expect(orderArchiveSchema.safeParse({ reason: "Doublon de saisie" }).success).toBe(true);
  });

  it("borne le motif à 200 caractères", () => {
    expect(orderArchiveSchema.safeParse({ reason: "x".repeat(201) }).success).toBe(false);
  });
});

describe("orderDeleteSchema", () => {
  it("refuse un motif absent", () => {
    expect(orderDeleteSchema.safeParse({}).success).toBe(false);
  });

  it("refuse un motif trop court", () => {
    expect(orderDeleteSchema.safeParse({ reason: "ok" }).success).toBe(false);
  });

  it("accepte un motif valide", () => {
    expect(orderDeleteSchema.safeParse({ reason: "Commande de test, doublon" }).success).toBe(true);
  });

  it("rejette un motif uniquement composé d'espaces", () => {
    expect(orderDeleteSchema.safeParse({ reason: "    " }).success).toBe(false);
  });
});
```

Run: `npx vitest run lib/validators/orderArchive.test.ts` → FAIL (module inexistant).

- [ ] **Step 2: Implémenter**

`lib/validators/orderArchive.ts` :

```ts
import { z } from "zod";

export const orderArchiveSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});
export type OrderArchiveInput = z.infer<typeof orderArchiveSchema>;

export const orderDeleteSchema = z.object({
  reason: z.string().trim().min(3, "Merci d'indiquer un motif."),
});
export type OrderDeleteInput = z.infer<typeof orderDeleteSchema>;
```

- [ ] **Step 3: Vérifier**

Run: `npx vitest run lib/validators/orderArchive.test.ts` → PASS (7/7).
Run: `npm run typecheck && npm run test` → propre, tout vert.

- [ ] **Step 4: Commit**

```bash
git add lib/validators/orderArchive.ts lib/validators/orderArchive.test.ts
git commit -m "feat(orders): validators for archive (optional reason) and delete (required reason)"
```

---

### Task 5: Server Actions — `archiveOrder`, `restoreOrder`, `deleteOrderPermanently`

**Files:**
- Create: `lib/orders/audit.ts`
- Modify: `lib/orders/actions.ts`

**Interfaces:**
- Consumes: `orderArchiveSchema`/`orderDeleteSchema` (Task 4), `statusMeta`/`OrderStatus` (Task 3, via `@/lib/generated/prisma/enums` pour le type Prisma), `aggregateQtyByProduct` (déjà importé dans `actions.ts`).
- Produces (consommés par Task 7) :

```ts
// lib/orders/actions.ts
export async function archiveOrder(ref: string, reason?: string): Promise<{ ok: true } | { ok: false; error: string }>;
export async function restoreOrder(ref: string): Promise<{ ok: true } | { ok: false; error: string }>;
export async function deleteOrderPermanently(ref: string, reason: string): Promise<{ ok: true } | { ok: false; error: string }>;
```

- [ ] **Step 1: Créer le helper d'écriture du journal**

`lib/orders/audit.ts` :

```ts
import type { Prisma } from "@/lib/generated/prisma/client";
import type { OrderAuditAction } from "@/lib/generated/prisma/enums";
import type { Role } from "@/lib/auth/session";

export interface OrderAuditEntry {
  tenantId: string;
  orderRef: string;
  action: OrderAuditAction;
  actorId: string;
  actorRole: Role;
  stockReconciled: boolean;
  reason?: string | null;
  orderSnapshot: unknown;
}

/**
 * Écrit une entrée du journal d'archivage/suppression des commandes. Toujours
 * appelé avec le client de transaction (`tx`) : "fait" et "tracé" doivent
 * rester le même événement atomique (miroir de recordPlatformAction).
 */
export async function recordOrderAuditLog(
  entry: OrderAuditEntry,
  tx: Prisma.TransactionClient
): Promise<void> {
  await tx.orderAuditLog.create({
    data: {
      tenantId: entry.tenantId,
      orderRef: entry.orderRef,
      action: entry.action,
      reason: entry.reason ?? null,
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      stockReconciled: entry.stockReconciled,
      // Retire les objets Date (non JSON-natifs) avant écriture dans la colonne Json.
      orderSnapshot: JSON.parse(JSON.stringify(entry.orderSnapshot)) as Prisma.InputJsonValue,
    },
  });
}
```

- [ ] **Step 2: Ajouter les imports dans `lib/orders/actions.ts`**

Remplacer l'import existant :

```ts
import { getOrderStatusHistory, type OrderStatusEventView } from "@/lib/data/orders.server";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory/lowStockThreshold";
```

par :

```ts
import { getOrderStatusHistory, type OrderStatusEventView } from "@/lib/data/orders.server";
import { LOW_STOCK_THRESHOLD } from "@/lib/inventory/lowStockThreshold";
import { orderArchiveSchema, orderDeleteSchema } from "@/lib/validators/orderArchive";
import { recordOrderAuditLog } from "./audit";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

/** Statuts pour lesquels confirmOrder a déjà déduit le stock (miroir de la condition dans confirmOrder). */
const STOCK_DEDUCTED_STATUSES: ReadonlyArray<OrderStatus> = ["confirmee", "preparation", "livree"];
```

- [ ] **Step 3: Implémenter `archiveOrder`**

Ajouter en fin de fichier :

```ts
/** Archive une commande (n'importe quel statut). Restaure le stock si déjà déduit. Idempotent. */
export async function archiveOrder(
  ref: string,
  reason?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const session = await getSession();
  if (!session) return { ok: false, error: "Une erreur est survenue, réessayez." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  const parsed = orderArchiveSchema.safeParse({ reason });
  if (!parsed.success) return { ok: false, error: "Informations invalides." };

  try {
    const tenant = await getCurrentTenant();
    await prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findFirst({ where: { ref, tenantId: tenant.id }, include: { lines: true } });
        if (!order) throw new Error("Commande introuvable.");
        if (order.status === "archivee") return; // idempotent : déjà archivée

        const stockReconciled = STOCK_DEDUCTED_STATUSES.includes(order.status);
        if (stockReconciled) {
          const demand = aggregateQtyByProduct(order.lines);
          for (const [productId, { qty }] of demand) {
            await tx.product.update({ where: { id: productId }, data: { stock: { increment: qty } } });
            await tx.stockMovement.create({
              data: {
                tenantId: tenant.id,
                productId,
                authorId: session.userId,
                delta: qty,
                reason: "correction",
                note: `Archivage ${order.ref}`,
              },
            });
          }
        }

        const previousStatus = order.status;
        await tx.order.update({
          where: { id: order.id },
          data: { status: "archivee", previousStatus, archivedAt: new Date() },
        });
        await tx.orderStatusEvent.create({
          data: { tenantId: tenant.id, orderId: order.id, authorId: session.userId, status: "archivee" },
        });
        await recordOrderAuditLog(
          {
            tenantId: tenant.id,
            orderRef: order.ref,
            action: "archived",
            actorId: session.userId,
            actorRole: session.role,
            stockReconciled,
            reason: parsed.data.reason,
            orderSnapshot: order,
          },
          tx
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 10000 }
    );

    revalidatePath("/admin/commandes");
    revalidatePath("/admin/inventaire");
    revalidatePath("/admin/tableau-de-bord");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    return { ok: false, error: message === "Commande introuvable." ? message : "Une erreur est survenue, réessayez." };
  }
}
```

- [ ] **Step 4: Implémenter `restoreOrder`**

```ts
/** Restaure une commande archivée à son statut précédent. Re-déduit le stock si nécessaire. Idempotent. */
export async function restoreOrder(ref: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const session = await getSession();
  if (!session) return { ok: false, error: "Une erreur est survenue, réessayez." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  try {
    const tenant = await getCurrentTenant();
    await prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findFirst({ where: { ref, tenantId: tenant.id }, include: { lines: true } });
        if (!order) throw new Error("Commande introuvable.");
        if (order.status !== "archivee" || !order.previousStatus) return; // idempotent : pas (ou plus) archivée

        const restoredStatus = order.previousStatus;
        const stockReconciled = STOCK_DEDUCTED_STATUSES.includes(restoredStatus);
        if (stockReconciled) {
          const demand = aggregateQtyByProduct(order.lines);
          for (const [productId, { qty, nameAtOrder }] of demand) {
            const product = await tx.product.findUnique({ where: { id: productId } });
            if (!product || product.stock < qty) {
              throw new Error(`Stock insuffisant pour ${nameAtOrder}.`);
            }
          }
          for (const [productId, { qty }] of demand) {
            await tx.product.update({ where: { id: productId }, data: { stock: { decrement: qty } } });
            await tx.stockMovement.create({
              data: {
                tenantId: tenant.id,
                productId,
                authorId: session.userId,
                delta: -qty,
                reason: "correction",
                note: `Restauration ${order.ref}`,
              },
            });
          }
        }

        await tx.order.update({
          where: { id: order.id },
          data: { status: restoredStatus, previousStatus: null, archivedAt: null },
        });
        await tx.orderStatusEvent.create({
          data: { tenantId: tenant.id, orderId: order.id, authorId: session.userId, status: restoredStatus },
        });
        await recordOrderAuditLog(
          {
            tenantId: tenant.id,
            orderRef: order.ref,
            action: "restored",
            actorId: session.userId,
            actorRole: session.role,
            stockReconciled,
            orderSnapshot: order,
          },
          tx
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 10000 }
    );

    revalidatePath("/admin/commandes");
    revalidatePath("/admin/inventaire");
    revalidatePath("/admin/tableau-de-bord");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const known = message === "Commande introuvable." || message.startsWith("Stock insuffisant pour ");
    return { ok: false, error: known ? message : "Une erreur est survenue, réessayez." };
  }
}
```

- [ ] **Step 5: Implémenter `deleteOrderPermanently`**

```ts
/** Supprime définitivement une commande déjà archivée. Motif obligatoire, snapshot conservé dans le journal. */
export async function deleteOrderPermanently(
  ref: string,
  reason: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const session = await getSession();
  if (!session) return { ok: false, error: "Une erreur est survenue, réessayez." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  const parsed = orderDeleteSchema.safeParse({ reason });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Informations invalides." };

  try {
    const tenant = await getCurrentTenant();
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { ref, tenantId: tenant.id }, include: { lines: true } });
      if (!order) throw new Error("Commande introuvable.");
      if (order.status !== "archivee") throw new Error("Seule une commande archivée peut être supprimée.");

      await recordOrderAuditLog(
        {
          tenantId: tenant.id,
          orderRef: order.ref,
          action: "deleted",
          actorId: session.userId,
          actorRole: session.role,
          stockReconciled: false,
          reason: parsed.data.reason,
          orderSnapshot: order,
        },
        tx
      );
      await tx.order.delete({ where: { id: order.id } });
    });

    revalidatePath("/admin/commandes");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const known =
      message === "Commande introuvable." || message === "Seule une commande archivée peut être supprimée.";
    return { ok: false, error: known ? message : "Une erreur est survenue, réessayez." };
  }
}
```

- [ ] **Step 6: Vérifier**

Run: `npm run typecheck && npm run test`
Expected: propre, tout vert (aucun nouveau test unitaire dans cette tâche — cohérent avec la convention déjà en place pour `confirmOrder`/`rejectOrder` dans ce même fichier ; vérifié en conditions réelles à la Task 9).

- [ ] **Step 7: Commit**

```bash
git add lib/orders/audit.ts lib/orders/actions.ts
git commit -m "feat(orders): archiveOrder, restoreOrder and deleteOrderPermanently server actions"
```

---

### Task 6: Lecture — journal d'audit

**Files:**
- Create: `lib/data/orderAudit.server.ts`

**Interfaces:**
- Consumes: `formatOrderDate` (`./orderStatus`, Task 3 non modifiée mais déjà exportée), `getCurrentTenant` (`@/lib/tenant`), `prisma` (`@/lib/db/client`).
- Produces (consommés par Task 8) :

```ts
export interface OrderAuditLogEntry {
  id: string;
  orderRef: string;
  action: "archived" | "restored" | "deleted";
  reason: string | null;
  actorName: string;
  date: string;
}
export async function getOrderAuditLog(): Promise<OrderAuditLogEntry[]>;
```

- [ ] **Step 1: Créer `lib/data/orderAudit.server.ts`**

```ts
import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { formatOrderDate } from "./orderStatus";
import type { OrderAuditAction } from "@/lib/generated/prisma/enums";

export interface OrderAuditLogEntry {
  id: string;
  orderRef: string;
  action: OrderAuditAction;
  reason: string | null;
  actorName: string;
  date: string;
}

/**
 * Journal complet des archivages/restaurations/suppressions du tenant
 * courant, le plus récent d'abord. Réservé à owner : le garde applicatif vit
 * dans la page appelante (`app/(dashboard)/journal-audit/page.tsx`), la RLS
 * (`order_audit_log_select_owner`) est la garde de défense en profondeur.
 * `actorId` n'a pas de FK (miroir PlatformAuditLog) : jointure manuelle par
 * lot plutôt qu'un `include` Prisma.
 */
export async function getOrderAuditLog(): Promise<OrderAuditLogEntry[]> {
  const tenant = await getCurrentTenant();
  const rows = await prisma.orderAuditLog.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
  });
  if (rows.length === 0) return [];

  const actorIds = [...new Set(rows.map((r) => r.actorId))];
  const authors = await prisma.profile.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(authors.map((a) => [a.id, a.name]));
  const now = new Date();

  return rows.map((r) => ({
    id: r.id,
    orderRef: r.orderRef,
    action: r.action,
    reason: r.reason,
    actorName: nameById.get(r.actorId) ?? "Compte supprimé",
    date: formatOrderDate(r.createdAt, now),
  }));
}
```

- [ ] **Step 2: Vérifier**

Run: `npm run typecheck && npm run test`
Expected: propre, tout vert (lecture Prisma simple, pas de nouveau test unitaire — vérifiée en conditions réelles à la Task 9, même convention que `getOrders`/`getRecentStockMovements`).

- [ ] **Step 3: Commit**

```bash
git add lib/data/orderAudit.server.ts
git commit -m "feat(orders): read the order audit log with resolved actor names"
```

---

### Task 7: UI — icônes, onglet Archivées, boutons Archiver/Restaurer/Supprimer

**Files:**
- Modify: `components/ui/Icon.tsx`
- Modify: `components/dashboard/screens/OrdersScreen.tsx`

**Interfaces:**
- Consumes: `archiveOrder`, `restoreOrder`, `deleteOrderPermanently` (Task 5, `@/lib/orders/actions`), `statusMeta.archivee`/`Order.archivedAt` (Task 3).
- Produces: rien en aval de contenu — Task 8 est indépendante (nav + nouvelle page).

- [ ] **Step 1: Ajouter les icônes `trash`/`archive`**

Dans `components/ui/Icon.tsx`, ajouter deux entrées à `ICONS` (juste avant la fermeture `} as const;`) :

```ts
  keypad: '<circle cx="6" cy="6" r="1.3"/><circle cx="12" cy="6" r="1.3"/><circle cx="18" cy="6" r="1.3"/><circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/><circle cx="6" cy="18" r="1.3"/><circle cx="12" cy="18" r="1.3"/><circle cx="18" cy="18" r="1.3"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/>',
  archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
} as const;
```

- [ ] **Step 2: Importer les nouvelles actions dans `OrdersScreen.tsx`**

Remplacer :

```ts
import {
  confirmOrder, rejectOrder, updateOrder, markPreparing, markDelivered, getOrderStatusHistoryAction,
} from "@/lib/orders/actions";
```

par :

```ts
import {
  confirmOrder, rejectOrder, updateOrder, markPreparing, markDelivered, getOrderStatusHistoryAction,
  archiveOrder, restoreOrder, deleteOrderPermanently,
} from "@/lib/orders/actions";
```

- [ ] **Step 3: Ajouter l'onglet « Archivées » et exclure `archivee` de « Toutes »**

Remplacer le tableau `FILTERS` :

```ts
const FILTERS: Array<[string, string, OrderStatus | null]> = [
  ["toValidate", "À valider", "nouvelle"],
  ["confirmee", "Confirmées", "confirmee"],
  ["preparation", "En préparation", "preparation"],
  ["livree", "Livrées", "livree"],
  ["refusee", "Refusées", "refusee"],
  ["all", "Toutes", null],
];
```

par :

```ts
const FILTERS: Array<[string, string, OrderStatus | null]> = [
  ["toValidate", "À valider", "nouvelle"],
  ["confirmee", "Confirmées", "confirmee"],
  ["preparation", "En préparation", "preparation"],
  ["livree", "Livrées", "livree"],
  ["refusee", "Refusées", "refusee"],
  ["archivees", "Archivées", "archivee"],
  ["all", "Toutes", null],
];
```

Remplacer la dérivation de la liste filtrée et du compteur :

```ts
  const cur = FILTERS.find((f) => f[0] === filter)!;
  const list = orders.filter((o) => (filter === "all" ? true : o.status === cur[2]));

  const selected: Order | undefined =
    orders.find((o) => o.id === selId) ?? list[0] ?? orders[0];

  const count = (st: OrderStatus | null) =>
    st === null ? orders.length : orders.filter((o) => o.status === st).length;
```

par :

```ts
  const cur = FILTERS.find((f) => f[0] === filter)!;
  const list = orders.filter((o) => (filter === "all" ? o.status !== "archivee" : o.status === cur[2]));

  const selected: Order | undefined =
    orders.find((o) => o.id === selId) ?? list[0] ?? orders[0];

  const count = (st: OrderStatus | null) =>
    st === null ? orders.filter((o) => o.status !== "archivee").length : orders.filter((o) => o.status === st).length;
```

Dans le rendu des onglets, remplacer :

```ts
          const on = filter === f[0];
          const c = f[0] === "all" ? orders.length : count(f[2]);
```

par :

```ts
          const on = filter === f[0];
          const c = count(f[2]);
```

(`count(null)` exclut déjà `archivee` — le cas spécial `"all"` devient inutile.)

- [ ] **Step 4: État des modales dans `OrdersScreen`**

Remplacer :

```ts
  const [editing, setEditing] = useState(false);
```

par :

```ts
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
```

- [ ] **Step 5: Brancher les nouveaux handlers sur `OrderDetail`**

Remplacer :

```tsx
            <OrderDetail
              order={selected}
              status={selected.status}
              historyVersion={historyVersion}
              onValidate={async () => {
                const result = await confirmOrder(selected.id);
                if (!result.ok) { showToast(result.error, "error"); return; }
                showToast("Commande validée — stock déduit", "success");
                setHistoryVersion((v) => v + 1);
              }}
              onRefuse={async () => {
                const result = await rejectOrder(selected.id);
                if (!result.ok) { showToast(result.error, "error"); return; }
                showToast("Commande refusée", "error");
                setHistoryVersion((v) => v + 1);
              }}
              onMarkPreparing={async () => {
                const result = await markPreparing(selected.id);
                if (!result.ok) { showToast(result.error, "error"); return; }
                showToast("Commande en préparation", "success");
                setHistoryVersion((v) => v + 1);
              }}
              onMarkDelivered={async () => {
                const result = await markDelivered(selected.id);
                if (!result.ok) { showToast(result.error, "error"); return; }
                showToast("Commande marquée livrée", "success");
                setHistoryVersion((v) => v + 1);
              }}
              onEdit={() => setEditing(true)}
            />
```

par :

```tsx
            <OrderDetail
              order={selected}
              status={selected.status}
              historyVersion={historyVersion}
              onValidate={async () => {
                const result = await confirmOrder(selected.id);
                if (!result.ok) { showToast(result.error, "error"); return; }
                showToast("Commande validée — stock déduit", "success");
                setHistoryVersion((v) => v + 1);
              }}
              onRefuse={async () => {
                const result = await rejectOrder(selected.id);
                if (!result.ok) { showToast(result.error, "error"); return; }
                showToast("Commande refusée", "error");
                setHistoryVersion((v) => v + 1);
              }}
              onMarkPreparing={async () => {
                const result = await markPreparing(selected.id);
                if (!result.ok) { showToast(result.error, "error"); return; }
                showToast("Commande en préparation", "success");
                setHistoryVersion((v) => v + 1);
              }}
              onMarkDelivered={async () => {
                const result = await markDelivered(selected.id);
                if (!result.ok) { showToast(result.error, "error"); return; }
                showToast("Commande marquée livrée", "success");
                setHistoryVersion((v) => v + 1);
              }}
              onEdit={() => setEditing(true)}
              onArchive={() => setArchiving(true)}
              onRestore={async () => {
                const result = await restoreOrder(selected.id);
                if (!result.ok) { showToast(result.error, "error"); return; }
                showToast("Commande restaurée", "success");
                setHistoryVersion((v) => v + 1);
              }}
              onDelete={() => setDeleting(true)}
            />
```

- [ ] **Step 6: Monter les nouvelles modales**

Remplacer :

```tsx
      {editing && selected && (
        <EditOrderModal
          order={selected}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
```

par :

```tsx
      {editing && selected && (
        <EditOrderModal
          order={selected}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      )}
      {archiving && selected && (
        <ArchiveOrderModal
          order={selected}
          onClose={() => setArchiving(false)}
          onArchived={() => {
            setArchiving(false);
            router.refresh();
          }}
        />
      )}
      {deleting && selected && (
        <DeleteOrderModal
          order={selected}
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            setDeleting(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Étendre les props et le header de `OrderDetail`**

Remplacer la signature :

```tsx
function OrderDetail({
  order: o,
  status,
  historyVersion,
  onValidate,
  onRefuse,
  onMarkPreparing,
  onMarkDelivered,
  onEdit,
}: {
  order: Order;
  status: OrderStatus;
  historyVersion: number;
  onValidate: () => void;
  onRefuse: () => void;
  onMarkPreparing: () => void;
  onMarkDelivered: () => void;
  onEdit: () => void;
}) {
```

par :

```tsx
function OrderDetail({
  order: o,
  status,
  historyVersion,
  onValidate,
  onRefuse,
  onMarkPreparing,
  onMarkDelivered,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: {
  order: Order;
  status: OrderStatus;
  historyVersion: number;
  onValidate: () => void;
  onRefuse: () => void;
  onMarkPreparing: () => void;
  onMarkDelivered: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
```

Remplacer le header (bloc id/date/badge) :

```tsx
      <div style={{ padding: "16px 18px", borderBottom: `1px solid ${colors.borderSoft}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 19 }}>{o.id}</div>
          <div style={{ fontSize: 12.5, color: colors.muted }}>
            {o.date} · {o.channel}
          </div>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            font: `600 12px ${fonts.ui}`,
            padding: "5px 11px",
            borderRadius: 999,
            background: meta.bg,
            color: meta.color,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 999, background: meta.dot }} />
          {meta.label}
        </span>
      </div>
```

par :

```tsx
      <div style={{ padding: "16px 18px", borderBottom: `1px solid ${colors.borderSoft}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 19 }}>{o.id}</div>
          <div style={{ fontSize: 12.5, color: colors.muted }}>
            {o.date} · {o.channel}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              font: `600 12px ${fonts.ui}`,
              padding: "5px 11px",
              borderRadius: 999,
              background: meta.bg,
              color: meta.color,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: meta.dot }} />
            {meta.label}
          </span>
          {status !== "archivee" && (
            <button
              type="button"
              onClick={onArchive}
              title="Archiver"
              style={{ width: 32, height: 32, border: `1.5px solid ${colors.borderField}`, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <Icon path={ICONS.archive} size={15} stroke={colors.muted} strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>
```

- [ ] **Step 8: Ajouter la branche `archivee` à la zone d'actions**

Remplacer le début du bloc conditionnel d'actions :

```tsx
        {actionable ? (
          <>
            <div style={{ display: "flex", gap: 9 }}>
              <button
                onClick={onRefuse}
```

par :

```tsx
        {status === "archivee" ? (
          <>
            <div style={{ fontSize: 11.5, color: colors.muted, background: colors.rowAlt, border: `1px solid ${colors.borderSoft}`, borderRadius: 8, padding: "8px 11px", marginBottom: 10 }}>
              Commande archivée{o.archivedAt ? ` le ${o.archivedAt}` : ""}.
            </div>
            <div style={{ display: "flex", gap: 9 }}>
              <button
                onClick={onRestore}
                style={{ flex: 1, height: 48, border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", color: colors.primary, font: `600 14px ${fonts.ui}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Icon path={ICONS.refresh} size={16} stroke={colors.primary} strokeWidth={1.9} />
                Restaurer
              </button>
              <button
                onClick={onDelete}
                style={{ flex: 1, height: 48, border: `1.5px solid ${colors.danger}`, borderRadius: 10, background: "#fff", color: colors.danger, font: `600 14px ${fonts.ui}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Icon path={ICONS.trash} size={16} stroke={colors.danger} strokeWidth={1.9} />
                Supprimer
              </button>
            </div>
          </>
        ) : actionable ? (
          <>
            <div style={{ display: "flex", gap: 9 }}>
              <button
                onClick={onRefuse}
```

(Le reste de la chaîne `actionable ? (...) : canPrepare ? (...) : canDeliver ? (...) : (done && (...))` reste **inchangé** — seule la nouvelle branche `status === "archivee" ? (...) :` est insérée devant `actionable ? (`.)

- [ ] **Step 9: Ajouter `ArchiveOrderModal` et `DeleteOrderModal`**

Juste après la fermeture de `EditOrderModal` (avant `const modalLabel: React.CSSProperties = {`), insérer :

```tsx
function ArchiveOrderModal({ order, onClose, onArchived }: { order: Order; onClose: () => void; onArchived: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const showToast = useBackoffice((s) => s.showToast);

  async function submit() {
    setSaving(true);
    const result = await archiveOrder(order.id, reason.trim() || undefined);
    setSaving(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    showToast("Commande archivée", "success");
    onArchived();
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(30,27,24,.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: 420, maxWidth: "92vw", padding: "22px 24px", boxShadow: "0 20px 50px rgba(30,27,24,.24)" }}
      >
        <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 18, marginBottom: 4 }}>Archiver la commande</div>
        <div style={{ fontSize: 12.5, color: colors.muted, marginBottom: 14 }}>{order.id}</div>

        <div style={{ background: colors.bgInfo, color: colors.fgInfo, borderRadius: 10, padding: "10px 13px", fontSize: 12.5, marginBottom: 14 }}>
          La commande quitte la liste active. Si du stock avait déjà été déduit, il sera restauré automatiquement. Vous pourrez la restaurer depuis l&apos;onglet « Archivées ».
        </div>

        <label style={modalLabel}>Motif (optionnel)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Raison de l'archivage…"
          style={{ ...modalField, height: 72, padding: "10px 13px", resize: "none" }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{ flex: 1, height: 46, border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", color: colors.primary, font: `600 14px ${fonts.ui}`, cursor: saving ? "default" : "pointer" }}
          >
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={saving}
            style={{ flex: 2, height: 46, border: "none", borderRadius: 10, background: colors.primary, color: "#fff", font: `600 14px ${fonts.ui}`, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Archivage…" : "Archiver"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteOrderModal({ order, onClose, onDeleted }: { order: Order; onClose: () => void; onDeleted: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const showToast = useBackoffice((s) => s.showToast);

  async function submit() {
    setSaving(true);
    const result = await deleteOrderPermanently(order.id, reason);
    setSaving(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    showToast("Commande supprimée définitivement", "success");
    onDeleted();
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(30,27,24,.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: 420, maxWidth: "92vw", padding: "22px 24px", boxShadow: "0 20px 50px rgba(30,27,24,.24)" }}
      >
        <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 18, marginBottom: 4 }}>Supprimer définitivement</div>
        <div style={{ fontSize: 12.5, color: colors.muted, marginBottom: 14 }}>{order.id}</div>

        <div style={{ background: colors.bgDanger, color: colors.fgDanger, borderRadius: 10, padding: "10px 13px", fontSize: 12.5, marginBottom: 14 }}>
          Cette action est irréversible : la commande sera définitivement supprimée.
        </div>

        <label style={modalLabel}>Motif de la suppression</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Pourquoi supprimer cette commande ?"
          style={{ ...modalField, height: 72, padding: "10px 13px", resize: "none" }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{ flex: 1, height: 46, border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", color: colors.primary, font: `600 14px ${fonts.ui}`, cursor: saving ? "default" : "pointer" }}
          >
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={saving || reason.trim().length < 3}
            style={{ flex: 2, height: 46, border: "none", borderRadius: 10, background: colors.danger, color: "#fff", font: `600 14px ${fonts.ui}`, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Suppression…" : "Supprimer définitivement"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Vérifier**

Run: `npm run typecheck && npm run test`
Expected: propre, tout vert.

Run: `npx next build --webpack`
Expected: réussit.

- [ ] **Step 11: Commit**

```bash
git add components/ui/Icon.tsx components/dashboard/screens/OrdersScreen.tsx
git commit -m "feat(orders): Archivées tab, archive/restore/delete UI with confirmation modals"
```

---

### Task 8: UI — navigation & page « Journal d'audit »

**Files:**
- Modify: `lib/nav.ts`
- Modify: `components/dashboard/Sidebar.tsx`
- Modify: `components/dashboard/MobileNav.tsx`
- Create: `components/dashboard/screens/OrderAuditLogScreen.tsx`
- Create: `app/(dashboard)/journal-audit/page.tsx`

**Interfaces:**
- Consumes: `getOrderAuditLog`, `type OrderAuditLogEntry` (Task 6, `@/lib/data/orderAudit.server`), `getSession` (`@/lib/auth`).
- Produces: rien en aval — dernière tâche de contenu du plan.

- [ ] **Step 1: `lib/nav.ts` — nouvelle entrée**

Remplacer :

```ts
  { id: "equipe", href: "/admin/equipe", label: "Équipe", short: "Équipe", icon: ICONS.personPlus },
];

/** Routes accessibles via l'onglet « Plus » sur mobile. */
export const MORE_ROUTES = ["cust", "mkt", "fin", "theme", "vitrine", "boutique", "equipe"];
```

par :

```ts
  { id: "equipe", href: "/admin/equipe", label: "Équipe", short: "Équipe", icon: ICONS.personPlus },
  { id: "audit", href: "/admin/journal-audit", label: "Journal d'audit", short: "Audit", icon: ICONS.clipboardCheck },
];

/** Routes accessibles via l'onglet « Plus » sur mobile. */
export const MORE_ROUTES = ["cust", "mkt", "fin", "theme", "vitrine", "boutique", "equipe", "audit"];
```

Remplacer :

```ts
  "/admin/equipe": ["Équipe", "Profils d'accès et employés"],
};
```

par :

```ts
  "/admin/equipe": ["Équipe", "Profils d'accès et employés"],
  "/admin/journal-audit": ["Journal d'audit", "Historique des archivages et suppressions de commandes"],
};
```

- [ ] **Step 2: `components/dashboard/Sidebar.tsx` — visibilité owner-only**

Remplacer :

```ts
  const visibleNav = NAV.filter((n) =>
    n.id === "equipe" ? session?.role === "owner" : hasModuleAccess(session, n.id)
  );
```

par :

```ts
  const visibleNav = NAV.filter((n) =>
    n.id === "equipe" || n.id === "audit" ? session?.role === "owner" : hasModuleAccess(session, n.id)
  );
```

- [ ] **Step 3: `components/dashboard/MobileNav.tsx` — même filtre**

Remplacer :

```ts
  const visibleIds = new Set(
    NAV.filter((n) => (n.id === "equipe" ? session?.role === "owner" : hasModuleAccess(session, n.id))).map(
      (n) => n.id
    )
  );
```

par :

```ts
  const visibleIds = new Set(
    NAV.filter((n) =>
      n.id === "equipe" || n.id === "audit" ? session?.role === "owner" : hasModuleAccess(session, n.id)
    ).map((n) => n.id)
  );
```

- [ ] **Step 4: Créer l'écran `OrderAuditLogScreen`**

`components/dashboard/screens/OrderAuditLogScreen.tsx` :

```tsx
"use client";

import { useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import type { OrderAuditLogEntry } from "@/lib/data/orderAudit.server";

const ACTION_META: Record<OrderAuditLogEntry["action"], { label: string; bg: string; color: string }> = {
  archived: { label: "Archivée", bg: colors.bgInfo, color: colors.fgInfo },
  restored: { label: "Restaurée", bg: colors.bgSuccess, color: colors.fgSuccess },
  deleted: { label: "Supprimée définitivement", bg: colors.bgDanger, color: colors.fgDanger },
};

const ACTION_FILTERS: Array<[string, string, OrderAuditLogEntry["action"] | null]> = [
  ["all", "Toutes", null],
  ["archived", "Archivées", "archived"],
  ["restored", "Restaurées", "restored"],
  ["deleted", "Supprimées", "deleted"],
];

export function OrderAuditLogScreen({ entries }: { entries: OrderAuditLogEntry[] }) {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = entries.filter((e) => {
    const matchesAction = actionFilter === "all" || e.action === actionFilter;
    const query = search.trim().toLowerCase();
    const matchesSearch =
      query === "" || e.orderRef.toLowerCase().includes(query) || e.actorName.toLowerCase().includes(query);
    return matchesAction && matchesSearch;
  });

  return (
    <div className="ft-pad">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {ACTION_FILTERS.map(([id, label, action]) => {
          const on = actionFilter === id;
          const c = action === null ? entries.length : entries.filter((e) => e.action === action).length;
          return (
            <button
              key={id}
              onClick={() => setActionFilter(id)}
              style={{
                height: 38,
                padding: "0 14px",
                borderRadius: 999,
                font: `600 13px ${fonts.ui}`,
                cursor: "pointer",
                border: `1.5px solid ${on ? colors.primary : colors.borderField}`,
                background: on ? colors.primary : "#fff",
                color: on ? "#fff" : colors.muted,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              {label}
              <span
                style={{
                  fontSize: 11,
                  background: on ? "rgba(255,255,255,.22)" : "#F1ECE2",
                  color: on ? "#fff" : colors.muted,
                  padding: "1px 7px",
                  borderRadius: 999,
                }}
              >
                {c}
              </span>
            </button>
          );
        })}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher par référence ou par vendeur…"
        style={{
          width: "100%",
          height: 42,
          padding: "0 13px",
          border: `1.5px solid ${colors.borderField}`,
          borderRadius: 10,
          font: `400 14px ${fonts.ui}`,
          marginBottom: 16,
        }}
      />

      {filtered.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, textAlign: "center", padding: "50px 24px", color: colors.muted }}>
          Aucune entrée pour ce filtre.
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid rgba(30,27,24,.08)", borderRadius: 14, overflow: "hidden" }}>
          {filtered.map((e) => {
            const meta = ACTION_META[e.action];
            return (
              <div
                key={e.id}
                style={{ padding: "14px 18px", borderBottom: `1px solid ${colors.faintLine}` }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{e.orderRef}</span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      font: `600 11px ${fonts.ui}`,
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: meta.bg,
                      color: meta.color,
                    }}
                  >
                    {meta.label}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: colors.muted }}>
                  {e.date} · par {e.actorName}
                </div>
                {e.reason && (
                  <div style={{ fontSize: 12.5, color: colors.ink, marginTop: 4 }}>« {e.reason} »</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Créer la page**

`app/(dashboard)/journal-audit/page.tsx` :

```tsx
import { getSession } from "@/lib/auth";
import { getOrderAuditLog } from "@/lib/data/orderAudit.server";
import { OrderAuditLogScreen } from "@/components/dashboard/screens/OrderAuditLogScreen";

export default async function JournalAuditPage() {
  const session = await getSession();
  if (session?.role !== "owner") {
    return (
      <div className="ft-pad">
        <p style={{ color: "#6B6259" }}>Réservé à la gérante.</p>
      </div>
    );
  }
  const entries = await getOrderAuditLog();
  return <OrderAuditLogScreen entries={entries} />;
}
```

(`proxy.ts` garantit déjà qu'un compte `owner`/`staff` valide est requis pour atteindre toute route `/admin/*` — ce garde local ajoute la distinction owner-only propre à cette page, en plus de la policy RLS `order_audit_log_select_owner` en défense en profondeur.)

- [ ] **Step 6: Vérifier**

Run: `npm run typecheck && npm run test`
Expected: propre, tout vert.

Run: `npx next build --webpack`
Expected: réussit, la route `/admin/journal-audit` apparaît dans la sortie.

- [ ] **Step 7: Commit**

```bash
git add lib/nav.ts components/dashboard/Sidebar.tsx components/dashboard/MobileNav.tsx components/dashboard/screens/OrderAuditLogScreen.tsx "app/(dashboard)/journal-audit/page.tsx"
git commit -m "feat(orders): owner-only Journal d'audit page and navigation entry"
```

---

### Task 9: Vérification finale

**Files:**
- Modify: `docs/superpowers/EXECUTION-STATUS.md`

**Interfaces:** aucune — clôture.

- [ ] **Step 1: Suite complète**

Run: `npm run test && npm run typecheck && npx next build --webpack`
Expected: tout vert, build réussi (route `/admin/journal-audit` listée).

- [ ] **Step 2: Vérifications en base (session owner requise pour le parcours navigateur, `execute_sql` sinon)**

Avec `mcp__supabase__execute_sql`, sur une commande de test dont le statut est `confirmee` (stock déjà déduit) :

```sql
-- Avant archivage : noter le stock courant du produit et le statut de la commande.
SELECT status, "previousStatus", "archivedAt" FROM "Order" WHERE ref = '<REF_TEST>';
SELECT stock FROM "Product" WHERE id = '<PRODUCT_ID>';
```

1. Archiver la commande (bouton ou `archiveOrder` en direct) → `status = 'archivee'`, `previousStatus = 'confirmee'`, `archivedAt` renseigné ; `Product.stock` incrémenté de la quantité ; une ligne `StockMovement` (`reason = 'correction'`, `delta > 0`) et une ligne `OrderAuditLog` (`action = 'archived'`, `stockReconciled = true`) créées.
2. Restaurer → `status = 'confirmee'`, `previousStatus`/`archivedAt` redevenus `null` ; `Product.stock` re-décrémenté au niveau initial ; nouvelle ligne `OrderAuditLog` (`action = 'restored'`).
3. Tenter une suppression sur une commande **non archivée** → refusée avec le message « Seule une commande archivée peut être supprimée. », aucune écriture.
4. Archiver à nouveau, puis supprimer avec un motif → `SELECT * FROM "Order" WHERE ref = '<REF_TEST>';` ne renvoie plus rien ; `SELECT * FROM "OrderAuditLog" WHERE "orderRef" = '<REF_TEST>' ORDER BY "createdAt" DESC LIMIT 1;` renvoie une ligne `action = 'deleted'` avec le motif et un `orderSnapshot` complet.
5. Vérifier l'isolation RLS : `SELECT count(*) FROM "OrderAuditLog";` exécuté sous un rôle `staff` (via une session applicative staff, pas `execute_sql` qui utilise un rôle privilégié) doit échouer/renvoyer 0 lignes côté application ; sous `owner`, la page `/admin/journal-audit` doit afficher les entrées.

Si aucune session owner/staff n'est disponible dans l'environnement de l'agent, consigner ces étapes pour l'utilisateur dans EXECUTION-STATUS (comme pour les chantiers précédents).

- [ ] **Step 3: Parcours navigateur (si une session est disponible)**

1. `/admin/commandes` → onglet « Archivées » vide au départ.
2. Ouvrir une commande `confirmee`, cliquer l'icône « Archiver » dans l'en-tête → modale, motif optionnel, confirmer → toast de succès, la commande disparaît de son onglet d'origine et apparaît dans « Archivées » ; stock visible incrémenté dans `/admin/inventaire`.
3. Rouvrir la commande depuis « Archivées » → bannière « Commande archivée le … », boutons Restaurer/Supprimer. Cliquer « Restaurer » → repasse dans l'onglet d'origine, stock re-décrémenté.
4. Archiver à nouveau, cliquer « Supprimer » → motif vide : bouton désactivé ; saisir un motif → confirmer → la commande disparaît de toutes les listes.
5. `/admin/journal-audit` (session owner) : les 3 entrées (archivée, restaurée, supprimée) apparaissent, filtrables par action, la recherche par référence/vendeur fonctionne.
6. Se connecter en staff (si possible) : l'entrée « Journal d'audit » n'apparaît ni dans la sidebar ni dans le menu « Plus » mobile ; naviguer directement vers `/admin/journal-audit` affiche « Réservé à la gérante. » sans lister d'entrées.

- [ ] **Step 4: Mettre à jour `EXECUTION-STATUS.md`**

Ajouter une section « Archivage & suppression des commandes (2026-08-08) » : ce qui est fait, référence au spec et au plan, tout écart constaté (notamment si le filtre « période » du journal d'audit a été simplifié en recherche texte plutôt qu'un vrai sélecteur de dates — décision documentée dans ce plan, Task 8 Step 4), et la liste des vérifications manuelles restantes le cas échéant.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/EXECUTION-STATUS.md
git commit -m "docs: record order archive/delete completion in EXECUTION-STATUS"
```
