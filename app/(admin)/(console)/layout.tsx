import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { currentSuperAdmin } from "@/lib/platform/guard";
import { platformPath } from "@/lib/proxy/zones";
import { PlatformShell } from "@/components/platform/PlatformShell";

/**
 * Groupe de routes `(console)` : le chrome ne doit pas envelopper `/connexion`,
 * servie par la même zone. Les groupes de routes n'affectent pas les URLs.
 * Ce garde double celui de `proxy.ts` — défense en profondeur, pas redondance :
 * lui seul protège si le matcher du proxy évolue.
 */
export default async function PlatformConsoleLayout({ children }: { children: React.ReactNode }) {
  const hostname = (await headers()).get("host") ?? "localhost";
  const session = await currentSuperAdmin();
  if (!session) {
    redirect(platformPath(hostname, "/connexion"));
  }
  const basePath = platformPath(hostname, "");
  return <PlatformShell userName={session.name} basePath={basePath}>{children}</PlatformShell>;
}
