export type ProductCategory = "Foulards" | "Turbans" | "Tissus" | "Accessoires";

export interface Product {
  id: string;
  cat: ProductCategory;
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
  /** Longueurs/tailles disponibles (ex. ["90 × 90 cm", "Sur-mesure"] ou ["Taille unique"]). */
  lengths: string[];
  /** Description longue affichée sur la fiche produit. */
  description: string;
  /** Prix barré éventuel (ex. article en promotion). */
  oldPrice?: number;
  /** Étiquette courte affichée sur la vignette ("Nouveau", "★ VIP"…). */
  badge?: string;
  /** Marque ce produit comme le "produit vedette" de la Home. Un seul produit devrait le porter. */
  featured?: boolean;
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
  | "refusee";

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
}
