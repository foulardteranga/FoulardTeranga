import { getSession } from "@/lib/auth";
import { getCustomerByProfileId, getCustomerOrderHistory } from "@/lib/data/customers.server";
import { AccountView } from "@/components/storefront/views/AccountView";
import { AccountAuthView } from "@/components/storefront/views/AccountAuthView";
import { signOutCustomer } from "@/lib/customers/actions";
import { colors, fonts } from "@/lib/theme/tokens";

export default async function AccountPage() {
  const session = await getSession();
  if (!session || session.role !== "customer") {
    return <AccountAuthView />;
  }

  const account = await getCustomerByProfileId(session.userId);
  const history = account ? await getCustomerOrderHistory(account.id) : [];

  return (
    <div>
      <AccountView account={account} history={history} />
      <form action={signOutCustomer} style={{ textAlign: "center", marginTop: 20, paddingBottom: 20 }}>
        <button
          type="submit"
          style={{ border: "none", background: "none", font: `600 13.5px ${fonts.ui}`, color: colors.muted, cursor: "pointer", textDecoration: "underline" }}
        >
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
