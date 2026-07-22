/** Identifiants des modes de paiement (miroir de l'enum Prisma `PaymentMethod`). */
export type PaymentMethodId =
  | "espece"
  | "mm"
  | "orange_money"
  | "wave"
  | "moov_money"
  | "mtn_momo"
  | "mixte";

/** Libellés FR affichés partout (POS, ticket, commandes, finance). */
export const PAYMENT_LABELS: Record<PaymentMethodId, string> = {
  espece: "Espèces",
  mm: "Mobile Money",
  orange_money: "Orange Money",
  wave: "Wave",
  moov_money: "Moov Money",
  mtn_momo: "MTN MoMo",
  mixte: "Mixte",
};

/** Modes proposés au POS — `mm` (générique) est réservé aux ventes historiques. */
export const POS_PAYMENT_METHODS = [
  "espece",
  "orange_money",
  "wave",
  "moov_money",
  "mtn_momo",
  "mixte",
] as const;

export type PosPaymentMethod = (typeof POS_PAYMENT_METHODS)[number];
