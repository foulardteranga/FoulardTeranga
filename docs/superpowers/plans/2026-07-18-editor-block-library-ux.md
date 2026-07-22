# Editor Block Library UX Implementation Plan (Chantier 3/4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre l'éditeur de vitrine réellement « sans code » : liste de blocs glisser-déposer, bibliothèque de blocs (+ ajouter), toolbar contextuelle (dupliquer/déplacer/masquer/supprimer) et panneau mobile en bottom-sheet — en s'appuyant sur les fondations multi-instances du chantier 2.

**Architecture:** Deux nouveaux composants de présentation (`BlockListPanel` avec `@dnd-kit/sortable`, `BlockPicker`), un composant générique réutilisable (`BottomSheet`, partagé avec le futur pavé numérique du chantier 4), une toolbar flottante sur le canevas (`BlockCanvasToolbar`), et une réécriture de `VitrineEditor` qui orchestre le tout : aside desktop à deux zones, barre + sheet mobile. Aucune nouvelle route, aucun changement de schéma — tout consomme les opérations pures déjà livrées par le chantier 2 (`addBlock`, `duplicateBlock`, `removeBlock`, `reorderBlocks`).

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript strict, `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` (nouvelles dépendances), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-18-vitrine-cms-images-digitpad-design.md` (§ Chantier 3)

## Global Constraints

- Langue produit : FR. Code, commits, identifiants : EN. Commentaires FR = convention du repo. Conventional Commits.
- TypeScript strict, jamais de `any`.
- **Seule dépendance ajoutée** : `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0`, `@dnd-kit/utilities@3.2.2` (compatibles React ≥16.8, donc React 19.2).
- **Breakpoint réutilisé, aucun nouveau** : `max-width: 859.98px`, exactement celui déjà utilisé par `.ft-desktop-only`/`.ft-mobile-only`/`.ft-editor-cols` dans `app/globals.css`. Ne pas introduire 1024px ni une autre valeur.
- **Pas de Playwright** : ce repo n'a ni dépendance ni config Playwright (vérifié — aucun `tests/`, aucun `@playwright/test`). La vérification suit le pattern déjà établi aux chantiers 1 et 2 : `npm run typecheck && npm test` (Vitest, logique pure uniquement — `vitest.config.ts` n'inclut que `**/*.test.ts`, environnement `node`, donc **pas de rendu React en test**) + vérification manuelle/automatisée via le panneau navigateur (Claude Browser).
- Logique pure toujours séparée du composant `"use client"` qui la consomme (`components/ui/sheetHeight.ts` à côté de `BottomSheet.tsx`), même convention que `lib/store/cartLogic.ts`/`useStorefront.ts` — nécessaire ici pour rester testable en Vitest sans jamais importer un module `.tsx`.
- Boutons de la toolbar canevas et de la barre mobile ≥ 40 px (cible tactile).
- Toute nouvelle icône ajoutée à `components/ui/Icon.tsx` suit le style existant (viewBox 24×24 implicite, 2–4 primitives simples `rect`/`circle`/`path`, stroke).
- Vérification par tâche : `npm run typecheck` et `npm test` avant chaque commit.

---

### Task 1: Dépendances, icônes manquantes et table `BLOCK_ICONS`

**Files:**
- Modify: `package.json` (dépendances)
- Modify: `components/ui/Icon.tsx` (5 nouvelles icônes)
- Create: `components/editor/blockIcons.ts`
- Test: `components/editor/blockIcons.test.ts`

**Interfaces:**
- Consumes: `BlockId`, `DEFAULT_BLOCK_ORDER` (`@/lib/storefront/blockIds`), `ICONS` (`@/components/ui/Icon`).
- Produces: `ICONS.gallery`, `ICONS.mail`, `ICONS.duplicate`, `ICONS.eye`, `ICONS.eyeOff` (nouvelles entrées de tracés) ; `BLOCK_ICONS: Record<BlockId, string>` exporté de `components/editor/blockIcons.ts`, consommé par les Tasks 3 et 4 pour afficher une icône par bloc dans la liste, le sélecteur et la toolbar.

- [ ] **Step 1: Install the dependencies**

Run: `npm install @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0 @dnd-kit/utilities@3.2.2`
Expected: les trois packages apparaissent dans `package.json` (`dependencies`) et `package-lock.json`.

- [ ] **Step 2: Add the five new icon paths**

Dans `components/ui/Icon.tsx`, ajouter dans l'objet `ICONS` (après la ligne `print: '...'`) :

```ts
  gallery: '<rect x="3" y="7" width="14" height="14" rx="2"/><path d="M7 7V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m4 6 8 7 8-7"/>',
  duplicate: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V4a2 2 0 0 1 2-2h12"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M2 12s4-7 10-7c1.4 0 2.7.3 3.9.8M22 12s-1.4 2.4-3.7 4.4M9.9 9.9a3 3 0 0 0 4.2 4.2M1 1l22 22"/>',
```

- [ ] **Step 3: Write the failing test**

Créer `components/editor/blockIcons.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_BLOCK_ORDER } from "@/lib/storefront/blockIds";
import { BLOCK_ICONS } from "./blockIcons";

describe("BLOCK_ICONS", () => {
  it("fournit une icône non vide pour chaque type de bloc", () => {
    for (const type of DEFAULT_BLOCK_ORDER) {
      expect(BLOCK_ICONS[type].length).toBeGreaterThan(0);
    }
  });

  it("couvre exactement les 9 types de blocs, sans clé en trop", () => {
    expect(Object.keys(BLOCK_ICONS).sort()).toEqual([...DEFAULT_BLOCK_ORDER].sort());
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- components/editor/blockIcons.test.ts`
Expected: FAIL — `./blockIcons` introuvable.

- [ ] **Step 5: Create `components/editor/blockIcons.ts`**

```ts
import { ICONS } from "@/components/ui/Icon";
import type { BlockId } from "@/lib/storefront/blockIds";

/**
 * Icône (tracé SVG) par type de bloc — liste de blocs, sélecteur et toolbar
 * de l'éditeur. Ne vit pas dans lib/storefront/blockSettings.ts (module
 * server-safe, cf. l'avertissement en tête de lib/storefront/blockIds.ts) :
 * cette table dépend de components/ui/Icon et reste donc côté éditeur/client.
 */
