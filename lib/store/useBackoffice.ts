import { create } from "zustand";
import type { Customer, Product } from "@/lib/data/types";
import type { PosPaymentMethod } from "@/lib/payments/labels";

export interface CartLine {
  id: string;
  productId?: string;
  variantId?: string | null;
  variantName?: string | null;
  colorHex?: string | null;
  name: string;
  variant: string;
  price: number;
  qty: number;
  /** Remise unitaire en FCFA (0 = aucune). */
  discount: number;
  image?: string;
}

export type ToastType = "success" | "warning" | "error";

export interface Ticket {
  ref: string;
  items: number;
  pay: string;
  total: string;
  lines: Array<{ name: string; qty: number; lineTotal: number }>;
  /** Remises par ligne agrégées en FCFA (0 = aucune). */
  discount: number;
  subtotal: number;
  loyalty: { pointsEarned: number; newBalance: number } | null;
  promo: { code: string; discount: number } | null;
  pointsUsed: { points: number; discount: number } | null;
  /** Message WhatsApp pré-construit (buildTicketMessage). */
  waMessage: string;
  customerPhone: string | null;
}

interface BackofficeState {
  // POS
  cart: CartLine[];
  client: Customer | null;
  pay: PosPaymentMethod;
  cartOpen: boolean;
  // Global UI
  offline: boolean;
  queued: number;
  notifOpen: boolean;
  moreOpen: boolean;
  toast: { msg: string; type: ToastType } | null;
  ticket: Ticket | null;

  // Actions
  addToCart: (
    p: Product,
    variant?: { id: string; colorName: string; colorHex: string; image?: string | null }
  ) => void;
  incLine: (id: string, delta: number) => void;
  rmLine: (id: string) => void;
  toggleDiscount: (id: string) => void;
  clearCart: () => void;
  setPay: (pay: BackofficeState["pay"]) => void;
  attachClient: (customer: Customer) => void;
  detachClient: () => void;
  showTicket: (ticket: Ticket) => void;
  openCart: () => void;
  closeCart: () => void;

  toggleOffline: () => void;
  toggleNotif: () => void;
  closeNotif: () => void;
  openMore: () => void;
  closeMore: () => void;
  showToast: (msg: string, type?: ToastType) => void;
  closeTicket: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useBackoffice = create<BackofficeState>((set, get) => ({
  cart: [],
  client: null,
  pay: "espece",
  cartOpen: false,
  offline: false,
  queued: 0,
  notifOpen: false,
  moreOpen: false,
  toast: null,
  ticket: null,

  addToCart: (p, variant) =>
    set((s) => {
      const lineId = variant ? `${p.id}::${variant.id}` : p.id;
      const cart = s.cart.map((l) => ({ ...l }));
      const ex = cart.find((l) => l.id === lineId);
      if (ex) {
        ex.qty += 1;
      } else {
        cart.push({
          id: lineId,
          productId: p.id,
          variantId: variant?.id ?? null,
          variantName: variant?.colorName ?? null,
          colorHex: variant?.colorHex ?? null,
          name: p.name,
          variant: variant ? `${p.variant} · ${variant.colorName}` : p.variant,
          price: p.price,
          qty: 1,
          discount: 0,
          image: variant?.image ?? p.image,
        });
      }
      return { cart };
    }),

  incLine: (id, delta) =>
    set((s) => {
      const cart = s.cart
        .map((l) => (l.id === id ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0);
      return { cart };
    }),

  rmLine: (id) => set((s) => ({ cart: s.cart.filter((l) => l.id !== id) })),

  toggleDiscount: (id) =>
    set((s) => ({
      cart: s.cart.map((l) =>
        l.id === id
          ? { ...l, discount: l.discount > 0 ? 0 : Math.round(l.price * 0.1) }
          : l
      ),
    })),

  clearCart: () => set({ cart: [], client: null }),

  setPay: (pay) => set({ pay }),

  attachClient: (customer) => set({ client: customer }),
  detachClient: () => set({ client: null }),

  showTicket: (ticket) => set({ ticket, cart: [], client: null, cartOpen: false }),

  openCart: () => set({ cartOpen: true }),
  closeCart: () => set({ cartOpen: false }),

  toggleOffline: () =>
    set((s) => {
      const next = !s.offline;
      get().showToast(
        next ? "Mode hors-ligne activé" : "De retour en ligne — resynchronisation…",
        next ? "warning" : "success"
      );
      return { offline: next };
    }),

  toggleNotif: () => set((s) => ({ notifOpen: !s.notifOpen })),
  closeNotif: () => set({ notifOpen: false }),
  openMore: () => set({ moreOpen: true }),
  closeMore: () => set({ moreOpen: false }),

  showToast: (msg, type = "success") => {
    set({ toast: { msg, type } });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: null }), 2600);
  },

  closeTicket: () => set({ ticket: null }),
}));
