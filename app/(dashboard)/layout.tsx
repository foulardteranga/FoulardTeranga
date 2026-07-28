import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { OfflineBanner } from "@/components/dashboard/OfflineBanner";
import { Toast } from "@/components/dashboard/Toast";
import { TicketModal } from "@/components/dashboard/TicketModal";
import { getSession } from "@/lib/auth";
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

  const [session, pendingCount, notifications] = await Promise.all([
    getSession(),
    getPendingOrdersCount(),
    getNotifications(),
  ]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "var(--color-ivory)",
        color: "var(--color-ink)",
      }}
    >
      <Sidebar session={session} pendingCount={pendingCount} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <OfflineBanner />
        <TopBar initialNotifications={notifications} tenantId={tenant.id} />
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
