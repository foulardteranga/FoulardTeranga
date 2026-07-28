import { Suspense } from "react";
import { headers } from "next/headers";
import { LoginView } from "@/components/auth/LoginView";

/**
 * Page partagée par la zone dashboard et la zone plateforme : Next.js refuse
 * deux `page.tsx` résolvant le même chemin, et `proxy.ts` réécrit les deux
 * zones vers `/connexion`. L'en-tête `x-zone`, posé par `proxy.ts`, est la
 * seule information qui distingue les deux appels.
 */
export default async function ConnexionPage() {
  const zone = (await headers()).get("x-zone");
  return (
    <Suspense fallback={<div style={{ maxWidth: 380, margin: "96px auto" }} />}>
      <LoginView variant={zone === "admin" ? "platform" : "dashboard"} />
    </Suspense>
  );
}
