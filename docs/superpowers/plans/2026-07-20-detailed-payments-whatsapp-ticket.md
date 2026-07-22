# Modes de paiement détaillés (CI) + Ticket WhatsApp — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lots 1 et 2 du spec `docs/superpowers/specs/2026-07-20-payments-promos-ticket-finance-design.md` — le POS propose les portefeuilles ivoiriens (Orange Money, Wave, Moov Money, MTN MoMo) en plus d'Espèces/Mixte, et la modale de ticket permet d'envoyer un reçu texte formaté sur WhatsApp.

**Architecture:** Migration additive de l'enum Prisma `PaymentMethod` (le `mm` générique reste pour l'historique mais disparaît des choix POS) ; libellés centralisés dans un nouveau module `lib/payments/labels.ts`. Le générateur de message de ticket est une fonction pure testée (`lib/pos/ticketMessage.ts`) ; `encaisserVente` renvoie les données du ticket (lignes, remise, fidélité, téléphone cliente) et la modale gagne un bouton WhatsApp (`wa.me` pré-rempli).

**Tech Stack:** Next.js 16.2 (App Router, Server Actions), Prisma 7 + Supabase Postgres (DDL via MCP), Zod 4, Zustand, Vitest.

## Global Constraints

- Langue produit : FR (libellés, messages d'erreur). Code/commits : EN.
- `npm run build` (Turbopack) est **cassé** par le nom du dossier parent (é NFD) — utiliser `npx next build --webpack` pour vérifier le build. `npm run test` et `npm run typecheck` fonctionnent normalement.
- Les migrations DDL s'appliquent au projet Supabase `vqqwviknffequjvxmojo` **via le MCP Supabase** (`apply_migration`), puis `npx prisma generate` localement. Convention projet : le SQL est aussi committé dans `prisma/migrations/<timestamp>_<name>/migration.sql`.
- Résultats typés `{ ok: true, ... } | { ok: false; error: string }`, messages d'erreur en français, jamais d'exception silencieuse.
- TypeScript strict, jamais de `any`.
- Conventional Commits, une préoccupation par commit.
- Après chaque tâche : `npm run test` et `npm run typecheck` doivent être verts.

---

### Task 1: Migration enum PaymentMethod + module de libellés

**Files:**
- Modify: `prisma/schema.prisma` (enum `PaymentMethod`, lignes ~44-48)
- Create: `prisma/migrations/20260720120000_detailed_payment_methods/migration.sql`
- Create: `lib/payments/labels.ts`

**Interfaces:**
- Consumes: rien (première tâche).
- Produces: enum Postgres/Prisma `PaymentMethod` avec 7 valeurs ; `PAYMENT_LABELS: Record<PaymentMethodId, string>`, `POS_PAYMENT_METHODS` (tuple readonly des 6 modes proposables au POS), `type PosPaymentMethod`, `type PaymentMethodId` — importés par les Tasks 2, 4, 5.

- [ ] **Step 1: Étendre l'enum dans `prisma/schema.prisma`**

Remplacer :

```prisma
enum PaymentMethod {
  espece
  mm
  mixte
}
```

par :

```prisma
enum PaymentMethod {
  espece
  mm // legacy : ventes historiques uniquement, affiché « Mobile Money »
  orange_money
  wave
  moov_money
  mtn_momo
  mixte
}
```

- [ ] **Step 2: Créer le fichier de migration**

`prisma/migrations/20260720120000_detailed_payment_methods/migration.sql` :

```sql
-- Portefeuilles Mobile Money ivoiriens détaillés. `mm` reste pour l'historique.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'orange_money';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'wave';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'moov_money';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'mtn_momo';
```

- [ ] **Step 3: Appliquer la migration via le MCP Supabase**

Appeler `mcp__supabase__apply_migration` avec `name: "detailed_payment_methods"` et le SQL du Step 2. Vérifier ensuite avec `mcp__supabase__execute_sql` :

```sql
SELECT unnest(enum_range(NULL::"PaymentMethod"))::text ORDER BY 1;
```

Attendu : 7 lignes — `espece, mixte, mm, moov_money, mtn_momo, orange_money, wave`.

- [ ] **Step 4: Régénérer le client Prisma**

Run: `npx prisma generate`
Expected: succès sans erreur.

- [ ] **Step 5: Créer `lib/payments/labels.ts`**

```ts
/** Identifiants des modes de paiement (miroir de l'enum Prisma `PaymentMethod`). */
export type PaymentMethodId =
  | "espece"
  | "mm"
  | "orange_money"
  | "wave"
  | "moov_money"
  | "mtn_momo"
  | "mixte";

/** Libellés FR affichés partout (POS, ticket, commandes, finance). */
export const PAYMENT_LABELS: Record<PaymentMethodId, string> = {
  espece: "Espèces",
  mm: "Mobile Money",
  orange_money: "Orange Money",
  wave: "Wave",
  moov_money: "Moov Money",
  mtn_momo: "MTN MoMo",
  mixte: "Mixte",
};

/** Modes proposés au POS — `mm` (générique) est réservé aux ventes historiques. */
export const POS_PAYMENT_METHODS = [
  "espece",
  "orange_money",
  "wave",
  "moov_money",
  "mtn_momo",
  "mixte",
] as const;

export type PosPaymentMethod = (typeof POS_PAYMENT_METHODS)[number];
```

- [ ] **Step 6: Vérifier**

Run: `npm run typecheck && npm run test`
Expected: propre, 173/173 verts (aucun consommateur encore modifié).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260720120000_detailed_payment_methods lib/payments/labels.ts
git commit -m "feat(payments): detailed CI mobile money wallets in PaymentMethod enum + shared labels"
```

---

### Task 2: POS — sélecteur 6 modes + validator

**Files:**
- Modify: `lib/validators/pos.ts`
- Create: `lib/validators/pos.test.ts`
- Modify: `lib/store/useBackoffice.ts` (type du champ `pay`, ligne ~28)
- Modify: `components/dashboard/screens/PosScreen.tsx` (constantes `PAY_DEF`/`PAY_LABELS` lignes 13-23, rendu des chips ligne ~439)

**Interfaces:**
- Consumes: `POS_PAYMENT_METHODS`, `PAYMENT_LABELS`, `PosPaymentMethod` de `lib/payments/labels.ts` (Task 1).
- Produces: `posSaleSchema.paymentMethod` accepte les 6 modes POS (refuse `mm`) ; `useBackoffice` stocke `pay: PosPaymentMethod` — consommés tels quels par la Task 4 (aucun changement de signature côté `encaisserVente`).

- [ ] **Step 1: Écrire le test du validator (échec attendu)**

`lib/validators/pos.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { posSaleSchema } from "./pos";

const base = { lines: [{ productId: "p1", qty: 1 }] };

describe("posSaleSchema — modes de paiement", () => {
  it("accepte les 6 modes proposés au POS", () => {
    for (const pm of ["espece", "orange_money", "wave", "moov_money", "mtn_momo", "mixte"]) {
      expect(posSaleSchema.safeParse({ ...base, paymentMethod: pm }).success).toBe(true);
    }
  });

  it("refuse le mm générique (réservé à l'historique)", () => {
    expect(posSaleSchema.safeParse({ ...base, paymentMethod: "mm" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run lib/validators/pos.test.ts`
Expected: FAIL — `orange_money` etc. rejetés par l'enum actuel.

- [ ] **Step 3: Mettre à jour le validator**

Dans `lib/validators/pos.ts`, remplacer la ligne `paymentMethod: z.enum(["espece", "mm", "mixte"]),` par :

```ts
  paymentMethod: z.enum(POS_PAYMENT_METHODS),
```

avec l'import en tête de fichier :

```ts
import { POS_PAYMENT_METHODS } from "@/lib/payments/labels";
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run lib/validators/pos.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Typer le store**

Dans `lib/store/useBackoffice.ts` :

```ts
import type { PosPaymentMethod } from "@/lib/payments/labels";
```

et remplacer `pay: "espece" | "mm" | "mixte";` par :

```ts
  pay: PosPaymentMethod;
```

(la valeur initiale `pay: "espece"` et `setPay` ne changent pas).

- [ ] **Step 6: Mettre à jour les chips du POS**

Dans `components/dashboard/screens/PosScreen.tsx`, remplacer les constantes `PAY_DEF` et `PAY_LABELS` (lignes 13-23) par :

```ts
import { PAYMENT_LABELS, type PosPaymentMethod } from "@/lib/payments/labels";

const PAY_DEF: ReadonlyArray<{ id: PosPaymentMethod; label: string; icon: string }> = [
  { id: "espece", label: "Espèces", icon: ICONS.cash },
  { id: "orange_money", label: "Orange M.", icon: ICONS.mobileMoney },
  { id: "wave", label: "Wave", icon: ICONS.mobileMoney },
  { id: "moov_money", label: "Moov M.", icon: ICONS.mobileMoney },
  { id: "mtn_momo", label: "MTN MoMo", icon: ICONS.mobileMoney },
  { id: "mixte", label: "Mixte", icon: ICONS.mixte },
];
```

Remplacer l'usage `PAY_LABELS[pay]` (dans `handlePay`, ligne ~493) par `PAYMENT_LABELS[pay]`. Vérifier le conteneur des chips (autour de la ligne 439) : s'assurer qu'il est en `display: "grid", gridTemplateColumns: "repeat(3, 1fr)"` (ou ajouter `flexWrap: "wrap"` si c'est un flex) pour que les 6 chips tiennent en 2 rangées de 3 sans déborder, styles existants conservés.

- [ ] **Step 7: Vérifier l'ensemble**

Run: `npm run typecheck && npm run test`
Expected: propre, 175/175 verts.

Vérification navigateur (launch.json → `npx next dev --webpack`) : ouvrir `/admin/pos`, constater 6 chips sur 2 rangées, sélectionner « Wave », encaisser une vente d'un article, la modale affiche « Mode de paiement : Wave ». Contrôler en base (`mcp__supabase__execute_sql`) : `SELECT ref, "paymentMethod" FROM "Order" ORDER BY "createdAt" DESC LIMIT 1;` → `wave`.

- [ ] **Step 8: Commit**

```bash
git add lib/validators/pos.ts lib/validators/pos.test.ts lib/store/useBackoffice.ts components/dashboard/screens/PosScreen.tsx
git commit -m "feat(pos): six payment mode chips (CI wallets), mm reserved to history"
```

---

### Task 3: Générateur pur de message de ticket (TDD)

**Files:**
- Create: `lib/pos/ticketMessage.ts`
- Create: `lib/pos/ticketMessage.test.ts`

**Interfaces:**
- Consumes: `money` de `lib/format.ts` (existant : `money(12500)` → `"12 500 FCFA"` — vérifier la sortie exacte en lisant `lib/format.ts` avant d'écrire les assertions).
- Produces:

```ts
export interface TicketLine { name: string; qty: number; lineTotal: number }
export interface TicketMessageInput {
  shopName: string;
  ref: string;
  date: Date;
  lines: TicketLine[];
  subtotal: number;   // Σ unitPrice × qty, avant remises
  discount: number;   // remises par ligne agrégées, FCFA (0 = aucune)
  total: number;      // montant réellement payé
  payLabel: string;   // libellé FR du mode (PAYMENT_LABELS)
  loyalty: { pointsEarned: number; newBalance: number } | null;
}
export function buildTicketMessage(input: TicketMessageInput): string;
```

consommé par la Task 5 (PosScreen).

- [ ] **Step 1: Écrire les tests (échec attendu)**

`lib/pos/ticketMessage.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { buildTicketMessage, type TicketMessageInput } from "./ticketMessage";

const base: TicketMessageInput = {
  shopName: "Foulard Teranga",
  ref: "#TER-1042",
  date: new Date(2026, 6, 20, 14, 32),
  lines: [
    { name: "Foulard tissé main", qty: 2, lineTotal: 24000 },
    { name: "Turban wax", qty: 1, lineTotal: 8500 },
  ],
  subtotal: 32500,
  discount: 0,
  total: 32500,
  payLabel: "Wave",
  loyalty: null,
};

describe("buildTicketMessage", () => {
  it("liste l'en-tête, chaque article et le total avec le mode de paiement", () => {
    const msg = buildTicketMessage(base);
    expect(msg).toContain("*Foulard Teranga*");
    expect(msg).toContain("#TER-1042");
    expect(msg).toContain("• Foulard tissé main × 2 — 24 000 FCFA");
    expect(msg).toContain("• Turban wax × 1 — 8 500 FCFA");
    expect(msg).toContain("*Total payé : 32 500 FCFA* (Wave)");
  });

  it("omet sous-total et remise quand il n'y a aucune remise", () => {
    const msg = buildTicketMessage(base);
    expect(msg).not.toContain("Sous-total");
    expect(msg).not.toContain("Remise");
  });

  it("affiche sous-total et remise quand une remise existe", () => {
    const msg = buildTicketMessage({ ...base, discount: 3250, total: 29250 });
    expect(msg).toContain("Sous-total : 32 500 FCFA");
    expect(msg).toContain("Remise : −3 250 FCFA");
    expect(msg).toContain("*Total payé : 29 250 FCFA* (Wave)");
  });

  it("affiche le bloc fidélité seulement si une cliente est rattachée", () => {
    expect(buildTicketMessage(base)).not.toContain("Points gagnés");
    const msg = buildTicketMessage({ ...base, loyalty: { pointsEarned: 32, newBalance: 96 } });
    expect(msg).toContain("⭐ Points gagnés : 32 · Nouveau solde : 96");
  });

  it("contient la date au format français", () => {
    expect(buildTicketMessage(base)).toContain("20/07/2026");
  });
});
```

Nota bene : si la sortie réelle de `money()` diffère (« 12 500 FCFA » vs « 12 500 »), ajuster les assertions **et** l'implémentation pour rester cohérent avec le reste de l'app — `money` est la seule source de formatage monétaire.

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run lib/pos/ticketMessage.test.ts`
Expected: FAIL — module inexistant.

- [ ] **Step 3: Implémenter `lib/pos/ticketMessage.ts`**

```ts
import { money } from "@/lib/format";

export interface TicketLine {
  name: string;
  qty: number;
  lineTotal: number;
}

export interface TicketMessageInput {
  shopName: string;
  ref: string;
  date: Date;
  lines: TicketLine[];
  /** Σ unitPrice × qty, avant remises. */
  subtotal: number;
  /** Remises par ligne agrégées en FCFA (0 = aucune). */
  discount: number;
  /** Montant réellement payé. */
  total: number;
  /** Libellé FR du mode de paiement (PAYMENT_LABELS). */
  payLabel: string;
  loyalty: { pointsEarned: number; newBalance: number } | null;
}

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

/** Reçu de caisse en texte WhatsApp (gras via *…*, listes via •). Pure et testée. */
export function buildTicketMessage(input: TicketMessageInput): string {
  const parts: string[] = [
    `🧾 *${input.shopName}* — Reçu de caisse`,
    `Réf : ${input.ref} · ${DATE_FMT.format(input.date)}`,
    "",
    ...input.lines.map((l) => `• ${l.name} × ${l.qty} — ${money(l.lineTotal)}`),
    "",
  ];
  if (input.discount > 0) {
    parts.push(`Sous-total : ${money(input.subtotal)}`, `Remise : −${money(input.discount)}`);
  }
  parts.push(`*Total payé : ${money(input.total)}* (${input.payLabel})`);
  if (input.loyalty) {
    parts.push(
      "",
      `⭐ Points gagnés : ${input.loyalty.pointsEarned} · Nouveau solde : ${input.loyalty.newBalance}`
    );
  }
  parts.push("", "Merci de votre visite ! 🧡");
  return parts.join("\n");
}
```

(Si `money()` n'ajoute pas « FCFA », concaténer ` FCFA` dans ce fichier — jamais dans les appelants.)

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npx vitest run lib/pos/ticketMessage.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add lib/pos/ticketMessage.ts lib/pos/ticketMessage.test.ts
git commit -m "feat(pos): pure WhatsApp ticket message builder"
```

---

### Task 4: `encaisserVente` renvoie les données du ticket

**Files:**
- Modify: `lib/customers/applyLoyaltyOrder.ts` (type de retour + les deux branches)
- Modify: `lib/pos/actions.ts` (`encaisserVente` : restructurer le retour de la transaction)

**Interfaces:**
- Consumes: `buildOrderLines` (existant — `built.lines: OrderLineData[]` avec `nameAtOrder`, `qty`, `unitPrice`, `discount`, `lineTotal` ; `built.total`), `getCurrentTenant()` (existant — `tenant.name`).
- Produces:

```ts
// applyLoyaltyOrder — retour étendu :
Promise<{ customerId: string; vipBefore: boolean; pointsEarned: number; newBalance: number }>

// encaisserVente — retour étendu :
{ ok: true; ref: string; ticket: PosTicketData } | { ok: false; error: string }

export interface PosTicketData {
  shopName: string;
  lines: Array<{ name: string; qty: number; lineTotal: number }>;
  subtotal: number;
  discount: number;
  total: number;
  customerPhone: string | null;
  loyalty: { pointsEarned: number; newBalance: number } | null;
}
```

consommé par la Task 5. **Attention (leçon du sous-projet 5)** : `submitWebOrder`/`confirmOrder` dans `lib/orders/actions.ts` appellent aussi `applyLoyaltyOrder` — le retour étendu est rétro-compatible (champs ajoutés), ils ne nécessitent aucun changement, mais vérifier par grep.

- [ ] **Step 1: Étendre `applyLoyaltyOrder`**

Dans la branche `customerId` (cliente POS connue), remplacer le `return` par :

```ts
    return {
      customerId: updated.id,
      vipBefore: existing.vip,
      pointsEarned: points - existing.points,
      newBalance: points,
    };
```

Dans la branche web (matching téléphone), remplacer le `return` final par :

```ts
  return {
    customerId: customer.id,
    vipBefore: existing?.vip ?? false,
    pointsEarned: points - (existing?.points ?? 0),
    newBalance: points,
  };
```

et mettre à jour la signature :

```ts
export async function applyLoyaltyOrder(
  params: ApplyLoyaltyOrderParams
): Promise<{ customerId: string; vipBefore: boolean; pointsEarned: number; newBalance: number }> {
```

- [ ] **Step 2: Vérifier qu'aucun appelant ne casse**

Run: `grep -rn "applyLoyaltyOrder" lib --include="*.ts" | grep -v generated`
Expected: `lib/pos/actions.ts` et `lib/orders/actions.ts` (champs ajoutés = rétro-compatible).
Run: `npm run typecheck`
Expected: propre.

- [ ] **Step 3: Restructurer le retour de `encaisserVente`**

Dans `lib/pos/actions.ts` : ajouter l'export du type puis faire remonter les données hors de la transaction. La transaction retourne désormais un objet composite au lieu du seul `order` :

```ts
export interface PosTicketData {
  shopName: string;
  lines: Array<{ name: string; qty: number; lineTotal: number }>;
  subtotal: number;
  discount: number;
  total: number;
  customerPhone: string | null;
  loyalty: { pointsEarned: number; newBalance: number } | null;
}
```

Dans le corps : déclarer `let loyaltyInfo: { pointsEarned: number; newBalance: number } | null = null;` avant l'appel `applyLoyaltyOrder` et l'alimenter dans le bloc `if (parsed.data.customerId)` :

```ts
        loyaltyInfo = { pointsEarned: loyalty.pointsEarned, newBalance: loyalty.newBalance };
```

Faire retourner à la transaction `{ order, built, phone, loyaltyInfo }` (renommer la variable de réception `const result = await prisma.$transaction(...)`), puis remplacer le `return { ok: true, ref: order.ref };` final par :

```ts
    return {
      ok: true,
      ref: result.order.ref,
      ticket: {
        shopName: tenant.name,
        lines: result.built.lines.map((l) => ({
          name: l.nameAtOrder,
          qty: l.qty,
          lineTotal: l.lineTotal,
        })),
        subtotal: result.built.lines.reduce((a, l) => a + l.unitPrice * l.qty, 0),
        discount: result.built.lines.reduce((a, l) => a + l.discount * l.qty, 0),
        total: result.built.total,
        customerPhone: result.phone || null,
        loyalty: result.loyaltyInfo,
      },
    };
```

(`loyaltyInfo`, `built` et `phone` sont déjà calculés à l'intérieur de la closure — il suffit de les inclure dans la valeur de retour de la closure. `revalidatePath` inchangés.)

- [ ] **Step 4: Vérifier**

Run: `npm run typecheck && npm run test`
Expected: propre — `PosScreen.handlePay` ignore simplement le champ `ticket` supplémentaire pour l'instant.

- [ ] **Step 5: Commit**

```bash
git add lib/customers/applyLoyaltyOrder.ts lib/pos/actions.ts
git commit -m "feat(pos): encaisserVente returns ticket payload (lines, discounts, loyalty, phone)"
```

---

### Task 5: Modale de ticket — lignes, WhatsApp, impression

**Files:**
- Modify: `lib/format.ts` (+ helper `whatsappShareLink`)
- Modify: `lib/format.test.ts` (tests du helper)
- Modify: `lib/store/useBackoffice.ts` (interface `Ticket`, lignes 17-22)
- Modify: `components/dashboard/screens/PosScreen.tsx` (`handlePay`, lignes ~480-498)
- Modify: `components/dashboard/TicketModal.tsx` (lignes d'articles, remise, fidélité, boutons)

**Interfaces:**
- Consumes: `buildTicketMessage`/`TicketMessageInput` (Task 3), `PosTicketData` retourné par `encaisserVente` (Task 4), `PAYMENT_LABELS` (Task 1), `whatsappLink` (existant).
- Produces: interface `Ticket` enrichie (état Zustand) — aucun consommateur en aval de ce plan.

- [ ] **Step 1: Test du helper de partage (échec attendu)**

Ajouter dans `lib/format.test.ts` :

```ts
import { whatsappShareLink } from "./format";

describe("whatsappShareLink", () => {
  it("construit un lien wa.me sans destinataire avec le message encodé", () => {
    expect(whatsappShareLink("Reçu #TER-1")).toBe("https://wa.me/?text=Re%C3%A7u%20%23TER-1");
  });
});
```

- [ ] **Step 2: Vérifier l'échec puis implémenter**

Run: `npx vitest run lib/format.test.ts` → FAIL (export manquant).

Ajouter dans `lib/format.ts` sous `whatsappLink` :

```ts
/** Lien de partage WhatsApp sans destinataire (l'app ouvre le choix du contact). */
export function whatsappShareLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
```

Run: `npx vitest run lib/format.test.ts` → PASS.

- [ ] **Step 3: Enrichir l'interface `Ticket` du store**

Dans `lib/store/useBackoffice.ts`, remplacer l'interface `Ticket` par :

```ts
export interface Ticket {
  ref: string;
  items: number;
  pay: string;
  total: string;
  lines: Array<{ name: string; qty: number; lineTotal: number }>;
  /** Remises par ligne agrégées en FCFA (0 = aucune). */
  discount: number;
  subtotal: number;
  loyalty: { pointsEarned: number; newBalance: number } | null;
  /** Message WhatsApp pré-construit (buildTicketMessage). */
  waMessage: string;
  customerPhone: string | null;
}
```

- [ ] **Step 4: Alimenter le ticket dans `PosScreen.handlePay`**

Remplacer l'appel `showTicket({ ... })` par :

```ts
    const message = buildTicketMessage({
      shopName: result.ticket.shopName,
      ref: result.ref,
      date: new Date(),
      lines: result.ticket.lines,
      subtotal: result.ticket.subtotal,
      discount: result.ticket.discount,
      total: result.ticket.total,
      payLabel: PAYMENT_LABELS[pay],
      loyalty: result.ticket.loyalty,
    });
    showTicket({
      ref: result.ref,
      items: cart.reduce((a, l) => a + l.qty, 0),
      pay: PAYMENT_LABELS[pay],
      total: money(result.ticket.total),
      lines: result.ticket.lines,
      discount: result.ticket.discount,
      subtotal: result.ticket.subtotal,
      loyalty: result.ticket.loyalty,
      waMessage: message,
      customerPhone: result.ticket.customerPhone,
    });
```

avec l'import `import { buildTicketMessage } from "@/lib/pos/ticketMessage";`. Noter que le total affiché vient désormais du **serveur** (`result.ticket.total`), plus du calcul local.

- [ ] **Step 5: Enrichir `TicketModal`**

Dans `components/dashboard/TicketModal.tsx` :

1. Sous la `Row` « Articles », insérer la liste des lignes puis les remises éventuelles :

```tsx
          <div style={{ borderTop: `1px solid ${colors.borderSoft}`, margin: "10px 0", paddingTop: 10 }}>
            {ticket.lines.map((l) => (
              <div key={l.name + l.qty} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0", color: colors.ink }}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name} × {l.qty}</span>
                <span style={{ fontWeight: 600 }}>{money(l.lineTotal)}</span>
              </div>
            ))}
          </div>
          {ticket.discount > 0 && <Row label="Sous-total" value={money(ticket.subtotal)} />}
          {ticket.discount > 0 && <Row label="Remise" value={`−${money(ticket.discount)}`} />}
```

(import `money` depuis `@/lib/format` ; réutiliser le composant `Row` local ; si `colors.ink` n'existe pas, prendre la couleur de texte par défaut déjà utilisée dans le fichier.)

2. Sous la ligne Total, si `ticket.loyalty` : `<Row label="Points gagnés" value={`+${ticket.loyalty.pointsEarned} · solde ${ticket.loyalty.newBalance}`} />`.

3. Boutons : passer la rangée en deux lignes — première ligne « Envoyer sur WhatsApp » (pleine largeur, fond `#25D366`, texte blanc, icône `ICONS.whatsapp` si présente dans `ICONS`, sinon sans icône) :

```tsx
            <button
              onClick={() => {
                const url = ticket.customerPhone
                  ? whatsappLink(ticket.customerPhone, ticket.waMessage)
                  : whatsappShareLink(ticket.waMessage);
                window.open(url, "_blank", "noopener");
              }}
              style={{ width: "100%", height: 46, border: "none", borderRadius: 10, background: "#25D366", color: "#fff", font: `600 14px ${fonts.ui}`, cursor: "pointer", marginBottom: 10 }}
            >
              Envoyer sur WhatsApp
            </button>
```

seconde ligne : « Nouvelle vente » (inchangé) + « Imprimer » dont le `onClick` devient `() => window.print()` (correctif : il fermait la modale).

- [ ] **Step 6: Vérifier**

Run: `npm run typecheck && npm run test`
Expected: propre, tous les tests verts.

Vérification navigateur : encaisser une vente **avec** cliente rattachée → la modale liste les articles, le bloc points apparaît, le bouton WhatsApp ouvre `wa.me/<numéro>?text=…` avec le reçu complet pré-rempli (vérifier l'URL de l'onglet ouvert). Encaisser une vente **sans** cliente → pas de bloc points, le bouton ouvre `wa.me/?text=…`.

- [ ] **Step 7: Commit**

```bash
git add lib/format.ts lib/format.test.ts lib/store/useBackoffice.ts components/dashboard/screens/PosScreen.tsx components/dashboard/TicketModal.tsx
git commit -m "feat(pos): ticket modal with line items and WhatsApp receipt sharing"
```

---

### Task 6: Vérification finale du lot

**Files:**
- Modify: `docs/superpowers/EXECUTION-STATUS.md` (nouvelle section en fin de fichier)

**Interfaces:** aucune — tâche de clôture.

- [ ] **Step 1: Suite complète**

Run: `npm run test && npm run typecheck && npx next build --webpack`
Expected: tous les tests verts, typecheck propre, build réussi (routes listées).

- [ ] **Step 2: Parcours navigateur complet**

Sur `/admin/pos` (session owner requise — si aucune session authentifiée n'est disponible dans le navigateur, documenter les étapes restantes pour l'utilisateur dans EXECUTION-STATUS, comme aux sous-projets précédents) : vente Wave avec cliente → ticket complet → WhatsApp pré-adressé ; vente Espèces sans cliente → WhatsApp choix du contact ; vérifier en base le `paymentMethod` des deux ventes.

- [ ] **Step 3: Mettre à jour EXECUTION-STATUS.md**

Ajouter une section « Lots paiements détaillés + ticket WhatsApp (2026-07-20) » : ce qui est fait, référence au spec, tout écart ou vérification restant pour l'utilisateur.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/EXECUTION-STATUS.md
git commit -m "docs: record detailed payments + WhatsApp ticket completion in EXECUTION-STATUS"
```
