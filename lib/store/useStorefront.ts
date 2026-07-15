"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_TENANT } from "@/lib/tenant/registry";
import { addLine, incLine as incLineLogic, removeLine, type StoreCartLine } from "./cartLogic";

export type { StoreCartLine } from "./cartLogic";

export type ToastType = "success" | "warning" | "error";

export type BlockId =
  | "hero"
  | "cats"
  | "grid"
  | "loyalty"
  | "featured"
  | "story"
  | "look"
  | "news"
  | "contact";

export const DEFAULT_BLOCK_ORDER: BlockId[] = [
  "hero", "cats", "grid", "loyalty", "featured", "story", "look", "news", "contact",
];

export const DEFAULT_BLOCK_NAMES: Record<BlockId, string> = {
  hero: "Bandeau Hero",
  cats: "Vignettes catégories",
  grid: "Nouveautés & best-sellers",
  loyalty: "Bandeau fidélité",
  featured: "Produit vedette",
  story: "Notre histoire",
  look: "Galerie / Lookbook",
  news: "Newsletter",
  contact: "Contact & localisation",
};

export interface KycForm {
  name: string;
  place: string;
  /** Pays sélectionné pour préfixer automatiquement l'indicatif téléphonique — non transmis à la commande. */
  country: string;
  phone: string;
  note: string;
  wa: boolean;
}

const EMPTY_KYC: KycForm = { name: "", place: "", country: "", phone: "", note: "", wa: true };

interface StorefrontState {
  cart: StoreCartLine[];
  offline: boolean;
  toast: { msg: string; type: ToastType } | null;
  menuOpen: boolean;

  blocksMode: boolean;
  blockOrder: BlockId[];
  blockHidden: Partial<Record<BlockId, boolean>>;
  blockNames: Record<BlockId, string>;

  kyc: KycForm;
  kycTouched: boolean;
  sending: boolean;

  addToCart: (line: Omit<StoreCartLine, "qty" | "key"> & { qty?: number }) => void;
  incLine: (key: string, delta: number) => void;
  rmLine: (key: string) => void;
  clearCart: () => void;

  toggleOffline: () => void;
  showToast: (msg: string, type?: ToastType) => void;
  openMenu: () => void;
  closeMenu: () => void;

  toggleBlocksMode: () => void;
  moveBlock: (id: BlockId, dir: -1 | 1) => void;
  toggleHideBlock: (id: BlockId) => void;
  renameBlock: (id: BlockId, name: string) => void;

  setKycField: (field: keyof KycForm, value: string | boolean) => void;
  markKycTouched: () => void;
  setSending: (sending: boolean) => void;
  resetKyc: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useStorefront = create<StorefrontState>()(
  persist(
    (set, get) => ({
      cart: [],
      offline: false,
      toast: null,
      menuOpen: false,

      blocksMode: false,
      blockOrder: DEFAULT_BLOCK_ORDER,
      blockHidden: {},
      blockNames: DEFAULT_BLOCK_NAMES,

      kyc: EMPTY_KYC,
      kycTouched: false,
      sending: false,

      addToCart: (line) => set((s) => ({ cart: addLine(s.cart, line) })),
      incLine: (key, delta) => set((s) => ({ cart: incLineLogic(s.cart, key, delta) })),
      rmLine: (key) => set((s) => ({ cart: removeLine(s.cart, key) })),
      clearCart: () => set({ cart: [] }),

      toggleOffline: () =>
        set((s) => {
          const next = !s.offline;
          get().showToast(next ? "Mode hors-ligne simulé" : "De retour en ligne", next ? "warning" : "success");
          return { offline: next };
        }),

      showToast: (msg, type = "success") => {
        set({ toast: { msg, type } });
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => set({ toast: null }), 2400);
      },

      openMenu: () => set({ menuOpen: true }),
      closeMenu: () => set({ menuOpen: false }),

      toggleBlocksMode: () => set((s) => ({ blocksMode: !s.blocksMode })),

      moveBlock: (id, dir) =>
        set((s) => {
          const order = [...s.blockOrder];
          const i = order.indexOf(id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= order.length) return {};
          [order[i], order[j]] = [order[j], order[i]];
          return { blockOrder: order };
        }),

      toggleHideBlock: (id) => set((s) => ({ blockHidden: { ...s.blockHidden, [id]: !s.blockHidden[id] } })),

      renameBlock: (id, name) => set((s) => ({ blockNames: { ...s.blockNames, [id]: name } })),

      setKycField: (field, value) => set((s) => ({ kyc: { ...s.kyc, [field]: value } })),
      markKycTouched: () => set({ kycTouched: true }),
      setSending: (sending) => set({ sending }),
      resetKyc: () => set({ kyc: EMPTY_KYC, kycTouched: false }),
    }),
    {
      name: `ft-storefront-store-${DEFAULT_TENANT.id}`,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        cart: s.cart,
        blockOrder: s.blockOrder,
        blockHidden: s.blockHidden,
        blockNames: s.blockNames,
      }),
    }
  )
);