export const BLOCK_ICONS: Record<BlockId, string> = {
  hero: ICONS.image,
  cats: ICONS.dash,
  grid: ICONS.cart,
  loyalty: ICONS.star,
  featured: ICONS.heart,
  story: ICONS.clock,
  look: ICONS.gallery,
  news: ICONS.mail,
  contact: ICONS.mapPin,
};
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- components/editor/blockIcons.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json components/ui/Icon.tsx components/editor/blockIcons.ts components/editor/blockIcons.test.ts
git commit -m "feat(editor): add dnd-kit, block icons and BLOCK_ICONS map"
```

---

### Task 2: `BottomSheet` — composant réutilisable (overlay + feuille redimensionnable)

**Files:**
- Create: `components/ui/sheetHeight.ts`
- Test: `components/ui/sheetHeight.test.ts`
- Create: `components/ui/BottomSheet.tsx`

**Interfaces:**
- Consumes: `colors`, `fonts` (`@/lib/theme/tokens`), `Icon`, `ICONS` (`@/components/ui/Icon`).
- Produces: `clampSheetHeight(vh: number, min?: number, max?: number): number`, `SHEET_MIN_VH`/`SHEET_MAX_VH`/`SHEET_DEFAULT_VH` (constantes) exportées de `sheetHeight.ts`. `<BottomSheet open={boolean} onClose={() => void} title={string}>{children}</BottomSheet>` — composant générique, aucune connaissance des blocs vitrine. Consommé par la Task 4 (et par le futur pavé numérique du chantier 4).

- [ ] **Step 1: Write the failing test**

Créer `components/ui/sheetHeight.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { clampSheetHeight, SHEET_MIN_VH, SHEET_MAX_VH } from "./sheetHeight";

