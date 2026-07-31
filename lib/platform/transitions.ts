import type { TenantStatus } from "@/lib/generated/prisma/enums";

/** Cible d'une transition : un statut, ou la suppression définitive (qui n'est pas un statut). */
export type LifecycleTarget = TenantStatus | "deleted";

export const STATUS_LABELS: Record<TenantStatus, string> = {
  active: "Active",
  suspended: "Suspendue",
  archived: "Archivée",
};

/**
 * Tableau des transitions autorisées du spec §9, encodé littéralement. Ce qui
 * n'y figure pas est refusé — y compris `archived → suspended`, absent du spec,
 * et toute transition vers l'état courant.
 */
const ALLOWED: Record<TenantStatus, LifecycleTarget[]> = {
  active: ["suspended", "archived"],
  suspended: ["active", "archived"],
  archived: ["active", "deleted"],
};

export function canTransition(from: TenantStatus, to: LifecycleTarget): boolean {
  return ALLOWED[from].includes(to);
}

/**
 * Message expliquant pourquoi une transition est refusée, ou `null` si elle est
 * autorisée. Spec §11 : jamais un échec muet ni un message technique.
 */
export function transitionRefusal(from: TenantStatus, to: LifecycleTarget): string | null {
  if (canTransition(from, to)) return null;

  if (to === "deleted") {
    return "Seule une boutique archivée peut être supprimée définitivement. Archivez-la d'abord.";
  }
  if (from === to) {
    return `Cette boutique est déjà ${STATUS_LABELS[from].toLowerCase()}.`;
  }
  if (from === "archived") {
    return "Cette boutique est archivée : réactivez-la avant de la suspendre.";
  }
  return "Ce changement d'état n'est pas autorisé.";
}
