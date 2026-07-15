import Link from "next/link";
import { fonts } from "@/lib/theme/tokens";
import { renderBlock } from "@/components/storefront/blocks/renderBlock";
import { whatsappLink } from "@/lib/format";
import type { StorefrontPageContent } from "@/lib/storefront/pageContent";
import type { Product } from "@/lib/data/types";

export function HomeShell({
  page,
  products,
  whatsappPhone,
}: {
  page: StorefrontPageContent;
  products: Product[];
  whatsappPhone?: string | null;
}) {
  const visible = page.blocks.filter((b) => b.visible);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {visible.map((b) => (
        <div key={b.type}>{renderBlock(b, { products, whatsappPhone })}</div>
      ))}

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
            {whatsappPhone ? (
              <a href={whatsappLink(whatsappPhone)} target="_blank" rel="noopener noreferrer" style={{ color: "#C9BEB0", display: "block" }}>WhatsApp</a>
            ) : (
              <div>WhatsApp</div>
            )}
            <div>Livraison</div>
            <div>Points de fidélité</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
