import { Suspense } from "react";
import { requireActiveStorefrontTenant } from "@/lib/tenant";
import { getCatalog } from "@/lib/data/catalog.server";
import { CatalogView } from "@/components/storefront/views/CatalogView";

export default async function CataloguePage() {
  // Le layout rend déjà un 404 (hôte inconnu/archivée) ou StoreUnavailable
  // (suspendue), mais Next rend layout et page en parallèle : sans ce garde,
  // ce segment appelle getCurrentTenant() (via getCatalog()) et lève une
  // exception non capturée dans les logs, en plus de la réponse déjà décidée
  // par le layout.
  await requireActiveStorefrontTenant();

  const products = await getCatalog();
  return (
    <Suspense fallback={<div className="ft-store-page" style={{ maxWidth: 1200, margin: "0 auto" }} />}>
      <CatalogView products={products} />
    </Suspense>
  );
}
