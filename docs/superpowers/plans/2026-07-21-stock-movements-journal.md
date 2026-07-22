# Journal des mouvements de stock & ajustement manuel — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter le spec `docs/superpowers/specs/2026-07-21-stock-movements-journal-design.md` — chaque mouvement de stock (vente POS, vente web validée, ajustement manuel) est journalisé dans une nouvelle table `StockMovement` avec son auteur ; le bouton « Ajuster », aujourd'hui décoratif, devient fonctionnel ; la carte « Derniers mouvements » du tiroir produit affiche les 5 vrais mouvements du produit au lieu de la constante `HISTORY` mockée.

**Architecture:** Un modèle Prisma `StockMovement` (delta signé, raison, auteur, note optionnelle) + RLS. Les deux points d'écriture existants (`encaisserVente`, `confirmOrder`) sont instrumentés pour insérer une ligne **dans leur transaction Serializable existante**, juste après le décrément de stock — jamais l'un sans l'autre. Une nouvelle Server Action `adjustStock` gère les ajustements manuels avec le même garde-fou « jamais de stock négatif » que le reste du projet. La lecture (5 derniers mouvements, avec libellé FR et nom de l'auteur) est exposée au tiroir produit (Client Component ouvert dynamiquement, sans prop serveur) via une Server Action de lecture, sur le modèle déjà utilisé par `previewPosDiscount` dans `PosScreen.tsx`.

**Tech Stack:** Next.js 16.2 (Server Actions), Prisma 7 + Supabase Postgres (DDL via MCP), Zod 4, Vitest.

## Global Constraints

- Langue produit : FR (libellés, erreurs). Code/commits : EN. TypeScript strict, jamais de `any`.
- `npm run build` (Turbopack) est **cassé** par le nom du dossier parent (é NFD) — utiliser `npx next build --webpack` pour vérifier le build. `npm run test` et `npm run typecheck` fonctionnent normalement.
- Migrations DDL appliquées au projet Supabase **via le MCP Supabase** (`apply_migration`), SQL committé sous `prisma/migrations/<timestamp>_<name>/migration.sql`, puis `npx prisma generate` localement. Toute nouvelle table → RLS + vérification `get_advisors` (convention du projet, aucune nouvelle alerte de sécurité attendue).
- Toute mutation de `Product.stock` reste dans une transaction Prisma `Serializable` (`isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 10000`) — c'est la convention déjà en place pour `encaisserVente`/`confirmOrder`, et utilise des opérations atomiques (`{ increment: … }`/`{ decrement: … }`) plutôt qu'un `set` littéral calculé côté application.
- Résultats typés `{ ok: true, ... } | { ok: false; error: string }`, messages d'erreur en français, jamais d'exception non gérée.
- Aucun rétro-remplissage : seules les écritures de stock **postérieures** à ce chantier sont journalisées.
- Après chaque tâche : `npm run test` et `npm run typecheck` doivent être verts.

---

### Task 1: Migration — `StockMovement`, enum, RLS

**Files:**
- Modify: `prisma/schema.prisma` (nouvel enum + nouveau model + relations inverses sur `Tenant`, `Product`, `Profile`)
- Create: `prisma/migrations/20260721120000_stock_movements/migration.sql`

**Interfaces:**
- Consumes: rien (première tâche).
- Produces : le modèle Prisma `StockMovement` (champs ci-dessous) et l'enum `StockMovementReason` (`vente_pos | vente_web | reception | perte | correction`) — consommés par toutes les tâches suivantes via `tx.stockMovement` / `prisma.stockMovement`.

- [ ] **Step 1: Étendre `prisma/schema.prisma`**

Ajouter après l'enum `NotificationType` :

```prisma
enum StockMovementReason {
  vente_pos
  vente_web
  reception
  perte
  correction
}
```

Ajouter le model (après `PromoCode`) :

```prisma
model StockMovement {
  id        String              @id @default(cuid())
  tenantId  String
  productId String
  authorId  String              @db.Uuid
  delta     Int
  reason    StockMovementReason
  note      String?
  createdAt DateTime            @default(now())

  tenant  Tenant  @relation(fields: [tenantId], references: [id])
  product Product @relation(fields: [productId], references: [id])
  author  Profile @relation(fields: [authorId], references: [id])

  @@index([tenantId, productId, createdAt])
}
```

Dans `model Tenant`, ajouter à la liste des relations : `stockMovements StockMovement[]`.
Dans `model Product`, ajouter : `stockMovements StockMovement[]`.
Dans `model Profile`, ajouter : `stockMovements StockMovement[]`.

- [ ] **Step 2: Créer la migration SQL**

`prisma/migrations/20260721120000_stock_movements/migration.sql` :

