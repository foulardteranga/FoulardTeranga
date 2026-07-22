import { describe, it, expect } from "vitest";
import { validateLogin } from "@/lib/validators/auth";

describe("validateLogin", () => {
  it("accepts a valid email and non-empty password", () => {
    const result = validateLogin({ email: "gerante@foulard-teranga.com", password: "un-mot-de-passe" });
    expect(result.ok).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = validateLogin({ email: "pas-un-email", password: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.email).toBeTruthy();
  });

  it("rejects an empty password", () => {
    const result = validateLogin({ email: "gerante@foulard-teranga.com", password: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.password).toBeTruthy();
  });

  it("trims whitespace from the email", () => {
    const result = validateLogin({ email: "  gerante@foulard-teranga.com  ", password: "x" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.email).toBe("gerante@foulard-teranga.com");
  });
});
