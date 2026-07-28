import { describe, it, expect } from "vitest";
import {
  normalizeSlug,
  tenantSlugSchema,
  tenantModulesSchema,
  createTenantSchema,
  tenantIdentitySchema,
  tenantModulesFormSchema,
} from "./platform";

describe("normalizeSlug", () => {
  it("met en minuscules et retire les espaces de bord", () => {
    expect(normalizeSlug("  Boutique-Du-Plateau  ")).toBe("boutique-du-plateau");
  });
});

describe("tenantSlugSchema", () => {
  it("accepte minuscules, chiffres et tirets", () => {
    expect(tenantSlugSchema.safeParse("foulard-teranga-2").success).toBe(true);
  });

  it("refuse les majuscules", () => {
    const r = tenantSlugSchema.safeParse("Foulard");
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Minuscules, chiffres et tirets uniquement.");
  });

  it("refuse un tiret en tête ou en fin", () => {
    expect(tenantSlugSchema.safeParse("-foulard").success).toBe(false);
    expect(tenantSlugSchema.safeParse("foulard-").success).toBe(false);
  });

  it("refuse moins de 3 caractères", () => {
    expect(tenantSlugSchema.safeParse("ab").success).toBe(false);
  });
});

describe("tenantModulesSchema", () => {
  it("accepte une sélection contenant dash", () => {
    expect(tenantModulesSchema.safeParse(["dash", "pos"]).success).toBe(true);
  });

  it("refuse une sélection sans dash, en miroir de tenant_min_modules", () => {
    const r = tenantModulesSchema.safeParse(["pos", "orders"]);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe(
        "Le module Tableau de bord ne peut pas être désactivé."
      );
    }
  });

  it("refuse un identifiant de module inconnu", () => {
    expect(tenantModulesSchema.safeParse(["dash", "compta"]).success).toBe(false);
  });

  it("refuse une sélection vide", () => {
    expect(tenantModulesSchema.safeParse([]).success).toBe(false);
  });
});

const VALID_CREATE = {
  slug: "boutique-du-plateau",
  name: "Boutique du Plateau",
  plan: "essentiel" as const,
  primaryColor: "#26326B",
  accentColor: "#D07A34",
  logoText: "BDP",
  domains: ["boutique-du-plateau.ci"],
  ownerName: "Aya Koné",
  ownerEmail: "aya@example.com",
  ownerPassword: "motdepasse1",
};

describe("createTenantSchema", () => {
  it("accepte une saisie complète et valide", () => {
    expect(createTenantSchema.safeParse(VALID_CREATE).success).toBe(true);
  });

  it("refuse une couleur qui n'est pas un hex à 6 chiffres", () => {
    expect(createTenantSchema.safeParse({ ...VALID_CREATE, primaryColor: "bleu" }).success).toBe(false);
  });

  it("refuse un mot de passe de moins de 8 caractères", () => {
    const r = createTenantSchema.safeParse({ ...VALID_CREATE, ownerPassword: "court" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("8 caractères minimum.");
  });

  it("refuse un email de gérante invalide", () => {
    expect(createTenantSchema.safeParse({ ...VALID_CREATE, ownerEmail: "aya" }).success).toBe(false);
  });

  it("accepte une liste de domaines absente et la remplace par une liste vide", () => {
    const { domains: _omitted, ...withoutDomains } = VALID_CREATE;
    const r = createTenantSchema.safeParse(withoutDomains);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.domains).toEqual([]);
  });
});

describe("tenantIdentitySchema", () => {
  it("accepte une identité complète", () => {
    const r = tenantIdentitySchema.safeParse({
      name: "Boutique du Plateau",
      slug: "boutique-du-plateau",
      tagline: "Élégance ivoirienne",
      primaryColor: "#26326B",
      accentColor: "#D07A34",
      logoText: "BDP",
      font: "Playfair Display",
      whatsappPhone: "+225 07 00 00 00 00",
      domains: [],
    });
    expect(r.success).toBe(true);
  });

  it("refuse une police hors des deux polices supportées", () => {
    const r = tenantIdentitySchema.safeParse({
      name: "Boutique du Plateau",
      slug: "boutique-du-plateau",
      primaryColor: "#26326B",
      accentColor: "#D07A34",
      logoText: "BDP",
      font: "Comic Sans",
      domains: [],
    });
    expect(r.success).toBe(false);
  });
});

describe("tenantModulesFormSchema", () => {
  it("accepte palier + modules cohérents", () => {
    expect(tenantModulesFormSchema.safeParse({ plan: "pro", modules: ["dash", "fin"] }).success).toBe(true);
  });

  it("refuse des modules sans dash même avec un palier valide", () => {
    expect(tenantModulesFormSchema.safeParse({ plan: "pro", modules: ["fin"] }).success).toBe(false);
  });
});
