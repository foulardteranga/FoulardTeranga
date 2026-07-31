/**
 * Écran servi au back-office d'une boutique suspendue ou archivée (spec §2).
 * Comme `StoreUnavailable`, il n'utilise aucune variable CSS de thème : la
 * boutique est coupée, et cet écran doit rester lisible quoi qu'il arrive.
 */
export function TenantBlockedNotice({
  tenantName,
  status,
}: {
  tenantName: string;
  status: "suspended" | "archived";
}) {
  const title =
    status === "suspended" ? `L'accès à ${tenantName} est suspendu` : `${tenantName} est archivée`;
  const body =
    status === "suspended"
      ? "Votre back-office est momentanément fermé. Contactez votre prestataire pour rétablir l'accès."
      : "Cette boutique a été archivée. Contactez votre prestataire pour la réactiver.";

  return (
    <main
      role="alert"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
        textAlign: "center",
        background: "#FAF7F2",
        color: "#1E1B18",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>{title}</h1>
      <p style={{ fontSize: 15, color: "#6B6459", margin: 0, maxWidth: 460 }}>{body}</p>
    </main>
  );
}
