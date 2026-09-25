-- AlterTable: Ajout des colonnes active et archivedAt sur Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- Index sur Product (tenantId, active)
CREATE INDEX IF NOT EXISTS "Product_tenantId_active_idx" ON "Product"("tenantId", "active");

-- Policy RLS DELETE pour Product (staff / owner)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'Product' AND policyname = 'products_delete_staff'
  ) THEN
    CREATE POLICY "products_delete_staff" ON "Product"
      FOR DELETE TO authenticated
      USING (
        "tenantId" = public.current_tenant_id() 
        AND public.current_role() IN ('owner'::"Role", 'staff'::"Role")
      );
  END IF;
END $$;
