import { StoreHeader } from "@/components/storefront/StoreHeader";
import { MobileMenu } from "@/components/storefront/MobileMenu";
import { BottomTab } from "@/components/storefront/BottomTab";
import { StoreOfflineBanner } from "@/components/storefront/StoreOfflineBanner";
import { StoreToast } from "@/components/storefront/StoreToast";
import { getTenantSettings } from "@/lib/data/tenant.server";

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { phone } = await getTenantSettings();
  return (
    <div style={{ minHeight: "100vh", background: "#FAF7F2", color: "#1E1B18", display: "flex", flexDirection: "column" }}>
      <StoreOfflineBanner />
      <StoreHeader />
      <MobileMenu whatsappPhone={phone} />
      <main style={{ flex: 1 }}>{children}</main>
      <BottomTab />
      <StoreToast />
    </div>
  );
}
