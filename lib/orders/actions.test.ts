import { describe, expect, it, vi, beforeEach } from "vitest";

// submitWebOrder est le checkout public de la vitrine (visiteuse anonyme,
// pas de session) : ce test ne couvre que son refus sur une boutique non
// active (Tâche 17), avant toute écriture — la boutique est résolue puis
// immédiatement contrôlée, donc aucun mock de prisma/transaction n'est requis
// pour ce cas précis (le refus intervient avant tout accès base).
const tenantState = vi.hoisted(() => ({ status: "active" as string }));
vi.mock("@/lib/tenant", () => ({
  getCurrentTenant: async () => ({
    id: "t1",
    slug: "foulard-teranga",
    name: "Foulard Teranga",
    status: tenantState.status,
    theme: {},
    domains: [],
  }),
}));

// Mocks additionnels pour confirmOrder (commande personnalisée) : suit le
// même patron que lib/inventory/actions.test.ts (vi.hoisted + $transaction
// qui invoque simplement le callback avec lui-même).
const mockPrisma = vi.hoisted(() => ({
  order: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  orderStatusEvent: {
    create: vi.fn(),
  },
  customer: {
    findMany: vi.fn(),
  },
  productVariant: {
    update: vi.fn(),
  },
  product: {
    update: vi.fn(),
  },
  stockMovement: {
    create: vi.fn(),
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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/customers/applyLoyaltyOrder", () => ({
  applyLoyaltyOrder: vi.fn(async () => ({ customerId: null })),
}));

import { submitWebOrder, confirmOrder } from "./actions";

const validKyc = { name: "Awa Diop", place: "Cocody", phone: "0102030405", note: "", wa: true };

describe("submitWebOrder — boutique suspendue/archivée", () => {
  it("refuse la commande avec un message client neutre quand la boutique est suspendue", async () => {
    tenantState.status = "suspended";
    const result = await submitWebOrder(validKyc, []);
    expect(result).toEqual({
      ok: false,
      error: "Cette boutique n'accepte plus de commandes pour le moment.",
    });
  });

  it("refuse la commande quand la boutique est archivée", async () => {
    tenantState.status = "archived";
    const result = await submitWebOrder(validKyc, []);
    expect(result.ok).toBe(false);
  });
});

describe("confirmOrder — commande personnalisée (isCustom: true)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantState.status = "active";
  });

  it("préserve order.total au lieu de le recalculer depuis un sous-total de lignes vide", async () => {
    mockPrisma.order.findFirst.mockResolvedValueOnce({
      id: "o1",
      ref: "#TER-9001",
      tenantId: "t1",
      status: "nouvelle",
      isCustom: true,
      lines: [],
      total: 25000,
      promoCode: null,
      pointsUsed: 0,
      phone: "0102030405",
      clientName: "Test",
      place: "Cocody",
    });
    mockPrisma.customer.findMany.mockResolvedValueOnce([]);

    const result = await confirmOrder("#TER-9001");

    expect(result).toEqual({ ok: true });
    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total: 25000,
          promoDiscount: 0,
          pointsUsed: 0,
          pointsDiscount: 0,
          status: "confirmee",
        }),
      })
    );
    expect(mockPrisma.productVariant.update).not.toHaveBeenCalled();
    expect(mockPrisma.product.update).not.toHaveBeenCalled();
    expect(mockPrisma.stockMovement.create).not.toHaveBeenCalled();
  });
});
