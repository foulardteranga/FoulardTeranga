"use client";

import { colors, fonts } from "@/lib/theme/tokens";
import type { FieldDescriptor } from "@/lib/storefront/blockSettings";

export function SettingsField({
  field,
  value,
  onChange,
}: {
  field: FieldDescriptor;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = (
    <label style={{ display: "block", font: `600 12px ${fonts.ui}`, color: colors.muted, marginBottom: 6 }}>
      {field.label}
    </label>
  );
  const base: React.CSSProperties = {
    width: "100%", padding: "9px 12px", border: `1.5px solid ${colors.borderField}`,
    borderRadius: 9, font: `400 13.5px ${fonts.ui}`, outline: "none",
  };

  return (
    <div style={{ marginBottom: 14 }}>
      {field.kind !== "toggle" && label}
      {field.kind === "textarea" ? (
        <textarea value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} rows={3} style={{ ...base, resize: "vertical" }} />
      ) : field.kind === "select" ? (
        <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} style={base}>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.kind === "toggle" ? (
        <label style={{ display: "flex", alignItems: "center", gap: 8, font: `600 12px ${fonts.ui}`, color: colors.muted }}>
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
          {field.label}
        </label>
      ) : field.kind === "number" ? (
        <input type="number" value={Number(value ?? 0)} onChange={(e) => onChange(Number(e.target.value))} style={base} />
      ) : (
        <input type="text" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} style={base} />
      )}
    </div>
  );
}
