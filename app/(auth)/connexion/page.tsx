import { Suspense } from "react";
import { headers } from "next/headers";
import { LoginView } from "@/components/auth/LoginView";
import { TenantBlockedNotice } from "@/components/dashboard/TenantBlockedNotice";
import { getCurrentTenantOrNull } from "@/lib/tenant";

/**
 * Page partagée par la zone dashboard et la zone plateforme : Next.js refuse
 * deux `page.tsx` résolvant le même chemin, et `proxy.ts` réécrit les deux
 * zones vers `/connexion`. L'en-tête `x-zone`, posé par `proxy.ts`, est la
 * seule information qui distingue les deux appels.
 */
export default async function ConnexionPage() {
  const zone = (await headers()).get("x-zone");
  const isPlatform = zone === "admin";

  // Spec §2 : la connexion au back-office d'une boutique suspendue est bloquée,
  // sinon la gérante se connecte pour atterrir sur un mur. La connexion
  // PLATEFORME n'est jamais concernée — le prestataire doit pouvoir entrer pour
  // réactiver précisément la boutique en cause.
  if (!isPlatform) {
    const tenant = await getCurrentTenantOrNull();
    if (tenant && tenant.status !== "active") {
      return <TenantBlockedNotice tenantName={tenant.name} status={tenant.status} />;
    }
  }

  return (
    <Suspense fallback={<div style={{ maxWidth: 380, margin: "96px auto" }} />}>
      <LoginView variant={isPlatform ? "platform" : "dashboard"} />
    </Suspense>
  );
}