```sql
CREATE TYPE "StockMovementReason" AS ENUM ('vente_pos', 'vente_web', 'reception', 'perte', 'correction');

CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "authorId" UUID NOT NULL,
  "delta" INTEGER NOT NULL,
  "reason" "StockMovementReason" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "StockMovement_tenantId_productId_createdAt_idx" ON "StockMovement"("tenantId", "productId", "createdAt");

-- RLS : lecture/écriture réservées aux rôles dashboard (owner/staff) du tenant.
-- Forme exacte alignée sur les policies "PromoCode" existantes (cf.
-- SELECT policyname, qual FROM pg_policies WHERE tablename = 'PromoCode';) —
-- "current_role"() doit être quoté (collision avec le mot réservé PostgreSQL
-- CURRENT_ROLE), sinon erreur de syntaxe 42601.
ALTER TABLE "StockMovement" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_movements_dashboard_select" ON "StockMovement"
  FOR SELECT TO authenticated
  USING ("tenantId" = current_tenant_id() AND "current_role"() = ANY (ARRAY['owner'::"Role", 'staff'::"Role"]));

CREATE POLICY "stock_movements_dashboard_all" ON "StockMovement"
  FOR ALL TO authenticated
  USING ("tenantId" = current_tenant_id() AND "current_role"() = ANY (ARRAY['owner'::"Role", 'staff'::"Role"]))
  WITH CHECK ("tenantId" = current_tenant_id() AND "current_role"() = ANY (ARRAY['owner'::"Role", 'staff'::"Role"]));
```

Avant d'appliquer : vérifier la forme exacte actuellement en base avec `mcp__supabase__execute_sql` (`SELECT policyname, qual FROM pg_policies WHERE tablename = 'PromoCode';`) et l'imiter si elle diverge du texte ci-dessus (ça a déjà bougé une fois dans ce projet).

- [ ] **Step 3: Appliquer via MCP et vérifier**

`mcp__supabase__apply_migration` avec `name: "stock_movements"` et le SQL ci-dessus. Puis vérifier :

```sql
SELECT relrowsecurity FROM pg_class WHERE relname = 'StockMovement';   -- attendu: true
SELECT policyname FROM pg_policies WHERE tablename = 'StockMovement';  -- attendu: les 2 policies
SELECT column_name FROM information_schema.columns WHERE table_name = 'StockMovement' ORDER BY 1;
```

Lancer `mcp__supabase__get_advisors` (type security) : aucune **nouvelle** advisory concernant `StockMovement` (celles préexistantes sur `current_role`/`current_tenant_id` restent, acceptées depuis le sous-projet DB 1/5).

- [ ] **Step 4: Régénérer et vérifier**

Run: `npx prisma generate && npm run typecheck && npm run test`
Expected: generate OK, typecheck propre, tous les tests actuels verts (aucun nouveau test dans cette tâche).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260721120000_stock_movements
git commit -m "feat(stock): StockMovement model, reason enum and RLS policies"
```

---

### Task 2: Libellés FR des raisons (module pur, TDD)

**Files:**
- Create: `lib/data/stockMovementLabels.ts`
- Create: `lib/data/stockMovementLabels.test.ts`

**Interfaces:**
- Consumes: le type `StockMovementReason` généré par Prisma (Task 1) — import **type-only**, aucune dépendance runtime à Prisma.
- Produces (consommés par Tasks 5, 6, 7) :

```ts
export const STOCK_MOVEMENT_REASON_LABELS: Record<StockMovementReason, string>;
```

- [ ] **Step 1: Écrire le test (échec attendu)**

`lib/data/stockMovementLabels.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { STOCK_MOVEMENT_REASON_LABELS } from "./stockMovementLabels";

describe("STOCK_MOVEMENT_REASON_LABELS", () => {
  it("a un libellé FR pour chaque raison", () => {
    expect(STOCK_MOVEMENT_REASON_LABELS.vente_pos).toBe("Vente boutique");
    expect(STOCK_MOVEMENT_REASON_LABELS.vente_web).toBe("Vente en ligne");
    expect(STOCK_MOVEMENT_REASON_LABELS.reception).toBe("Entrée atelier / Réception");
    expect(STOCK_MOVEMENT_REASON_LABELS.perte).toBe("Perte ou casse");
    expect(STOCK_MOVEMENT_REASON_LABELS.correction).toBe("Correction d'inventaire");
  });
});
```

Run: `npx vitest run lib/data/stockMovementLabels.test.ts` → FAIL (module inexistant).

- [ ] **Step 2: Implémenter**

`lib/data/stockMovementLabels.ts` :

```ts
import type { StockMovementReason } from "@/lib/generated/prisma/client";

