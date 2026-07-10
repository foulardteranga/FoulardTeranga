"use client";

import Link from "next/link";
import { fonts } from "@/lib/theme/tokens";
import { Icon } from "@/components/ui/Icon";
import { useStorefront } from "@/lib/store/useStorefront";
import { blockRegistry } from "@/components/storefront/blocks/registry";

export default function StorefrontHomePage() {
  const blockOrder = useStorefront((s) => s.blockOrder);
  const blocksMode = useStorefront((s) => s.blocksMode);
  const toggleBlocksMode = useStorefront((s) => s.toggleBlocksMode);

  const renderableOrder = blockOrder.filter((id) => id in blockRegistry);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {blocksMode && (
        <div
          style={{
            position: "sticky", top: 0, zIndex: 40, display: "flex", alignItems: "center", gap: 10,
            maxWidth: 1200, margin: "12px auto 0", width: "calc(100% - 32px)",
            background: "#FBF1D8", border: "1px solid #EBD9A6", borderRadius: 12, padding: "11px 14px",
          }}
        >
          <span style={{ fontSize: 13, color: "#7a5a00", lineHeight: 1.4 }}>
            Mode éditeur — renommez un bloc, réordonnez-le (↑↓) ou masquez-le (œil). Chaque bloc est empilable et éditable sans code.
          </span>
        </div>
      )}

      {renderableOrder.map((id) => {
        const Block = blockRegistry[id]!;
        return <Block key={id} />;
      })}

      <footer style={{ background: "#1E1B18", color: "#C9BEB0", marginTop: 20 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 20px 100px", display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 22, color: "#fff", marginBottom: 8 }}>Foulard Teranga</div>
            <div style={{ fontSize: 13, maxWidth: 280, lineHeight: 1.6 }}>
              Foulards &amp; accessoires africains élégants, depuis Abidjan.
            </div>
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 2 }}>
            <div style={{ color: "#fff", fontWeight: 600, marginBottom: 6 }}>Boutique</div>
            <Link href="/catalogue?cat=Foulards" style={{ color: "#C9BEB0", display: "block" }}>Foulards</Link>
            <Link href="/catalogue?cat=Turbans" style={{ color: "#C9BEB0", display: "block" }}>Turbans</Link>
            <Link href="/catalogue?cat=Accessoires" style={{ color: "#C9BEB0", display: "block" }}>Accessoires</Link>
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 2 }}>
            <div style={{ color: "#fff", fontWeight: 600, marginBottom: 6 }}>Aide</div>
            <div>WhatsApp</div>
            <div>Livraison</div>
            <div>Points de fidélité</div>
          </div>
        </div>
      </footer>

      <button
        onClick={toggleBlocksMode}
        style={{
          position: "fixed", right: 20, bottom: 28, zIndex: 55, height: 46, padding: "0 18px",
          border: "none", borderRadius: 999, background: blocksMode ? "#D07A34" : "#1E1B18", color: "#fff",
          font: `600 14px ${fonts.ui}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 9,
          boxShadow: "0 8px 24px rgba(30,27,24,.28)",
        }}
      >
        <Icon path='<rect x="3" y="3" width="18" height="7" rx="1.5"/><rect x="3" y="14" width="18" height="7" rx="1.5"/>' size={18} stroke="#fff" strokeWidth={1.85} />
        {blocksMode ? "Quitter l'aperçu" : "Aperçu des blocs"}
      </button>
    </div>
  );
}
