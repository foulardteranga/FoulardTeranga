import { notFound } from "next/navigation";
import { StoreHeader } from "@/components/storefront/StoreHeader";
import { MobileMenu } from "@/components/storefront/MobileMenu";
import { BottomTab } from "@/components/storefront/BottomTab";
import { StoreOfflineBanner } from "@/components/storefront/StoreOfflineBanner";
import { StoreToast } from "@/components/storefront/StoreToast";
import { StoreUnavailable } from "@/components/storefront/StoreUnavailable";
import { getCurrentTenantOrNull } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/data/tenant.server";

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenantOrNull();
  // Un hôte qui ne correspond à aucune boutique ne doit pas afficher la
  // vitrine d'une cliente au hasard (spec §2). Une boutique archivée est
  // « sortie du parc, invisible partout sauf pour le prestataire » (spec §9) :
  // elle est donc indistinguable d'un hôte inconnu, d'où le même 404.
  if (!tenant || tenant.status === "archived") notFound();

  // Une boutique suspendue existe toujours et le dit (spec §9) : réponse 200
  // avec un message, pas un 404 qui laisserait croire à une erreur de domaine.
  if (tenant.status === "suspended") return <StoreUnavailable tenantName={tenant.name} />;

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