/** Libellés FR affichés dans le journal des mouvements de stock. */
export const STOCK_MOVEMENT_REASON_LABELS: Record<StockMovementReason, string> = {
  vente_pos: "Vente boutique",
  vente_web: "Vente en ligne",
  reception: "Entrée atelier / Réception",
  perte: "Perte ou casse",
  correction: "Correction d'inventaire",
};
```

- [ ] **Step 3: Vérifier**

Run: `npx vitest run lib/data/stockMovementLabels.test.ts` → PASS (1/1).
Run: `npm run typecheck && npm run test` → propre, tout vert.

- [ ] **Step 4: Commit**

```bash
git add lib/data/stockMovementLabels.ts lib/data/stockMovementLabels.test.ts
git commit -m "feat(stock): French labels for stock movement reasons"
```

---

### Task 3: Instrumentation — vente POS (`encaisserVente`)

**Files:**
- Modify: `lib/pos/actions.ts` (import ligne 6, garde d'auth ligne 30, boucle de décrément ligne 53 — `encaisserVente` est la seule fonction exportée du fichier, aucune ambiguïté)

**Interfaces:**
- Consumes: rien de nouveau (utilise directement `tx.stockMovement.create`, Task 1).
- Produces: aucun changement d'interface publique de `encaisserVente` — même signature, même `PosTicketData`.

- [ ] **Step 1: Ajouter l'import de `getSession`**

En tête de `lib/pos/actions.ts`, remplacer :

```ts
import { requireZone } from "@/lib/auth";
```

par :

```ts
import { requireZone, getSession } from "@/lib/auth";
```

- [ ] **Step 2: Récupérer la session juste après la garde d'auth**

Juste après le bloc :

```ts
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };
```

ajouter :

```ts
  const session = await getSession();
  if (!session) return { ok: false, error: "Une erreur est survenue, réessayez." };
```

- [ ] **Step 3: Journaliser chaque décrément**

Remplacer la boucle de décrément :

```ts
      for (const [productId, { qty }] of demand) {
        await tx.product.update({ where: { id: productId }, data: { stock: { decrement: qty } } });
      }
```

par :

```ts
      for (const [productId, { qty }] of demand) {
        await tx.product.update({ where: { id: productId }, data: { stock: { decrement: qty } } });
        await tx.stockMovement.create({
          data: {
            tenantId: tenant.id,
            productId,
            authorId: session.userId,
            delta: -qty,
            reason: "vente_pos",
          },
        });
      }
```

- [ ] **Step 4: Vérifier**

Run: `npm run typecheck && npm run test`
Expected: propre, tous les tests actuels verts (pas de nouveau test unitaire ici — le garde-fou et l'insertion sont vérifiés en conditions réelles à la Task 8, comme le reste des transactions du projet).

- [ ] **Step 5: Commit**

```bash
git add lib/pos/actions.ts
git commit -m "feat(pos): log a StockMovement row for every POS sale decrement"
```

---

### Task 4: Instrumentation — validation commande web (`confirmOrder`)

**Files:**
- Modify: `lib/orders/actions.ts` (garde d'auth de `confirmOrder` à la ligne 115 — **attention**, `requireZone("dashboard")` apparaît aussi dans `updateOrder` (ligne 230) et `rejectOrder` (ligne 259) : n'éditer QUE l'occurrence de `confirmOrder`, celle juste après `export async function confirmOrder(ref: string)` à la ligne 114 ; boucle de décrément vers la ligne 141)

**Interfaces:**
- Consumes: rien de nouveau (`getSession` déjà importé dans ce fichier).
- Produces: aucun changement d'interface publique de `confirmOrder`.

- [ ] **Step 1: Récupérer la session dans `confirmOrder`**

`getSession` est déjà importé en tête du fichier (`import { requireZone, getSession } from "@/lib/auth";`). Dans `confirmOrder`, juste après :

```ts
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };
```

ajouter :

```ts
  const session = await getSession();
  if (!session) return { ok: false, error: "Une erreur est survenue, réessayez." };
```

- [ ] **Step 2: Journaliser chaque décrément**

Remplacer la boucle de décrément (qui alimente aussi `lowStock`) :

```ts
      const lowStock: Array<{ name: string; stock: number }> = [];
      for (const [productId, { qty, nameAtOrder }] of demand) {
        const updated = await tx.product.update({
          where: { id: productId },
          data: { stock: { decrement: qty } },
        });
        if (updated.stock <= LOW_STOCK_THRESHOLD) {
          lowStock.push({ name: nameAtOrder, stock: updated.stock });
        }
      }
