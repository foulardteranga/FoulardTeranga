import { ICONS } from "@/components/ui/Icon";

/** Définition de la navigation back-office : route → libellé + icône. */
export interface NavDef {
  id: string;
  href: string;
  label: string;
  /** Libellé court pour les onglets mobiles. */
  short: string;
  icon: string;
  /** Affiche le badge « commandes à valider » sur cette entrée. */
  ordersBadge?: boolean;
}

export const NAV: NavDef[] = [
  { id: "pos", href: "/pos", label: "Point de vente", short: "Caisse", icon: ICONS.pos },
  { id: "dash", href: "/tableau-de-bord", label: "Tableau de bord", short: "Bord", icon: ICONS.dash },
  { id: "orders", href: "/commandes", label: "Commandes", short: "Commandes", icon: ICONS.orders, ordersBadge: true },
  { id: "inv", href: "/inventaire", label: "Inventaire", short: "Stock", icon: ICONS.inv },
  { id: "cust", href: "/clientes", label: "Clientes", short: "Clientes", icon: ICONS.cust },
  { id: "mkt", href: "/marketing", label: "Marketing", short: "Marketing", icon: ICONS.mkt },
  { id: "fin", href: "/finance", label: "Finance", short: "Finance", icon: ICONS.fin },
  { id: "theme", href: "/personnalisation", label: "Personnalisation", short: "Thème", icon: ICONS.theme },
];

/** Routes accessibles via l'onglet « Plus » sur mobile. */
export const MORE_ROUTES = ["cust", "mkt", "fin", "theme"];

/** Titre & sous-titre d'écran par route (barre supérieure). */
export const SCREEN_META: Record<string, [string, string]> = {
  "/pos": ["Point de vente", "Encaissez rapidement, en ligne ou hors-ligne"],
  "/tableau-de-bord": ["Tableau de bord", "Vue d'ensemble de l'activité du jour"],
  "/inventaire": ["Inventaire & stock", "Produits, variantes et mouvements"],
  "/commandes": ["Commandes en ligne", "File de validation"],
  "/clientes": ["Clientes & fidélité", "Segments, historique et points"],
  "/marketing": ["Marketing & analyse", "Performances produits et promotions"],
  "/finance": ["Finance", "Transactions, encaissements et marges"],
  "/personnalisation": ["Personnalisation", "Apparence de votre vitrine"],
};
