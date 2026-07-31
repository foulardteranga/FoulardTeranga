import { describe, it, expect } from "vitest";
import { canTransition, transitionRefusal, STATUS_LABELS } from "@/lib/platform/transitions";

describe("canTransition — tableau du spec §9", () => {
  it("autorise active → suspended", () => {
    expect(canTransition("active", "suspended")).toBe(true);
  });

  it("autorise suspended → active", () => {
    expect(canTransition("suspended", "active")).toBe(true);
  });

  it("autorise active → archived", () => {
    expect(canTransition("active", "archived")).toBe(true);
  });

  it("autorise suspended → archived", () => {
    expect(canTransition("suspended", "archived")).toBe(true);
  });

  it("autorise archived → active", () => {
    expect(canTransition("archived", "active")).toBe(true);
  });

  it("autorise archived → deleted", () => {
    expect(canTransition("archived", "deleted")).toBe(true);
  });

  it("REFUSE active → deleted : il faut archiver d'abord", () => {
    expect(canTransition("active", "deleted")).toBe(false);
  });

  it("REFUSE suspended → deleted : il faut archiver d'abord", () => {
    expect(canTransition("suspended", "deleted")).toBe(false);
  });

  it("refuse archived → suspended : absent du tableau du spec §9", () => {
    expect(canTransition("archived", "suspended")).toBe(false);
  });

  it("refuse une transition vers l'état courant", () => {
    expect(canTransition("active", "active")).toBe(false);
    expect(canTransition("suspended", "suspended")).toBe(false);
    expect(canTransition("archived", "archived")).toBe(false);
  });
});

describe("transitionRefusal", () => {
  it("renvoie null quand la transition est autorisée", () => {
    expect(transitionRefusal("archived", "deleted")).toBeNull();
  });

  it("explique qu'il faut archiver avant de supprimer", () => {
    expect(transitionRefusal("active", "deleted")).toBe(
      "Seule une boutique archivée peut être supprimée définitivement. Archivez-la d'abord."
    );
    expect(transitionRefusal("suspended", "deleted")).toBe(
      "Seule une boutique archivée peut être supprimée définitivement. Archivez-la d'abord."
    );
  });

  it("explique un changement d'état impossible sans laisser un message technique", () => {
    expect(transitionRefusal("archived", "suspended")).toBe(
      "Cette boutique est archivée : réactivez-la avant de la suspendre."
    );
  });

  it("explique une transition vers l'état courant", () => {
    expect(transitionRefusal("active", "active")).toBe("Cette boutique est déjà active.");
  });
});

describe("STATUS_LABELS", () => {
  it("nomme les trois états en français", () => {
    expect(STATUS_LABELS.active).toBe("Active");
    expect(STATUS_LABELS.suspended).toBe("Suspendue");
    expect(STATUS_LABELS.archived).toBe("Archivée");
  });
});
