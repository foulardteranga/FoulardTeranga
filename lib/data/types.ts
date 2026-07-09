export type ProductCategory = "Foulards" | "Tissus" | "Accessoires";

export interface Product {
  id: string;
  cat: ProductCategory;
  name: string;
  variant: string;
  price: number;
  stock: number;
  /** Motif de fond servant de vignette produit (mock, sans image). */
  swatch: string;
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
