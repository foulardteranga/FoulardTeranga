import { describe, it, expect } from "vitest";
import { validateKyc } from "@/lib/validators/kyc";

const validBase = { name: "Awa Diallo", place: "Cocody, Abidjan", phone: "+225 07 12 45 67 89", note: "", wa: true };

describe("validateKyc", () => {
  it("accepts a valid Abidjan submission", () => {
    const result = validateKyc(validBase);
    expect(result.ok).toBe(true);
  });

  it("accepts a phone number with a different country code (sub-region / international customers)", () => {
    const result = validateKyc({ ...validBase, phone: "+33 6 12 34 56 78", place: "Paris, France" });
    expect(result.ok).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = validateKyc({ ...validBase, name: "  " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.name).toBeTruthy();
  });

  it("rejects an empty place", () => {
    const result = validateKyc({ ...validBase, place: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.place).toBeTruthy();
  });

  it("rejects a phone number that is too short", () => {
    const result = validateKyc({ ...validBase, phone: "123" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.phone).toBeTruthy();
  });

  it("rejects a phone number containing letters", () => {
    const result = validateKyc({ ...validBase, phone: "call me maybe" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.phone).toBeTruthy();
  });

  it("trims whitespace from accepted fields", () => {
    const result = validateKyc({ ...validBase, name: "  Awa Diallo  " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.name).toBe("Awa Diallo");
  });
});
