import { StoreHeader } from "@/components/storefront/StoreHeader";
import { MobileMenu } from "@/components/storefront/MobileMenu";
import { BottomTab } from "@/components/storefront/BottomTab";
import { StoreOfflineBanner } from "@/components/storefront/StoreOfflineBanner";
import { StoreToast } from "@/components/storefront/StoreToast";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#FAF7F2", color: "#1E1B18", display: "flex", flexDirection: "column" }}>
      <StoreOfflineBanner />
      <StoreHeader />
      <MobileMenu />
      <main style={{ flex: 1 }}>{children}</main>
      <BottomTab />
      <StoreToast />
    </div>
  );
}
