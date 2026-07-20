import { describe, it, expect } from "vitest";
import { fmt, money, initials, whatsappShareLink } from "@/lib/format";

describe("fmt", () => {
  it("groups thousands with a narrow no-break space (current toLocaleString('fr-FR') behavior)", () => {
    expect(fmt(12500).replace(/\s/g, " ")).toBe("12 500");
  });

  it("does not add a separator under 1000", () => {
    expect(fmt(500)).toBe("500");
  });
});

describe("money", () => {
  it("appends the FCFA suffix", () => {
    expect(money(22000).replace(/\s/g, " ")).toBe("22 000 FCFA");
  });
});

describe("initials", () => {
  it("takes the first letter of the first two words, uppercased", () => {
    expect(initials("Aya Koffi")).toBe("AK");
  });

  it("handles a single word", () => {
    expect(initials("Madame")).toBe("M");
  });
});

describe("whatsappShareLink", () => {
  it("construit un lien wa.me sans destinataire avec le message encodé", () => {
    expect(whatsappShareLink("Reçu #TER-1")).toBe("https://wa.me/?text=Re%C3%A7u%20%23TER-1");
  });
});
