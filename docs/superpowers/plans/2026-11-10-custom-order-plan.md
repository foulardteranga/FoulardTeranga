# Commande personnalisée — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter le spec `docs/superpowers/specs/2026-11-10-custom-order-design.md` — un bouton « + Commande personnalisée » dans `OrdersScreen` permet d'enregistrer une demande de confection sur mesure (tissu, couleur, modèle, photo, prix, acompte, date de livraison), intégrée au même workflow de validation que les commandes catalogue, sans ligne produit ni déduction de stock.

**Architecture:** La commande personnalisée est une `Order` normale avec un flag `isCustom: true` et des champs `custom*` optionnels, **sans `OrderLine`** — les boucles de déduction/réconciliation de stock dans `confirmOrder`/`archiveOrder`/`restoreOrder` sont déjà des no-op sur un tableau de lignes vide, donc inchangées. Seul `confirmOrder` doit explicitement sauter son recalcul de remise/total (dérivé des lignes) pour ne pas écraser le prix saisi à la main. Une nouvelle Server Action `createCustomOrder` suit le squelette exact des actions existantes. L'UI ajoute une nouvelle modale (`CustomOrderModal`) qui réutilise le sélecteur de couleur et l'upload photo déjà existants pour les produits catalogue.

**Tech Stack:** Next.js 16.2 (Server Actions), Prisma 7 + Supabase Postgres (DDL via MCP), Zod 4, Vitest, React 19.2.

## Global Constraints

- Langue produit : FR (libellés, erreurs, placeholders). Code/commits : EN. TypeScript strict, jamais de `any`.
- `npm run build` (Turbopack) est **cassé** par le nom du dossier parent (é NFD) — utiliser `npx next build --webpack` pour vérifier le build. `npm run test` et `npm run typecheck` fonctionnent normalement.
- Migrations DDL appliquées au projet Supabase **via le MCP Supabase** (`mcp__supabase__apply_migration`), SQL committé sous `prisma/migrations/<timestamp>_<name>/migration.sql`, puis `npx prisma generate` localement.
- Aucune nouvelle table ni nouvelle policy RLS dans ce plan : `orders_insert_public` (`for insert with check (true)`) couvre déjà l'insertion de `Order`, `orders_select_staff`/`orders_update_staff` couvrent le reste — vérifié dans la spec §2.1.
- Résultats typés `{ ok: true, ... } | { ok: false; error: string }`, messages d'erreur en français, jamais d'exception non gérée (CLAUDE.md §8).
- `confirmOrder` ne doit **jamais** écraser `order.total` d'une commande `isCustom` — c'est le bug critique identifié dans la spec §2.2, à corriger explicitement dans Task 3.
- Suivant la convention déjà en place dans `lib/orders/actions.ts` (aucune des actions existantes `confirmOrder`/`rejectOrder`/`submitWebOrder` n'a de test Vitest couvrant ses transactions Prisma — non mockées dans ce fichier, vérifiées en conditions réelles) et dans `components/` (aucun composant `.tsx` n'a de test unitaire dans ce repo, seuls les helpers `.ts` purs en ont), ce plan suit la même règle : pas de nouveau mock Prisma, pas de test de composant React — vérification de `createCustomOrder`/`confirmOrder` et de l'UI via navigateur à la tâche finale (Task 7).
- Après chaque tâche : `npm run test` et `npm run typecheck` doivent être verts.

---

### Task 1: Migration — champs commande personnalisée sur `Order`

**Files:**
- Modify: `prisma/schema.prisma` (model `Order`)
- Create: `prisma/migrations/20261110130000_custom_order_fields/migration.sql`

**Interfaces:**
- Consumes: rien (première tâche).
- Produces: les colonnes `Order.isCustom`, `Order.customColorName`, `Order.customColorHex`, `Order.customFabricNote`, `Order.customModel`, `Order.customModelImageUrl`, `Order.customDueDate`, `Order.customDeposit`, consommées par toutes les tâches suivantes.

- [ ] **Step 1: Étendre `prisma/schema.prisma`**

Dans `model Order` (`prisma/schema.prisma` L.230-260), ajouter les nouveaux champs juste après `paymentDetails Json?` :

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
  amountReceived Int?
  changeGiven    Int?
  paymentDetails Json?
  isCustom             Boolean   @default(false)
  customColorName      String?
  customColorHex       String?
  customFabricNote     String?
  customModel          String?
  customModelImageUrl  String?
  customDueDate        DateTime?
  customDeposit        Int?

  tenant       Tenant             @relation(fields: [tenantId], references: [id])
  customer     Customer?          @relation(fields: [customerId], references: [id])
  lines        OrderLine[]
  statusEvents OrderStatusEvent[]

  @@index([tenantId])
}
```

(Seuls les 8 champs `isCustom`/`custom*` sont nouveaux ; le reste du model est inchangé, reproduit ici pour situer l'insertion.)

- [ ] **Step 2: Créer la migration SQL**

`prisma/migrations/20261110130000_custom_order_fields/migration.sql` :

```sql
-- AlterTable: Ajout des champs de commande personnalisée (sur mesure, sans produit catalogue)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "isCustom" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customColorName" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customColorHex" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customFabricNote" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customModel" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customModelImageUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customDueDate" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customDeposit" INTEGER;
```

- [ ] **Step 3: Appliquer via MCP et vérifier**

Appeler `mcp__supabase__apply_migration` avec `name: "custom_order_fields"` et le SQL ci-dessus. Puis vérifier :

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'Order' AND column_name LIKE 'custom%' OR column_name = 'isCustom'
ORDER BY column_name;
```

