import { describe, expect, it, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  product: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  orderLine: {
    count: vi.fn(),
  },
  stockMovement: {
    deleteMany: vi.fn(),
  },
  productVariant: {
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockPrisma)),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/auth", () => ({
  requireZone: vi.fn(async () => ({ allowed: true })),
  getSession: vi.fn(async () => ({ userId: "user-1", role: "owner" })),
}));

vi.mock("@/lib/impersonation/guards", () => ({
  requireWritableSession: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/tenant", () => ({
  getCurrentTenant: vi.fn(async () => ({ id: "t1" })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockRemoveTenantStorageFiles = vi.hoisted(() => vi.fn(async () => ({ ok: true, deletedCount: 1 })));
vi.mock("@/lib/images/storage", () => ({
  removeTenantStorageFiles: mockRemoveTenantStorageFiles,
}));

import { archiveProduct, restoreProduct, deleteProduct, deleteProductImage, updateProductImages } from "./actions";

describe("lib/inventory/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("archiveProduct & restoreProduct", () => {
    it("archiveProduct passe active à false et définit archivedAt", async () => {
      mockPrisma.product.findFirst.mockResolvedValueOnce({ id: "p1", tenantId: "t1", active: true });
      mockPrisma.product.update.mockResolvedValueOnce({ id: "p1", active: false, archivedAt: new Date() });

      const res = await archiveProduct("p1");
      expect(res).toEqual({ ok: true });
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: expect.objectContaining({ active: false, archivedAt: expect.any(Date) }),
      });
    });

    it("restoreProduct passe active à true et archivedAt à null", async () => {
      mockPrisma.product.findFirst.mockResolvedValueOnce({ id: "p1", tenantId: "t1", active: false });
      mockPrisma.product.update.mockResolvedValueOnce({ id: "p1", active: true, archivedAt: null });

      const res = await restoreProduct("p1");
      expect(res).toEqual({ ok: true });
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: { active: true, archivedAt: null },
      });
    });
  });

  describe("deleteProduct", () => {
    it("deleteProduct refuse la suppression si des commandes sont liées au produit", async () => {
      mockPrisma.product.findFirst.mockResolvedValueOnce({ id: "p1", tenantId: "t1" });
      mockPrisma.orderLine.count.mockResolvedValueOnce(3);

      const res = await deleteProduct("p1");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toContain("Ce produit est référencé dans 3 commande");
      }
      expect(mockPrisma.product.delete).not.toHaveBeenCalled();
      expect(mockRemoveTenantStorageFiles).not.toHaveBeenCalled();
    });

    it("deleteProduct supprime le produit, ses variantes, mouvements et purge les images du stockage", async () => {
      mockPrisma.product.findFirst.mockResolvedValueOnce({
        id: "p1",
        tenantId: "t1",
        image: "https://domain.co/storefront-images/t1/products/main.webp",
        gallery: ["https://domain.co/storefront-images/t1/products/gal1.webp"],
        variants: [
          { id: "v1", image: "https://domain.co/storefront-images/t1/products/var1.webp" },
          { id: "v2", image: null },
        ],
      });
      mockPrisma.orderLine.count.mockResolvedValueOnce(0);

      const res = await deleteProduct("p1");
      expect(res).toEqual({ ok: true });
      expect(mockPrisma.stockMovement.deleteMany).toHaveBeenCalledWith({ where: { productId: "p1" } });
      expect(mockPrisma.productVariant.deleteMany).toHaveBeenCalledWith({ where: { productId: "p1" } });
      expect(mockPrisma.product.delete).toHaveBeenCalledWith({ where: { id: "p1" } });

      expect(mockRemoveTenantStorageFiles).toHaveBeenCalledWith("t1", [
        "https://domain.co/storefront-images/t1/products/main.webp",
        "https://domain.co/storefront-images/t1/products/gal1.webp",
        "https://domain.co/storefront-images/t1/products/var1.webp",
      ]);
    });
  });

  describe("deleteProductImage", () => {
    it("supprime l'image du stockage et de la base de données pour un produit spécifique", async () => {
      const url = "https://domain.co/storefront-images/t1/products/photo1.webp";
      mockPrisma.product.findFirst.mockResolvedValueOnce({
        id: "p1",
        image: url,
        gallery: [url, "https://domain.co/storefront-images/t1/products/photo2.webp"],
      });

      const res = await deleteProductImage(url, "p1");
      expect(res).toEqual({ ok: true });
      expect(mockRemoveTenantStorageFiles).toHaveBeenCalledWith("t1", [url]);
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: {
          image: null,
          gallery: ["https://domain.co/storefront-images/t1/products/photo2.webp"],
        },
      });
      expect(mockPrisma.productVariant.updateMany).toHaveBeenCalledWith({
        where: { productId: "p1", image: url },
        data: { image: null },
      });
    });

    it("supprime l'image du stockage et de tous les produits du tenant quand productId n'est pas spécifié", async () => {
      const url = "https://domain.co/storefront-images/t1/products/global.webp";
      mockPrisma.product.findMany.mockResolvedValueOnce([
        { id: "p2", gallery: [url, "https://other.webp"] },
      ]);

      const res = await deleteProductImage(url);
      expect(res).toEqual({ ok: true });
      expect(mockRemoveTenantStorageFiles).toHaveBeenCalledWith("t1", [url]);
      expect(mockPrisma.product.updateMany).toHaveBeenCalledWith({
        where: { tenantId: "t1", image: url },
        data: { image: null },
      });
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: "p2" },
        data: { gallery: ["https://other.webp"] },
      });
      expect(mockPrisma.productVariant.updateMany).toHaveBeenCalledWith({
        where: { product: { tenantId: "t1" }, image: url },
        data: { image: null },
      });
    });
  });

  describe("updateProductImages", () => {
    it("met à jour les photos et supprime les anciennes photos retirées du stockage", async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
      const oldMain = "https://x.supabase.co/storage/v1/object/public/storefront-images/t1/products/old-main.webp";
      const oldGal = "https://x.supabase.co/storage/v1/object/public/storefront-images/t1/products/old-gal.webp";
      const keptGal = "https://x.supabase.co/storage/v1/object/public/storefront-images/t1/products/kept-gal.webp";
      const newMain = "https://x.supabase.co/storage/v1/object/public/storefront-images/t1/products/new-main.webp";

      mockPrisma.product.findFirst.mockResolvedValueOnce({
        id: "p1",
        image: oldMain,
        gallery: [oldGal, keptGal],
      });

      const res = await updateProductImages("p1", {
        image: newMain,
        gallery: [keptGal],
      });

      expect(res).toEqual({ ok: true });
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: {
          image: newMain,
          gallery: [keptGal],
        },
      });
      expect(mockRemoveTenantStorageFiles).toHaveBeenCalledWith("t1", [oldMain, oldGal]);
    });
  });
});
