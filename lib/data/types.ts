export type ProductCategory = "Foulards" | "Turbans" | "Coiffes" | "Eventails" | "Voiles";

export interface Product {
  id: string;
  /** `null` pour les produits hérités dont l'ancienne catégorie a été supprimée (« Sans catégorie »). */
  cat: ProductCategory | null;
  name: string;
  variant: string;
  price: number;
  stock: number;
  /** Motif de fond servant de vignette produit (mock, sans image). */
  swatch: string;
  /** Couleurs disponibles (hex) ; la première sert de teinte principale pour le dégradé vignette. */
  colors: string[];
  /** Motif textile (Wax, Bazin, Uni, Kente…) — utilisé par les filtres vitrine. */
  motif: string;
  /** Tailles disponibles (S, M, L) ; peut contenir d'anciennes valeurs texte libre pour les produits créés avant le passage au menu S/M/L. */
  lengths: string[];
  /** Description longue affichée sur la fiche produit. */
  description: string;
  /** Prix barré éventuel (ex. article en promotion). */
  oldPrice?: number;
  /** Étiquette courte affichée sur la vignette ("Nouveau", "★ VIP"…). */
  badge?: string;
  /** Marque ce produit comme le "produit vedette" de la Home. Un seul produit devrait le porter. */
  featured?: boolean;
  /** Photo principale (URL publique Supabase Storage) ; absente = repli sur le dégradé `swatch`. */
  image?: string;
  /** Photos secondaires affichées dans la galerie de la fiche produit. */
  gallery: string[];
  /** Variantes de couleurs et stocks unitaires associés. */
  variants?: ProductVariantData[];
  /** Statut actif / archivé du produit. */
  active?: boolean;
  /** Date d'archivage (formatée ou ISO). Null si actif. */
  archivedAt?: string | null;
  /** Date de création (ISO) — utilisée pour le filtre vitrine "Nouveautés". Absente pour des fixtures/mocks. */
  createdAt?: string;
}

export interface ProductVariantData {
  id: string;
  productId: string;
  colorName: string;
  colorHex: string;
  stock: number;
  sku?: string | null;
  image?: string | null;
  active: boolean;
  position: number;
}

export type CustomerSegment = "VIP" | "Fidèle" | "Nouvelle";

export interface Customer {
  id: string;
  name: string;
  initials: string;
  phone: string;
  place: string;
  points: number;
  orders: number;
  spent: string;
  vip: boolean;
  seg: CustomerSegment;
}

/** Une ligne de l'historique d'achats affiché sur une fiche cliente (dashboard) ou la page Compte (vitrine). */
export interface CustomerOrderHistoryEntry {
  ref: string;
  date: string;
  total: string;
}

export type OrderStatus =
  | "nouvelle"
  | "confirmee"
  | "preparation"
  | "livree"
  | "refusee"
  | "archivee";

export interface OrderLine {
  name: string;
  qty: number;
  price: string;
  total: string;
  /** Référence catalogue de l'article — nécessaire pour déduire le stock à la validation. */
  productId: string;
}

export type OrderChannel = "Web" | "WhatsApp" | "Boutique";

export interface Order {
  id: string;
  /** Identifiant non devinable (cuid interne) utilisé dans les liens de suivi public — jamais `ref`, séquentiel. */
  trackingToken: string;
  cid: string;
  client: string;
  place: string;
  phone: string;
  items: number;
  channel: OrderChannel;
  ago: string;
  date: string;
  total: string;
  status: OrderStatus;
  vip: boolean;
  lines: OrderLine[];
  /** Σ lineTotal, formaté — affiché quand une remise existe. */
  subtotal: string;
  promoCode: string | null;
  promoDiscount: number;
  pointsUsed: number;
  pointsDiscount: number;
  /** false SEULEMENT pour une commande `nouvelle` dont le code ne passe plus (écart à afficher). */
  promoStillValid: boolean;
  /** Date/heure d'archivage formatée, `null` si la commande n'est pas (ou plus) archivée. */
  archivedAt: string | null;
  paymentMethod?: string | null;
  amountReceived?: number | null;
  changeGiven?: number | null;
  paymentDetails?: Array<{
    method: string;
    amount: number;
    amountReceived?: number | null;
    changeGiven?: number | null;
  }> | null;
  isCustom: boolean;
  customColorName: string | null;
  customColorHex: string | null;
  customFabricNote: string | null;
  customModel: string | null;
  customModelImageUrl: string | null;
  /** Formatée JJ/MM/AAAA, `null` si non renseignée ou si la commande n'est pas personnalisée. */
  customDueDate: string | null;
  /** Formatée money (ex. « 5 000 FCFA »), `null` si aucun acompte saisi. */
  customDeposit: string | null;
  /** = total − acompte, formatée money, `null` si aucun acompte saisi. */
  customBalanceDue: string | null;
}
