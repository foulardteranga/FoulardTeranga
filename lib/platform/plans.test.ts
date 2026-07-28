import { describe, it, expect } from "vitest";
import { MODULE_IDS } from "@/lib/nav";
import { PLAN_MODULES, PLAN_LABELS, modulesForPlan } from "./plans";

describe("modulesForPlan", () => {
  it("donne au palier essentiel tout sauf marketing et finance", () => {
    const modules = modulesForPlan("essentiel");
    expect(modules).toEqual(["pos", "dash", "orders", "inv", "cust", "theme", "vitrine", "boutique"]);
    expect(modules).not.toContain("mkt");
    expect(modules).not.toContain("fin");
  });

  it("donne au palier pro tous les modules connus", () => {
    expect([...modulesForPlan("pro")].sort()).toEqual([...MODULE_IDS].sort());
  });

  it("inclut toujours dash, exigé par la contrainte tenant_min_modules", () => {
    expect(modulesForPlan("essentiel")).toContain("dash");
    expect(modulesForPlan("pro")).toContain("dash");
  });

  it("renvoie une copie : muter le résultat ne corrompt pas la table des paliers", () => {
    const modules = modulesForPlan("essentiel");
    modules.pop();
    expect(modulesForPlan("essentiel")).toHaveLength(8);
    expect(PLAN_MODULES.essentiel).toHaveLength(8);
  });

  it("nomme les deux paliers en français pour l'UI", () => {
    expect(PLAN_LABELS).toEqual({ essentiel: "Essentiel", pro: "Pro" });
  });
});
