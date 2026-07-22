import { describe, it, expect } from "vitest";
import { fmt } from "@/lib/format";
import {
  appendDigit, appendDoubleZero, deleteLast, clampNumericValue, formatPadValue,
} from "./numericPadLogic";

describe("appendDigit", () => {
  it("mode integer : concatène les chiffres", () => {
    expect(appendDigit("1", "2", "integer")).toBe("12");
  });

  it("mode integer : remplace un zéro seul non significatif", () => {
    expect(appendDigit("0", "5", "integer")).toBe("5");
  });

  it("mode decimal : autorise un seul point", () => {
    expect(appendDigit("12", ".", "decimal")).toBe("12.");
    expect(appendDigit("12.5", ".", "decimal")).toBe("12.5");
  });

  it("mode decimal : un point sur une valeur vide part de '0.'", () => {
    expect(appendDigit("", ".", "decimal")).toBe("0.");
  });

  it("mode money : refuse le point (pas de décimales FCFA)", () => {
    expect(appendDigit("15000", ".", "money")).toBe("15000");
  });

  it("mode phone : autorise un '+' unique en tête", () => {
    expect(appendDigit("", "+", "phone")).toBe("+");
    expect(appendDigit("+225", "+", "phone")).toBe("+225");
  });

  it("mode phone : refuse le point", () => {
    expect(appendDigit("225", ".", "phone")).toBe("225");
  });
});

describe("appendDoubleZero", () => {
  it("ajoute '00' à une valeur existante", () => {
    expect(appendDoubleZero("15")).toBe("1500");
  });

  it("laisse '0' pour une valeur vide", () => {
    expect(appendDoubleZero("")).toBe("0");
  });
});

describe("deleteLast", () => {
  it("retire le dernier caractère", () => {
    expect(deleteLast("123")).toBe("12");
  });

  it("ne casse pas sur une chaîne vide", () => {
    expect(deleteLast("")).toBe("");
  });
});

describe("clampNumericValue", () => {
  it("borne au minimum", () => {
    expect(clampNumericValue("0", 1, 99)).toBe("1");
  });

  it("borne au maximum", () => {
    expect(clampNumericValue("500", 1, 99)).toBe("99");
  });

  it("laisse passer une valeur dans les bornes", () => {
    expect(clampNumericValue("12", 1, 99)).toBe("12");
  });

  it("laisse la chaîne vide inchangée (aucune saisie)", () => {
    expect(clampNumericValue("", 1, 99)).toBe("");
  });

  it("fonctionne sans bornes fournies", () => {
    expect(clampNumericValue("42")).toBe("42");
  });
});

describe("formatPadValue", () => {
  it("mode money : groupe les milliers et ajoute FCFA", () => {
    expect(formatPadValue("15000", "money")).toBe(`${fmt(15000)} FCFA`);
  });

  it("autres modes : valeur inchangée", () => {
    expect(formatPadValue("15000", "integer")).toBe("15000");
    expect(formatPadValue("+225", "phone")).toBe("+225");
  });
});
