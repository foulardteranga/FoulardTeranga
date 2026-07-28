import { describe, it, expect } from "vitest";
import { defaultEmployeeRoles, initialStorefrontPage } from "./provisioning";
import { modulesForPlan } from "./plans";

describe("defaultEmployeeRoles", () => {
  it("crée Vendeuse et Gérant adjoint pour le palier essentiel", () => {
    const roles = defaultEmployeeRoles(modulesForPlan("essentiel"));
    expect(roles.map((r) => r.name)).toEqual(["Vendeuse", "Gérant adjoint"]);
  });

  it("limite Vendeuse à pos, orders et inv", () => {
    const roles = defaultEmployeeRoles(modulesForPlan("pro"));
    expect(roles[0]).toEqual({ name: "Vendeuse", permissions: ["pos", "orders", "inv"] });
  });

  it("exclut theme et vitrine de Gérant adjoint", () => {
    const adjoint = defaultEmployeeRoles(modulesForPlan("pro"))[1];
    expect(adjoint.permissions).not.toContain("theme");
    expect(adjoint.permissions).not.toContain("vitrine");
    expect(adjoint.permissions).toContain("fin");
  });

  it("ne provisionne jamais une permission pour un module désactivé", () => {
    const roles = defaultEmployeeRoles(["dash", "pos"]);
    expect(roles).toEqual([
      { name: "Vendeuse", permissions: ["pos"] },
      { name: "Gérant adjoint", permissions: ["dash", "pos"] },
    ]);
  });

  it("omet un profil qui n'aurait aucune permission", () => {
    expect(defaultEmployeeRoles(["theme", "vitrine"])).toEqual([]);
  });
});

describe("initialStorefrontPage", () => {
  it("conserve tous les blocs par défaut", () => {
    const page = initialStorefrontPage("Boutique du Plateau");
    expect(page.blocks).toHaveLength(10);
    expect(page.blocks.map((b) => b.type)).toContain("hero");
  });

  it("renseigne le hero avec le nom de la boutique", () => {
    const hero = initialStorefrontPage("Boutique du Plateau").blocks.find((b) => b.type === "hero");
    expect(hero?.settings.title).toBe("Boutique du Plateau");
    expect(hero?.settings.subtitle).toBe("Découvrez les créations de Boutique du Plateau.");
  });

  it("renseigne la grille produits et le bloc contact", () => {
    const page = initialStorefrontPage("Boutique du Plateau");
    expect(page.blocks.find((b) => b.type === "grid")?.settings.title).toBe(
      "Les nouveautés de Boutique du Plateau"
    );
    expect(page.blocks.find((b) => b.type === "contact")?.settings.locationTitle).toBe(
      "Boutique du Plateau"
    );
  });

  it("laisse les autres blocs sur leurs valeurs par défaut", () => {
    const story = initialStorefrontPage("Boutique du Plateau").blocks.find((b) => b.type === "story");
    expect(story?.visible).toBe(true);
    expect(story?.settings).toBeDefined();
  });
});
