import type { Customer } from "./types";

/** Clientes (données de démonstration). */
export const clients: Customer[] = [
  { id: "c1", name: "Aya Koffi", initials: "AK", phone: "+225 07 12 45 67 89", place: "Cocody, Abidjan", points: 186, orders: 14, spent: "420 000 FCFA", vip: true, seg: "VIP" },
  { id: "c2", name: "Adjoua N’Guessan", initials: "AN", phone: "+225 05 33 21 09 44", place: "Yopougon, Abidjan", points: 92, orders: 8, spent: "196 000 FCFA", vip: false, seg: "Fidèle" },
  { id: "c3", name: "Mariam Traoré", initials: "MT", phone: "+225 01 88 76 54 32", place: "Plateau, Abidjan", points: 154, orders: 11, spent: "312 000 FCFA", vip: true, seg: "VIP" },
  { id: "c4", name: "Fatou Bamba", initials: "FB", phone: "+225 07 45 09 87 11", place: "Marcory, Abidjan", points: 47, orders: 4, spent: "88 000 FCFA", vip: false, seg: "Fidèle" },
  { id: "c5", name: "Aminata Koné", initials: "AK", phone: "+225 05 61 23 45 78", place: "Bouaké", points: 23, orders: 2, spent: "34 500 FCFA", vip: false, seg: "Nouvelle" },
  { id: "c6", name: "Grace Kouassi", initials: "GK", phone: "+225 01 19 82 73 64", place: "Riviera, Abidjan", points: 128, orders: 9, spent: "254 000 FCFA", vip: false, seg: "Fidèle" },
];

/** Historique d'achats affiché sur la fiche cliente (mock partagé). */
export const customerHistory = [
  { id: "#TER-0489", date: "02/07/2026", total: "86 000 FCFA" },
  { id: "#TER-0475", date: "24/06/2026", total: "31 000 FCFA" },
  { id: "#TER-0461", date: "12/06/2026", total: "54 500 FCFA" },
];
