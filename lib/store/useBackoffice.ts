import { create } from "zustand";
import type { Customer, Product } from "@/lib/data/types";

export interface CartLine {
  id: string;
  name: string;
  variant: string;
  price: number;
  qty: number;
  /** Remise unitaire en FCFA (0 = aucune). */
  discount: number;
}

export type ToastType = "success" | "warning" | "error";

export interface Ticket {
  items: number;
  pay: string;
  total: string;
  ref: string;
}

interface BackofficeState {
  // POS
  cart: CartLine[];
  client: Customer | null;
  pay: "espece" | "mm" | "mixte";
  cartOpen: boolean;
  // Global UI
  offline: boolean;
  queued: number;
  notifOpen: boolean;
  moreOpen: boolean;
  toast: { msg: string; type: ToastType } | null;
  ticket: Ticket | null;

  // Actions
  addToCart: (p: Product) => void;
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

  addToCart: (p) =>
    set((s) => {
      const cart = s.cart.map((l) => ({ ...l }));
      const ex = cart.find((l) => l.id === p.id);
      if (ex) {
        ex.qty += 1;
      } else {
        cart.push({ id: p.id, name: p.name, variant: p.variant, price: p.price, qty: 1, discount: 0 });
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
