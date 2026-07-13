import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { OfflineBanner } from "@/components/dashboard/OfflineBanner";
import { Toast } from "@/components/dashboard/Toast";
import { TicketModal } from "@/components/dashboard/TicketModal";
import { getSession } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "var(--color-ivory)",
        color: "var(--color-ink)",
      }}
    >
      <Sidebar session={session} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <OfflineBanner />
        <TopBar />
        <main className="ft-main" style={{ flex: 1, minWidth: 0, overflowX: "hidden" }}>
          {children}
        </main>
        <MobileNav />
      </div>

      <Toast />
      <TicketModal />
    </div>
  );
}
