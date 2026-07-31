import { notFound } from "next/navigation";
import { requireActiveStorefrontTenant } from "@/lib/tenant";
import { getCatalog, getProductById } from "@/lib/data/catalog.server";
import { relatedTo } from "@/lib/data/catalog";
import { ProductView } from "@/components/storefront/views/ProductView";

export async function generateStaticParams() {
  // Littéral volontaire : generateStaticParams() s'exécute au build, hors
  // requête HTTP, donc headers() (et getCurrentTenant()) n'y est pas
  // disponible. getCatalog() accepte justement un tenantId explicite pour ce
  // cas (v1 mono-boutique). ProductPage plus bas, qui s'exécute par requête,
  // continue d'appeler getCatalog() sans argument, inchangé.
  const products = await getCatalog("foulard-teranga");
  return products.map((p) => ({ id: p.id }));
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  // Le layout rend déjà un 404 (hôte inconnu/archivée) ou StoreUnavailable
  // (suspendue), mais Next rend layout et page en parallèle : sans ce garde,
  // ce segment appelle getCurrentTenant() et lève une exception non capturée
  // dans les logs, en plus de la réponse déjà décidée par le layout.
  await requireActiveStorefrontTenant();

  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();
  const products = await getCatalog();
  const related = relatedTo(products, product.id);
  return <ProductView product={product} related={related} />;
}
