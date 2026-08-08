import { getSession } from "@/lib/auth";
import { getOrderAuditLog } from "@/lib/data/orderAudit.server";
import { OrderAuditLogScreen } from "@/components/dashboard/screens/OrderAuditLogScreen";

export default async function JournalAuditPage() {
  const session = await getSession();
  if (session?.role !== "owner") {
    return (
      <div className="ft-pad">
        <p style={{ color: "#6B6259" }}>Réservé à la gérante.</p>
      </div>
    );
  }
  const entries = await getOrderAuditLog();
  return <OrderAuditLogScreen entries={entries} />;
}
