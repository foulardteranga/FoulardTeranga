import { Suspense } from "react";
import { getCatalog } from "@/lib/data/catalog.server";
import { CatalogView } from "@/components/storefront/views/CatalogView";

export default async function CataloguePage() {
  const products = await getCatalog();
  return (
    <Suspense fallback={<div className="ft-store-page" style={{ maxWidth: 1200, margin: "0 auto" }} />}>
      <CatalogView products={products} />
    </Suspense>
  );
}
