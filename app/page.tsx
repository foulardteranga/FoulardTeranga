export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, margin: "0 0 8px" }}>
          Foulard Teranga
        </h1>
        <p style={{ color: "var(--color-muted)", fontSize: 15, lineHeight: 1.5 }}>
          La vitrine arrive bientôt. En attendant, l&apos;équipe accède au back-office via{" "}
          <code>/admin</code>.
        </p>
      </div>
    </main>
  );
}
