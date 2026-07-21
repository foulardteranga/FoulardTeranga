import { describe, it, expect } from "vitest";
import {
  REVENUE_STATUSES,
  startOfDayUtc,
  addDaysUtc,
  inWindow,
  summarizePeriod,
  deltaPct,
  breakdownByPayment,
  dailySeries,
  weeklySeries,
  topSoldProducts,
  lastSaleByProduct,
  dormantProducts,
  type RevenueOrder,
  type SoldLine,
} from "./analytics";

function order(over: Partial<RevenueOrder> = {}): RevenueOrder {
  return {
    total: 10000,
    promoDiscount: 0,
    pointsDiscount: 0,
    lineDiscount: 0,
    paymentMethod: "espece",
    createdAt: new Date("2026-07-20T10:00:00Z"),
    ...over,
  };
}

describe("REVENUE_STATUSES", () => {
  it("compte les commandes validées, jamais les nouvelles ni les refusées", () => {
    expect([...REVENUE_STATUSES]).toEqual(["confirmee", "preparation", "livree"]);
  });
});

describe("bornes de journée (fuseau boutique = UTC)", () => {
  it("ramène à minuit UTC", () => {
    expect(startOfDayUtc(new Date("2026-07-20T23:45:00Z")).toISOString()).toBe("2026-07-20T00:00:00.000Z");
  });

  it("décale d'un nombre de jours entier", () => {
    expect(addDaysUtc(new Date("2026-07-20T00:00:00Z"), -1).toISOString()).toBe("2026-07-19T00:00:00.000Z");
  });

  it("inclut la borne de début et exclut celle de fin", () => {
    const start = new Date("2026-07-20T00:00:00Z");
    const end = new Date("2026-07-21T00:00:00Z");
    expect(inWindow(start, start, end)).toBe(true);
    expect(inWindow(end, start, end)).toBe(false);
  });
});

describe("summarizePeriod", () => {
  it("agrège CA, transactions, panier moyen et remises", () => {
    const result = summarizePeriod([
      order({ total: 12000, promoDiscount: 1000 }),
      order({ total: 8000, pointsDiscount: 500, lineDiscount: 250 }),
    ]);
    expect(result.revenue).toBe(20000);
    expect(result.transactions).toBe(2);
    expect(result.averageBasket).toBe(10000);
    expect(result.discounts).toBe(1750);
  });

  it("renvoie des zéros sans commande (pas de division par zéro)", () => {
    expect(summarizePeriod([])).toEqual({ revenue: 0, transactions: 0, averageBasket: 0, discounts: 0 });
  });

  it("arrondit le panier moyen au FCFA", () => {
    expect(summarizePeriod([order({ total: 10000 }), order({ total: 10001 })]).averageBasket).toBe(10001);
  });
});

describe("deltaPct", () => {
  it("calcule la variation en pourcentage arrondi", () => {
    expect(deltaPct(120, 100)).toBe(20);
    expect(deltaPct(80, 100)).toBe(-20);
  });

  it("renvoie null quand la période précédente est vide (pas de +Infini%)", () => {
    expect(deltaPct(500, 0)).toBeNull();
  });
});

describe("breakdownByPayment", () => {
  it("regroupe par mode, trie par montant décroissant et calcule les parts", () => {
    const result = breakdownByPayment([
      order({ total: 6000, paymentMethod: "wave" }),
      order({ total: 3000, paymentMethod: "espece" }),
      order({ total: 1000, paymentMethod: "wave" }),
    ]);
    expect(result).toEqual([
      { key: "wave", amount: 7000, pct: 70 },
      { key: "espece", amount: 3000, pct: 30 },
    ]);
  });

  it("regroupe les commandes sans mode sous la clé « unpaid »", () => {
    const result = breakdownByPayment([order({ total: 5000, paymentMethod: null })]);
    expect(result).toEqual([{ key: "unpaid", amount: 5000, pct: 100 }]);
  });

  it("renvoie une liste vide sans commande", () => {
    expect(breakdownByPayment([])).toEqual([]);
  });
});

