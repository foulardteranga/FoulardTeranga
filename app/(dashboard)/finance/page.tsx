import { getFinanceSnapshot } from "@/lib/data/finance.server";
import { FinanceScreen } from "@/components/dashboard/screens/FinanceScreen";

export default async function FinancePage() {
  const snapshot = await getFinanceSnapshot();
  return <FinanceScreen snapshot={snapshot} />;
}
