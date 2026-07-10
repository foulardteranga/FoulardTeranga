import { notFound } from "next/navigation";
import { catalog } from "@/lib/data/catalog";
import { ProductView } from "@/components/storefront/views/ProductView";

export function generateStaticParams() {
  return catalog.map((p) => ({ id: p.id }));
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = catalog.find((p) => p.id === id);
  if (!product) notFound();
  return <ProductView product={product} />;
}