```

par :

```ts
      const lowStock: Array<{ name: string; stock: number }> = [];
      for (const [productId, { qty, nameAtOrder }] of demand) {
        const updated = await tx.product.update({
          where: { id: productId },
          data: { stock: { decrement: qty } },
        });
        await tx.stockMovement.create({
          data: {
            tenantId: tenant.id,
            productId,
            authorId: session.userId,
            delta: -qty,
            reason: "vente_web",
          },
        });
        if (updated.stock <= LOW_STOCK_THRESHOLD) {
          lowStock.push({ name: nameAtOrder, stock: updated.stock });
        }
      }
```

Rappel (déjà vrai dans le code existant, à ne pas casser) : la garde d'idempotence `if (order.status !== "nouvelle") return { lowStock: [] };` se trouve **avant** cette boucle — une commande déjà confirmée qu'on retente n'insère donc jamais de second mouvement.

- [ ] **Step 3: Vérifier**

Run: `npm run typecheck && npm run test`
Expected: propre, tout vert.

- [ ] **Step 4: Commit**

```bash
git add lib/orders/actions.ts
git commit -m "feat(orders): log a StockMovement row for every web order confirmation decrement"
```

---

### Task 5: Ajustement manuel — validator + Server Action

**Files:**
- Create: `lib/validators/stockMovement.ts`
- Create: `lib/validators/stockMovement.test.ts`
- Modify: `lib/inventory/actions.ts`

**Interfaces:**
- Consumes: `getSession`, `requireZone` (`@/lib/auth`), `getCurrentTenant` (`@/lib/tenant`), `prisma` (`@/lib/db/client`), `Prisma` (`@/lib/generated/prisma/client`, pour `TransactionIsolationLevel`).
- Produces (consommés par Task 7) :

```ts
// lib/validators/stockMovement.ts
export const MANUAL_STOCK_REASONS: readonly ["reception", "perte", "correction"];
export const stockAdjustmentSchema: ZodSchema<{ productId: string; delta: number; reason: "reception"|"perte"|"correction"; note?: string }>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

// lib/inventory/actions.ts
export async function adjustStock(input: StockAdjustmentInput): Promise<{ ok: true } | { ok: false; error: string }>;
```

- [ ] **Step 1: Écrire les tests du validator (échec attendu)**

`lib/validators/stockMovement.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { stockAdjustmentSchema } from "./stockMovement";

describe("stockAdjustmentSchema", () => {
  it("accepte un écart positif ou négatif avec une raison manuelle valide", () => {
    expect(stockAdjustmentSchema.safeParse({ productId: "p1", delta: 12, reason: "reception" }).success).toBe(true);
    expect(stockAdjustmentSchema.safeParse({ productId: "p1", delta: -3, reason: "perte" }).success).toBe(true);
    expect(stockAdjustmentSchema.safeParse({ productId: "p1", delta: -1, reason: "correction" }).success).toBe(true);
  });

  it("refuse un écart nul", () => {
    expect(stockAdjustmentSchema.safeParse({ productId: "p1", delta: 0, reason: "correction" }).success).toBe(false);
  });

  it("refuse un delta non entier", () => {
    expect(stockAdjustmentSchema.safeParse({ productId: "p1", delta: 1.5, reason: "correction" }).success).toBe(false);
  });

  it("refuse les raisons automatiques (non sélectionnables manuellement)", () => {
    expect(stockAdjustmentSchema.safeParse({ productId: "p1", delta: 5, reason: "vente_pos" }).success).toBe(false);
    expect(stockAdjustmentSchema.safeParse({ productId: "p1", delta: 5, reason: "vente_web" }).success).toBe(false);
  });

  it("accepte une note optionnelle et la borne à 200 caractères", () => {
    expect(
      stockAdjustmentSchema.safeParse({ productId: "p1", delta: 1, reason: "correction", note: "Comptage physique" }).success
    ).toBe(true);
    expect(
      stockAdjustmentSchema.safeParse({ productId: "p1", delta: 1, reason: "correction", note: "x".repeat(201) }).success
    ).toBe(false);
  });

  it("refuse un productId vide", () => {
    expect(stockAdjustmentSchema.safeParse({ productId: "", delta: 1, reason: "correction" }).success).toBe(false);
  });
});
```

Run: `npx vitest run lib/validators/stockMovement.test.ts` → FAIL (module inexistant).

- [ ] **Step 2: Implémenter `lib/validators/stockMovement.ts`**

```ts
import { z } from "zod";

/** Raisons sélectionnables par la gérante (les raisons "vente_*" sont écrites uniquement par le système). */
export const MANUAL_STOCK_REASONS = ["reception", "perte", "correction"] as const;

