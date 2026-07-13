"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { orders as seedOrders } from "@/lib/data/orders";
import type { Order, OrderStatus } from "@/lib/data/types";
import type { KycInput } from "@/lib/validators/kyc";
import { DEFAULT_TENANT } from "@/lib/tenant/registry";
import {
  applyConfirmOnce,
  buildWebOrder,
  computeEffectiveStatus,
  computeEffectiveStock,
  countPending,
  type WebCartLine,
} from "./shopLogic";

export type { WebCartLine } from "./shopLogic";

interface ShopState {
  orders: Order[];
  statusOverrides: Record<string, OrderStatus>;
  stockDeductions: Record<string, number>;
  deductedOrderIds: string[];
  autoValidate: boolean;

  effectiveStatus: (orderId: string) => OrderStatus;
  effectiveStock: (productId: string) => number;
  pendingCount: () => number;

  submitWebOrder: (kyc: KycInput, cartLines: WebCartLine[]) => Order;
  confirmOrder: (orderId: string) => void;
  rejectOrder: (orderId: string) => void;
  setOrderStatus: (orderId: string, status: OrderStatus) => void;
  toggleAuto: () => void;
}

// Dérive la prochaine référence à partir des commandes persistées plutôt que
// d'un compteur en mémoire : ce dernier repartirait de zéro après un rechargement
// alors que le tableau `orders` (localStorage) conserve les commandes déjà émises,
// ce qui provoquerait des ids en double (clés React, recherches par id, etc.).
function nextOrderRef(orders: Order[]): string {
  const nums = orders
    .map((o) => /^#TER-(\d+)$/.exec(o.id)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number);
  const next = (nums.length > 0 ? Math.max(...nums) : 2700) + 1;
  return `#TER-${next}`;
}

export const useShop = create<ShopState>()(
  persist(
    (set, get) => ({
      orders: seedOrders,
      statusOverrides: {},
      stockDeductions: {},
      deductedOrderIds: [],
      autoValidate: false,

      effectiveStatus: (orderId) => {
        const s = get();
        const order = s.orders.find((o) => o.id === orderId);
        return order ? computeEffectiveStatus(order, s.statusOverrides) : "nouvelle";
      },

      effectiveStock: (productId) => computeEffectiveStock(productId, get().stockDeductions),

      pendingCount: () => countPending(get().orders, get().statusOverrides),

      submitWebOrder: (kyc, cartLines) => {
        const order = buildWebOrder(kyc, cartLines, nextOrderRef(get().orders));
        set((s) => ({ orders: [order, ...s.orders] }));
        return order;
      },

      confirmOrder: (orderId) => {
        const s = get();
        if (s.effectiveStatus(orderId) !== "nouvelle") return; // transition — pas de re-confirmation directe
        const order = s.orders.find((o) => o.id === orderId);
        if (!order) return;
        // Déduction idempotente par id de commande : même si le statut repasse à
        // "nouvelle" puis re-confirme, le stock n'est jamais déduit deux fois.
        const { stockDeductions, deductedOrderIds } = applyConfirmOnce(
          s.stockDeductions,
          s.deductedOrderIds,
          order
        );
        set({
          statusOverrides: { ...s.statusOverrides, [orderId]: "confirmee" },
          stockDeductions,
          deductedOrderIds,
        });
      },

      rejectOrder: (orderId) => {
        set((s) => ({ statusOverrides: { ...s.statusOverrides, [orderId]: "refusee" } }));
      },

      setOrderStatus: (orderId, status) => {
        // "confirmee" ne doit JAMAIS être atteint ici : seule confirmOrder() déduit
        // le stock. setOrderStatus ne gère que les transitions post-confirmation
        // (préparation, livrée, etc.) — on ignore silencieusement toute tentative
        // de contourner la validation par ce chemin.
        if (status === "confirmee") return;
        set((s) => ({ statusOverrides: { ...s.statusOverrides, [orderId]: status } }));
      },

      toggleAuto: () => set((s) => ({ autoValidate: !s.autoValidate })),
    }),
    {
      name: `ft-shop-store-${DEFAULT_TENANT.id}`,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        orders: s.orders,
        statusOverrides: s.statusOverrides,
        stockDeductions: s.stockDeductions,
        deductedOrderIds: s.deductedOrderIds,
        autoValidate: s.autoValidate,
      }),
    }
  )
);
