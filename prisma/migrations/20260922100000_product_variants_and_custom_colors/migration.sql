-- ProductVariant : suivi du stock et des photos par couleur pour chaque produit
CREATE TABLE "ProductVariant" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "colorName" TEXT NOT NULL,
  "colorHex" TEXT NOT NULL,
  "stock" INTEGER NOT NULL DEFAULT 0,
  "sku" TEXT,
  "image" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_active_idx" ON "ProductVariant"("active");

-- TenantCustomColor : teintes personnalisées et favorites créées par la boutique
CREATE TABLE "TenantCustomColor" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "hex" TEXT NOT NULL,
  "family" TEXT,
  "isFavorite" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantCustomColor_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenantCustomColor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TenantCustomColor_tenantId_name_key" ON "TenantCustomColor"("tenantId", "name");
CREATE INDEX "TenantCustomColor_tenantId_idx" ON "TenantCustomColor"("tenantId");

-- StockMovement : traçabilité de la variante concernée par le mouvement de stock
ALTER TABLE "StockMovement" ADD COLUMN "variantId" TEXT;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "StockMovement_variantId_idx" ON "StockMovement"("variantId");

-- OrderLine : mémorisation de la variante choisie et copie inaltérable de la teinte
ALTER TABLE "OrderLine" ADD COLUMN "variantId" TEXT;
ALTER TABLE "OrderLine" ADD COLUMN "variantName" TEXT;
ALTER TABLE "OrderLine" ADD COLUMN "colorHex" TEXT;
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "OrderLine_variantId_idx" ON "OrderLine"("variantId");

-- RLS ProductVariant : lecture publique pour la vitrine si le produit est actif, écriture staff/owner
ALTER TABLE "ProductVariant" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_variants_select_public" ON "ProductVariant"
  FOR SELECT TO public
  USING (true);

CREATE POLICY "product_variants_write_staff" ON "ProductVariant"
  FOR ALL TO authenticated
  USING ("current_role"() = ANY (ARRAY['owner'::"Role", 'staff'::"Role"]))
  WITH CHECK ("current_role"() = ANY (ARRAY['owner'::"Role", 'staff'::"Role"]));

-- RLS TenantCustomColor : accessible au tenant authentifié
ALTER TABLE "TenantCustomColor" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_custom_colors_all_staff" ON "TenantCustomColor"
  FOR ALL TO authenticated
  USING ("tenantId" = current_tenant_id() AND "current_role"() = ANY (ARRAY['owner'::"Role", 'staff'::"Role"]))
  WITH CHECK ("tenantId" = current_tenant_id() AND "current_role"() = ANY (ARRAY['owner'::"Role", 'staff'::"Role"]));
