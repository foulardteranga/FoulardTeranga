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
