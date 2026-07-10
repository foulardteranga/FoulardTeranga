"use client";

import { fonts } from "@/lib/theme/tokens";
import { Icon } from "@/components/ui/Icon";
import { useStorefront, type BlockId } from "@/lib/store/useStorefront";

const CHEVRON_UP = '<path d="m18 15-6-6-6 6"/>';
const CHEVRON_DOWN = '<path d="m6 9 6 6 6-6"/>';
const EYE = '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>';
const EYE_OFF =
  '<path d="M2 2 22 22"/><path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3 3.5M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>';

/** Enveloppe commune de chaque bloc de la Home : cadre "mode éditeur" (renommer,
 * réordonner, masquer) — préfigure le futur éditeur de vitrine (SECTIONS.md §1). */
export function BlockFrame({ id, children }: { id: BlockId; children: React.ReactNode }) {
  const blocksMode = useStorefront((s) => s.blocksMode);
  const name = useStorefront((s) => s.blockNames[id]);
  const hidden = useStorefront((s) => !!s.blockHidden[id]);
  const renameBlock = useStorefront((s) => s.renameBlock);
  const moveBlock = useStorefront((s) => s.moveBlock);
  const toggleHideBlock = useStorefront((s) => s.toggleHideBlock);

  if (hidden && !blocksMode) return null;

  return (
    <div
      style={{
        position: "relative",
        opacity: hidden ? 0.4 : 1,
        outline: blocksMode ? "2px dashed rgba(208,122,52,.95)" : "none",
        outlineOffset: -4,
        borderRadius: 6,
        transition: "opacity .15s",
      }}
    >
      {blocksMode && (
        <div
          style={{
            position: "absolute", top: 8, left: 14, zIndex: 25,
            display: "flex", alignItems: "center", gap: 1,
            background: "#1E1B18", borderRadius: 9, padding: 4, boxShadow: "0 6px 18px rgba(30,27,24,.3)",
          }}
        >
          <input
            value={name}
            onChange={(e) => renameBlock(id, e.target.value)}
            style={{ width: 150, border: "none", background: "#2c2822", color: "#fff", font: `600 12.5px ${fonts.ui}`, borderRadius: 6, padding: "6px 9px", outline: "none" }}
          />
          <ToolbarButton label="Monter" onClick={() => moveBlock(id, -1)} path={CHEVRON_UP} />
          <ToolbarButton label="Descendre" onClick={() => moveBlock(id, 1)} path={CHEVRON_DOWN} />
          <ToolbarButton label="Masquer / afficher" onClick={() => toggleHideBlock(id)} path={hidden ? EYE_OFF : EYE} />
        </div>
      )}
      {children}
    </div>
  );
}

function ToolbarButton({ label, onClick, path }: { label: string; onClick: () => void; path: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{ width: 28, height: 28, border: "none", borderRadius: 6, background: "none", color: "#C9BEB0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <Icon path={path} size={15} stroke="currentColor" strokeWidth={2} />
    </button>
  );
}
