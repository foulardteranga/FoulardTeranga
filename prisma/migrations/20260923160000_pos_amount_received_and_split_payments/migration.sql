-- AlterTable: Ajout des colonnes de gestion du rendu de monnaie et du paiement mixte sur Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "amountReceived" integer;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "changeGiven" integer;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentDetails" jsonb;