describe("dailySeries", () => {
  it("produit un point par jour, du plus ancien au plus récent, jours vides à 0", () => {
    const now = new Date("2026-07-20T12:00:00Z"); // lundi
    const series = dailySeries(
      [
        order({ total: 5000, createdAt: new Date("2026-07-20T09:00:00Z") }),
        order({ total: 3000, createdAt: new Date("2026-07-18T09:00:00Z") }),
      ],
      now,
      7
    );
    expect(series).toHaveLength(7);
    expect(series[6].value).toBe(5000);
    expect(series[4].value).toBe(3000);
    expect(series[5].value).toBe(0);
    expect(series[6].label).toBe("Lun");
  });
});

describe("weeklySeries", () => {
  it("produit un point par semaine étiqueté S1..Sn, du plus ancien au plus récent", () => {
    const now = new Date("2026-07-20T12:00:00Z");
    const series = weeklySeries(
      [
        order({ total: 4000, createdAt: new Date("2026-07-20T09:00:00Z") }),
        order({ total: 2000, createdAt: new Date("2026-07-01T09:00:00Z") }),
      ],
      now,
      4
    );
    // Fenêtres (now = lundi 20/07) : S1 = [23/06, 30/06[, S2 = [30/06, 07/07[,
    // S3 = [07/07, 14/07[, S4 = [14/07, 21/07[.
    expect(series).toHaveLength(4);
    expect(series.map((s) => s.label)).toEqual(["S1", "S2", "S3", "S4"]);
    expect(series[3].value).toBe(4000); // vente du 20/07
    expect(series[1].value).toBe(2000); // vente du 01/07
    expect(series[0].value).toBe(0);
  });
});

describe("topSoldProducts", () => {
  const lines: SoldLine[] = [
    { productId: "p1", qty: 2, lineTotal: 20000, soldAt: new Date("2026-07-10T00:00:00Z") },
    { productId: "p2", qty: 5, lineTotal: 15000, soldAt: new Date("2026-07-11T00:00:00Z") },
    { productId: "p1", qty: 1, lineTotal: 10000, soldAt: new Date("2026-07-12T00:00:00Z") },
  ];

  it("classe par quantité vendue décroissante et cumule le CA", () => {
    expect(topSoldProducts(lines, 2)).toEqual([
      { productId: "p2", qty: 5, revenue: 15000 },
      { productId: "p1", qty: 3, revenue: 30000 },
    ]);
  });

  it("respecte la limite demandée", () => {
    expect(topSoldProducts(lines, 1)).toHaveLength(1);
  });
});

describe("lastSaleByProduct", () => {
  it("retient la vente la plus récente par produit", () => {
    const map = lastSaleByProduct([
      { productId: "p1", qty: 1, lineTotal: 1, soldAt: new Date("2026-07-10T00:00:00Z") },
      { productId: "p1", qty: 1, lineTotal: 1, soldAt: new Date("2026-07-15T00:00:00Z") },
    ]);
    expect(map.get("p1")?.toISOString()).toBe("2026-07-15T00:00:00.000Z");
  });
});

describe("dormantProducts", () => {
  const now = new Date("2026-07-20T00:00:00Z");
  const products = [
    { id: "p1", stock: 5, createdAt: new Date("2026-06-01T00:00:00Z") },
    { id: "p2", stock: 3, createdAt: new Date("2026-07-01T00:00:00Z") },
    { id: "p3", stock: 0, createdAt: new Date("2026-05-01T00:00:00Z") },
  ];

  it("ignore les produits sans stock et trie du plus dormant au moins dormant", () => {
    const map = new Map([["p1", new Date("2026-07-18T00:00:00Z")]]);
    const result = dormantProducts(products, map, now, 4);
    expect(result.map((d) => d.productId)).toEqual(["p2", "p1"]);
    expect(result[0]).toEqual({ productId: "p2", daysSinceLastSale: 19, neverSold: true });
    expect(result[1]).toEqual({ productId: "p1", daysSinceLastSale: 2, neverSold: false });
  });

  it("respecte la limite demandée", () => {
    expect(dormantProducts(products, new Map(), now, 1)).toHaveLength(1);
  });
});
