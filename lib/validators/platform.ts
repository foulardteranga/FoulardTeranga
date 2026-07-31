import { z } from "zod";
import { MODULE_IDS } from "@/lib/nav";
import { normalizeDomain, isValidDomain } from "@/lib/platform/domains";

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
 * Les Server Actions sont directement appelables (HTTP), donc le formulaire
 * client (NewTenantScreen.tsx, TenantIdentityForm.tsx) qui normalise/valide
 * via `normalizeDomain`/`isValidDomain` avant l'appel n'est pas une garantie :
 * un appelant qui contourne le formulaire pourrait persister un hôte non
 * normalisé (casse mixte, espaces) ou invalide, qui ne correspondrait alors
 * plus jamais dans `resolveTenantFromHost`. Ce filet est un dernier recours ;
 * le message générique suffit, le client donne déjà une erreur par domaine.
 */
const domainsSchema = z
  .array(z.string())
  .default([])
  .transform((domains) => domains.map(normalizeDomain))
  .refine((domains) => domains.every(isValidDomain), "Domaine invalide.");

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
  domains: domainsSchema,
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
  domains: domainsSchema,
});
export type TenantIdentityInput = z.infer<typeof tenantIdentitySchema>;

export const tenantModulesFormSchema = z.object({
  plan: z.enum(["essentiel", "pro"]),
  modules: tenantModulesSchema,
});
export type TenantModulesInput = z.infer<typeof tenantModulesFormSchema>;

/**
 * Motif de suspension (spec §9). Optionnel par conception : la gérante doit
 * pouvoir être coupée immédiatement, la justification peut suivre. Stocké dans
 * `Tenant.suspendedReason` et recopié dans `metadata` de l'entrée d'audit.
 */
export const suspendTenantSchema = z.object({
  reason: z.string().trim().max(280, "280 caractères maximum.").default(""),
});
export type SuspendTenantInput = z.infer<typeof suspendTenantSchema>;

/**
 * Confirmation de la suppression définitive (spec §9) : l'opérateur retape le
 * slug. La comparaison au slug réel se fait dans l'action, pas ici — le schéma
 * ne connaît pas la boutique visée.
 */
export const deleteTenantSchema = z.object({
  confirmSlug: z.string().trim().min(1, "Retapez le slug de la boutique pour confirmer."),
});
export type DeleteTenantInput = z.infer<typeof deleteTenantSchema>;

/** Même plancher que `createTenantSchema.ownerPassword` : 8 caractères. */
export const resetOwnerPasswordSchema = z.object({
  password: z.string().min(8, "8 caractères minimum."),
});
export type ResetOwnerPasswordInput = z.infer<typeof resetOwnerPasswordSchema>;

/** Rattachement d'une gérante à une boutique qui n'en a pas (spec §6, onglet Équipe). */
export const createOwnerSchema = z.object({
  name: z.string().trim().min(2, "Le nom de la gérante est requis."),
  email: z.string().trim().email("Adresse email invalide."),
  password: z.string().min(8, "8 caractères minimum."),
});
export type CreateOwnerInput = z.infer<typeof createOwnerSchema>;
