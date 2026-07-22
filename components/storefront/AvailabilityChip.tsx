import { fonts } from "@/lib/theme/tokens";

export function AvailabilityChip({ stock }: { stock: number }) {
  if (stock <= 0) {
    return <Chip bg="#F8E5E3" fg="#9c352d" dot="#C4453B" label="Épuisé — bientôt de retour" />;
  }
  if (stock <= 5) {
    return <Chip bg="#FBF1D8" fg="#8a6500" dot="#E0A400" label={`Plus que ${stock} en stock`} />;
  }
  return <Chip bg="#E6F4EE" fg="#0b6e4d" dot="#0E9F6E" label="En stock · expédié sous 48h" />;
}

function Chip({ bg, fg, dot, label }: { bg: string; fg: string; dot: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, font: `600 12.5px ${fonts.ui}`, padding: "6px 12px", borderRadius: 999, background: bg, color: fg }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: dot }} />
      {label}
    </span>
  );
}
