import { notFound } from "next/navigation";
import { getCatalog, getProductById } from "@/lib/data/catalog.server";
import { relatedTo } from "@/lib/data/catalog";
import { DEFAULT_TENANT } from "@/lib/tenant/registry";
import { ProductView } from "@/components/storefront/views/ProductView";

export async function generateStaticParams() {
  // Exécuté au build, hors requête HTTP : pas de headers() disponibles pour
  // résoudre le tenant courant, donc tenant explicite (v1 mono-boutique).
  const products = await getCatalog(DEFAULT_TENANT.id);
  return products.map((p) => ({ id: p.id }));
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();
  const products = await getCatalog();
  const related = relatedTo(products, product.id);
  return <ProductView product={product} related={related} />;
}
