import { prisma } from "../lib/db/client";
import { buildDefaultVariantsForProduct } from "../lib/inventory/variantsMigration";

/**
 * Script de migration des données existantes :
 * Crée au moins une ProductVariant pour chaque produit existant en base de données.
 */
async function main() {
  console.log("Démarrage du rattrapage des variantes de produits...");

  const products = await prisma.product.findMany({
    include: { variants: true },
  });

  let createdCount = 0;

  for (const product of products) {
    if (product.variants.length > 0) {
      continue;
    }

    const defaultVariants = buildDefaultVariantsForProduct({
      id: product.id,
      name: product.name,
      swatch: product.swatch,
      colors: product.colors,
      stock: product.stock,
    });

    for (const v of defaultVariants) {
      await prisma.productVariant.create({
        data: {
          productId: product.id,
          colorName: v.colorName,
          colorHex: v.colorHex,
          stock: v.stock,
          active: v.active,
          position: v.position,
        },
      });
      createdCount++;
    }

    console.log(`Produit [${product.name}] : ${defaultVariants.length} variante(s) créée(s).`);
  }

  console.log(`Rattrapage terminé avec succès : ${createdCount} variante(s) créée(s).`);
}

main()
  .catch((e) => {
    console.error("Erreur lors du rattrapage des variantes :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
