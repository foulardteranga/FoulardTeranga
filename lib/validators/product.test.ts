import { describe, it, expect, beforeAll } from "vitest";
import { productSchema, productImagesSchema } from "./product";

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
});

const BASE = {
  category: "Foulards",
  name: "Foulard tissé main",
  variant: "Coton · Bleu nuit",
  motif: "Wax",
  price: 15000,
  stock: 10,
  swatch: "#26326B",
  lengths: "Taille unique",
  description: "",
};

const URL_A = "https://x.supabase.co/storage/v1/object/public/storefront-images/t/products/a.webp";
const URL_B = "https://x.supabase.co/storage/v1/object/public/storefront-images/t/products/b.webp";

describe("productSchema — images", () => {
  it("accepte un produit sans image ni galerie (défauts)", () => {
    const parsed = productSchema.parse(BASE);
    expect(parsed.image).toBeUndefined();
    expect(parsed.gallery).toEqual([]);
  });

  it("accepte une image principale et une galerie en URLs", () => {
    const parsed = productSchema.parse({ ...BASE, image: URL_A, gallery: [URL_B] });
    expect(parsed.image).toBe(URL_A);
    expect(parsed.gallery).toEqual([URL_B]);
  });

  it("rejette une image qui n'est pas une URL", () => {
    expect(productSchema.safeParse({ ...BASE, image: "pas-une-url" }).success).toBe(false);
  });

  it("rejette une galerie contenant autre chose que des URLs", () => {
    expect(productSchema.safeParse({ ...BASE, gallery: ["nope"] }).success).toBe(false);
  });

  it("rejette une image hébergée sur un domaine externe imitant le chemin du bucket", () => {
    const evil = "https://evil.com/storage/v1/object/public/storefront-images/x.webp";
    expect(productSchema.safeParse({ ...BASE, image: evil }).success).toBe(false);
    expect(productSchema.safeParse({ ...BASE, gallery: [evil] }).success).toBe(false);
  });

  it("rejette une URL sur notre domaine mais en dehors du bucket storefront-images", () => {
    const outsideBucket = "https://x.supabase.co/storage/v1/object/public/other-bucket/x.webp";
    expect(productSchema.safeParse({ ...BASE, image: outsideBucket }).success).toBe(false);
    expect(productSchema.safeParse({ ...BASE, gallery: [outsideBucket] }).success).toBe(false);
  });
});

describe("productImagesSchema", () => {
  it("accepte image null (retrait de la photo principale)", () => {
    const parsed = productImagesSchema.parse({ image: null, gallery: [] });
    expect(parsed.image).toBeNull();
    expect(parsed.gallery).toEqual([]);
  });

  it("accepte image + galerie en URLs", () => {
    expect(productImagesSchema.parse({ image: URL_A, gallery: [URL_B] })).toEqual({
      image: URL_A,
      gallery: [URL_B],
    });
  });

  it("rejette un objet incomplet", () => {
    expect(productImagesSchema.safeParse({ image: URL_A }).success).toBe(false);
  });

  it("rejette une image ou une galerie hors du bucket storefront-images", () => {
    const evil = "https://evil.com/storage/v1/object/public/storefront-images/x.webp";
    const outsideBucket = "https://x.supabase.co/storage/v1/object/public/other-bucket/x.webp";
    expect(productImagesSchema.safeParse({ image: evil, gallery: [] }).success).toBe(false);
    expect(productImagesSchema.safeParse({ image: null, gallery: [outsideBucket] }).success).toBe(false);
  });
});
