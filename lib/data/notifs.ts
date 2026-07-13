import { ICONS } from "@/components/ui/Icon";

export interface Notif {
  title: string;
  body: string;
  time: string;
  bg: string;
  icon: string;
  iconColor: string;
}

export const notifs: Notif[] = [
  {
    title: "Nouvelle commande",
    body: "#TER-0492 · Aya Koffi · 54 000 FCFA",
    time: "il y a 12 min",
    bg: "#EEF0F7",
    icon: ICONS.orders,
    iconColor: "#26326B",
  },
  {
    title: "Stock bas",
    body: "Boucles perles — 3 restants",
    time: "il y a 1 h",
    bg: "#FBF1D8",
    icon: ICONS.alertTriangle,
    iconColor: "#E0A400",
  },
  {
    title: "Paiement reçu",
    body: "Mobile Money · 86 000 FCFA",
    time: "il y a 2 h",
    bg: "#E6F4EE",
    icon: ICONS.check,
    iconColor: "#0E9F6E",
  },
];
