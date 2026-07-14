import { describe, it, expect } from "vitest";
import { normalizePhone } from "@/lib/customers/normalizePhone";

describe("normalizePhone", () => {
  it("strips spaces while keeping a leading + and all digits", () => {
    expect(normalizePhone("+225 07 12 45 67 89")).toBe("+2250712456789");
  });

  it("treats different separators as equivalent for the same number", () => {
    expect(normalizePhone("+225-07-12-45-67-89")).toBe(normalizePhone("+225 07 12 45 67 89"));
  });

  it("keeps a leading + but drops parentheses too", () => {
    expect(normalizePhone("+225 (07) 12-45-67-89")).toBe("+2250712456789");
  });

  it("returns digits only when there is no leading +", () => {
    expect(normalizePhone("0712456789")).toBe("0712456789");
  });

  it("does not merge a local number with its +country-code equivalent (known limitation, see spec §6)", () => {
    expect(normalizePhone("0712456789")).not.toBe(normalizePhone("+2250712456789"));
  });
});
