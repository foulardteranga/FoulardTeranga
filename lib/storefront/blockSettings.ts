import { z } from "zod";
import type { BlockId } from "./blockIds";

export type FieldKind = "text" | "textarea" | "select" | "toggle" | "number" | "url";

export interface FieldDescriptor {
  key: string;
  label: string;
  kind: FieldKind;
  options?: string[];
}

/* ---- hero ---- */
export const heroSchema = z.object({
  eyebrow: z.string(),
  title: z.string(),
  subtitle: z.string(),
  ctaLabel: z.string(),
  ctaLink: z.string(),
  secondaryCtaLabel: z.string(),
  secondaryCtaLink: z.string(),
});
export type HeroSettings = z.infer<typeof heroSchema>;
export const heroDefaults: HeroSettings = {
  eyebrow: "NOUVELLE COLLECTION 2026",
  title: "L'élégance\ntissée main",
  subtitle:
    "Foulards, turbans & accessoires africains pour la femme moderne. Fabriqués en Côte d'Ivoire, dans l'esprit Teranga.",
  ctaLabel: "Découvrir la boutique",
  ctaLink: "/catalogue",
  secondaryCtaLabel: "Notre histoire",
  secondaryCtaLink: "/#ft-story",
};
export const heroFields: FieldDescriptor[] = [
  { key: "eyebrow", label: "Pré-titre", kind: "text" },
  { key: "title", label: "Titre (retour à la ligne = nouvelle ligne)", kind: "textarea" },
  { key: "subtitle", label: "Sous-titre", kind: "textarea" },
  { key: "ctaLabel", label: "Bouton principal — libellé", kind: "text" },
  { key: "ctaLink", label: "Bouton principal — lien", kind: "url" },
  { key: "secondaryCtaLabel", label: "Bouton secondaire — libellé", kind: "text" },
  { key: "secondaryCtaLink", label: "Bouton secondaire — lien", kind: "url" },
];

/* ---- story ---- */
export const storySchema = z.object({
  eyebrow: z.string(),
  title: z.string(),
  body1: z.string(),
  body2: z.string(),
  stat1Value: z.string(),
  stat1Label: z.string(),
  stat2Value: z.string(),
  stat2Label: z.string(),
  stat3Value: z.string(),
  stat3Label: z.string(),
});
export type StorySettings = z.infer<typeof storySchema>;
export const storyDefaults: StorySettings = {
  eyebrow: "Notre histoire",
  title: "L'esprit Teranga, tissé dans chaque pièce",
  body1:
    "« Teranga », c'est l'hospitalité sénégalaise. Depuis Abidjan, chaque foulard est choisi auprès d'artisanes partenaires, teint à la main selon des savoir-faire transmis de mère en fille.",
  body2: "Des matières nobles, des motifs qui racontent, une élégance qui vous ressemble.",
  stat1Value: "100%",
  stat1Label: "tissé main",
  stat2Value: "24",
  stat2Label: "artisanes partenaires",
  stat3Value: "3",
  stat3Label: "pays livrés",
};
export const storyFields: FieldDescriptor[] = [
  { key: "eyebrow", label: "Pré-titre", kind: "text" },
  { key: "title", label: "Titre", kind: "text" },
  { key: "body1", label: "Paragraphe 1", kind: "textarea" },
  { key: "body2", label: "Paragraphe 2", kind: "textarea" },
  { key: "stat1Value", label: "Stat 1 — valeur", kind: "text" },
  { key: "stat1Label", label: "Stat 1 — libellé", kind: "text" },
  { key: "stat2Value", label: "Stat 2 — valeur", kind: "text" },
  { key: "stat2Label", label: "Stat 2 — libellé", kind: "text" },
  { key: "stat3Value", label: "Stat 3 — valeur", kind: "text" },
  { key: "stat3Label", label: "Stat 3 — libellé", kind: "text" },
];

/* ---- loyalty ---- */
export const loyaltySchema = z.object({
  title: z.string(),
  text: z.string(),
  ctaLabel: z.string(),
  ctaLink: z.string(),
});
export type LoyaltySettings = z.infer<typeof loyaltySchema>;
export const loyaltyDefaults: LoyaltySettings = {
  title: "Programme fidélité Teranga",
  text: "Cumulez des points à chaque commande — 5% offerts dès 300 points.",
  ctaLabel: "Rejoindre le programme",
  ctaLink: "/compte",
};
export const loyaltyFields: FieldDescriptor[] = [
  { key: "title", label: "Titre", kind: "text" },
  { key: "text", label: "Texte", kind: "textarea" },
  { key: "ctaLabel", label: "Bouton — libellé", kind: "text" },
  { key: "ctaLink", label: "Bouton — lien", kind: "url" },
];

