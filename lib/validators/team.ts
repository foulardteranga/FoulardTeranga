import { z } from "zod";
import { MODULE_IDS } from "@/lib/nav";

export const employeeRoleSchema = z.object({
  name: z.string().trim().min(2, "Le nom du profil doit contenir au moins 2 caractères.").max(40),
  permissions: z.array(z.enum(MODULE_IDS)).min(1, "Sélectionnez au moins un module."),
});
export type EmployeeRoleInput = z.infer<typeof employeeRoleSchema>;

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères."),
  email: z.string().trim().email("Adresse email invalide."),
  password: z.string().min(8, "8 caractères minimum."),
  employeeRoleId: z.string().min(1, "Choisissez un profil d'accès."),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
