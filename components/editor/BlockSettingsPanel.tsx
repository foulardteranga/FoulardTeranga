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
