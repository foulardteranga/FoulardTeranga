import { getCustomers, getCustomerOrderHistory } from "@/lib/data/customers.server";
import { AccountView } from "@/components/storefront/views/AccountView";

export default async function AccountPage() {
  const customers = await getCustomers();
  const account = customers[0] ?? null;
  const history = account ? await getCustomerOrderHistory(account.id) : [];

  return <AccountView account={account} history={history} />;
}