Expected: 8 lignes, `isCustom` en `boolean`/`NO`/`false`, les 7 autres en `NO` → non, en `YES` (nullable) sans défaut.

- [ ] **Step 4: Régénérer et vérifier**

Run: `npx prisma generate && npm run typecheck && npm run test`
Expected: generate OK, typecheck propre, tous les tests actuels verts (aucun nouveau test dans cette tâche).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261110130000_custom_order_fields
git commit -m "feat(orders): add custom order fields to Order model"
```

---

### Task 2: Validateur Zod `customOrderSchema`

**Files:**
- Create: `lib/validators/customOrder.ts`
- Create: `lib/validators/customOrder.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `customOrderSchema` (export Zod) et le type `CustomOrderInput` (= `z.input<typeof customOrderSchema>`, c'est-à-dire la forme **avant** coercion — `dueDate`/`total`/`deposit` peuvent être des chaînes, comme envoyés par un formulaire), consommés par Task 3 (server action) et Task 6 (modale UI).

- [ ] **Step 1: Écrire le test (qui échoue, le fichier source n'existe pas encore)**

`lib/validators/customOrder.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { customOrderSchema } from "./customOrder";

const base = {
  clientName: "Awa Diop",
  place: "Cocody",
  phone: "0102030405",
  total: 25000,
};

describe("customOrderSchema", () => {
  it("accepte le minimum requis (nom, lieu, téléphone, prix)", () => {
    expect(customOrderSchema.safeParse(base).success).toBe(true);
  });

  it("accepte tous les champs optionnels renseignés", () => {
    const result = customOrderSchema.safeParse({
      ...base,
      colorName: "Bordeaux",
      colorHex: "#6B1D2F",
      fabricNote: "Bazin brodé, motif wax",
      model: "Robe wax ajustée",
      modelImageUrl: "https://example.supabase.co/storage/v1/object/public/images/t1/products/abc.webp",
      dueDate: "2026-12-01",
      deposit: 5000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dueDate).toBeInstanceOf(Date);
      expect(result.data.deposit).toBe(5000);
    }
  });

  it("rejette un nom trop court", () => {
    expect(customOrderSchema.safeParse({ ...base, clientName: "A" }).success).toBe(false);
  });

  it("rejette un téléphone invalide", () => {
    expect(customOrderSchema.safeParse({ ...base, phone: "abc" }).success).toBe(false);
  });

  it("rejette un prix absent", () => {
    const { total, ...rest } = base;
    expect(customOrderSchema.safeParse(rest).success).toBe(false);
  });

  it("rejette un prix inférieur à 100 FCFA", () => {
    expect(customOrderSchema.safeParse({ ...base, total: 50 }).success).toBe(false);
  });

  it("coerce un prix envoyé en chaîne (NumericField renvoie une string)", () => {
    const result = customOrderSchema.safeParse({ ...base, total: "15000" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.total).toBe(15000);
  });

  it("traite une date de livraison vide comme absente", () => {
    const result = customOrderSchema.safeParse({ ...base, dueDate: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.dueDate).toBeUndefined();
  });

  it("accepte l'absence totale de champs optionnels", () => {
    expect(customOrderSchema.safeParse(base).success).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run lib/validators/customOrder.test.ts`
Expected: FAIL — `Cannot find module './customOrder'`

- [ ] **Step 3: Implémenter `lib/validators/customOrder.ts`**

```ts
import { z } from "zod";

export const customOrderSchema = z.object({
  clientName: z.string().trim().min(2, "Merci d'indiquer le nom."),
  place: z.string().trim().min(2, "Indiquez où livrer."),
  phone: z.string().trim().regex(/^[0-9+()\-\s]{6,20}$/, "Un numéro pour la joindre."),
  colorName: z.string().trim().max(60).optional(),
  colorHex: z.string().trim().max(9).optional(),
  fabricNote: z.string().trim().max(200).optional(),
  model: z.string().trim().max(200).optional(),
  modelImageUrl: z.string().trim().max(600).optional(),
  dueDate: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.date().optional()
  ),
  total: z.coerce.number().int("Le prix doit être un nombre entier.").min(100, "Indiquez un prix."),
  deposit: z.coerce.number().int("L'acompte doit être un nombre entier.").min(0).optional(),
});

export type CustomOrderInput = z.input<typeof customOrderSchema>;
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run lib/validators/customOrder.test.ts`
Expected: PASS — 9 tests verts.

- [ ] **Step 5: Typecheck complet**

Run: `npm run typecheck && npm run test`
Expected: propre, tous les tests verts.

- [ ] **Step 6: Commit**

```bash
git add lib/validators/customOrder.ts lib/validators/customOrder.test.ts
git commit -m "feat(orders): add customOrderSchema validator"
```

---

### Task 3: Server Action `createCustomOrder` + correction de `confirmOrder`

**Files:**
- Modify: `lib/orders/actions.ts`

**Interfaces:**
- Consumes: `customOrderSchema`, `CustomOrderInput` (Task 2) ; `Order.isCustom`/`custom*` (Task 1).
- Produces: `createCustomOrder(input: CustomOrderInput): Promise<{ ok: true; ref: string } | { ok: false; error: string }>`, consommée par Task 6 (modale UI).

- [ ] **Step 1: Ajouter l'import du validateur**

Dans `lib/orders/actions.ts`, à côté de l'import de `orderEditSchema` (L.10), ajouter :

```ts
import { customOrderSchema, type CustomOrderInput } from "@/lib/validators/customOrder";
```

- [ ] **Step 2: Ajouter `createCustomOrder` après `submitWebOrder`**

Juste après la fermeture de `submitWebOrder` (L.132, juste avant `export async function confirmOrder`), insérer :

```ts
/** Crée une commande personnalisée (sur mesure, sans produit catalogue) — saisie par owner/staff au comptoir. */
export async function createCustomOrder(
  input: CustomOrderInput
): Promise<{ ok: true; ref: string } | { ok: false; error: string }> {
  const { allowed } = await requireZone("dashboard");
  if (!allowed) return { ok: false, error: "Une erreur est survenue, réessayez." };

  const session = await getSession();
  if (!session) return { ok: false, error: "Une erreur est survenue, réessayez." };
  const writable = await requireWritableSession();
  if (!writable.ok) return { ok: false, error: writable.error };

  const parsed = customOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Informations invalides." };

  try {
    const tenant = await getCurrentTenant();
    const d = parsed.data;

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          tenantId: tenant.id,
          clientName: d.clientName,
          place: d.place,
          phone: d.phone,
          channel: "Boutique",
          total: d.total,
          isCustom: true,
          customColorName: d.colorName || null,
          customColorHex: d.colorHex || null,
          customFabricNote: d.fabricNote || null,
          customModel: d.model || null,
          customModelImageUrl: d.modelImageUrl || null,
          customDueDate: d.dueDate ?? null,
          customDeposit: d.deposit ?? null,
        },
      });
      await tx.orderStatusEvent.create({
        data: { tenantId: tenant.id, orderId: created.id, authorId: session.userId, status: "nouvelle" },
      });
      return created;
    }, { maxWait: 10000, timeout: 10000 });

    await createNotification({
      tenantId: tenant.id,
      type: "nouvelle_commande",
      title: "Nouvelle commande personnalisée",
      body: `${order.ref} · ${order.clientName} · ${money(order.total)}`,
      href: "/admin/commandes",
    });

    revalidatePath("/admin/commandes");
    revalidatePath("/admin/tableau-de-bord");
    return { ok: true, ref: order.ref };
  } catch {
    return { ok: false, error: "Une erreur est survenue, réessayez." };
  }
}
```

- [ ] **Step 3: Corriger `confirmOrder` pour ne pas écraser le total d'une commande personnalisée**

Dans `confirmOrder` (L.134-277), remplacer le bloc qui recalcule remises/total (actuellement L.198-224) :

Avant :

```ts
      // Remises : re-validation au moment de la validation (source de vérité).
      // Le sous-total vient des lignes ; la cliente est matchée par téléphone
      // normalisé (même règle que applyLoyaltyOrder) pour connaître solde et VIP.
      const subtotal = order.lines.reduce((sum, l) => sum + l.lineTotal, 0);
      const normalized = normalizePhone(order.phone);
      const candidates = await tx.customer.findMany({ where: { tenantId: tenant.id } });
      const matched = candidates.find((c) => normalizePhone(c.phone) === normalized) ?? null;

      let promoRow = null;
      if (order.promoCode) {
        promoRow = await findPromoByCode(tx, tenant.id, order.promoCode);
        const verdict = validatePromo(promoRow, {
          now: new Date(),
          subtotal,
          isVip: matched?.vip ?? false,
        });
        if (!verdict.ok) promoRow = null; // code plus valide : commande validée SANS la remise promo
      }
      const d = applyDiscounts({
        subtotal,
        promo: promoRow,
        pointsRequested: order.pointsUsed, // l'intention enregistrée à la soumission
        pointsBalance: matched?.points ?? 0,
      });
      if (promoRow && d.promoDiscount > 0) {
        await tx.promoCode.update({ where: { id: promoRow.id }, data: { usedCount: { increment: 1 } } });
      }
```

Après :

```ts
      // Une commande personnalisée n'a aucune OrderLine : son prix est saisi
      // à la main (createCustomOrder) et ne doit jamais être recalculé depuis
      // un sous-total de lignes qui vaudrait 0 — ni code promo ni points sur
      // une commande personnalisée.
      const subtotal = order.lines.reduce((sum, l) => sum + l.lineTotal, 0);
      const normalized = normalizePhone(order.phone);
      const candidates = await tx.customer.findMany({ where: { tenantId: tenant.id } });
      const matched = candidates.find((c) => normalizePhone(c.phone) === normalized) ?? null;

      let promoRow = null;
      let d: { promoDiscount: number; pointsUsed: number; pointsDiscount: number; total: number } = {
        promoDiscount: 0,
        pointsUsed: 0,
        pointsDiscount: 0,
        total: order.total,
      };
      if (!order.isCustom) {
        if (order.promoCode) {
          promoRow = await findPromoByCode(tx, tenant.id, order.promoCode);
          const verdict = validatePromo(promoRow, {
            now: new Date(),
            subtotal,
            isVip: matched?.vip ?? false,
          });
          if (!verdict.ok) promoRow = null; // code plus valide : commande validée SANS la remise promo
        }
        d = applyDiscounts({
          subtotal,
          promo: promoRow,
          pointsRequested: order.pointsUsed, // l'intention enregistrée à la soumission
          pointsBalance: matched?.points ?? 0,
        });
        if (promoRow && d.promoDiscount > 0) {
          await tx.promoCode.update({ where: { id: promoRow.id }, data: { usedCount: { increment: 1 } } });
        }
      }
```

Le reste de `confirmOrder` (l'appel à `applyLoyaltyOrder` avec `orderTotal: d.total`, puis `tx.order.update({ data: { total: d.total, ... } })`) reste **inchangé** : pour une commande `isCustom`, `d.total === order.total` (le prix saisi, préservé), et la cliente continue de gagner des points de fidélité normalement.

- [ ] **Step 4: Typecheck et tests**

Run: `npm run typecheck && npm run test`
Expected: propre, tous les tests verts (aucune régression sur `submitWebOrder`).

- [ ] **Step 5: Commit**

```bash
git add lib/orders/actions.ts
git commit -m "feat(orders): add createCustomOrder action, preserve total in confirmOrder for custom orders"
```

---

### Task 4: Lecture — type `Order` et mapping `toOrder`

**Files:**
- Modify: `lib/data/types.ts` (interface `Order`)
- Modify: `lib/data/orders.server.ts` (`toOrder`)

**Interfaces:**
- Consumes: colonnes `Order.isCustom`/`custom*` (Task 1).
- Produces: `Order.isCustom: boolean`, `Order.customColorName/customColorHex/customFabricNote/customModel/customModelImageUrl: string | null`, `Order.customDueDate: string | null` (formatée `JJ/MM/AAAA`), `Order.customDeposit: string | null` (formatée money), `Order.customBalanceDue: string | null` (formatée money, = total − acompte), consommés par Task 6 (badge + section détail).

- [ ] **Step 1: Étendre l'interface `Order`**

Dans `lib/data/types.ts`, juste après `paymentDetails` (L.123-128, avant le `}` final de l'interface), ajouter :

```ts
  isCustom: boolean;
  customColorName: string | null;
  customColorHex: string | null;
  customFabricNote: string | null;
  customModel: string | null;
  customModelImageUrl: string | null;
  /** Formatée JJ/MM/AAAA, `null` si non renseignée ou si la commande n'est pas personnalisée. */
  customDueDate: string | null;
  /** Formatée money (ex. « 5 000 FCFA »), `null` si aucun acompte saisi. */
  customDeposit: string | null;
  /** = total − acompte, formatée money, `null` si aucun acompte saisi. */
  customBalanceDue: string | null;
```

- [ ] **Step 2: Étendre `toOrder` dans `lib/data/orders.server.ts`**

Dans `toOrder` (L.18-58), ajouter juste avant le `};` de fermeture de l'objet retourné (après `paymentDetails: ...` L.51-56) :

```ts
    isCustom: row.isCustom,
    customColorName: row.customColorName,
    customColorHex: row.customColorHex,
    customFabricNote: row.customFabricNote,
    customModel: row.customModel,
    customModelImageUrl: row.customModelImageUrl,
    customDueDate: row.customDueDate
      ? row.customDueDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
      : null,
    customDeposit: row.customDeposit != null ? money(row.customDeposit) : null,
    customBalanceDue:
      row.customDeposit != null ? money(Math.max(0, row.total - row.customDeposit)) : null,
```

- [ ] **Step 3: Typecheck et tests**

Run: `npm run typecheck && npm run test`
Expected: propre. Si `npm run typecheck` signale un objet littéral non conforme ailleurs (ex. un mock de test construisant un `Order` à la main), ajouter les nouveaux champs à cet endroit précis avec des valeurs neutres (`isCustom: false`, le reste `null`) — rechercher avec `grep -rn "isCustom" --include="*.ts*" .` après le premier run pour localiser tout endroit manquant.

- [ ] **Step 4: Commit**

```bash
git add lib/data/types.ts lib/data/orders.server.ts
git commit -m "feat(orders): expose custom order fields in Order type and toOrder mapping"
```

---

### Task 5: Modale `CustomOrderModal`

**Files:**
- Modify: `components/dashboard/ProductVariantsField.tsx` (exporter `POPULAR_SWATCHES`)
- Create: `components/orders/CustomOrderModal.tsx`

**Interfaces:**
- Consumes: `createCustomOrder` (Task 3) ; `searchColors` (`@/lib/colors/catalog`), `generateShades` (`@/lib/colors/shades`), `getTenantColors`/`TenantColorItem` (`@/lib/colors/actions`), `CustomColorModal` (`@/components/dashboard/CustomColorModal`), `POPULAR_SWATCHES` (ce task), `prepareImageForUpload`/`uploadProductImageClient` (`@/lib/images/client`), `NumericField` (`@/components/ui/NumericField`), `useBackoffice` (`@/lib/store/useBackoffice`) — tous déjà existants, aucun n'est modifié par ce task hormis l'export de `POPULAR_SWATCHES`.
- Produces: `CustomOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void })`, consommé par Task 6 (`OrdersScreen`).

- [ ] **Step 1: Exporter `POPULAR_SWATCHES`**

Dans `components/dashboard/ProductVariantsField.tsx` (L.25), changer :

```ts
const POPULAR_SWATCHES = [
```

en :

```ts
export const POPULAR_SWATCHES = [
```

- [ ] **Step 2: Créer `components/orders/CustomOrderModal.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { colors, fonts, adminBorder } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { NumericField } from "@/components/ui/NumericField";
import { searchColors } from "@/lib/colors/catalog";
import { generateShades } from "@/lib/colors/shades";
import { getTenantColors, type TenantColorItem } from "@/lib/colors/actions";
import { CustomColorModal } from "@/components/dashboard/CustomColorModal";
import { POPULAR_SWATCHES } from "@/components/dashboard/ProductVariantsField";
import { prepareImageForUpload, uploadProductImageClient } from "@/lib/images/client";
import { createCustomOrder } from "@/lib/orders/actions";
import { useBackoffice } from "@/lib/store/useBackoffice";

export function CustomOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [clientName, setClientName] = useState("");
  const [place, setPlace] = useState("");
  const [phone, setPhone] = useState("");
  const [colorName, setColorName] = useState("");
  const [colorHex, setColorHex] = useState("");
  const [colorSearch, setColorSearch] = useState("");
  const [colorSearchOpen, setColorSearchOpen] = useState(false);
  const [customColorModalOpen, setCustomColorModalOpen] = useState(false);
  const [tenantFavorites, setTenantFavorites] = useState<TenantColorItem[]>([]);
  const [fabricNote, setFabricNote] = useState("");
  const [model, setModel] = useState("");
  const [modelImageUrl, setModelImageUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [total, setTotal] = useState("");
  const [deposit, setDeposit] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showToast = useBackoffice((s) => s.showToast);

  useEffect(() => {
    let cancelled = false;
    getTenantColors().then((items) => {
      if (!cancelled) setTenantFavorites(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const searchResults = useMemo(() => {
    if (!colorSearch.trim()) return [];
    return searchColors(colorSearch.trim()).slice(0, 6);
  }, [colorSearch]);

  function selectColor(name: string, hex: string) {
    setColorName(name);
    setColorHex(hex);
    setColorSearch("");
    setColorSearchOpen(false);
  }

  async function handlePhotoUpload(file: File) {
    setUploadingPhoto(true);
    setError(null);
    try {
      const prepared = await prepareImageForUpload(file);
      const formData = new FormData();
      formData.append("file", prepared);
      const res = await uploadProductImageClient(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setModelImageUrl(res.url);
    } catch {
      setError("Une erreur est survenue lors de l'envoi de la photo.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  const valid =
    clientName.trim().length >= 2 &&
    place.trim().length >= 2 &&
    phone.trim().length >= 6 &&
    Number(total) >= 100;

  async function submit() {
    setSaving(true);
    setError(null);
    const result = await createCustomOrder({
      clientName,
      place,
      phone,
      colorName: colorName || undefined,
      colorHex: colorHex || undefined,
      fabricNote: fabricNote || undefined,
      model: model || undefined,
      modelImageUrl: modelImageUrl || undefined,
      dueDate: dueDate || undefined,
      total: Number(total),
      deposit: deposit ? Number(deposit) : undefined,
    });
    setSaving(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    showToast(`Commande personnalisée ${result.ref} créée`, "success");
    onCreated();
  }

  const favoriteSwatches = [
    ...tenantFavorites.map((f) => ({ id: f.id, name: f.name, hex: f.hex })),
    ...POPULAR_SWATCHES.map((s, i) => ({ id: `pop-${i}`, name: s.name, hex: s.hex })),
  ];

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(30,27,24,.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ background: "#fff", borderRadius: 16, width: 480, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto", padding: "22px 24px", boxShadow: "0 20px 50px rgba(30,27,24,.24)" }}
        >
          <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 18, marginBottom: 4 }}>
            Commande personnalisée
          </div>
          <div style={{ fontSize: 12.5, color: colors.muted, marginBottom: 18 }}>
            Confection sur mesure — sans produit catalogue, prix saisi à la main.
          </div>

          <label style={fieldLabel}>Nom de la cliente</label>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} style={fieldInput} placeholder="Awa Diop" />

          <label style={fieldLabel}>Téléphone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} style={fieldInput} placeholder="07 00 00 00 00" />

          <label style={fieldLabel}>Lieu de livraison</label>
          <input value={place} onChange={(e) => setPlace(e.target.value)} style={fieldInput} placeholder="Cocody, Abidjan" />

          <label style={fieldLabel}>Couleur du tissu</label>
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", height: 42, padding: "0 12px", border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", gap: 8 }}>
              <Icon path={ICONS.search} size={15} stroke={colors.muted} />
              <input
                type="text"
                value={colorSearch}
                onChange={(e) => {
                  setColorSearch(e.target.value);
                  setColorSearchOpen(true);
                }}
                onFocus={() => setColorSearchOpen(true)}
                placeholder="Rechercher une teinte…"
                style={{ flex: 1, border: "none", outline: "none", font: `400 13.5px ${fonts.ui}`, background: "transparent" }}
              />
            </div>
            {colorSearchOpen && searchResults.length > 0 && (
              <div
                style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 6, background: "#fff", borderRadius: 12, boxShadow: "0 12px 32px -4px rgba(30,27,24,0.18)", border: adminBorder, zIndex: 30, maxHeight: 220, overflowY: "auto", padding: "6px 0" }}
              >
                {searchResults.map((item) => {
                  const shades = generateShades(item.hex, item.name);
                  return (
                    <div key={item.name} style={{ padding: "8px 14px", borderTop: `1px solid ${colors.faintLine}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {shades.map((shade) => (
                          <button
                            key={shade.hex}
                            type="button"
                            onClick={() => selectColor(shade.name, shade.hex)}
                            title={shade.name}
                            style={{ width: 28, height: 28, borderRadius: 7, background: shade.hex, border: `2px solid ${colorHex.toLowerCase() === shade.hex.toLowerCase() ? colors.primary : "rgba(0,0,0,0.14)"}`, cursor: "pointer" }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {favoriteSwatches.map((swatch) => {
              const isSelected = colorHex.toLowerCase() === swatch.hex.toLowerCase();
              return (
                <button
                  key={swatch.id}
                  type="button"
                  onClick={() => selectColor(swatch.name, swatch.hex)}
                  title={swatch.name}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", height: 34, borderRadius: 9, border: `1.5px solid ${isSelected ? colors.primary : colors.borderField}`, background: isSelected ? colors.bgInfo : "#fff", cursor: "pointer", fontSize: 12, fontWeight: isSelected ? 600 : 500, color: isSelected ? colors.primary : colors.ink }}
                >
                  <span style={{ width: 14, height: 14, borderRadius: 4, background: swatch.hex, border: "1px solid rgba(0,0,0,0.15)" }} />
                  {swatch.name}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setCustomColorModalOpen(true)}
              style={{ border: "none", background: "transparent", color: colors.primary, font: `600 12px ${fonts.ui}`, cursor: "pointer", padding: "6px 8px" }}
            >
              + Couleur sur mesure
            </button>
          </div>
          {colorName && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: colors.muted }}>
              <span style={{ width: 16, height: 16, borderRadius: 5, background: colorHex, border: "1px solid rgba(0,0,0,0.15)" }} />
              {colorName}
              <button
                type="button"
                onClick={() => {
                  setColorName("");
                  setColorHex("");
                }}
                style={{ border: "none", background: "transparent", color: colors.danger, cursor: "pointer", fontSize: 12 }}
              >
                Retirer
              </button>
            </div>
          )}

          <label style={fieldLabel}>Motif / matière</label>
          <input value={fabricNote} onChange={(e) => setFabricNote(e.target.value)} style={fieldInput} placeholder="Bazin brodé, motif wax…" />

          <label style={fieldLabel}>Modèle à confectionner</label>
          <input value={model} onChange={(e) => setModel(e.target.value)} style={fieldInput} placeholder="Robe wax ajustée, manches longues…" />

          <label style={fieldLabel}>Photo du modèle (optionnel)</label>
          {modelImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={modelImageUrl} alt="Photo du modèle" style={{ width: "100%", maxHeight: 140, objectFit: "cover", borderRadius: 9, marginBottom: 8 }} />
          )}
          <label style={{ ...miniBtnStyle, cursor: uploadingPhoto ? "default" : "pointer", opacity: uploadingPhoto ? 0.6 : 1, marginBottom: 14 }}>
            {uploadingPhoto ? "Envoi…" : modelImageUrl ? "Remplacer la photo" : "Ajouter une photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploadingPhoto}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) handlePhotoUpload(f);
              }}
              style={{ display: "none" }}
            />
          </label>

          <label style={fieldLabel}>Date de livraison souhaitée</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={fieldInput} />

          <label style={fieldLabel}>Prix convenu (FCFA)</label>
          <NumericField mode="money" value={total} onChange={setTotal} placeholder="0" />

          <div style={{ marginTop: 12 }}>
            <label style={fieldLabel}>Acompte versé (FCFA, optionnel)</label>
            <NumericField mode="money" value={deposit} onChange={setDeposit} placeholder="0" />
          </div>

          {error && <div style={{ marginTop: 10, fontSize: 12.5, color: colors.danger }}>{error}</div>}

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{ flex: 1, height: 46, border: `1.5px solid ${colors.borderField}`, borderRadius: 10, background: "#fff", color: colors.primary, font: `600 14px ${fonts.ui}`, cursor: saving ? "default" : "pointer" }}
            >
              Annuler
            </button>
            <button
              onClick={submit}
              disabled={saving || !valid}
              style={{ flex: 2, height: 46, border: "none", borderRadius: 10, background: colors.primary, color: "#fff", font: `600 14px ${fonts.ui}`, cursor: saving || !valid ? "default" : "pointer", opacity: saving || !valid ? 0.7 : 1 }}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>

      <CustomColorModal
        isOpen={customColorModalOpen}
        onClose={() => setCustomColorModalOpen(false)}
        onSelect={({ name, hex }) => selectColor(name, hex)}
      />
    </>
  );
}

const fieldLabel: React.CSSProperties = {
  display: "block",
  font: `600 12px ${fonts.ui}`,
  color: colors.muted,
  marginTop: 12,
  marginBottom: 6,
};
const fieldInput: React.CSSProperties = {
  width: "100%",
  height: 42,
  padding: "0 13px",
  border: `1.5px solid ${colors.borderField}`,
  borderRadius: 10,
  font: `400 14px ${fonts.ui}`,
};
const miniBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 34,
  padding: "0 12px",
  border: `1.5px solid ${colors.borderField}`,
  borderRadius: 8,
  background: "#fff",
  color: colors.primary,
  font: `600 12px ${fonts.ui}`,
};
```

Note : `CustomColorModal` est rendu comme **frère** du conteneur `onClick={onClose}` (pas un enfant), exactement comme dans `ProductVariantsField` — s'il était imbriqué dans le `<div onClick={onClose}>`, un clic à l'intérieur de `CustomColorModal` se propagerait et fermerait `CustomOrderModal` par erreur.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: propre (ce composant n'est pas encore importé nulle part, donc aucun test fonctionnel possible à ce stade — Task 6 le branche dans `OrdersScreen`).

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/ProductVariantsField.tsx components/orders/CustomOrderModal.tsx
git commit -m "feat(orders): add CustomOrderModal component"
```

---

### Task 6: Intégration dans `OrdersScreen`

**Files:**
- Modify: `components/dashboard/screens/OrdersScreen.tsx`

**Interfaces:**
- Consumes: `CustomOrderModal` (Task 5) ; `Order.isCustom`/`customColorName`/`customColorHex`/`customFabricNote`/`customModel`/`customModelImageUrl`/`customDueDate`/`customDeposit`/`customBalanceDue` (Task 4).
- Produces: le bouton « + Commande personnalisée », le badge « Personnalisée » (liste + détail), la section « Détails de la confection » dans `OrderDetail` — consommés uniquement par l'utilisateur final (dernier maillon de la chaîne).

- [ ] **Step 1: Importer `CustomOrderModal`**

Dans `components/dashboard/screens/OrdersScreen.tsx`, à côté de l'import de `OrderStatusTimeline` (L.15), ajouter :

```ts
import { CustomOrderModal } from "@/components/orders/CustomOrderModal";
```

- [ ] **Step 2: Ajouter l'état et le bouton**

Dans `OrdersScreen` (L.30-37), ajouter l'état après `const [deleting, setDeleting] = useState(false);` (L.35) :

```ts
  const [creatingCustom, setCreatingCustom] = useState(false);
```

Remplacer la rangée de filtres (L.74-115, le `<div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, overflowX: "auto" }}>` qui contient `{FILTERS.map(...)}`) en l'enveloppant ainsi — garder tout le contenu interne de la `map` identique, seul le conteneur englobant change :

```tsx
      {/* filter tabs + bouton commande personnalisée */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", overflowX: "auto", flex: 1 }}>
          {FILTERS.map((f) => {
            const on = filter === f[0];
            const c = count(f[2]);
            return (
              <button
                key={f[0]}
                onClick={() => {
                  setFilter(f[0]);
                  setSelId(null);
                }}
                style={{
                  height: 38,
                  padding: "0 14px",
                  borderRadius: 999,
                  font: `600 13px ${fonts.ui}`,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  border: `1.5px solid ${on ? colors.primary : colors.borderField}`,
                  background: on ? colors.primary : "#fff",
                  color: on ? "#fff" : colors.muted,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                {f[1]}
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
        <button
          type="button"
          onClick={() => setCreatingCustom(true)}
          className="ft-primary-btn"
          style={{
            flex: "none",
            height: 38,
            padding: "0 14px",
            borderRadius: 999,
            border: "none",
            background: colors.primary,
            color: "#fff",
            font: `600 13px ${fonts.ui}`,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
          }}
        >
          <Icon path={ICONS.plus} size={15} stroke="#fff" strokeWidth={2.2} />
          Commande personnalisée
        </button>
      </div>
```

- [ ] **Step 3: Rendre la modale**

Dans le groupe des modales en fin de composant (après le bloc `{deleting && selected && (...)}`, juste avant le `</div>` fermant de `OrdersScreen`, vers L.271), ajouter :

```tsx
      {creatingCustom && (
        <CustomOrderModal
          onClose={() => setCreatingCustom(false)}
          onCreated={() => {
            setCreatingCustom(false);
            router.refresh();
          }}
        />
      )}
```

- [ ] **Step 4: Badge et libellé dans la carte liste**

Dans le `list.map((o) => {...})` (L.149-183), remplacer la ligne de résumé :

```tsx
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12.5, color: colors.muted }}>
                      {o.items} articles · {o.channel} · {o.ago}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 15, color: colors.primary }}>{o.total}</span>
                  </div>
```

par :

```tsx
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12.5, color: colors.muted }}>
                      {o.isCustom ? "Commande personnalisée" : `${o.items} articles`} · {o.channel} · {o.ago}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 15, color: colors.primary }}>{o.total}</span>
                  </div>
```

Puis, juste au-dessus, remplacer `<Badge meta={st} />` (seul enfant du conteneur flex qui termine la ligne d'en-tête de la carte) par :

```tsx
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
                      {o.isCustom && <CustomBadge />}
                      <Badge meta={st} />
                    </div>
```

- [ ] **Step 5: Badge dans le détail**

Dans `OrderDetail` (L.345-379), dans la zone des badges d'en-tête (`<div style={{ display: "flex", alignItems: "center", gap: 8 }}>` qui contient le badge de statut et le bouton archiver, L.352-378), ajouter `{o.isCustom && <CustomBadge />}` juste avant le `<span>` du badge de statut :

```tsx
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {o.isCustom && <CustomBadge />}
          <span
            style={{
```

(le reste du bloc, inchangé, continue après ce `<span>`.)

- [ ] **Step 6: Ajouter le composant `CustomBadge`**

Juste après la fonction `Badge` (L.276-295), ajouter :

```tsx
function CustomBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        font: `600 11.5px ${fonts.ui}`,
        padding: "4px 9px",
        borderRadius: 999,
        flex: "none",
        background: colors.bgInfo,
        color: colors.fgInfo,
      }}
    >
      Personnalisée
    </span>
  );
}
```

- [ ] **Step 7: Section « Détails de la confection » dans `OrderDetail`**

Dans `OrderDetail`, juste après la fermeture du bloc « Mini-fiche cliente » (L.389-410, le `</div>` qui suit `{o.phone}` à l'intérieur du conteneur KYC — repère : juste avant `{/* items */}` / `<div style={kycLabel}>Panier</div>` L.412-413), insérer :

```tsx
        {/* détails de la confection (commande personnalisée uniquement) */}
        {o.isCustom && (
          <div style={{ background: colors.ivory, border: `1px solid ${colors.borderSoft}`, borderRadius: 12, padding: "13px 15px", marginBottom: 14 }}>
            <div style={kycLabel}>Détails de la confection</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 13 }}>
              {o.customColorName && (
                <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                  <span style={{ width: 16, height: 16, borderRadius: 5, background: o.customColorHex ?? "#ccc", border: "1px solid rgba(0,0,0,.15)", flex: "none" }} />
                  <span>{o.customColorName}</span>
                </div>
              )}
              {o.customFabricNote && (
                <div style={{ color: colors.muted }}>
                  <strong style={{ color: colors.ink }}>Motif / matière : </strong>
                  {o.customFabricNote}
                </div>
              )}
              {o.customModel && (
                <div style={{ color: colors.muted }}>
                  <strong style={{ color: colors.ink }}>Modèle : </strong>
                  {o.customModel}
                </div>
              )}
              {o.customModelImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={o.customModelImageUrl} alt="Photo du modèle" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 9 }} />
              )}
              {o.customDueDate && (
                <div style={{ color: colors.muted }}>
                  <strong style={{ color: colors.ink }}>Livraison souhaitée : </strong>
                  {o.customDueDate}
                </div>
              )}
              {o.customDeposit && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: colors.muted }}>Acompte versé</span>
                  <span style={{ fontWeight: 600, color: colors.fgSuccess }}>{o.customDeposit}</span>
                </div>
              )}
              {o.customBalanceDue && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: colors.muted }}>Reste à payer</span>
                  <span style={{ fontWeight: 600 }}>{o.customBalanceDue}</span>
                </div>
              )}
            </div>
          </div>
        )}

```

Puis, sur la ligne `<div style={kycLabel}>Panier</div>` (juste après, L.413), remplacer le texte fixe par un libellé conditionnel :

```tsx
        <div style={kycLabel}>{o.isCustom ? "Récapitulatif" : "Panier"}</div>
```

- [ ] **Step 8: Typecheck, tests et build**

Run: `npm run typecheck && npm run test && npx next build --webpack`
Expected: tous verts, build réussi (rappel : ne pas utiliser `npm run build`, cassé par le nom du dossier parent).

- [ ] **Step 9: Commit**

```bash
git add components/dashboard/screens/OrdersScreen.tsx
git commit -m "feat(orders): wire custom order button, badge and detail section into OrdersScreen"
```

---

### Task 7: Vérification navigateur de bout en bout

**Files:** aucune modification prévue (vérification uniquement ; si un bug est trouvé, le corriger dans le fichier concerné puis refaire les étapes 2-4 avant de commit).

**Interfaces:**
- Consumes: l'ensemble des tasks 1-6.
- Produces: confirmation que le parcours fonctionne réellement (dernier maillon).

- [ ] **Step 1: Démarrer le serveur de dev et ouvrir `/admin/commandes`**

Utiliser l'outil de preview du navigateur intégré pour lancer le serveur de dev du projet et naviguer vers `/admin/commandes`, connecté en tant que owner ou staff.

Expected: le bouton « Commande personnalisée » apparaît à droite des onglets de filtre.

- [ ] **Step 2: Créer une commande personnalisée**

Cliquer sur le bouton → remplir nom/téléphone/lieu → sélectionner une couleur via la recherche ou les teintes rapides → remplir motif/matière et modèle → ajouter une photo → choisir une date de livraison → saisir un prix (ex. 25 000) et un acompte (ex. 5 000) → cliquer « Enregistrer ».

Expected: toast de succès, la modale se ferme, la commande apparaît dans l'onglet « À valider » avec le badge « Personnalisée » et le libellé « Commande personnalisée » (pas « 0 articles »).

- [ ] **Step 3: Vérifier le détail et la validation**

Cliquer sur la commande créée → vérifier que la section « Détails de la confection » affiche couleur/motif/modèle/photo/date/acompte/reste à payer, et que le prix total affiché est bien celui saisi. Cliquer « Valider ».

Expected: la commande passe en « Confirmées », **le prix affiché reste inchangé** (pas 0 FCFA — c'est le bug corrigé en Task 3), aucune alerte de stock insuffisant.

- [ ] **Step 4: Vérifier l'absence de régression sur une commande catalogue**

Si une commande catalogue existante (avec de vraies lignes produit) est disponible dans la liste, ouvrir son détail et vérifier que la section « Panier » (lignes, sous-total, total) s'affiche exactement comme avant, sans badge « Personnalisée » ni section « Détails de la confection ».

Expected: aucune différence visuelle ou fonctionnelle par rapport à avant ce plan.

- [ ] **Step 5: Vérification finale**

Run: `npm run test && npm run typecheck && npx next build --webpack`
Expected: tous verts.

Si des corrections ont été nécessaires pendant cette tâche, commit final :

```bash
git add -A
git commit -m "fix(orders): address issues found during custom order manual verification"
```

Sinon, aucun commit (tâche de vérification pure).
