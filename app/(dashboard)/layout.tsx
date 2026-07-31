import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { OfflineBanner } from "@/components/dashboard/OfflineBanner";
import { ImpersonationBanner, BANNER_HEIGHT } from "@/components/dashboard/ImpersonationBanner";
import { IMPERSONATION_DURATION_MS } from "@/lib/impersonation/cookie";
import { Toast } from "@/components/dashboard/Toast";
import { TicketModal } from "@/components/dashboard/TicketModal";
import { TenantBlockedNotice } from "@/components/dashboard/TenantBlockedNotice";
import { getSession } from "@/lib/auth";
import { getActorContext } from "@/lib/impersonation/context";
import { notFound } from "next/navigation";
import { getCurrentTenantOrNull } from "@/lib/tenant";
import { getPendingOrdersCount } from "@/lib/data/orders.server";
import { getNotifications } from "@/lib/data/notifications.server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // `proxy.ts` est censé n'acheminer ici que des hôtes résolus, mais un hôte
  // inconnu produisait une exception brute plutôt qu'une réponse contrôlée.
  const tenant = await getCurrentTenantOrNull();
  if (!tenant) notFound();

  const [session, pendingCount, notifications, actorContext] = await Promise.all([
    getSession(),
    getPendingOrdersCount(),
    getNotifications(),
    getActorContext(),
  ]);

  const impersonation = actorContext?.impersonation ?? null;
  const topOffset = impersonation ? BANNER_HEIGHT : 0;

  // Boutique suspendue ou archivée : accès bloqué (spec §2). Le bandeau
  // d'impersonation est rendu MALGRÉ le blocage, délibérément : sans lui, le
  // prestataire entré dans la boutique avant sa suspension perdrait le bouton
  // « Quitter » et resterait enfermé jusqu'à l'expiration des 60 minutes,
  // derrière un cookie httpOnly qu'il ne peut pas supprimer depuis l'interface.
  if (tenant.status !== "active") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {impersonation && (
          <ImpersonationBanner
            tenantName={tenant.name}
            targetName={session?.name ?? ""}
            mode={impersonation.mode}
            expiresAt={new Date(
              new Date(impersonation.startedAt).getTime() + IMPERSONATION_DURATION_MS
            ).toISOString()}
          />
        )}
        <div style={{ flex: 1, display: "flex", paddingTop: topOffset }}>
          <TenantBlockedNotice tenantName={tenant.name} status={tenant.status} />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "var(--color-ivory)",
        color: "var(--color-ink)",
      }}
    >
      <Sidebar session={session} pendingCount={pendingCount} topOffset={topOffset} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {impersonation && (
          <ImpersonationBanner
            tenantName={tenant.name}
            targetName={session?.name ?? ""}
            mode={impersonation.mode}
            expiresAt={new Date(new Date(impersonation.startedAt).getTime() + IMPERSONATION_DURATION_MS).toISOString()}
          />
        )}
        <OfflineBanner />
        <TopBar initialNotifications={notifications} tenantId={tenant.id} topOffset={topOffset} />
        <main className="ft-main" style={{ flex: 1, minWidth: 0, overflowX: "hidden" }}>
          {children}
        </main>
        <MobileNav pendingCount={pendingCount} session={session} />
      </div>

      <Toast />
      <TicketModal />
    </div>
  );
}
