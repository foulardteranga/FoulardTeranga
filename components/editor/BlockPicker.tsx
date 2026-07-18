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
