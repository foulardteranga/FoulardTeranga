export function LoyaltyBadge({ points }: { points: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#0b6e4d", background: "#E6F4EE", padding: "8px 12px", borderRadius: 999, marginTop: 14 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#C9A227" stroke="none"><path d="M12 2 15 9l7 .5-5.5 4.5L18.5 21 12 17l-6.5 4 2-7L2 9.5 9 9Z" /></svg>
      +{points} points de fidélité
    </div>
  );
}