describe("clampSheetHeight", () => {
  it("laisse passer une valeur dans les bornes", () => {
    expect(clampSheetHeight(60)).toBe(60);
  });

  it("borne au minimum par défaut", () => {
    expect(clampSheetHeight(10)).toBe(SHEET_MIN_VH);
  });

  it("borne au maximum par défaut", () => {
    expect(clampSheetHeight(150)).toBe(SHEET_MAX_VH);
  });

  it("accepte des bornes personnalisées", () => {
    expect(clampSheetHeight(5, 20, 80)).toBe(20);
    expect(clampSheetHeight(95, 20, 80)).toBe(80);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- components/ui/sheetHeight.test.ts`
Expected: FAIL — `./sheetHeight` introuvable.

- [ ] **Step 3: Create `components/ui/sheetHeight.ts`**

```ts
export const SHEET_MIN_VH = 40;
export const SHEET_MAX_VH = 92;
export const SHEET_DEFAULT_VH = 60;

/** Borne une hauteur de sheet (en unités vh) entre un minimum et un maximum. */
export function clampSheetHeight(
  vh: number,
  min: number = SHEET_MIN_VH,
  max: number = SHEET_MAX_VH
): number {
  return Math.min(max, Math.max(min, vh));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- components/ui/sheetHeight.test.ts`
Expected: PASS.

- [ ] **Step 5: Create `components/ui/BottomSheet.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { clampSheetHeight, SHEET_DEFAULT_VH } from "./sheetHeight";

/**
 * Feuille glissante générique (overlay + panneau bas d'écran), poignée
 * redimensionnable au doigt/souris. Ne connaît rien des blocs de la vitrine —
 * réutilisée telle quelle par le futur pavé numérique (chantier 4).
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [heightVh, setHeightVh] = useState(SHEET_DEFAULT_VH);
  const dragStart = useRef<{ y: number; heightVh: number } | null>(null);

  useEffect(() => {
    if (open) setHeightVh(SHEET_DEFAULT_VH);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onMove(e: PointerEvent) {
      if (!dragStart.current) return;
      const deltaVh = ((dragStart.current.y - e.clientY) / window.innerHeight) * 100;
      setHeightVh(clampSheetHeight(dragStart.current.heightVh + deltaVh));
    }
    function onUp() {
      dragStart.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(30,27,24,.4)", zIndex: 60, animation: "ft-fade .15s ease" }}
      />
      <div
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 61,
          height: `${heightVh}vh`, maxHeight: "92vh",
          background: "#fff", borderRadius: "18px 18px 0 0",
          boxShadow: "0 -8px 32px rgba(60,40,20,.18)",
          display: "flex", flexDirection: "column",
          animation: "ft-slideup .2s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div
          onPointerDown={(e) => { dragStart.current = { y: e.clientY, heightVh }; }}
          style={{ padding: "10px 0 4px", display: "flex", justifyContent: "center", cursor: "ns-resize", touchAction: "none" }}
        >
          <span style={{ width: 40, height: 4, borderRadius: 999, background: colors.borderField }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 18px 12px", borderBottom: `1px solid ${colors.borderSoft}` }}>
          <span style={{ flex: 1, fontFamily: fonts.display, fontWeight: 600, fontSize: 16 }}>{title}</span>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{ border: "none", background: colors.borderSoft, width: 30, height: 30, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <Icon path={ICONS.close} size={15} stroke={colors.muted} strokeWidth={2} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>{children}</div>
      </div>
    </>
  );
}
```

- [ ] **Step 6: Typecheck and full test run**

Run: `npm run typecheck && npm test`
Expected: PASS. (Aucune vérification navigateur à cette étape — `BottomSheet` n'a pas encore de consommateur ; la vérification visuelle a lieu à la Task 4 où elle est réellement montée.)

- [ ] **Step 7: Commit**

```bash
git add components/ui/sheetHeight.ts components/ui/sheetHeight.test.ts components/ui/BottomSheet.tsx
git commit -m "feat(ui): reusable BottomSheet component with drag-to-resize handle"
```

---

### Task 3: `BlockListPanel` (liste glisser-déposer) et `BlockPicker` (sélecteur de blocs)

**Files:**
- Create: `components/editor/BlockListPanel.tsx`
- Create: `components/editor/BlockPicker.tsx`

**Interfaces:**
- Consumes: `BlockInstance` (`@/lib/storefront/pageContent`), `BLOCK_ICONS` (Task 1), `BLOCK_LIBRARY`, `DEFAULT_BLOCK_ORDER` (`@/lib/storefront/blockSettings`, `@/lib/storefront/blockIds`), `@dnd-kit/core`/`@dnd-kit/sortable`/`@dnd-kit/utilities` (Task 1).
- Produces:
  - `<BlockListPanel blocks={BlockInstance[]} selectedId={string} onSelect={(id: string) => void} onReorder={(fromId: string, toId: string) => void} onAddClick={() => void} />`
  - `<BlockPicker onPick={(type: BlockId) => void} />`
  - Ces deux composants sont purement présentationnels (aucun appel direct à `pageContent.ts`) — la Task 4 leur fournit les handlers.

- [ ] **Step 1: Create `components/editor/BlockListPanel.tsx`**

```tsx
"use client";

import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { BLOCK_ICONS } from "./blockIcons";
import type { BlockInstance } from "@/lib/storefront/pageContent";

export function BlockListPanel({
  blocks,
  selectedId,
  onSelect,
  onReorder,
  onAddClick,
}: {
  blocks: BlockInstance[];
  selectedId: string;
  onSelect: (id: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  onAddClick: () => void;
}) {
  // distance minimale avant d'activer le drag : laisse passer un simple tap
  // (sélection) sans déclencher un déplacement involontaire.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  }

  return (
    <div style={{ padding: "16px 18px", borderBottom: `1px solid ${colors.borderSoft}` }}>
      <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 17, marginBottom: 12 }}>
        Blocs de la page
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {blocks.map((b) => (
              <BlockRow key={b.id} block={b} selected={b.id === selectedId} onSelect={() => onSelect(b.id)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button onClick={onAddClick} style={addBtnStyle}>
        <Icon path={ICONS.plus} size={16} stroke={colors.primary} strokeWidth={2} />
        Ajouter un bloc
      </button>
    </div>
  );
}

function BlockRow({
  block,
  selected,
  onSelect,
}: {
  block: BlockInstance;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9,
        border: `1.5px solid ${selected ? colors.primary : colors.borderSoft}`,
        background: selected ? "#EEF0F7" : "#fff", cursor: "pointer",
      }}
      onClick={onSelect}
    >
      <span
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        aria-label="Réordonner ce bloc"
        style={{ display: "flex", cursor: "grab", touchAction: "none", color: colors.muted, flex: "none" }}
      >
        <Icon path={ICONS.menu} size={16} stroke="currentColor" />
      </span>
      <Icon path={BLOCK_ICONS[block.type]} size={17} stroke={colors.primary} strokeWidth={1.6} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {block.name}
      </span>
      {!block.visible && (
        <span style={{ font: `600 10px ${fonts.ui}`, padding: "2px 7px", borderRadius: 999, background: colors.borderSoft, color: colors.muted, flex: "none" }}>
          Masqué
        </span>
      )}
    </div>
  );
}

const addBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 40,
  border: `1.5px dashed ${colors.borderField}`, borderRadius: 9, background: "#fff", color: colors.primary,
  font: `600 13px ${fonts.ui}`, cursor: "pointer",
};
```

- [ ] **Step 2: Create `components/editor/BlockPicker.tsx`**

```tsx
"use client";

import { colors, fonts } from "@/lib/theme/tokens";
import { Icon } from "@/components/ui/Icon";
import { BLOCK_LIBRARY } from "@/lib/storefront/blockSettings";
import { DEFAULT_BLOCK_ORDER, type BlockId } from "@/lib/storefront/blockIds";
import { BLOCK_ICONS } from "./blockIcons";

export function BlockPicker({ onPick }: { onPick: (type: BlockId) => void }) {
  return (
    <div style={{ padding: "14px 18px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {DEFAULT_BLOCK_ORDER.map((type) => {
        const entry = BLOCK_LIBRARY[type];
        return (
          <button key={type} onClick={() => onPick(type)} style={cardStyle}>
            <span style={{ display: "flex", width: 36, height: 36, borderRadius: 9, background: "#EEF0F7", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
              <Icon path={BLOCK_ICONS[type]} size={18} stroke={colors.primary} strokeWidth={1.7} />
            </span>
            <span style={{ font: `700 13px ${fonts.ui}`, marginBottom: 3 }}>{entry.label}</span>
            <span style={{ font: `400 11.5px ${fonts.ui}`, color: colors.muted, lineHeight: 1.35 }}>{entry.description}</span>
          </button>
        );
      })}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left",
  padding: "12px 12px 14px", border: `1.5px solid ${colors.borderSoft}`, borderRadius: 12,
  background: "#fff", cursor: "pointer",
};
```

- [ ] **Step 3: Typecheck and full test run**

Run: `npm run typecheck && npm test`
Expected: PASS. Pas de test unitaire pour ces deux composants (interaction dnd-kit/props uniquement, pas de logique pure nouvelle) — vérification visuelle à la Task 4, où ils sont réellement montés dans `VitrineEditor`.

- [ ] **Step 4: Commit**

```bash
git add components/editor/BlockListPanel.tsx components/editor/BlockPicker.tsx
git commit -m "feat(editor): draggable block list panel and block picker"
```

---

### Task 4: Intégration dans `VitrineEditor` — toolbar canevas, aside desktop, barre + sheets mobile

**Files:**
- Create: `components/editor/BlockCanvasToolbar.tsx`
- Modify: `components/editor/BlockSettingsPanel.tsx` (retrait de `onMove` et des boutons ↑/↓)
- Modify: `components/editor/VitrineEditor.tsx` (réécriture complète)

**Interfaces:**
- Consumes: `addBlock`, `duplicateBlock`, `removeBlock`, `reorderBlocks`, `moveBlock`, `renameBlock`, `setBlockVisible`, `updateBlockSettings` (`@/lib/storefront/pageContent`, chantier 2) ; `BlockListPanel`, `BlockPicker` (Task 3) ; `BottomSheet` (Task 2) ; `BLOCK_ICONS` (Task 1).
- Produces: `<BlockCanvasToolbar visible canRemove onMoveUp onMoveDown onDuplicate onToggleVisible onRemove />` ; `BlockSettingsPanel` sans prop `onMove` (props restantes inchangées : `block`, `onChangeSetting`, `onRename`, `onToggleVisible`).

- [ ] **Step 1: Create `components/editor/BlockCanvasToolbar.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";

/** Barre d'actions flottante affichée sur le bloc sélectionné du canevas. */
export function BlockCanvasToolbar({
  visible,
  canRemove,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onToggleVisible,
  onRemove,
}: {
  visible: boolean;
  canRemove: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onToggleVisible: () => void;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function handleRemoveClick() {
    if (!confirming) {
      setConfirming(true);
      timer.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setConfirming(false);
    onRemove();
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute", top: 8, right: 8, zIndex: 15,
        display: "flex", gap: 4, padding: 4, background: "#fff", borderRadius: 10,
        border: `1px solid ${colors.borderSoft}`, boxShadow: "0 4px 14px rgba(60,40,20,.14)",
      }}
    >
      <ToolbarBtn label="Monter" onClick={onMoveUp}>
        <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}>
          <Icon path={ICONS.chevronDown} size={17} stroke={colors.primary} strokeWidth={2} />
        </span>
      </ToolbarBtn>
      <ToolbarBtn label="Descendre" onClick={onMoveDown}>
        <Icon path={ICONS.chevronDown} size={17} stroke={colors.primary} strokeWidth={2} />
      </ToolbarBtn>
      <ToolbarBtn label="Dupliquer" onClick={onDuplicate}>
        <Icon path={ICONS.duplicate} size={17} stroke={colors.primary} strokeWidth={1.7} />
      </ToolbarBtn>
      <ToolbarBtn label={visible ? "Masquer" : "Afficher"} onClick={onToggleVisible}>
        <Icon path={visible ? ICONS.eye : ICONS.eyeOff} size={17} stroke={colors.primary} strokeWidth={1.7} />
      </ToolbarBtn>
      <ToolbarBtn
        label={confirming ? "Confirmer ?" : "Supprimer"}
        onClick={handleRemoveClick}
        disabled={!canRemove}
        danger={confirming}
        wide={confirming}
      >
        {confirming ? undefined : <Icon path={ICONS.close} size={17} stroke={colors.danger} strokeWidth={2} />}
      </ToolbarBtn>
    </div>
  );
}

function ToolbarBtn({
  label,
  onClick,
  disabled,
  danger,
  wide,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  wide?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Impossible de supprimer le dernier bloc" : label}
      aria-label={label}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        width: wide ? "auto" : 40, height: 40, padding: wide ? "0 12px" : 0,
        border: "none", borderRadius: 8, cursor: disabled ? "default" : "pointer",
        background: danger ? colors.danger : "transparent",
        color: danger ? "#fff" : colors.primary,
        opacity: disabled ? 0.35 : 1,
        font: wide ? `600 12px ${fonts.ui}` : undefined,
      }}
    >
      {children ?? label}
    </button>
  );
}
```

- [ ] **Step 2: Remove ↑/↓ from `BlockSettingsPanel`**

Dans `components/editor/BlockSettingsPanel.tsx`, remplacer le fichier entier par :

```tsx
"use client";

import { colors, fonts } from "@/lib/theme/tokens";
import { BLOCK_SETTINGS } from "@/lib/storefront/blockSettings";
import type { BlockInstance } from "@/lib/storefront/pageContent";
import { SettingsField } from "./SettingsField";

export function BlockSettingsPanel({
  block,
  onChangeSetting,
  onRename,
  onToggleVisible,
}: {
  block: BlockInstance;
  onChangeSetting: (key: string, value: unknown) => void;
  onRename: (name: string) => void;
  onToggleVisible: () => void;
}) {
  const fields = BLOCK_SETTINGS[block.type].fields;
  return (
    <div style={{ padding: "16px 18px" }}>
      <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 17, marginBottom: 12 }}>
        Réglages du bloc
      </div>
      <SettingsField field={{ key: "__name", label: "Nom du bloc (interne)", kind: "text" }} value={block.name} onChange={(v) => onRename(String(v))} blockType={block.type} />
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={onToggleVisible} style={miniBtn}>{block.visible ? "Masquer" : "Afficher"}</button>
      </div>
      <div style={{ borderTop: `1px solid ${colors.borderSoft}`, paddingTop: 14 }}>
        {fields.map((f) => (
          <SettingsField key={f.key} field={f} value={block.settings[f.key]} onChange={(v) => onChangeSetting(f.key, v)} blockType={block.type} />
        ))}
      </div>
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  height: 34, padding: "0 12px", border: `1.5px solid ${colors.borderField}`, borderRadius: 8,
  background: "#fff", color: colors.primary, font: `600 12px ${fonts.ui}`, cursor: "pointer",
};
```

- [ ] **Step 3: Replace `components/editor/VitrineEditor.tsx` entirely**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { renderBlock } from "@/components/storefront/blocks/renderBlock";
import {
  moveBlock, renameBlock, setBlockVisible, updateBlockSettings,
  addBlock, duplicateBlock, removeBlock, reorderBlocks,
  type StorefrontPageContent,
} from "@/lib/storefront/pageContent";
import type { BlockId } from "@/lib/storefront/blockIds";
import { saveDraft, publish, revertDraft } from "@/lib/storefront/actions";
import { BlockSettingsPanel } from "./BlockSettingsPanel";
import { BlockListPanel } from "./BlockListPanel";
import { BlockPicker } from "./BlockPicker";
import { BlockCanvasToolbar } from "./BlockCanvasToolbar";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { Product } from "@/lib/data/types";

type SaveState = "idle" | "saving" | "error";
type MobileSheet = "list" | "settings" | "picker" | null;

/** Bascule desktop/mobile de l'éditeur — même seuil que .ft-desktop-only/.ft-mobile-only (app/globals.css). */
const EDITOR_MOBILE_QUERY = "(max-width: 859.98px)";

export function VitrineEditor({
  initialPage,
  products,
  whatsappPhone,
}: {
  initialPage: StorefrontPageContent;
  products: Product[];
  whatsappPhone?: string | null;
}) {
  const [page, setPage] = useState(initialPage);
  const [selected, setSelected] = useState<string>(initialPage.blocks[0]?.id ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [publishing, setPublishing] = useState(false);
  const [activeSheet, setActiveSheet] = useState<MobileSheet>(null);
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autosave débouncé du brouillon à chaque changement de `page`.
  const scheduleSave = useCallback((next: StorefrontPageContent) => {
    if (timer.current) clearTimeout(timer.current);
    setSaveState("saving");
    timer.current = setTimeout(async () => {
      const res = await saveDraft(next);
      setSaveState(res.ok ? "idle" : "error");
    }, 700);
  }, []);

  const apply = useCallback(
    (next: StorefrontPageContent) => {
      setPage(next);
      scheduleSave(next);
    },
    [scheduleSave]
  );

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Fait défiler jusqu'au bloc ajouté/dupliqué une fois son DOM monté.
  useEffect(() => {
    if (!pendingScrollId) return;
    const el = document.getElementById(`ft-block-${pendingScrollId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setPendingScrollId(null);
  }, [pendingScrollId, page]);

  const selectedBlock = page.blocks.find((b) => b.id === selected) ?? page.blocks[0];

  function handleAdd(type: BlockId) {
    const { page: next, id } = addBlock(page, type);
    apply(next);
    setSelected(id);
    setActiveSheet(null);
    setPendingScrollId(id);
  }

  function handleDuplicate(id: string) {
    const { page: next, id: copyId } = duplicateBlock(page, id);
    apply(next);
    setSelected(copyId);
    setPendingScrollId(copyId);
  }

  // Supprime le bloc et, s'il était sélectionné, resélectionne son voisin le plus proche.
  function handleRemove(id: string) {
    const next = removeBlock(page, id);
    if (next === page) return; // dernier bloc restant — garde-fou de removeBlock
    apply(next);
    if (selected === id) {
      const i = page.blocks.findIndex((b) => b.id === id);
      const fallback = next.blocks[Math.max(0, i - 1)] ?? next.blocks[0];
      setSelected(fallback.id);
    }
  }

  function handleCanvasClick(id: string) {
    setSelected(id);
    if (typeof window !== "undefined" && window.matchMedia(EDITOR_MOBILE_QUERY).matches) {
      setActiveSheet("settings");
    }
  }

  async function onPublish() {
    setPublishing(true);
    // s'assurer que le dernier brouillon est bien enregistré avant publication
    if (timer.current) clearTimeout(timer.current);
    const saved = await saveDraft(page);
    if (!saved.ok) { setSaveState("error"); setPublishing(false); return; }
    const res = await publish();
    if (!res.ok) { setSaveState("error"); setPublishing(false); return; }
    setPublishing(false);
  }

  async function onRevert() {
    if (timer.current) clearTimeout(timer.current);
    setPublishing(true);
    const res = await revertDraft();
    setPublishing(false);
    if (!res.ok) { setSaveState("error"); return; }
    // recharge la page pour récupérer le brouillon = publié
    window.location.reload();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {/* barre d'actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: `1px solid ${colors.borderSoft}`, background: "#fff", position: "sticky", top: 65, zIndex: 20 }}>
        <span style={{ fontSize: 13, color: colors.muted }}>
          {saveState === "saving" ? "Enregistrement…" : saveState === "error" ? "Modifications non enregistrées, nouvelle tentative…" : "Brouillon enregistré"}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button onClick={onRevert} disabled={publishing} style={{ height: 40, padding: "0 16px", border: `1.5px solid ${colors.borderField}`, borderRadius: 9, background: "#fff", color: colors.primary, font: `600 13px ${fonts.ui}`, cursor: publishing ? "default" : "pointer" }}>
            Annuler les modifications
          </button>
          <button onClick={onPublish} disabled={publishing || saveState === "saving"} className="ft-primary-btn" style={{ height: 40, padding: "0 18px", border: "none", borderRadius: 9, background: colors.primary, color: "#fff", font: `700 13px ${fonts.ui}`, cursor: publishing ? "default" : "pointer", opacity: publishing ? 0.7 : 1 }}>
            {publishing ? "Publication…" : "Publier"}
          </button>
        </div>
      </div>

      <div className="ft-editor-cols" style={{ display: "grid", gridTemplateColumns: "1fr 340px", alignItems: "start" }}>
        {/* canevas WYSIWYG (largeur vitrine) */}
        <div style={{ minWidth: 0, overflowX: "hidden" }}>
          {page.blocks.map((b, i) => (
            <div
              key={b.id}
              id={`ft-block-${b.id}`}
              onClick={() => handleCanvasClick(b.id)}
              style={{
                position: "relative", cursor: "pointer", opacity: b.visible ? 1 : 0.4,
                outline: selected === b.id ? `2px solid ${colors.primary}` : "2px solid transparent",
                outlineOffset: -2,
              }}
            >
              {renderBlock(b, {
                products,
                whatsappPhone,
                anchored: page.blocks.findIndex((x) => x.type === b.type) === i,
              })}
              {selected === b.id && (
                <BlockCanvasToolbar
                  visible={b.visible}
                  canRemove={page.blocks.length > 1}
                  onMoveUp={() => apply(moveBlock(page, b.id, -1))}
                  onMoveDown={() => apply(moveBlock(page, b.id, 1))}
                  onDuplicate={() => handleDuplicate(b.id)}
                  onToggleVisible={() => apply(setBlockVisible(page, b.id, !b.visible))}
                  onRemove={() => handleRemove(b.id)}
                />
              )}
            </div>
          ))}
          <div className="ft-mobile-only" style={{ height: 60 }} aria-hidden />
        </div>

        {/* panneau desktop (aside) : liste de blocs + réglages du bloc sélectionné */}
        <aside className="ft-desktop-only" style={{ position: "sticky", top: 118, background: "#fff", borderLeft: `1px solid ${colors.borderSoft}`, maxHeight: "calc(100vh - 118px)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <BlockListPanel
            blocks={page.blocks}
            selectedId={selected}
            onSelect={setSelected}
            onReorder={(fromId, toId) => apply(reorderBlocks(page, fromId, toId))}
            onAddClick={() => setActiveSheet("picker")}
          />
          {selectedBlock && (
            <BlockSettingsPanel
              block={selectedBlock}
              onChangeSetting={(key, value) => apply(updateBlockSettings(page, selectedBlock.id, key, value))}
              onRename={(name) => apply(renameBlock(page, selectedBlock.id, name))}
              onToggleVisible={() => apply(setBlockVisible(page, selectedBlock.id, !selectedBlock.visible))}
            />
          )}
        </aside>
      </div>

      {/* barre mobile : accès aux sheets Blocs / Réglages */}
      <div className="ft-mobile-only" style={{ position: "fixed", left: 0, right: 0, bottom: 76, zIndex: 45, display: "flex", background: "#fff", borderTop: `1px solid ${colors.borderSoft}`, boxShadow: "0 -2px 8px rgba(60,40,20,.06)" }}>
        <button onClick={() => setActiveSheet("list")} style={mobileToolbarBtn}>
          <span style={{ font: `700 11px ${fonts.ui}`, letterSpacing: ".02em" }}>☰ Blocs</span>
        </button>
        {selectedBlock && (
          <button onClick={() => setActiveSheet("settings")} style={{ ...mobileToolbarBtn, borderLeft: `1px solid ${colors.borderSoft}` }}>
            <span style={{ font: `600 10.5px ${fonts.ui}`, color: colors.muted }}>Réglages</span>
            <span style={{ font: `600 13px ${fonts.ui}`, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selectedBlock.name}
            </span>
          </button>
        )}
      </div>

      {/* sheet partagée : liste de blocs, réglages, ou sélecteur d'ajout */}
      <BottomSheet
        open={activeSheet !== null}
        onClose={() => setActiveSheet(null)}
        title={activeSheet === "list" ? "Blocs de la page" : activeSheet === "settings" ? (selectedBlock?.name ?? "Réglages") : "Ajouter un bloc"}
      >
        {activeSheet === "list" && (
          <BlockListPanel
            blocks={page.blocks}
            selectedId={selected}
            onSelect={setSelected}
            onReorder={(fromId, toId) => apply(reorderBlocks(page, fromId, toId))}
            onAddClick={() => setActiveSheet("picker")}
          />
        )}
        {activeSheet === "settings" && selectedBlock && (
          <BlockSettingsPanel
            block={selectedBlock}
            onChangeSetting={(key, value) => apply(updateBlockSettings(page, selectedBlock.id, key, value))}
            onRename={(name) => apply(renameBlock(page, selectedBlock.id, name))}
            onToggleVisible={() => apply(setBlockVisible(page, selectedBlock.id, !selectedBlock.visible))}
          />
        )}
        {activeSheet === "picker" && <BlockPicker onPick={handleAdd} />}
      </BottomSheet>
    </div>
  );
}

const mobileToolbarBtn: React.CSSProperties = {
  flex: 1, minHeight: 56, border: "none", background: "none", cursor: "pointer",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
};
```

- [ ] **Step 4: Typecheck and full test run**

Run: `npm run typecheck && npm test`
Expected: PASS (149/149 + les nouveaux tests des Tasks 1–2, aucune régression — cette tâche ne touche aucune logique testée en Vitest).

- [ ] **Step 5: Browser verification — desktop (controller)**

Sur `/admin/vitrine`, largeur ≥ 860px :
1. La colonne de droite affiche la liste des 9 blocs (icône + nom) au-dessus des réglages du bloc sélectionné.
2. Glisser-déposer un bloc dans la liste → l'ordre change dans le canevas et dans la liste, l'autosave se déclenche.
3. Cliquer un bloc dans la liste → il se sélectionne (contour bleu sur le canevas, réglages à jour).
4. Cliquer un bloc sur le canevas → la toolbar flottante apparaît en haut à droite du bloc.
5. Toolbar : Monter/Descendre déplacent le bloc ; Dupliquer crée une copie juste en dessous, la sélectionne et y fait défiler ; Masquer/Afficher bascule l'icône œil et l'opacité ; Supprimer demande confirmation (le bouton devient rouge « Confirmer ? » 3 s) puis retire le bloc et resélectionne son voisin.
6. « + Ajouter un bloc » (dans la liste) ouvre la bottom-sheet avec la grille des 9 types ; en choisir un l'ajoute en fin de page, le sélectionne et y fait défiler.
7. Réduire à 1 seul bloc (supprimer les 8 autres) → le bouton Supprimer du dernier bloc restant est désactivé (grisé, tooltip).
8. Aucun warning « duplicate key »/hydratation en console.

- [ ] **Step 6: Browser verification — mobile (controller)**

Redimensionner ≤ 859px (ou `resize_window` preset mobile) :
1. La colonne de droite a disparu ; une barre fixe en bas affiche « ☰ Blocs » et le nom du bloc sélectionné, au-dessus de la barre d'onglets du back-office.
2. Taper un bloc sur le canevas → la sheet Réglages s'ouvre directement.
3. Taper « ☰ Blocs » → la sheet Liste s'ouvre ; glisser la poignée du haut redimensionne la sheet (borne 40–92 vh) ; glisser-déposer une ligne réordonne.
4. Depuis la sheet Liste, « + Ajouter un bloc » ouvre le sélecteur ; choisir un type l'ajoute, ferme la sheet, sélectionne et fait défiler jusqu'au nouveau bloc.
5. La toolbar canevas reste utilisable au doigt (boutons ≥ 40 px) sur le bloc visible sous la sheet fermée.
6. Publier fonctionne comme avant ; la vitrine publique (`/`) reflète les changements.

- [ ] **Step 7: Commit**

```bash
git add components/editor/BlockCanvasToolbar.tsx components/editor/BlockSettingsPanel.tsx components/editor/VitrineEditor.tsx
git commit -m "feat(storefront): draggable block list, canvas toolbar and mobile bottom-sheet editor"
```

---

### Task 5: Vérification de bout en bout

**Files:** aucun nouveau.

- [ ] **Step 1: Full local gate**

Run: `npm run typecheck && npm test && npx next build --webpack`
Expected: tout PASS, build sans erreur. (⚠️ `--webpack` obligatoire : Turbopack panique sur les accents NFD du chemin du projet. ⚠️ Le build a besoin d'accéder à la base — si `next build` échoue avec des `PrismaClientKnownRequestError`/`SocketTimeout`, c'est une panne de connectivité Supabase externe, pas une régression de ce chantier ; réessayer une fois la base accessible, cf. incident déjà rencontré au chantier 2.)

- [ ] **Step 2: End-to-end manual pass**

Reprendre l'intégralité des vérifications navigateur des Steps 5–6 de la Task 4 sur des données réelles du tenant, puis **annuler tout changement de test** (remettre noms/ordre/visibilité d'origine et publier à nouveau) pour ne pas laisser de données de test dans le brouillon/publié du tenant — même précaution que celle appliquée au chantier 2.

- [ ] **Step 3: Final commit (if any fixups)**

```bash
git add -A
git commit -m "fix(editor): end-to-end fixups for block library UX"
```

(Seulement s'il y a eu des correctifs ; sinon rien à committer.)
