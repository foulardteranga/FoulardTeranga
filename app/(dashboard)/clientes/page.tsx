import { getCustomers, getCustomerOrderHistory } from "@/lib/data/customers.server";
import { CustomersScreen } from "@/components/dashboard/screens/CustomersScreen";
import type { CustomerOrderHistoryEntry } from "@/lib/data/types";

export default async function CustomersPage() {
  const customers = await getCustomers();
  const histories = await Promise.all(customers.map((c) => getCustomerOrderHistory(c.id)));
  const historyByCustomerId: Record<string, CustomerOrderHistoryEntry[]> = {};
  customers.forEach((c, i) => {
    historyByCustomerId[c.id] = histories[i];
  });

  return <CustomersScreen customers={customers} historyByCustomerId={historyByCustomerId} />;
}
