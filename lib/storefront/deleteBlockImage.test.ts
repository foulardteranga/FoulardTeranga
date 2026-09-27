import { describe, expect, it, vi, beforeEach } from "vitest";

const removeMock = vi.fn();
const getPublicUrlMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireZone: async () => ({ allowed: true }),
}));

vi.mock("@/lib/impersonation/guards", () => ({
  requireWritableSession: async () => ({ ok: true }),
}));

vi.mock("@/lib/tenant", () => ({
  getCurrentTenant: async () => ({
    id: "tenant-123",
    slug: "foulards",
    name: "Foulards Téranga",
    status: "active",
    theme: {},
    domains: [],
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: (_bucket: string) => ({
        remove: removeMock,
        getPublicUrl: getPublicUrlMock,
      }),
    },
  }),
}));

import { deleteBlockImage } from "./actions";

describe("deleteBlockImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne ok: true immédiatement si imageUrl est vide", async () => {
    const res1 = await deleteBlockImage("");
    const res2 = await deleteBlockImage("   ");

    expect(res1).toEqual({ ok: true });
    expect(res2).toEqual({ ok: true });
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("retourne ok: true sans appel storage si l'URL ne vient pas du bucket storefront-images", async () => {
    const res = await deleteBlockImage("https://external-cdn.com/photos/banner.jpg");

    expect(res).toEqual({ ok: true });
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("rejette la suppression si l'image appartient à un autre tenant (isolation multitenant)", async () => {
    const intruderUrl =
      "https://xyz.supabase.co/storage/v1/object/public/storefront-images/other-tenant-999/hero/image.webp";

    const res = await deleteBlockImage(intruderUrl);

    expect(res).toEqual({ ok: false, error: "Action non autorisée." });
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("supprime avec succès l'image appartenant au tenant courant", async () => {
    removeMock.mockResolvedValueOnce({ error: null });

    const validUrl =
      "https://xyz.supabase.co/storage/v1/object/public/storefront-images/tenant-123/hero/slide-1.webp?t=123456";

    const res = await deleteBlockImage(validUrl);

    expect(res).toEqual({ ok: true });
    expect(removeMock).toHaveBeenCalledWith(["tenant-123/hero/slide-1.webp"]);
  });

  it("gère l'erreur renvoyée par le stockage Supabase", async () => {
    removeMock.mockResolvedValueOnce({ error: { message: "Storage error" } });

    const validUrl =
      "https://xyz.supabase.co/storage/v1/object/public/storefront-images/tenant-123/hero/slide-1.webp";

    const res = await deleteBlockImage(validUrl);

    expect(res).toEqual({ ok: false, error: "Échec de la suppression dans le stockage." });
    expect(removeMock).toHaveBeenCalledWith(["tenant-123/hero/slide-1.webp"]);
  });
});
