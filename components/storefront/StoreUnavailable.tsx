/**
 * Réponse publique d'une boutique suspendue (spec §9). Volontairement sans
 * aucune variable CSS de thème : la boutique est coupée, ses couleurs ne sont
 * pas le sujet, et cet écran doit rester lisible même si le thème est cassé.
 * Le motif de suspension n'est JAMAIS affiché — c'est une information interne
 * entre le prestataire et la gérante, pas une information cliente.
 */
export function StoreUnavailable({ tenantName }: { tenantName: string }) {
  return (
    <main
      style={{
        minHeight: "100vh",
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
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>{tenantName} est temporairement indisponible</h1>
      <p style={{ fontSize: 15, color: "#6B6459", margin: 0, maxWidth: 420 }}>
        Cette boutique est momentanément fermée. Merci de revenir un peu plus tard.
      </p>
    </main>
  );
}
