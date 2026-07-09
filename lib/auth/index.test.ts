import { describe, it, expect } from "vitest";
import { requireZone } from "@/lib/auth";

describe("requireZone", () => {
  it("always allows the public storefront zone", () => {
    expect(requireZone("storefront").allowed).toBe(true);
  });

  it("allows the mock owner session into the dashboard zone", () => {
    expect(requireZone("dashboard").allowed).toBe(true);
  });

  it("does not allow the mock owner session into the super-admin zone", () => {
    expect(requireZone("admin").allowed).toBe(false);
  });
});