/* ---- news ---- */
export const newsSchema = z.object({
  title: z.string(),
  text: z.string(),
  placeholder: z.string(),
  buttonLabel: z.string(),
});
export type NewsSettings = z.infer<typeof newsSchema>;
export const newsDefaults: NewsSettings = {
  title: "Restez dans la boucle",
  text: "Nouveautés, ventes privées et 25 points de bienvenue à l'inscription.",
  placeholder: "Votre numéro ou e-mail",
  buttonLabel: "S'inscrire",
};
export const newsFields: FieldDescriptor[] = [
  { key: "title", label: "Titre", kind: "text" },
  { key: "text", label: "Texte", kind: "textarea" },
  { key: "placeholder", label: "Champ — indication", kind: "text" },
  { key: "buttonLabel", label: "Bouton — libellé", kind: "text" },
];

/* ---- contact ---- */
export const contactSchema = z.object({
  title: z.string(),
  locationTitle: z.string(),
  address: z.string(),
  hoursTitle: z.string(),
  hours: z.string(),
});
export type ContactSettings = z.infer<typeof contactSchema>;
export const contactDefaults: ContactSettings = {
  title: "Nous trouver",
  locationTitle: "Boutique Plateau",
  address: "Rue du Commerce, Plateau, Abidjan · Côte d'Ivoire",
  hoursTitle: "Horaires",
  hours: "Lun – Sam · 9h – 19h",
};
export const contactFields: FieldDescriptor[] = [
  { key: "title", label: "Titre", kind: "text" },
  { key: "locationTitle", label: "Nom du lieu", kind: "text" },
  { key: "address", label: "Adresse", kind: "textarea" },
  { key: "hoursTitle", label: "Libellé horaires", kind: "text" },
  { key: "hours", label: "Horaires", kind: "text" },
];

/* ---- cats ---- */
export const catsSchema = z.object({
  title: z.string(),
});
export type CatsSettings = z.infer<typeof catsSchema>;
export const catsDefaults: CatsSettings = {
  // titre de section optionnel ; vide = pas de titre (pas de régression)
  title: "",
};
export const catsFields: FieldDescriptor[] = [
  { key: "title", label: "Titre de section (optionnel)", kind: "text" },
];

/* ---- grid ---- */
export const gridSchema = z.object({
  title: z.string(),
});
export type GridSettings = z.infer<typeof gridSchema>;
export const gridDefaults: GridSettings = {
  title: "Nouveautés & best-sellers",
};
export const gridFields: FieldDescriptor[] = [
  { key: "title", label: "Titre de section", kind: "text" },
];

/* ---- featured ---- */
export const featuredSchema = z.object({
  eyebrow: z.string(),
  ctaLabel: z.string(),
});
export type FeaturedSettings = z.infer<typeof featuredSchema>;
export const featuredDefaults: FeaturedSettings = {
  eyebrow: "Édition limitée",
  ctaLabel: "Voir le produit",
};
export const featuredFields: FieldDescriptor[] = [
  { key: "eyebrow", label: "Pré-titre", kind: "text" },
  { key: "ctaLabel", label: "Bouton — libellé", kind: "text" },
];

/* ---- look ---- */
export const lookSchema = z.object({
  eyebrow: z.string(),
  title: z.string(),
});
export type LookSettings = z.infer<typeof lookSchema>;
export const lookDefaults: LookSettings = {
  eyebrow: "Lookbook",
  title: "Portées avec style",
};
export const lookFields: FieldDescriptor[] = [
  { key: "eyebrow", label: "Pré-titre", kind: "text" },
  { key: "title", label: "Titre", kind: "text" },
];

export type BlockSettingsMap = {
  hero: HeroSettings;
  cats: CatsSettings;
  grid: GridSettings;
  loyalty: LoyaltySettings;
  featured: FeaturedSettings;
  story: StorySettings;
  look: LookSettings;
  news: NewsSettings;
  contact: ContactSettings;
};

export const BLOCK_SETTINGS: Record<
  BlockId,
  { schema: z.ZodTypeAny; defaults: unknown; fields: FieldDescriptor[] }
> = {
  hero: { schema: heroSchema, defaults: heroDefaults, fields: heroFields },
  cats: { schema: catsSchema, defaults: catsDefaults, fields: catsFields },
  grid: { schema: gridSchema, defaults: gridDefaults, fields: gridFields },
  loyalty: { schema: loyaltySchema, defaults: loyaltyDefaults, fields: loyaltyFields },
  featured: { schema: featuredSchema, defaults: featuredDefaults, fields: featuredFields },
  story: { schema: storySchema, defaults: storyDefaults, fields: storyFields },
  look: { schema: lookSchema, defaults: lookDefaults, fields: lookFields },
  news: { schema: newsSchema, defaults: newsDefaults, fields: newsFields },
  contact: { schema: contactSchema, defaults: contactDefaults, fields: contactFields },
};
