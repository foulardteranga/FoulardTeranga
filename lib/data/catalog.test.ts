import { describe, it, expect } from "vitest";
import {
  catalog,
  categories,
  storefrontCategories,
  newestProducts,
  featuredProduct,
  relatedTo,
  filterCatalog,
} from "@/lib/data/catalog";

describe("catalog", () => {
  it("keeps the original 12 product ids", () => {
    expect(catalog.map((p) => p.id)).toEqual([
      "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "p11", "p12",
    ]);
  });

  it("recategorizes the turban (p3) out of Foulards", () => {
    const p3 = catalog.find((p) => p.id === "p3")!;
    expect(p3.cat).toBe("Turbans");
  });

  it("exposes Turbans in the full category list and in storefrontCategories", () => {
    expect(categories).toContain("Turbans");
    expect(storefrontCategories).toEqual(["Foulards", "Turbans", "Accessoires"]);
  });
});

describe("newestProducts", () => {
  it("returns badged products first, in catalog order", () => {
    expect(newestProducts(4).map((p) => p.id)).toEqual(["p1", "p2", "p7", "p10"]);
  });

  it("respects the limit", () => {
    expect(newestProducts(2).map((p) => p.id)).toEqual(["p1", "p2"]);
  });
});

describe("featuredProduct", () => {
  it("returns the product flagged featured", () => {
    expect(featuredProduct().id).toBe("p2");
  });
});

describe("relatedTo", () => {
  it("returns same-category products excluding the product itself", () => {
    expect(relatedTo("p2").map((p) => p.id)).toEqual(["p1", "p4"]);
  });

  it("returns an empty array for an unknown id", () => {
    expect(relatedTo("nope")).toEqual([]);
  });
});

describe("filterCatalog", () => {
  const base = { cat: "Tous" as const, color: "", motif: "", priceMax: 999999, query: "", sort: "new" as const };

  it("returns everything with no filters", () => {
    expect(filterCatalog(base)).toHaveLength(12);
  });

  it("filters by category", () => {
    expect(filterCatalog({ ...base, cat: "Turbans" }).map((p) => p.id)).toEqual(["p3"]);
  });

  it("filters by color (gold present on p3, absent on p4)", () => {
    const result = filterCatalog({ ...base, color: "#C9A227" }).map((p) => p.id);
    expect(result).toContain("p3");
    expect(result).not.toContain("p4");
  });

  it("filters by motif", () => {
    expect(filterCatalog({ ...base, motif: "Kente" }).map((p) => p.id)).toEqual(["p2", "p7"]);
  });

  it("filters by max price inclusive", () => {
    expect(filterCatalog({ ...base, priceMax: 8000 }).map((p) => p.id)).toEqual(["p4", "p9", "p10", "p12"]);
  });

  it("filters by free-text query on name or motif", () => {
    expect(filterCatalog({ ...base, query: "kente" }).map((p) => p.id)).toEqual(["p2", "p7"]);
  });

  it("sorts ascending by price", () => {
    expect(filterCatalog({ ...base, cat: "Accessoires", sort: "asc" }).map((p) => p.id)).toEqual([
      "p9", "p10", "p12", "p11",
    ]);
  });
});
