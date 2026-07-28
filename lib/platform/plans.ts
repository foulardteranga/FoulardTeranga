import { MODULE_IDS, type ModuleId } from "@/lib/nav";
import type { TenantPlan } from "@/lib/generated/prisma/enums";

/** Palier « essentiel » : tout sauf marketing et finance (spec §1.1). */
const ESSENTIEL_MODULES: ModuleId[] = [
  "pos",
  "dash",
  "orders",
  "inv",
  "cust",
  "theme",
  "vitrine",
  "boutique",
];

export const PLAN_MODULES: Record<TenantPlan, ModuleId[]> = {
  essentiel: ESSENTIEL_MODULES,
  pro: [...MODULE_IDS],
};

export const PLAN_LABELS: Record<TenantPlan, string> = {
  essentiel: "Essentiel",
  pro: "Pro",
};

/**
 * Pré-remplissage des modules d'un palier. Copie défensive : l'appelant ajuste
 * ensuite librement les cases — `plan` ne contraint rien (spec §1.1).
 */
export function modulesForPlan(plan: TenantPlan): ModuleId[] {
  return [...PLAN_MODULES[plan]];
}