export const stockAdjustmentSchema = z.object({
  productId: z.string().min(1),
  delta: z.coerce
    .number()
    .int()
    .refine((n) => n !== 0, "L'écart ne peut pas être nul."),
  reason: z.enum(MANUAL_STOCK_REASONS),
  note: z.string().trim().max(200).optional(),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
```

- [ ] **Step 3: Vérifier le validator**

Run: `npx vitest run lib/validators/stockMovement.test.ts` → PASS (6/6).

- [ ] **Step 4: Implémenter `adjustStock` dans `lib/inventory/actions.ts`**

Étendre les imports en tête de fichier :

```ts
import { prisma } from "@/lib/db/client";
import { Prisma } from "@/lib/generated/prisma/client";
import { getCurrentTenant } from "@/lib/tenant";
import { requireZone, getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { compressImage, validateImageUpload, STOREFRONT_IMAGES_BUCKET } from "@/lib/images/imageUpload";
import { productSchema, productImagesSchema, type ProductInput } from "@/lib/validators/product";
import { stockAdjustmentSchema, type StockAdjustmentInput } from "@/lib/validators/stockMovement";
```

(seuls `Prisma`, `getSession`, `stockAdjustmentSchema`/`StockAdjustmentInput` sont nouveaux ; les autres lignes existent déjà et ne changent pas).

Ajouter en fin de fichier :

```ts
/** Ajustement manuel de stock (réception, perte/casse, correction d'inventaire). */
export async function adjustStock(
  input: StockAdjustmentInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const session = await getSession();
  if (!session) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const parsed = stockAdjustmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Informations invalides." };

  try {
    const tenant = await getCurrentTenant();

    await prisma.$transaction(
      async (tx) => {
        const product = await tx.product.findFirst({
          where: { id: parsed.data.productId, tenantId: tenant.id },
        });
        if (!product) throw new Error("Produit introuvable.");

        const nextStock = product.stock + parsed.data.delta;
        if (nextStock < 0) {
          throw new Error(`Stock insuffisant pour cet ajustement — stock actuel : ${product.stock}.`);
        }

        await tx.product.update({
          where: { id: product.id },
          data: { stock: { increment: parsed.data.delta } },
        });
        await tx.stockMovement.create({
          data: {
            tenantId: tenant.id,
            productId: product.id,
            authorId: session.userId,
            delta: parsed.data.delta,
            reason: parsed.data.reason,
            note: parsed.data.note || undefined,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 10000 }
    );

    revalidatePath("/admin/inventaire");
    revalidatePath("/admin/tableau-de-bord");
    revalidatePath("/admin/pos");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const known =
      message === "Produit introuvable." || message.startsWith("Stock insuffisant pour cet ajustement");
    return { ok: false, error: known ? message : "Une erreur est survenue, réessayez." };
  }
}
```

- [ ] **Step 5: Vérifier**

Run: `npm run typecheck && npm run test`
Expected: propre, tout vert (6 nouveaux tests validator inclus).

- [ ] **Step 6: Commit**

```bash
git add lib/validators/stockMovement.ts lib/validators/stockMovement.test.ts lib/inventory/actions.ts
git commit -m "feat(inventory): adjustStock server action with negative-stock guard"
```

---

### Task 6: Lecture — 5 derniers mouvements + action de lecture pour le client

**Files:**
- Create: `lib/data/stockMovements.server.ts`
- Modify: `lib/inventory/actions.ts`

**Interfaces:**
- Consumes: `STOCK_MOVEMENT_REASON_LABELS` (Task 2), `getCurrentTenant`, `prisma`.
- Produces (consommés par Task 7) :

```ts
// lib/data/stockMovements.server.ts
export interface StockMovementView {
  id: string;
  date: string;         // formaté FR, même helper que orderStatus.ts
  reasonLabel: string;
  delta: number;
  authorName: string;
}
export async function getRecentStockMovements(productId: string, limit?: number): Promise<StockMovementView[]>;

// lib/inventory/actions.ts — nouvelle action de LECTURE (le tiroir produit est
// un Client Component ouvert dynamiquement, sans prop serveur par produit —
// même pattern que previewPosDiscount dans PosScreen.tsx)
export async function getProductStockMovements(
  productId: string
): Promise<{ ok: true; movements: StockMovementView[] } | { ok: false; error: string }>;
```

Note de conception : `StockMovementView` inclut un `id` stable (clé React) — affinement volontaire par rapport au spec, qui ne détaillait pas cette précaution ; ça évite la classe de bug « clé React non stable » déjà rencontrée sur ce projet (ticket POS, lot 2).

- [ ] **Step 1: Créer `lib/data/stockMovements.server.ts`**

```ts
import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import { formatOrderDate } from "./orderStatus";
import { STOCK_MOVEMENT_REASON_LABELS } from "./stockMovementLabels";

/** Nombre de mouvements affichés par défaut dans le tiroir produit. */
const DEFAULT_LIMIT = 5;

export interface StockMovementView {
  id: string;
  date: string;
  reasonLabel: string;
  delta: number;
  authorName: string;
}

/** Les `limit` derniers mouvements d'un produit du tenant courant, plus récents d'abord. */
export async function getRecentStockMovements(
  productId: string,
  limit: number = DEFAULT_LIMIT
): Promise<StockMovementView[]> {
  const tenant = await getCurrentTenant();
  const now = new Date();
  const rows = await prisma.stockMovement.findMany({
    where: { productId, tenantId: tenant.id },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    date: formatOrderDate(r.createdAt, now),
    reasonLabel: STOCK_MOVEMENT_REASON_LABELS[r.reason],
    delta: r.delta,
    authorName: r.author.name,
  }));
}
```

- [ ] **Step 2: Ajouter l'action de lecture dans `lib/inventory/actions.ts`**

Ajouter l'import (à côté des autres) :

```ts
import { getRecentStockMovements, type StockMovementView } from "@/lib/data/stockMovements.server";
```

Ajouter en fin de fichier :

```ts
/**
 * Lecture des mouvements de stock d'un produit, appelée depuis le tiroir
 * produit (Client Component ouvert dynamiquement — pas de prop serveur par
 * produit) : même pattern que `previewPosDiscount` dans PosScreen.tsx.
 */
export async function getProductStockMovements(
  productId: string
): Promise<{ ok: true; movements: StockMovementView[] } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  try {
    const movements = await getRecentStockMovements(productId);
    return { ok: true, movements };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}
```

- [ ] **Step 3: Vérifier**

Run: `npm run typecheck && npm run test`
Expected: propre, tout vert (aucun nouveau test unitaire — lecture Prisma simple, vérifiée en conditions réelles à la Task 8).

- [ ] **Step 4: Commit**

```bash
git add lib/data/stockMovements.server.ts lib/inventory/actions.ts
git commit -m "feat(inventory): read the 5 most recent stock movements with author and French labels"
```

---

### Task 7: UI — bouton « Ajuster » fonctionnel + journal réel

**Files:**
- Modify: `components/dashboard/screens/InventoryScreen.tsx`

**Interfaces:**
- Consumes: `adjustStock`, `getProductStockMovements` (Task 5/6, `@/lib/inventory/actions`), `type StockMovementView` (Task 6, `@/lib/data/stockMovements.server` — import type-only), `MANUAL_STOCK_REASONS` (Task 5, `@/lib/validators/stockMovement`), `NumericField` (existant), `FormField`/`textField` (existants dans ce même fichier), `colors`/`fonts` (existants), `useBackoffice` `showToast` (existant), `useRouter` (existant).
- Produces: rien en aval — dernière tâche de contenu du plan.

- [ ] **Step 1: Supprimer le mock et ajouter les imports**

Supprimer la constante en tête de fichier (lignes ~21-25) :

```ts
const HISTORY = [
  { date: "05/07", type: "Entrée atelier", qty: "+12", color: colors.fgSuccess },
  { date: "03/07", type: "Vente boutique", qty: "−3", color: colors.fgDanger },
  { date: "01/07", type: "Ajustement inventaire", qty: "−1", color: colors.fgDanger },
];
```

Étendre les imports en tête de fichier — remplacer :

```ts
import { useMemo, useState } from "react";
```

par :

```ts
import { useEffect, useMemo, useState } from "react";
```

et remplacer :

```ts
import { createProduct, updateProductImages } from "@/lib/inventory/actions";
```

par :

```ts
import { createProduct, updateProductImages, adjustStock, getProductStockMovements } from "@/lib/inventory/actions";
import type { StockMovementView } from "@/lib/data/stockMovements.server";
```

- [ ] **Step 2: État et lecture des mouvements dans `EditDrawer`**

Dans `EditDrawer` (juste après les états `photos`/`savingPhotos` existants), ajouter :

```tsx
  const [movements, setMovements] = useState<StockMovementView[]>([]);
  const [movementsVersion, setMovementsVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getProductStockMovements(p.id).then((res) => {
      if (!cancelled && res.ok) setMovements(res.movements);
    });
    return () => {
      cancelled = true;
    };
  }, [p.id, movementsVersion]);

  const [adjusting, setAdjusting] = useState(false);
  const [adjustReason, setAdjustReason] = useState<(typeof MANUAL_STOCK_REASONS)[number]>("reception");
  const [adjustSign, setAdjustSign] = useState<"+" | "-">("+");
  const [adjustQty, setAdjustQty] = useState("1");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSaving, setAdjustSaving] = useState(false);

  async function submitAdjustment() {
    setAdjustSaving(true);
    setAdjustError(null);
    const magnitude = Number(adjustQty) || 0;
    const delta = adjustSign === "+" ? magnitude : -magnitude;
    const res = await adjustStock({
      productId: p.id,
      delta,
      reason: adjustReason,
      note: adjustNote.trim() || undefined,
    });
    setAdjustSaving(false);
    if (!res.ok) {
      setAdjustError(res.error);
      return;
    }
    showToast("Stock ajusté.", "success");
    setAdjusting(false);
    setAdjustQty("1");
    setAdjustNote("");
    setMovementsVersion((v) => v + 1);
    router.refresh();
  }
```

Ajouter l'import de `MANUAL_STOCK_REASONS` en tête de fichier, à côté des autres imports de validators :

```ts
import { MANUAL_STOCK_REASONS } from "@/lib/validators/stockMovement";
```

- [ ] **Step 3: Brancher le bouton « Ajuster »**

Remplacer le bouton (actuellement sans `onClick`) :

```tsx
            <button
              style={{
                height: 44,
                border: `1.5px solid ${colors.borderField}`,
                borderRadius: 10,
                background: "#fff",
                color: colors.primary,
                font: `600 13px ${fonts.ui}`,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Icon path={ICONS.refresh} size={15} stroke={colors.primary} strokeWidth={1.9} />
              Ajuster
            </button>
```

par :

```tsx
            <button
              type="button"
              onClick={() => setAdjusting((v) => !v)}
              style={{
                height: 44,
                border: `1.5px solid ${adjusting ? colors.primary : colors.borderField}`,
                borderRadius: 10,
                background: adjusting ? colors.bgInfo : "#fff",
                color: colors.primary,
                font: `600 13px ${fonts.ui}`,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Icon path={ICONS.refresh} size={15} stroke={colors.primary} strokeWidth={1.9} />
              Ajuster
            </button>
```

(Note : les boutons « Entrée »/« Sortie » (`MoveBtn`) restent décoratifs — hors périmètre du spec approuvé, qui ne portait que sur « Ajuster ».)

- [ ] **Step 4: Insérer le formulaire d'ajustement**

Juste après le `</div>` qui ferme la grille des 3 boutons (avant le bloc `<div style={{ background: colors.ivory, ...` de la carte « Derniers mouvements »), insérer :

```tsx
          {adjusting && (
            <div style={{ border: `1px solid ${colors.borderSoft}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <FormField label="Raison">
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value as (typeof MANUAL_STOCK_REASONS)[number])}
                  style={textField}
                >
                  <option value="reception">Entrée atelier / Réception</option>
                  <option value="perte">Perte ou casse</option>
                  <option value="correction">Correction d&apos;inventaire</option>
                </select>
              </FormField>
              <FormField label="Écart">
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setAdjustSign("+")}
                    style={{
                      width: 44,
                      height: 42,
                      border: `1.5px solid ${adjustSign === "+" ? colors.success : colors.borderField}`,
                      borderRadius: 10,
                      background: adjustSign === "+" ? colors.bgSuccess : "#fff",
                      color: adjustSign === "+" ? colors.fgSuccess : colors.muted,
                      fontWeight: 700,
                      fontSize: 18,
                      cursor: "pointer",
                    }}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustSign("-")}
                    style={{
                      width: 44,
                      height: 42,
                      border: `1.5px solid ${adjustSign === "-" ? colors.danger : colors.borderField}`,
                      borderRadius: 10,
                      background: adjustSign === "-" ? colors.bgDanger : "#fff",
                      color: adjustSign === "-" ? colors.fgDanger : colors.muted,
                      fontWeight: 700,
                      fontSize: 18,
                      cursor: "pointer",
                    }}
                  >
                    −
                  </button>
                  <div style={{ flex: 1 }}>
                    <NumericField mode="integer" value={adjustQty} onChange={setAdjustQty} min={1} placeholder="1" />
                  </div>
                </div>
              </FormField>
              <FormField label="Note (optionnel)">
                <textarea
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="Précision sur ce mouvement…"
                  style={{ ...textField, height: 64, padding: "10px 13px", resize: "none" }}
                />
              </FormField>
              {adjustError && <p style={{ color: colors.danger, fontSize: 12.5, margin: "0 0 12px" }}>{adjustError}</p>}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setAdjusting(false)}
                  style={{
                    flex: 1,
                    height: 42,
                    border: `1.5px solid ${colors.borderField}`,
                    borderRadius: 10,
                    background: "#fff",
                    color: colors.primary,
                    font: `600 13px ${fonts.ui}`,
                    cursor: "pointer",
                  }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={submitAdjustment}
                  disabled={adjustSaving}
                  className="ft-primary-btn"
                  style={{
                    flex: 1,
                    height: 42,
                    border: "none",
                    borderRadius: 10,
                    background: colors.primary,
                    color: "#fff",
                    font: `600 13px ${fonts.ui}`,
                    cursor: adjustSaving ? "default" : "pointer",
                    opacity: adjustSaving ? 0.7 : 1,
                  }}
                >
                  {adjustSaving ? "Enregistrement…" : "Confirmer l'ajustement"}
                </button>
              </div>
            </div>
          )}
```

- [ ] **Step 5: Remplacer l'affichage mocké par les vrais mouvements**

Remplacer :

```tsx
            {HISTORY.map((h) => (
              <div key={h.date} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 12.5 }}>
                <span style={{ color: colors.muted }}>
                  {h.date} · {h.type}
                </span>
                <span style={{ fontWeight: 600, color: h.color }}>{h.qty}</span>
              </div>
            ))}
```

par :

```tsx
            {movements.length === 0 ? (
              <p style={{ fontSize: 12.5, color: colors.muted, margin: 0 }}>Aucun mouvement enregistré.</p>
            ) : (
              movements.map((m) => (
                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 12.5 }}>
                  <span style={{ color: colors.muted }}>
                    {m.date} · {m.reasonLabel} · par {m.authorName}
                  </span>
                  <span style={{ fontWeight: 600, color: m.delta >= 0 ? colors.fgSuccess : colors.fgDanger }}>
                    {m.delta >= 0 ? `+${m.delta}` : m.delta}
                  </span>
                </div>
              ))
            )}
```

- [ ] **Step 6: Vérifier**

Run: `npm run typecheck && npm run test`
Expected: propre, tout vert.

Run: `npx next build --webpack`
Expected: réussit (aucune fuite `next/headers` — `StockMovementView` est importé en `import type` uniquement).

- [ ] **Step 7: Commit**

```bash
git add components/dashboard/screens/InventoryScreen.tsx
git commit -m "feat(inventory): wire the Ajuster button and show real stock movements in the product drawer"
```

---

### Task 8: Vérification finale

**Files:**
- Modify: `docs/superpowers/EXECUTION-STATUS.md`

**Interfaces:** aucune — clôture.

- [ ] **Step 1: Suite complète**

Run: `npm run test && npm run typecheck && npx next build --webpack`
Expected: tout vert, build réussi (toutes les routes back-office listées).

- [ ] **Step 2: Parcours navigateur (session owner requise)**

Sur `/admin/inventaire`, ouvrir le tiroir d'un produit :
1. La carte « Derniers mouvements » affiche « Aucun mouvement enregistré. » si le produit n'a encore aucun historique post-chantier.
2. Cliquer « Ajuster » → le formulaire apparaît. Choisir « Perte ou casse », signe « − », quantité 2 → confirmer. Toast de succès, le mouvement apparaît en tête de liste avec l'auteur (nom du compte connecté) et « −2 » en rouge.
3. Rouvrir le formulaire, choisir « Entrée atelier / Réception », signe « + », quantité 5 → confirmer. Le mouvement apparaît en vert « +5 ».
4. Tenter un ajustement dont l'écart ferait passer le stock sous zéro → message rouge « Stock insuffisant pour cet ajustement — stock actuel : X. », aucune écriture.
5. Encaisser une vente POS de ce produit → vérifier en base (`SELECT reason, delta FROM "StockMovement" WHERE "productId" = '<id>' ORDER BY "createdAt" DESC LIMIT 1;`) qu'une ligne `vente_pos` a été ajoutée, puis que le tiroir (après rouvrir) l'affiche « Vente boutique ».
6. Valider une commande web de ce produit → vérifier la ligne `vente_web`.

Si aucune session owner n'est disponible dans l'environnement de l'agent, consigner ces 6 étapes pour l'utilisateur dans EXECUTION-STATUS (comme pour les chantiers précédents).

- [ ] **Step 3: Mettre à jour EXECUTION-STATUS.md**

Ajouter une section « Journal des mouvements de stock & ajustement manuel (2026-07-21) » : ce qui est fait, référence au spec, tout écart, et la liste des vérifications manuelles restantes le cas échéant. Mentionner explicitement que les boutons « Entrée »/« Sortie » (`MoveBtn`) restent décoratifs (hors périmètre de ce chantier) et que le stock tripartite (interne/sous-traitance/matériel) de la section « Stock par emplacement » reste un mock non lié à ce chantier (déjà listé hors périmètre dans le spec).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/EXECUTION-STATUS.md
git commit -m "docs: record stock movements journal completion in EXECUTION-STATUS"
```
