import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { OfflineBanner } from "@/components/dashboard/OfflineBanner";
import { Toast } from "@/components/dashboard/Toast";
import { TicketModal } from "@/components/dashboard/TicketModal";
import { getSession } from "@/lib/auth";
import { getPendingOrdersCount } from "@/lib/data/orders.server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, pendingCount] = await Promise.all([getSession(), getPendingOrdersCount()]);

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
        <TopBar />
        <main className="ft-main" style={{ flex: 1, minWidth: 0, overflowX: "hidden" }}>
          {children}
        </main>
        <MobileNav pendingCount={pendingCount} />
      </div>

      <Toast />
      <TicketModal />
    </div>
  );
}
