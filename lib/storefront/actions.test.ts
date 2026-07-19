import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireZone: async () => ({ allowed: false }),
}));

import { uploadBlockImage } from "./actions";

describe("uploadBlockImage", () => {
  it("rejette hors zone dashboard", async () => {
    const formData = new FormData();
    formData.append("blockType", "hero");
    formData.append("fieldKey", "backgroundImage");

    const res = await uploadBlockImage(formData);

    expect(res).toEqual({ ok: false, error: "Une erreur est survenue, réessayez." });
  });
});
