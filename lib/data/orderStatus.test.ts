import { describe, it, expect } from "vitest";
import { formatOrderAgo, formatOrderDate } from "@/lib/data/orderStatus";

describe("formatOrderAgo", () => {
  const now = new Date("2026-07-14T10:00:00Z");

  it("returns \"à l'instant\" for less than a minute ago", () => {
    const createdAt = new Date("2026-07-14T09:59:30Z");
    expect(formatOrderAgo(createdAt, now)).toBe("à l'instant");
  });

  it("returns minutes for under an hour ago", () => {
    const createdAt = new Date("2026-07-14T09:48:00Z");
    expect(formatOrderAgo(createdAt, now)).toBe("il y a 12 min");
  });

  it("returns hours for under a day ago", () => {
    const createdAt = new Date("2026-07-14T07:00:00Z");
    expect(formatOrderAgo(createdAt, now)).toBe("il y a 3 h");
  });

  it("returns \"hier\" for exactly one day ago", () => {
    const createdAt = new Date("2026-07-13T10:00:00Z");
    expect(formatOrderAgo(createdAt, now)).toBe("hier");
  });

  it("returns days for more than a day ago", () => {
    const createdAt = new Date("2026-07-10T10:00:00Z");
    expect(formatOrderAgo(createdAt, now)).toBe("il y a 4 j");
  });
});

describe("formatOrderDate", () => {
  const now = new Date("2026-07-14T10:00:00Z");

  it("prefixes with \"Aujourd'hui\" for the same calendar day", () => {
    const createdAt = new Date("2026-07-14T09:42:00Z");
    expect(formatOrderDate(createdAt, now)).toContain("Aujourd'hui");
  });

  it("prefixes with \"Hier\" for the previous calendar day", () => {
    const createdAt = new Date("2026-07-13T18:20:00Z");
    expect(formatOrderDate(createdAt, now)).toContain("Hier");
  });

  it("falls back to a day/month date further in the past", () => {
    const createdAt = new Date("2026-07-01T11:40:00Z");
    const result = formatOrderDate(createdAt, now);
    expect(result).not.toContain("Aujourd'hui");
    expect(result).not.toContain("Hier");
    expect(result).toContain("01/07");
  });
});
