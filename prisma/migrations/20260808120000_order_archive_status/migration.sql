ALTER TYPE "OrderStatus" ADD VALUE 'archivee';

ALTER TABLE "Order" ADD COLUMN "previousStatus" "OrderStatus";
ALTER TABLE "Order" ADD COLUMN "archivedAt" TIMESTAMP(3);
