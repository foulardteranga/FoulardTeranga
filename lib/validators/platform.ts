import { z } from "zod";
import { MODULE_IDS } from "@/lib/nav";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Normalisation appliquée AVANT le parse (et non par un transform Zod) pour que
 * le schéma reste purement validant : la même instance sert à afficher une
 * erreur côté client sans réécrire la saisie sous les doigts de l'opérateur.
 */
export function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export const tenantSlugSchema = z
  .string()
  .trim()
  .min(3, "Le slug doit contenir au moins 3 caractères.")
  .max(40, "40 caractères maximum.")
  .regex(SLUG_RE, "Minuscules, chiffres et tirets uniquement.");

const hexColor = z.string().trim().regex(HEX_RE, "Couleur invalide.");

/**
 * Miroir applicatif de la contrainte base `tenant_min_modules` : `dash` ne peut
 * jamais être décoché (spec §12). La contrainte CHECK reste la garde ultime,
 * mais elle produirait une erreur Postgres brute au lieu d'un message lisible.
 */
export const tenantModulesSchema = z
  .array(z.enum(MODULE_IDS))
  .min(1, "Sélectionnez au moins un module.")
  .refine((modules) => modules.includes("dash"), {
    message: "Le module Tableau de bord ne peut pas être désactivé.",
  });

export const createTenantSchema = z.object({
  slug: tenantSlugSchema,
  name: z.string().trim().min(2, "Le nom de la boutique est requis.").max(60, "60 caractères maximum."),
  plan: z.enum(["essentiel", "pro"]),
  primaryColor: hexColor,
  accentColor: hexColor,
  logoText: z.string().trim().min(1, "Le logo texte est requis.").max(24, "24 caractères maximum."),
  domains: z.array(z.string()).default([]),
  ownerName: z.string().trim().min(2, "Le nom de la gérante est requis."),
  ownerEmail: z.string().trim().email("Adresse email invalide."),
  ownerPassword: z.string().min(8, "8 caractères minimum."),
});
export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export const tenantIdentitySchema = z.object({
  name: z.string().trim().min(2, "Le nom de la boutique est requis.").max(60, "60 caractères maximum."),
  slug: tenantSlugSchema,
  tagline: z.string().trim().max(120, "120 caractères maximum.").default(""),
  primaryColor: hexColor,
  accentColor: hexColor,
  logoText: z.string().trim().min(1, "Le logo texte est requis.").max(24, "24 caractères maximum."),
  font: z.enum(["Playfair Display", "Inter"]),
  whatsappPhone: z
    .string()
    .trim()
    .regex(/^[0-9+()\-\s]{0,20}$/, "Numéro invalide.")
    .default(""),
  domains: z.array(z.string()).default([]),
});
export type TenantIdentityInput = z.infer<typeof tenantIdentitySchema>;

export const tenantModulesFormSchema = z.object({
  plan: z.enum(["essentiel", "pro"]),
  modules: tenantModulesSchema,
});
export type TenantModulesInput = z.infer<typeof tenantModulesFormSchema>;
