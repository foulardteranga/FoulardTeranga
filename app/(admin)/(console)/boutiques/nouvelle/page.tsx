import { headers } from "next/headers";
import { NewTenantScreen } from "@/components/platform/screens/NewTenantScreen";
import { platformPath } from "@/lib/proxy/zones";

export default async function NouvelleBoutiquePage() {
  const hostname = (await headers()).get("host") ?? "localhost";
  const basePath = platformPath(hostname, "");
  return <NewTenantScreen basePath={basePath} />;
}
