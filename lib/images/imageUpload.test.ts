import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { validateImageUpload, compressImage, MAX_UPLOAD_BYTES } from "./imageUpload";

describe("validateImageUpload", () => {
  it("accepte un JPEG, un PNG et un WebP sous la limite de taille", () => {
    expect(validateImageUpload({ type: "image/jpeg", size: 1000 })).toEqual({ ok: true });
    expect(validateImageUpload({ type: "image/png", size: 1000 })).toEqual({ ok: true });
    expect(validateImageUpload({ type: "image/webp", size: 1000 })).toEqual({ ok: true });
  });

  it("rejette un format non supporté", () => {
    const result = validateImageUpload({ type: "application/pdf", size: 1000 });
    expect(result.ok).toBe(false);
  });

  it("rejette un fichier au-dessus de la limite de taille", () => {
    const result = validateImageUpload({ type: "image/jpeg", size: MAX_UPLOAD_BYTES + 1 });
    expect(result.ok).toBe(false);
  });

  it("accepte un fichier exactement à la limite de taille", () => {
    expect(validateImageUpload({ type: "image/jpeg", size: MAX_UPLOAD_BYTES })).toEqual({ ok: true });
  });
});

describe("compressImage", () => {
  it("convertit une image en WebP", async () => {
    const input = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();

    const output = await compressImage(input);
    const meta = await sharp(output).metadata();
    expect(meta.format).toBe("webp");
  });

  it("redimensionne une image plus large que 1920px à 1920px de large", async () => {
    const input = await sharp({
      create: { width: 2500, height: 500, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .png()
      .toBuffer();

    const output = await compressImage(input);
    const meta = await sharp(output).metadata();
    expect(meta.width).toBe(1920);
  });

  it("n'agrandit pas une image plus petite que 1920px", async () => {
    const input = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 0, g: 255, b: 0 } },
    })
      .png()
      .toBuffer();

    const output = await compressImage(input);
    const meta = await sharp(output).metadata();
    expect(meta.width).toBe(50);
  });
});
