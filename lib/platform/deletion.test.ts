import { describe, it, expect, vi } from "vitest";
import { TENANT_DELETION_ORDER, deleteTenantRows } from "@/lib/platform/deletion";

function makeTx() {
  const calls: Array<{ model: string; args: Record<string, unknown> }> = [];
  const models = [
    "orderLine",
    "orderStatusEvent",
    "stockMovement",
    "order",
    "customer",
    "notification",
    "storefrontPage",
    "promoCode",
    "product",
    "profile",
    "employeeRole",
  ];
  const tx: Record<string, unknown> = {
    tenant: {
      delete: async (args: Record<string, unknown>) => {
        calls.push({ model: "tenant", args });
        return {};
      },
    },
  };
  for (const model of models) {
    tx[model] = {
      deleteMany: async (args: Record<string, unknown>) => {
        calls.push({ model, args });
        return { count: 0 };
      },
    };
  }
  return { tx, calls };
}

describe("TENANT_DELETION_ORDER", () => {
  it("supprime les enfants avant leurs parents", () => {
    const at = (model: string) => TENANT_DELETION_ORDER.indexOf(model);
    expect(at("orderLine")).toBeLessThan(at("order"));
    expect(at("orderLine")).toBeLessThan(at("product"));
    expect(at("orderStatusEvent")).toBeLessThan(at("order"));
    expect(at("orderStatusEvent")).toBeLessThan(at("profile"));
    expect(at("stockMovement")).toBeLessThan(at("product"));
    expect(at("stockMovement")).toBeLessThan(at("profile"));
    expect(at("order")).toBeLessThan(at("customer"));
    expect(at("customer")).toBeLessThan(at("profile"));
    expect(at("profile")).toBeLessThan(at("employeeRole"));
    expect(at("employeeRole")).toBeLessThan(at("tenant"));
  });

  it("couvre les onze tables porteuses d'un tenantId, plus OrderLine et Tenant", () => {
    expect(TENANT_DELETION_ORDER).toEqual([
      "orderLine",
      "orderStatusEvent",
      "stockMovement",
      "order",
      "customer",
      "notification",
      "storefrontPage",
      "promoCode",
      "product",
      "profile",
      "employeeRole",
      "tenant",
    ]);
  });

  it("ne supprime jamais PlatformAuditLog — le journal doit survivre (spec §1.3)", () => {
    expect(TENANT_DELETION_ORDER).not.toContain("platformAuditLog");
  });
});

describe("deleteTenantRows", () => {
  it("appelle chaque table dans l'ordre déclaré", async () => {
    const { tx, calls } = makeTx();
    await deleteTenantRows(tx as never, "t1");
    expect(calls.map((c) => c.model)).toEqual([...TENANT_DELETION_ORDER]);
  });

  it("filtre OrderLine par la boutique de sa commande, faute de tenantId propre", async () => {
    const { tx, calls } = makeTx();
    await deleteTenantRows(tx as never, "t1");
    expect(calls[0]).toEqual({ model: "orderLine", args: { where: { order: { tenantId: "t1" } } } });
  });

  it("filtre toutes les autres tables par tenantId, et Tenant par son id", async () => {
    const { tx, calls } = makeTx();
    await deleteTenantRows(tx as never, "t1");
    for (const call of calls.slice(1, -1)) {
      expect(call.args).toEqual({ where: { tenantId: "t1" } });
    }
    expect(calls[calls.length - 1]).toEqual({ model: "tenant", args: { where: { id: "t1" } } });
  });
});
