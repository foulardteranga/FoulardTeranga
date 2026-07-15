"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_TENANT } from "@/lib/tenant/registry";
import { addLine, incLine as incLineLogic, removeLine, type StoreCartLine } from "./cartLogic";
import { DEFAULT_BLOCK_ORDER, DEFAULT_BLOCK_NAMES, type BlockId } from "@/lib/storefront/blockIds";

export type { StoreCartLine } from "./cartLogic";
// Ré-exportés pour compat : ces valeurs vivent dans lib/storefront/blockIds.ts
// (module serveur-safe) car le code serveur (pageContent.ts) en a besoin, et
// un module "use client" ne peut pas fournir de valeurs au bundle serveur.
export { DEFAULT_BLOCK_ORDER, DEFAULT_BLOCK_NAMES, type BlockId };

export type ToastType = "success" | "warning" | "error";

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
      }),
    }
  )
);
