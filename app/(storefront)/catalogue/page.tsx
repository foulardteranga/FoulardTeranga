import { Suspense } from "react";
import { CatalogView } from "@/components/storefront/views/CatalogView";

export default function CataloguePage() {
  return (
    <Suspense fallback={<div className="ft-store-page" style={{ maxWidth: 1200, margin: "0 auto" }} />}>
      <CatalogView />
    </Suspense>
  );
}
