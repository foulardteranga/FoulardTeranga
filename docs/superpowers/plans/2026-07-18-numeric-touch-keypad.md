# Numeric Touch Keypad Implementation Plan (Chantier 4/4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la saisie numérique native (peu adaptée au tactile) par un composant `NumericField` adaptatif — pavé numérique en bottom-sheet sur pointeur tactile, saisie clavier native inchangée sur desktop — déployé sur tous les champs numériques du site : prix/stock produit, réglage `number` de l'éditeur, téléphone (connexion + fiche KYC), quantités POS/panier/fiche produit.

**Architecture:** Un hook `useCoarsePointer` (détection tactile via `matchMedia`), un pavé `NumericPad` dont la logique de composition de valeur est extraite en fonctions pures testées (`numericPadLogic.ts`, même principe que `sheetHeight.ts` du chantier 3), un champ `NumericField` qui bascule entre saisie native (desktop) et pavé (tactile) en réutilisant le `BottomSheet` du chantier 3, et un `QtyStepper` (steppers +/− existants, enrichis d'un tap sur le nombre central pour ouvrir le pavé, borné au stock disponible). Aucune nouvelle dépendance, aucune migration.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript strict, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-18-vitrine-cms-images-digitpad-design.md` (§ Chantier 4)

## Global Constraints

- Langue produit : FR. Code, commits, identifiants : EN. Commentaires FR = convention du repo. Conventional Commits.
- TypeScript strict, jamais de `any`.
- **Aucune nouvelle dépendance.**
- **Pas de Playwright** (confirmé absent du repo) : vérification par `npm run typecheck && npm test` (Vitest, logique pure uniquement) + passage navigateur, comme les 3 chantiers précédents.
- **Zéro régression de la saisie native desktop** : sur pointeur fin (souris/clavier), les champs `money`/`integer`/`decimal` restent `<input type="number">` (contrôle natif du navigateur, identique à l'existant) ; seul le mode `phone` reste `type="tel"` texte libre, comme aujourd'hui. Le pavé tactile est un mode d'interaction **ajouté**, jamais une dégradation de l'existant.
- **`useCoarsePointer` retourne `false` par défaut** (SSR/premier rendu), se met à jour après montage via `matchMedia("(pointer: coarse)")` — même philosophie que le `matchMedia` déjà utilisé dans `VitrineEditor.tsx` (chantier 3).
- Logique de composition de valeur du pavé (`numericPadLogic.ts`) séparée du composant `.tsx`, testée en Vitest — même convention que `sheetHeight.ts`/`BottomSheet.tsx` (chantier 3), nécessaire pour rester dans le périmètre testable de ce repo (`vitest.config.ts` : `**/*.test.ts` uniquement, environnement `node`).
- Boutons du pavé ≥ 56 px (cible tactile, cf. spec).
- Toute nouvelle icône dans `components/ui/Icon.tsx` suit le style existant (2–4 primitives simples, stroke).
- **Portée volontairement limitée pour les quantités panier vitrine** (`CartView.tsx`) : ce composant n'a aujourd'hui aucun accès au stock produit (`StoreCartLine` ne porte pas de champ stock, `CartView` ne reçoit pas `products`) — les boutons +/− actuels sont **déjà non bornés**. `QtyStepper` y est déployé **sans** prop `max`, ce qui préserve exactement le comportement actuel (ni plus, ni moins permissif). Border le panier vitrine par le stock réel est un chantier à part (fil de données `products` à faire remonter jusqu'à la page panier), explicitement hors périmètre ici.
- Vérification par tâche : `npm run typecheck` et `npm test` avant chaque commit.

---

### Task 1: `useCoarsePointer`, `numericPadLogic`, `NumericPad`, `NumericField`

**Files:**
- Create: `components/ui/useCoarsePointer.ts`
- Create: `components/ui/numericPadLogic.ts`
- Test: `components/ui/numericPadLogic.test.ts`
- Create: `components/ui/NumericPad.tsx`
- Create: `components/ui/NumericField.tsx`
- Modify: `components/ui/Icon.tsx` (1 nouvelle icône : `keypad`)

**Interfaces:**
- Consumes: `colors`, `fonts` (`@/lib/theme/tokens`), `Icon`, `ICONS` (`@/components/ui/Icon`), `BottomSheet` (`@/components/ui/BottomSheet`, chantier 3), `fmt` (`@/lib/format`).
- Produces (consommés par les Tasks 2–5) :
  - `useCoarsePointer(): boolean`
  - `type NumericMode = "integer" | "money" | "decimal" | "phone"`
  - `appendDigit(value: string, digit: string, mode: NumericMode): string`, `appendDoubleZero(value: string): string`, `deleteLast(value: string): string`, `clampNumericValue(value: string, min?: number, max?: number): string`, `formatPadValue(value: string, mode: NumericMode): string`
  - `<NumericPad value mode onChange onConfirm />`
  - `<NumericField mode value onChange label? placeholder? min? max? invalid? />`

- [ ] **Step 1: Write the failing tests**

Créer `components/ui/numericPadLogic.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { fmt } from "@/lib/format";
import {
  appendDigit, appendDoubleZero, deleteLast, clampNumericValue, formatPadValue,
} from "./numericPadLogic";

describe("appendDigit", () => {
  it("mode integer : concatène les chiffres", () => {
    expect(appendDigit("1", "2", "integer")).toBe("12");
  });

  it("mode integer : remplace un zéro seul non significatif", () => {
    expect(appendDigit("0", "5", "integer")).toBe("5");
  });

  it("mode decimal : autorise un seul point", () => {
    expect(appendDigit("12", ".", "decimal")).toBe("12.");
    expect(appendDigit("12.5", ".", "decimal")).toBe("12.5");
  });

  it("mode decimal : un point sur une valeur vide part de '0.'", () => {
    expect(appendDigit("", ".", "decimal")).toBe("0.");
  });

  it("mode money : refuse le point (pas de décimales FCFA)", () => {
    expect(appendDigit("15000", ".", "money")).toBe("15000");
  });

  it("mode phone : autorise un '+' unique en tête", () => {
    expect(appendDigit("", "+", "phone")).toBe("+");
    expect(appendDigit("+225", "+", "phone")).toBe("+225");
  });

  it("mode phone : refuse le point", () => {
    expect(appendDigit("225", ".", "phone")).toBe("225");
  });
});

describe("appendDoubleZero", () => {
  it("ajoute '00' à une valeur existante", () => {
    expect(appendDoubleZero("15")).toBe("1500");
  });

  it("laisse '0' pour une valeur vide", () => {
    expect(appendDoubleZero("")).toBe("0");
  });
});

describe("deleteLast", () => {
  it("retire le dernier caractère", () => {
    expect(deleteLast("123")).toBe("12");
  });

  it("ne casse pas sur une chaîne vide", () => {
    expect(deleteLast("")).toBe("");
  });
});

describe("clampNumericValue", () => {
  it("borne au minimum", () => {
    expect(clampNumericValue("0", 1, 99)).toBe("1");
  });

  it("borne au maximum", () => {
    expect(clampNumericValue("500", 1, 99)).toBe("99");
  });

  it("laisse passer une valeur dans les bornes", () => {
    expect(clampNumericValue("12", 1, 99)).toBe("12");
  });

  it("laisse la chaîne vide inchangée (aucune saisie)", () => {
    expect(clampNumericValue("", 1, 99)).toBe("");
  });

  it("fonctionne sans bornes fournies", () => {
    expect(clampNumericValue("42")).toBe("42");
  });
});

describe("formatPadValue", () => {
  it("mode money : groupe les milliers et ajoute FCFA", () => {
    expect(formatPadValue("15000", "money")).toBe(`${fmt(15000)} FCFA`);
  });

  it("autres modes : valeur inchangée", () => {
    expect(formatPadValue("15000", "integer")).toBe("15000");
    expect(formatPadValue("+225", "phone")).toBe("+225");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- components/ui/numericPadLogic.test.ts`
Expected: FAIL — `./numericPadLogic` introuvable.

- [ ] **Step 3: Create `components/ui/numericPadLogic.ts`**

```ts
import { fmt } from "@/lib/format";

export type NumericMode = "integer" | "money" | "decimal" | "phone";

/** Ajoute un caractère à la valeur en cours, en respectant les règles du
 *  mode. Retourne la valeur inchangée si le caractère n'est pas autorisé. */
export function appendDigit(value: string, digit: string, mode: NumericMode): string {
  if (mode === "phone") {
    if (digit === "+") return value.includes("+") ? value : "+" + value;
    if (!/^[0-9]$/.test(digit)) return value;
    return value + digit;
  }
  if (digit === ".") {
    if (mode !== "decimal" || value.includes(".")) return value;
    return value === "" ? "0." : value + ".";
  }
  if (!/^[0-9]$/.test(digit)) return value;
  // évite les zéros non significatifs ("0" + "5" -> "5", pas "05")
  if (value === "0") return digit;
  return value + digit;
}

/** Ajoute « 00 » en un tap (touche contextuelle du mode montant). */
export function appendDoubleZero(value: string): string {
  if (value === "" || value === "0") return "0";
  return value + "00";
}

/** Retire le dernier caractère saisi. */
export function deleteLast(value: string): string {
  return value.slice(0, -1);
}

/** Borne une valeur numérique entre min et max, une fois confirmée par l'utilisateur. */
export function clampNumericValue(value: string, min?: number, max?: number): string {
  if (value === "" || value === ".") return value;
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  let clamped = n;
  if (min !== undefined) clamped = Math.max(min, clamped);
  if (max !== undefined) clamped = Math.min(max, clamped);
  return String(clamped);
}

/** Formate la valeur en cours pour l'affichage du pavé (groupement de milliers en mode montant). */
export function formatPadValue(value: string, mode: NumericMode): string {
  if (mode === "money" && value !== "" && value !== "0") {
    const n = Number(value);
    return Number.isNaN(n) ? value : `${fmt(n)} FCFA`;
  }
  return value;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- components/ui/numericPadLogic.test.ts`
Expected: PASS.

- [ ] **Step 5: Create `components/ui/useCoarsePointer.ts`**

```ts
"use client";

import { useEffect, useState } from "react";

/**
 * Détecte un pointeur « grossier » (tactile) via matchMedia. Faux par défaut
 * (SSR/premier rendu, comme tout hook basé sur matchMedia dans ce projet —
 * cf. VitrineEditor.handleCanvasClick), se met à jour après montage.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(pointer: coarse)");
    setCoarse(mql.matches);
    const handler = (e: MediaQueryListEvent) => setCoarse(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return coarse;
}
```

- [ ] **Step 6: Add the `keypad` icon**

Dans `components/ui/Icon.tsx`, ajouter dans l'objet `ICONS` (après `eyeOff`) :

```ts
  keypad: '<circle cx="6" cy="6" r="1.3"/><circle cx="12" cy="6" r="1.3"/><circle cx="18" cy="6" r="1.3"/><circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/><circle cx="6" cy="18" r="1.3"/><circle cx="12" cy="18" r="1.3"/><circle cx="18" cy="18" r="1.3"/>',
```

- [ ] **Step 7: Create `components/ui/NumericPad.tsx`**

```tsx
"use client";

import { colors, fonts } from "@/lib/theme/tokens";
import { appendDigit, appendDoubleZero, deleteLast, formatPadValue, type NumericMode } from "./numericPadLogic";

const DIGIT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Pavé numérique tactile — grille 3×4, touche contextuelle selon le mode
 * (« 00 » en mode montant, « + » en mode téléphone, « . » en mode décimal),
 * valeur formatée en direct (groupement de milliers en mode montant).
 */
export function NumericPad({
  value,
  mode,
  onChange,
  onConfirm,
}: {
  value: string;
  mode: NumericMode;
  onChange: (value: string) => void;
  onConfirm: () => void;
}) {
  const contextKey = mode === "money" ? "00" : mode === "phone" ? "+" : mode === "decimal" ? "." : null;

  function press(key: string) {
    if (key === "00") onChange(appendDoubleZero(value));
    else onChange(appendDigit(value, key, mode));
  }

  return (
    <div style={{ padding: "8px 18px 18px" }}>
      <div
        style={{
          height: 56, display: "flex", alignItems: "center", justifyContent: "flex-end",
          padding: "0 4px", marginBottom: 14, fontFamily: fonts.display, fontWeight: 600, fontSize: 26,
          borderBottom: `1.5px solid ${colors.borderSoft}`, color: value ? colors.ink : colors.muted,
        }}
      >
        {value ? formatPadValue(value, mode) : "0"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
        {DIGIT_KEYS.map((k) => (
          <PadKey key={k} label={k} onClick={() => press(k)} />
        ))}
        {contextKey ? <PadKey label={contextKey} onClick={() => press(contextKey)} /> : <span aria-hidden />}
        <PadKey label="0" onClick={() => press("0")} />
        <PadKey label="⌫" onClick={() => onChange(deleteLast(value))} muted />
      </div>
      <button onClick={onConfirm} style={confirmBtn}>Valider</button>
    </div>
  );
}

function PadKey({ label, onClick, muted }: { label: string; onClick: () => void; muted?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 56, border: `1.5px solid ${colors.borderSoft}`, borderRadius: 12,
        background: "#fff", color: muted ? colors.muted : colors.ink,
        font: `700 20px ${fonts.ui}`, cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

const confirmBtn: React.CSSProperties = {
  width: "100%", height: 48, border: "none", borderRadius: 10,
  background: colors.primary, color: "#fff", font: `700 14px ${fonts.ui}`, cursor: "pointer",
};
```

- [ ] **Step 8: Create `components/ui/NumericField.tsx`**

```tsx
"use client";

import { useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { BottomSheet } from "./BottomSheet";
import { NumericPad } from "./NumericPad";
import { useCoarsePointer } from "./useCoarsePointer";
import { clampNumericValue, type NumericMode } from "./numericPadLogic";

const NATIVE_TYPE: Record<NumericMode, "number" | "tel"> = {
  integer: "number", money: "number", decimal: "number", phone: "tel",
};
const INPUT_MODE: Record<NumericMode, "numeric" | "decimal" | "tel"> = {
  integer: "numeric", money: "numeric", decimal: "decimal", phone: "tel",
};

/**
 * Champ numérique adaptatif : sur pointeur tactile, le champ passe en lecture
 * seule et un tap ouvre un pavé numérique en bottom-sheet ; au clavier/souris,
 * saisie native inchangée (type number/tel — même contrôle natif qu'avant,
 * zéro régression), avec une icône pour ouvrir le pavé si on préfère.
 */
export function NumericField({
  mode,
  value,
  onChange,
  label,
  placeholder,
  min,
  max,
  invalid,
}: {
  mode: NumericMode;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  invalid?: boolean;
}) {
  const coarse = useCoarsePointer();
  const [padOpen, setPadOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  function openPad() {
    setDraft(value);
    setPadOpen(true);
  }

  function confirmPad() {
    onChange(mode === "phone" ? draft : clampNumericValue(draft, min, max));
    setPadOpen(false);
  }

  const baseStyle: React.CSSProperties = {
    width: "100%", height: 44, padding: "0 13px",
    border: `1.5px solid ${invalid ? colors.danger : colors.borderField}`,
    borderRadius: 10, font: `400 14px ${fonts.ui}`, color: colors.ink, outline: "none",
  };

  return (
    <div>
      {label && (
        <label style={{ display: "block", font: `600 12px ${fonts.ui}`, color: colors.muted, marginBottom: 6 }}>
          {label}
        </label>
      )}
      {coarse ? (
        <input
          value={value}
          readOnly
          onClick={openPad}
          inputMode="none"
          placeholder={placeholder}
          style={{ ...baseStyle, cursor: "pointer" }}
        />
      ) : (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type={NATIVE_TYPE[mode]}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            inputMode={INPUT_MODE[mode]}
            placeholder={placeholder}
            style={{ ...baseStyle, flex: 1 }}
          />
          <button type="button" onClick={openPad} aria-label="Ouvrir le pavé numérique" style={padIconBtn}>
            <Icon path={ICONS.keypad} size={16} stroke={colors.primary} />
          </button>
        </div>
      )}
      <BottomSheet open={padOpen} onClose={() => setPadOpen(false)} title={label ?? "Saisie"}>
        <NumericPad value={draft} mode={mode} onChange={setDraft} onConfirm={confirmPad} />
      </BottomSheet>
    </div>
  );
}

const padIconBtn: React.CSSProperties = {
  width: 36, height: 44, flex: "none", border: `1.5px solid ${colors.borderField}`, borderRadius: 10,
  background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
};
```

- [ ] **Step 9: Typecheck and full test run**

Run: `npm run typecheck && npm test`
Expected: PASS (155 existants + les nouveaux tests `numericPadLogic`). Pas de vérification navigateur à cette étape — `NumericField`/`NumericPad` n'ont pas encore de consommateur (Tasks 2–5).

- [ ] **Step 10: Commit**

```bash
git add components/ui/useCoarsePointer.ts components/ui/numericPadLogic.ts components/ui/numericPadLogic.test.ts components/ui/NumericPad.tsx components/ui/NumericField.tsx components/ui/Icon.tsx
git commit -m "feat(ui): adaptive NumericField with touch keypad (BottomSheet-based)"
```

---

### Task 2: Déploiement — prix & stock produit (`InventoryScreen`)

**Files:**
- Modify: `components/dashboard/screens/InventoryScreen.tsx`

**Interfaces:**
- Consumes: `NumericField` (Task 1).
- Produces: —

- [ ] **Step 1: Import `NumericField`**

En tête de `components/dashboard/screens/InventoryScreen.tsx` :

```ts
import { NumericField } from "@/components/ui/NumericField";
```

- [ ] **Step 2: Replace the price and stock inputs**

Remplacer :

```tsx
            <FormField label="Prix (FCFA)">
              <input type="number" min={0} value={form.price} onChange={(e) => set("price", e.target.value)} style={textField} placeholder="15000" />
            </FormField>
            <FormField label="Stock initial">
              <input type="number" min={0} value={form.stock} onChange={(e) => set("stock", e.target.value)} style={textField} placeholder="10" />
            </FormField>
```

par :

```tsx
            <FormField label="Prix (FCFA)">
              <NumericField mode="money" value={form.price} onChange={(v) => set("price", v)} placeholder="15000" min={0} />
            </FormField>
            <FormField label="Stock initial">
              <NumericField mode="integer" value={form.stock} onChange={(v) => set("stock", v)} placeholder="10" min={0} />
            </FormField>
```

(`FormField` fournit déjà le `<label>` — ne pas passer la prop `label` à `NumericField` ici, pour éviter un doublon.)

- [ ] **Step 3: Typecheck and full test run**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 4: Browser verification (controller)**

Sur `/admin/inventaire` → « + Produit » : en souris/clavier, les champs Prix/Stock se comportent exactement comme avant (saisie native, flèches de `type=number`, plus une petite icône pavé cliquable qui ouvre la bottom-sheet). Redimensionner en mobile (ou tester sur un vrai appareil tactile si disponible) : le champ devient lecture seule, le tap ouvre le pavé, « Valider » applique la valeur bornée (`min=0`).

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/screens/InventoryScreen.tsx
git commit -m "feat(inventory): touch keypad for price and stock fields"
```

---

### Task 3: Déploiement — champ `number` de l'éditeur de blocs (`SettingsField`)

**Files:**
- Modify: `components/editor/SettingsField.tsx`

**Interfaces:**
- Consumes: `NumericField` (Task 1).
- Produces: —

- [ ] **Step 1: Import `NumericField`**

Ajouter en tête de `components/editor/SettingsField.tsx` :

```ts
import { NumericField } from "@/components/ui/NumericField";
```

- [ ] **Step 2: Replace the `number` kind branch**

Remplacer :

```tsx
      ) : field.kind === "number" ? (
        <input type="number" value={Number(value ?? 0)} onChange={(e) => onChange(Number(e.target.value))} style={base} />
      ) : (
```

par :

```tsx
      ) : field.kind === "number" ? (
        <NumericField mode="integer" value={String(value ?? 0)} onChange={(v) => onChange(Number(v) || 0)} />
      ) : (
```

(Le `<label>` du champ est déjà rendu juste au-dessus par `SettingsField` — ne pas passer `label` à `NumericField` ici non plus.)

- [ ] **Step 3: Typecheck and full test run**

Run: `npm run typecheck && npm test`
Expected: PASS. Aucun bloc n'utilise actuellement `kind: "number"` (vérifié dans `lib/storefront/blockSettings.ts`) — ce chemin est prêt pour un futur champ, pas de vérification navigateur possible sur un bloc réel à cette étape. Se contenter du typecheck.

- [ ] **Step 4: Commit**

```bash
git add components/editor/SettingsField.tsx
git commit -m "feat(editor): touch keypad for the generic number setting field"
```

---

### Task 4: Déploiement — téléphone (connexion + fiche KYC)

**Files:**
- Modify: `components/storefront/views/CheckoutView.tsx`
- Modify: `components/storefront/views/AccountAuthView.tsx`

**Interfaces:**
- Consumes: `NumericField` (Task 1).
- Produces: —

- [ ] **Step 1: `CheckoutView` — direct replacement (champ contrôlé Zustand)**

Ajouter l'import en tête du fichier :

```ts
import { NumericField } from "@/components/ui/NumericField";
```

Remplacer :

```tsx
          <Field label="Numéro de contact *" error={errors.phone}>
            <input value={kyc.phone} onChange={(e) => setKycField("phone", e.target.value)} placeholder="Ex. +225 07 12 45 67 89" style={inputStyle(!!errors.phone)} />
          </Field>
```

par :

```tsx
          <Field label="Numéro de contact *" error={errors.phone}>
            <NumericField mode="phone" value={kyc.phone} onChange={(v) => setKycField("phone", v)} placeholder="Ex. +225 07 12 45 67 89" invalid={!!errors.phone} />
          </Field>
```

- [ ] **Step 2: `AccountAuthView` — formulaire natif (Server Action), champ contrôlé + input caché**

`useState` est déjà importé en tête du fichier (`import { useActionState, useState } from "react";`). Dans `SignupForm`, ajouter l'état local juste après la ligne `const [state, formAction, pending] = useActionState<...>(signUpCustomer, null);` :

```ts
  const [phone, setPhone] = useState("");
```

Ajouter l'import en tête du fichier :

```ts
import { NumericField } from "@/components/ui/NumericField";
```

Remplacer :

```tsx
      <Field label="Téléphone" error={state && !state.ok ? state.errors.phone : undefined}>
        <input type="tel" name="phone" required placeholder="Ex. +225 07 12 45 67 89" style={inputStyle} />
      </Field>
```

par :

```tsx
      <Field label="Téléphone" error={state && !state.ok ? state.errors.phone : undefined}>
        <NumericField
          mode="phone"
          value={phone}
          onChange={setPhone}
          placeholder="Ex. +225 07 12 45 67 89"
          invalid={!!(state && !state.ok && state.errors.phone)}
        />
        <input type="hidden" name="phone" value={phone} required />
      </Field>
```

(`Field` accepte déjà plusieurs enfants — le `NumericField` visible + l'`<input type="hidden">` qui porte le `name="phone"` lu par `formAction`/`signUpCustomer` côté serveur, exactement comme le faisait l'ancien `<input type="tel" name="phone">`.)

- [ ] **Step 3: Typecheck and full test run**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 4: Browser verification (controller)**

`/commander` (checkout, panier non vide requis) : le champ téléphone fonctionne en saisie directe (souris/clavier) et via le pavé (tactile, touche contextuelle « + »), l'erreur de validation rougit toujours la bordure. `/compte` → « Créer un compte » : même vérification sur le champ Téléphone de l'inscription, et confirmer que la soumission du formulaire transmet bien le numéro saisi (message d'erreur serveur si le numéro est invalide, comme avant).

- [ ] **Step 5: Commit**

```bash
git add components/storefront/views/CheckoutView.tsx components/storefront/views/AccountAuthView.tsx
git commit -m "feat(storefront): touch keypad for phone fields (checkout + signup)"
```

---

### Task 5: `QtyStepper` — quantités POS, panier vitrine, fiche produit

**Files:**
- Create: `components/ui/QtyStepper.tsx`
- Modify: `components/dashboard/screens/PosScreen.tsx`
- Modify: `components/storefront/views/CartView.tsx`
- Modify: `components/storefront/views/ProductView.tsx`

**Interfaces:**
- Consumes: `BottomSheet`, `NumericPad`, `clampNumericValue` (Task 1).
- Produces: `<QtyStepper qty={number} onChange={(qty: number) => void} max={number}? big={boolean}? />` — stepper +/− existant, enrichi d'un tap sur le nombre central ouvrant un pavé (mode `integer`, borné `[1, max]` si `max` est fourni).

- [ ] **Step 1: Create `components/ui/QtyStepper.tsx`**

```tsx
"use client";

import { useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { BottomSheet } from "./BottomSheet";
import { NumericPad } from "./NumericPad";
import { clampNumericValue } from "./numericPadLogic";

/**
 * Stepper +/− avec valeur centrale ouvrant un pavé numérique tactile pour
 * saisir une quantité directement — bornée à [1, max] si max est fourni.
 */
export function QtyStepper({
  qty,
  onChange,
  max,
  big,
}: {
  qty: number;
  onChange: (qty: number) => void;
  max?: number;
  big?: boolean;
}) {
  const [padOpen, setPadOpen] = useState(false);
  const [draft, setDraft] = useState(String(qty));
  const size = big ? 38 : 34;

  function openPad() {
    setDraft(String(qty));
    setPadOpen(true);
  }

  function confirmPad() {
    const clamped = clampNumericValue(draft === "" ? "1" : draft, 1, max);
    onChange(Number(clamped));
    setPadOpen(false);
  }

  return (
    <>
      <div style={{ display: "inline-flex", alignItems: "center", height: size, border: `1.5px solid ${colors.borderField}`, borderRadius: 9, overflow: "hidden" }}>
        <button onClick={() => onChange(Math.max(1, qty - 1))} aria-label="Diminuer" style={stepBtnStyle(size)}>−</button>
        <button onClick={openPad} aria-label="Saisir la quantité" style={{ width: big ? 36 : 38, height: "100%", border: "none", background: "#fff", font: `600 14px ${fonts.ui}`, cursor: "pointer" }}>
          {qty}
        </button>
        <button onClick={() => onChange(max !== undefined ? Math.min(max, qty + 1) : qty + 1)} aria-label="Augmenter" style={stepBtnStyle(size)}>+</button>
      </div>
      <BottomSheet open={padOpen} onClose={() => setPadOpen(false)} title="Quantité">
        <NumericPad value={draft} mode="integer" onChange={setDraft} onConfirm={confirmPad} />
      </BottomSheet>
    </>
  );
}

function stepBtnStyle(w: number): React.CSSProperties {
  return { width: w, height: "100%", border: "none", background: colors.ivory, fontSize: w >= 38 ? 18 : 17, color: colors.primary, cursor: "pointer" };
}
```

- [ ] **Step 2: `PosScreen` — thread `products` down, replace both `Stepper` call sites, delete the local `Stepper`**

Dans `components/dashboard/screens/PosScreen.tsx` :

1. Import `QtyStepper` en tête du fichier :

```ts
import { QtyStepper } from "@/components/ui/QtyStepper";
```

2. Passer `products` aux deux composants de panier (les deux call sites dans `PosScreen`) :

```tsx
      <CartPanelDesktop total={total} sub={sub} disc={disc} customers={customers} products={products} />
```

```tsx
      {cartOpen && <CartSheetMobile total={total} onClose={closeCart} customers={customers} products={products} />}
```

3. Étendre les deux signatures pour recevoir `products` :

```tsx
function CartPanelDesktop({ total, sub, disc, customers, products }: { total: number; sub: number; disc: number; customers: Customer[]; products: Product[] }) {
```

```tsx
function CartSheetMobile({ total, onClose, customers, products }: { total: number; onClose: () => void; customers: Customer[]; products: Product[] }) {
```

4. Dans `CartPanelDesktop`, propager `products` à `CartLineDesktop` :

```tsx
          cart.map((l) => <CartLineDesktop key={l.id} line={l} stock={products.find((p) => p.id === l.id)?.stock} />)
```

5. Étendre `CartLineDesktop` et remplacer son `Stepper` :

```tsx
function CartLineDesktop({ line: l, stock }: { line: CartLine; stock?: number }) {
```

Remplacer :

```tsx
        <Stepper qty={l.qty} onDec={() => incLine(l.id, -1)} onInc={() => incLine(l.id, 1)} />
```

par :

```tsx
        <QtyStepper qty={l.qty} onChange={(qty) => incLine(l.id, qty - l.qty)} max={stock} />
```

6. Dans `CartSheetMobile`, remplacer :

```tsx
                  <Stepper qty={l.qty} big onDec={() => incLine(l.id, -1)} onInc={() => incLine(l.id, 1)} />
```

par :

```tsx
                  <QtyStepper qty={l.qty} big onChange={(qty) => incLine(l.id, qty - l.qty)} max={products.find((p) => p.id === l.id)?.stock} />
```

7. Supprimer les fonctions `Stepper` et `stepBtn` désormais inutilisées (celles définies dans ce fichier, remplacées par `QtyStepper`/`stepBtnStyle`) — vérifier au préalable qu'aucun autre appel à `<Stepper` ou `stepBtn(` ne subsiste dans le fichier.

- [ ] **Step 3: `CartView` (vitrine) — replace the inline stepper, no `max` (see Global Constraints)**

Dans `components/storefront/views/CartView.tsx` :

1. Import `QtyStepper` en tête du fichier :

```ts
import { QtyStepper } from "@/components/ui/QtyStepper";
```

2. Remplacer le stepper inline (les deux boutons −/+ entourant `{line.qty}`) :

```tsx
                      <button onClick={() => incLine(line.key, -1)} style={{ width: 38, height: "100%", border: "none", background: colors.ivory, fontSize: 17, color: colors.primary, cursor: "pointer" }}>−</button>
                      <span style={{ width: 42, textAlign: "center", font: `600 14px ${fonts.ui}` }}>{line.qty}</span>
                      <button onClick={() => incLine(line.key, 1)} style={{ width: 38, height: "100%", border: "none", background: colors.ivory, fontSize: 17, color: colors.primary, cursor: "pointer" }}>+</button>
```

par :

```tsx
                      <QtyStepper qty={line.qty} onChange={(qty) => incLine(line.key, qty - line.qty)} />
```

(Vérifier le conteneur parent : s'il portait déjà `border`/`borderRadius`/`overflow: hidden` spécifiquement pour habiller les 3 éléments remplacés, le simplifier puisque `QtyStepper` porte désormais sa propre bordure/arrondi — sinon laisser tel quel, `QtyStepper` s'insère sans conflit visuel notable.)

- [ ] **Step 4: `ProductView` — replace the standalone qty selector**

Dans `components/storefront/views/ProductView.tsx` :

1. Import `QtyStepper` en tête du fichier :

```ts
import { QtyStepper } from "@/components/ui/QtyStepper";
```

2. Remplacer :

```tsx
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ width: 46, height: "100%", border: "none", background: colors.ivory, fontSize: 20, color: colors.primary, cursor: "pointer" }}>−</button>
              <span style={{ width: 48, textAlign: "center", font: `600 16px ${fonts.ui}` }}>{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} style={{ width: 46, height: "100%", border: "none", background: colors.ivory, fontSize: 20, color: colors.primary, cursor: "pointer" }}>+</button>
```

par :

```tsx
              <QtyStepper qty={qty} onChange={setQty} max={stock} big />
```

(`stock` est déjà la variable en portée dans ce composant — `const stock = product.stock;`.)

- [ ] **Step 5: Typecheck and full test run**

Run: `npm run typecheck && npm test`
Expected: PASS (155 existants, aucun test cassé — `incLine`/`cartLogic` inchangés).

- [ ] **Step 6: Browser verification (controller)**

`/admin/pos` : ajouter un article, taper le nombre central du stepper → pavé s'ouvre, saisir une quantité → bornée au stock du produit, appliquée au panier. `/produit/<id>` : même vérification, bornée à `product.stock`. `/panier` : même vérification, **non bornée** (comportement identique à avant — confirmer qu'on peut toujours dépasser le stock affiché, exactement comme c'était déjà le cas).

- [ ] **Step 7: Commit**

```bash
git add components/ui/QtyStepper.tsx components/dashboard/screens/PosScreen.tsx components/storefront/views/CartView.tsx components/storefront/views/ProductView.tsx
git commit -m "feat: touch keypad for POS, cart and product quantity steppers"
```

---

### Task 6: Vérification de bout en bout

**Files:** aucun nouveau.

- [ ] **Step 1: Full local gate**

Run: `npm run typecheck && npm test && npx next build --webpack`
Expected: tout PASS, build sans erreur. (⚠️ `--webpack` obligatoire : Turbopack panique sur les accents NFD du chemin. ⚠️ Si le build échoue avec des erreurs Prisma/Supabase `SocketTimeout`, c'est une panne de connectivité externe déjà rencontrée aux chantiers 2 et 3, pas une régression de ce chantier — réessayer une fois la base accessible.)

- [ ] **Step 2: End-to-end manual pass**

Reprendre l'intégralité des vérifications navigateur des Tasks 2, 4 et 5 sur des données réelles du tenant (création d'un produit avec prix/stock au pavé, quantité POS/produit au pavé), en testant explicitement les deux modes d'interaction (souris/clavier ET tactile — redimensionner la fenêtre ou tester sur un vrai appareil si possible), puis **annuler tout changement de test** (supprimer le produit de test créé, remettre le panier à l'état d'origine) pour ne pas laisser de données de test réelles — même précaution que les chantiers 2 et 3.

- [ ] **Step 3: Final commit (if any fixups)**

```bash
git add -A
git commit -m "fix: end-to-end fixups for numeric touch keypad"
```

(Seulement s'il y a eu des correctifs ; sinon rien à committer.)
