import { describe, expect, it, vi, beforeEach } from "vitest";
import { extractTenantStoragePath, removeTenantStorageFiles } from "./storage";

const mockRemove = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        remove: mockRemove,
      })),
    },
  })),
}));

describe("lib/images/storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractTenantStoragePath", () => {
    it("retourne null pour les entrées vides ou non-string", () => {
      expect(extractTenantStoragePath("", "tenant-1")).toBeNull();
      expect(extractTenantStoragePath("   ", "tenant-1")).toBeNull();
      // @ts-expect-error test invalide
      expect(extractTenantStoragePath(null, "tenant-1")).toBeNull();
    });

    it("retourne null pour une URL externe hors bucket", () => {
      expect(extractTenantStoragePath("https://external-cdn.com/photos/banner.jpg", "tenant-1")).toBeNull();
    });

    it("retourne null si l'URL tente d'accéder au dossier d'un autre tenant", () => {
      const intruderUrl = "https://my-supabase.co/storage/v1/object/public/storefront-images/tenant-2/products/hack.webp";
      expect(extractTenantStoragePath(intruderUrl, "tenant-1")).toBeNull();
    });

    it("extrait correctement le chemin relatif pour le bon tenant", () => {
      const validUrl = "https://my-supabase.co/storage/v1/object/public/storefront-images/tenant-1/products/foulard.webp?v=123";
      expect(extractTenantStoragePath(validUrl, "tenant-1")).toBe("tenant-1/products/foulard.webp");
    });
  });

  describe("removeTenantStorageFiles", () => {
    it("ne fait rien et réussit si aucune image valide n'est fournie", async () => {
      const res = await removeTenantStorageFiles("tenant-1", ["", null, "https://google.com/img.jpg"]);
      expect(res).toEqual({ ok: true, deletedCount: 0 });
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it("supprime les images valides appartenant au tenant et déduplique", async () => {
      mockRemove.mockResolvedValueOnce({ data: [], error: null });
      const url1 = "https://domain.co/storefront-images/tenant-1/p1.webp";
      const url2 = "https://domain.co/storefront-images/tenant-1/p2.webp";
      const urlIntruder = "https://domain.co/storefront-images/tenant-2/p3.webp";

      const res = await removeTenantStorageFiles("tenant-1", [url1, url2, url1, urlIntruder]);
      expect(res).toEqual({ ok: true, deletedCount: 2 });
      expect(mockRemove).toHaveBeenCalledWith(["tenant-1/p1.webp", "tenant-1/p2.webp"]);
    });

    it("gère l'erreur renvoyée par le storage Supabase", async () => {
      mockRemove.mockResolvedValueOnce({ data: null, error: { message: "Storage error" } });
      const url1 = "https://domain.co/storefront-images/tenant-1/p1.webp";

      const res = await removeTenantStorageFiles("tenant-1", [url1]);
      expect(res.ok).toBe(false);
      expect(res.deletedCount).toBe(0);
    });
  });
});
