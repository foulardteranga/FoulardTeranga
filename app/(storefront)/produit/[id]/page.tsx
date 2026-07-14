import { notFound } from "next/navigation";
import { getCatalog, getProductById } from "@/lib/data/catalog.server";
import { relatedTo } from "@/lib/data/catalog";
import { ProductView } from "@/components/storefront/views/ProductView";

export async function generateStaticParams() {
  const products = await getCatalog();
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
