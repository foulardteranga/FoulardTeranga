import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCurrentTenantOrNull } from "@/lib/tenant";
import { getCatalog } from "@/lib/data/catalog.server";
import { CatalogView } from "@/components/storefront/views/CatalogView";

export default async function CataloguePage() {
  // Le layout rend déjà un 404 sur hôte inconnu, mais Next rend layout et page
  // en parallèle : sans ce garde, ce segment appelle getCurrentTenant() (via
  // getCatalog()) et lève une exception non capturée dans les logs, en plus
  // du 404 correct.
  if (!(await getCurrentTenantOrNull())) notFound();

  const products = await getCatalog();
  return (
    <Suspense fallback={<div className="ft-store-page" style={{ maxWidth: 1200, margin: "0 auto" }} />}>
      <CatalogView products={products} />
    </Suspense>
  );
}
