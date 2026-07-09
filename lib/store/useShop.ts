"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { orders as seedOrders } from "@/lib/data/orders";
import type { Order, OrderStatus } from "@/lib/data/types";
import type { KycInput } from "@/lib/validators/kyc";
import { DEFAULT_TENANT } from "@/lib/tenant/registry";
import {
  applyConfirmDeductions,
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

let refCounter = 2700;
function nextOrderRef(): string {
  refCounter += 1;
  return `#TER-${refCounter}`;
}

export const useShop = create<ShopState>()(
  persist(
    (set, get) => ({
      orders: seedOrders,
      statusOverrides: {},
      stockDeductions: {},
      autoValidate: false,

      effectiveStatus: (orderId) => {
        const s = get();
        const order = s.orders.find((o) => o.id === orderId);
        return order ? computeEffectiveStatus(order, s.statusOverrides) : "nouvelle";
      },

      effectiveStock: (productId) => computeEffectiveStock(productId, get().stockDeductions),

      pendingCount: () => countPending(get().orders, get().statusOverrides),

      submitWebOrder: (kyc, cartLines) => {
        const order = buildWebOrder(kyc, cartLines, nextOrderRef());
        set((s) => ({ orders: [order, ...s.orders] }));
        return order;
      },

      confirmOrder: (orderId) => {
        const s = get();
        if (s.effectiveStatus(orderId) !== "nouvelle") return; // idempotent — stock is deducted once
        const order = s.orders.find((o) => o.id === orderId);
        if (!order) return;
        set({
          statusOverrides: { ...s.statusOverrides, [orderId]: "confirmee" },
          stockDeductions: applyConfirmDeductions(s.stockDeductions, order),
        });
      },

      rejectOrder: (orderId) => {
        set((s) => ({ statusOverrides: { ...s.statusOverrides, [orderId]: "refusee" } }));
      },

      setOrderStatus: (orderId, status) => {
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
        autoValidate: s.autoValidate,
      }),
    }
  )
);
