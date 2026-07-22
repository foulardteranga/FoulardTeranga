import Link from "next/link";
import { colors } from "@/lib/theme/tokens";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: colors.muted, marginBottom: 14, flexWrap: "wrap" }}>
      {items.map((item, i) => (
        <span key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {i > 0 && <span style={{ color: "#C7BFB2" }}>/</span>}
          {item.href ? (
            <Link href={item.href} style={{ color: colors.primary }}>{item.label}</Link>
          ) : (
            <span style={{ color: colors.ink, fontWeight: 600 }}>{item.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}
