-- Remplace les catégories "Tissus" et "Accessoires" par "Coiffes", "Eventails" et "Voiles".
-- La colonne devient nullable : les produits existants rattachés aux catégories
-- supprimées passent à NULL ("Sans catégorie") plutôt que d'être forcés vers une
-- nouvelle valeur ou bloqués par la contrainte NOT NULL.

ALTER TYPE "ProductCategory" RENAME TO "ProductCategory_old";

CREATE TYPE "ProductCategory" AS ENUM ('Foulards', 'Turbans', 'Coiffes', 'Eventails', 'Voiles');

ALTER TABLE "Product"
  ALTER COLUMN "category" DROP DEFAULT,
  ALTER COLUMN "category" TYPE "ProductCategory"
    USING (
      CASE "category"::text
        WHEN 'Foulards' THEN 'Foulards'
        WHEN 'Turbans' THEN 'Turbans'
        ELSE NULL
      END
    )::"ProductCategory",
  ALTER COLUMN "category" DROP NOT NULL;

DROP TYPE "ProductCategory_old";
