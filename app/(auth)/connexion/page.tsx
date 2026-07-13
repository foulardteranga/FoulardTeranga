import { Suspense } from "react";
import { LoginView } from "@/components/auth/LoginView";

export default function ConnexionPage() {
  return (
    <Suspense fallback={<div style={{ maxWidth: 380, margin: "96px auto" }} />}>
      <LoginView />
    </Suspense>
  );
}
