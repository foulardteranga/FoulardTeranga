import { describe, expect, it, vi, beforeEach } from "vitest";
import { updateTenantWhatsappPhone } from "./actions";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth";
import { requireWritableSession } from "@/lib/impersonation/guards";
import { getCurrentTenant } from "@/lib/tenant";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/impersonation/guards", () => ({
  requireWritableSession: vi.fn(),
}));

vi.mock("@/lib/tenant", () => ({
  getCurrentTenant: vi.fn(),
  TENANTS_CACHE_TAG: "tenants-cache",
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    tenant: {
      update: vi.fn(),
    },
  },
}));

describe("updateTenantWhatsappPhone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuse si non connecté ou non owner", async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null);
    const res = await updateTenantWhatsappPhone("+225 07 00 00 00 00");
    expect(res.ok).toBe(false);
    expect(res).toEqual({ ok: false, error: "Action réservée à la gérante de la boutique." });
  });

  it("refuse si la session impersonation est en lecture seule", async () => {
    vi.mocked(getSession).mockResolvedValueOnce({
      id: "u1", role: "owner", email: "o@t.ci", name: "Owner", tenantId: "t1",
    });
    vi.mocked(requireWritableSession).mockResolvedValueOnce({
      ok: false,
      error: "Mode lecture seule actif",
    });

    const res = await updateTenantWhatsappPhone("+225 07 00 00 00 00");
    expect(res.ok).toBe(false);
    expect(res).toEqual({ ok: false, error: "Mode lecture seule actif" });
  });

  it("refuse un numéro avec un format invalide", async () => {
    vi.mocked(getSession).mockResolvedValueOnce({
      id: "u1", role: "owner", email: "o@t.ci", name: "Owner", tenantId: "t1",
    });
    vi.mocked(requireWritableSession).mockResolvedValueOnce({ ok: true });

    const res = await updateTenantWhatsappPhone("abc??");
    expect(res.ok).toBe(false);
    expect(res).toEqual({ ok: false, error: "Format de numéro de téléphone invalide." });
  });

  it("enregistre un numéro valide et renvoie ok", async () => {
    vi.mocked(getSession).mockResolvedValueOnce({
      id: "u1", role: "owner", email: "o@t.ci", name: "Owner", tenantId: "t1",
    });
    vi.mocked(requireWritableSession).mockResolvedValueOnce({ ok: true });
    vi.mocked(getCurrentTenant).mockResolvedValueOnce({
      id: "t1", slug: "teranga", name: "Teranga", status: "active", plan: "essentiel",
    } as any);

    const res = await updateTenantWhatsappPhone("+225 07 59 45 09 88");
    expect(res.ok).toBe(true);
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { whatsappPhone: "+225 07 59 45 09 88" },
    });
  });

  it("permet de vider le numéro avec chaîne vide", async () => {
    vi.mocked(getSession).mockResolvedValueOnce({
      id: "u1", role: "owner", email: "o@t.ci", name: "Owner", tenantId: "t1",
    });
    vi.mocked(requireWritableSession).mockResolvedValueOnce({ ok: true });
    vi.mocked(getCurrentTenant).mockResolvedValueOnce({
      id: "t1", slug: "teranga", name: "Teranga", status: "active", plan: "essentiel",
    } as any);

    const res = await updateTenantWhatsappPhone("");
    expect(res.ok).toBe(true);
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { whatsappPhone: null },
    });
  });
});
