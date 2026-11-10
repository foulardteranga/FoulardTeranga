-- AlterTable: Ajout des champs de commande personnalisée (sur mesure, sans produit catalogue)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "isCustom" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customColorName" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customColorHex" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customFabricNote" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customModel" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customModelImageUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customDueDate" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customDeposit" INTEGER;
