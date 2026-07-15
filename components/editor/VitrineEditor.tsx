"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { colors, fonts } from "@/lib/theme/tokens";
import { renderBlock } from "@/components/storefront/blocks/renderBlock";
import {
  moveBlock, renameBlock, setBlockVisible, updateBlockSettings,
  type StorefrontPageContent,
} from "@/lib/storefront/pageContent";
import type { BlockId } from "@/lib/store/useStorefront";
import { saveDraft, publish, revertDraft } from "@/lib/storefront/actions";
import { BlockSettingsPanel } from "./BlockSettingsPanel";
import type { Product } from "@/lib/data/types";

type SaveState = "idle" | "saving" | "error";

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
  const [selected, setSelected] = useState<BlockId>(initialPage.blocks[0]?.type ?? "hero");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [publishing, setPublishing] = useState(false);
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

  const selectedBlock = page.blocks.find((b) => b.type === selected) ?? page.blocks[0];

  async function onPublish() {
    setPublishing(true);
    // s'assurer que le dernier brouillon est bien enregistré avant publication
    if (timer.current) clearTimeout(timer.current);
    const saved = await saveDraft(page);
    if (!saved.ok) { setSaveState("error"); setPublishing(false); return; }
    await publish();
    setPublishing(false);
  }

  async function onRevert() {
    setPublishing(true);
    await revertDraft();
    setPublishing(false);
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
          {page.blocks.map((b) => (
            <div
              key={b.type}
              onClick={() => setSelected(b.type)}
              style={{
                position: "relative", cursor: "pointer", opacity: b.visible ? 1 : 0.4,
                outline: selected === b.type ? `2px solid ${colors.primary}` : "2px solid transparent",
                outlineOffset: -2,
              }}
            >
              {renderBlock(b, { products, whatsappPhone })}
            </div>
          ))}
        </div>

        {/* panneau de réglages (aside) */}
        <aside style={{ position: "sticky", top: 118, background: "#fff", borderLeft: `1px solid ${colors.borderSoft}`, minHeight: "calc(100vh - 118px)" }}>
          {selectedBlock && (
            <BlockSettingsPanel
              block={selectedBlock}
              onChangeSetting={(key, value) => apply(updateBlockSettings(page, selectedBlock.type, key, value))}
              onRename={(name) => apply(renameBlock(page, selectedBlock.type, name))}
              onToggleVisible={() => apply(setBlockVisible(page, selectedBlock.type, !selectedBlock.visible))}
              onMove={(dir) => apply(moveBlock(page, selectedBlock.type, dir))}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
