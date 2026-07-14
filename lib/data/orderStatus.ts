import type { OrderStatus } from "./types";

/** Métadonnées d'affichage (badge) par statut de commande. */
export const statusMeta: Record<
  OrderStatus,
  { label: string; bg: string; color: string; dot: string }
> = {
  nouvelle: { label: "À valider", bg: "#FBF1D8", color: "#8a6500", dot: "#E0A400" },
  confirmee: { label: "Confirmée", bg: "#EEF0F7", color: "#26326B", dot: "#26326B" },
  preparation: { label: "En préparation", bg: "#FBF1D8", color: "#8a6500", dot: "#E0A400" },
  livree: { label: "Livrée", bg: "#E6F4EE", color: "#0b6e4d", dot: "#0E9F6E" },
  refusee: { label: "Refusée", bg: "#F8E5E3", color: "#9c352d", dot: "#C4453B" },
};

/** Ancienneté relative d'une commande, affichée dans les listes (« il y a 12 min », « hier »). */
export function formatOrderAgo(createdAt: Date, now: Date = new Date()): string {
  const diffMin = Math.floor((now.getTime() - createdAt.getTime()) / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "hier";
  return `il y a ${diffD} j`;
}

/** Date/heure complète d'une commande, affichée dans le détail (« Aujourd'hui 09:42 », « Hier 18:20 »). */
export function formatOrderDate(createdAt: Date, now: Date = new Date()): string {
  const time = createdAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (createdAt.toDateString() === now.toDateString()) return `Aujourd'hui ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (createdAt.toDateString() === yesterday.toDateString()) return `Hier ${time}`;
  return `${createdAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} ${time}`;
}
