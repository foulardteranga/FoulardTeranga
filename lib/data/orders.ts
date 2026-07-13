import type { Order } from "./types";

/** Commandes en ligne / boutique (données de démonstration). */
export const orders: Order[] = [
  {
    id: "#TER-0492", cid: "c1", client: "Aya Koffi", place: "Cocody, Abidjan", phone: "+225 07 12 45 67 89",
    items: 3, channel: "Web", ago: "il y a 12 min", date: "Aujourd'hui 09:42", total: "54 000 FCFA", status: "nouvelle", vip: true,
    lines: [
      { name: "Foulard soie Kente", qty: 1, price: "22 000", total: "22 000", productId: "p2" },
      { name: "Turban Bazin Or", qty: 1, price: "18 000", total: "18 000", productId: "p3" },
      { name: "Broche dorée", qty: 2, price: "4 500", total: "9 000", productId: "p9" },
    ],
  },
  {
    id: "#TER-0491", cid: "c4", client: "Fatou Bamba", place: "Marcory, Abidjan", phone: "+225 07 45 09 87 11",
    items: 2, channel: "WhatsApp", ago: "il y a 40 min", date: "Aujourd'hui 09:10", total: "31 000 FCFA", status: "nouvelle", vip: false,
    lines: [{ name: "Wax Vlisco 6 yards", qty: 1, price: "35 000", total: "35 000", productId: "p5" }],
  },
  {
    id: "#TER-0490", cid: "c5", client: "Aminata Koné", place: "Bouaké", phone: "+225 05 61 23 45 78",
    items: 1, channel: "Web", ago: "il y a 1 h", date: "Aujourd'hui 08:30", total: "12 500 FCFA", status: "nouvelle", vip: false,
    lines: [{ name: "Foulard Wax Abidjan", qty: 1, price: "12 500", total: "12 500", productId: "p1" }],
  },
  {
    id: "#TER-0489", cid: "c3", client: "Mariam Traoré", place: "Plateau, Abidjan", phone: "+225 01 88 76 54 32",
    items: 4, channel: "Web", ago: "il y a 2 h", date: "Aujourd'hui 07:55", total: "86 000 FCFA", status: "confirmee", vip: true,
    lines: [
      { name: "Kente bande", qty: 2, price: "40 000", total: "80 000", productId: "p7" },
      { name: "Pochette wax", qty: 1, price: "8 000", total: "8 000", productId: "p12" },
    ],
  },
  {
    id: "#TER-0488", cid: "c2", client: "Adjoua N’Guessan", place: "Yopougon, Abidjan", phone: "+225 05 33 21 09 44",
    items: 2, channel: "Boutique", ago: "il y a 3 h", date: "Hier 18:20", total: "27 500 FCFA", status: "preparation", vip: false,
    lines: [{ name: "Pagne Woodin", qty: 1, price: "24 000", total: "24 000", productId: "p8" }],
  },
  {
    id: "#TER-0487", cid: "c6", client: "Grace Kouassi", place: "Riviera, Abidjan", phone: "+225 01 19 82 73 64",
    items: 3, channel: "Web", ago: "hier", date: "Hier 15:02", total: "42 000 FCFA", status: "livree", vip: false,
    lines: [{ name: "Bazin riche", qty: 1, price: "28 000", total: "28 000", productId: "p6" }],
  },
  {
    id: "#TER-0486", cid: "c4", client: "Fatou Bamba", place: "Marcory, Abidjan", phone: "+225 07 45 09 87 11",
    items: 1, channel: "Web", ago: "hier", date: "Hier 11:40", total: "7 000 FCFA", status: "refusee", vip: false,
    lines: [{ name: "Foulard mousseline", qty: 1, price: "7 000", total: "7 000", productId: "p4" }],
  },
];
