import { Suspense } from "react";
import { ConfirmView } from "@/components/storefront/views/ConfirmView";

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<div className="ft-store-page" style={{ maxWidth: 720, margin: "0 auto" }} />}>
      <ConfirmView />
    </Suspense>
  );
}
