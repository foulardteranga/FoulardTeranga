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
  { id: "pos", href: "/admin/pos", label: "Point de vente", short: "Caisse", icon: ICONS.pos },
  { id: "dash", href: "/admin/tableau-de-bord", label: "Tableau de bord", short: "Bord", icon: ICONS.dash },
  { id: "orders", href: "/admin/commandes", label: "Commandes", short: "Commandes", icon: ICONS.orders, ordersBadge: true },
  { id: "inv", href: "/admin/inventaire", label: "Inventaire", short: "Stock", icon: ICONS.inv },
  { id: "cust", href: "/admin/clientes", label: "Clientes", short: "Clientes", icon: ICONS.cust },
  { id: "mkt", href: "/admin/marketing", label: "Marketing", short: "Marketing", icon: ICONS.mkt },
  { id: "fin", href: "/admin/finance", label: "Finance", short: "Finance", icon: ICONS.fin },
  { id: "theme", href: "/admin/personnalisation", label: "Personnalisation", short: "Thème", icon: ICONS.theme },
  { id: "vitrine", href: "/admin/vitrine", label: "Vitrine", short: "Vitrine", icon: ICONS.theme },
  { id: "boutique", href: "/admin/boutique", label: "Boutique", short: "Boutique", icon: ICONS.inv },
];

/** Routes accessibles via l'onglet « Plus » sur mobile. */
export const MORE_ROUTES = ["cust", "mkt", "fin", "theme", "vitrine", "boutique"];

/** Titre & sous-titre d'écran par route (barre supérieure). */
export const SCREEN_META: Record<string, [string, string]> = {
  "/admin/pos": ["Point de vente", "Encaissez rapidement, en ligne ou hors-ligne"],
  "/admin/tableau-de-bord": ["Tableau de bord", "Vue d'ensemble de l'activité du jour"],
  "/admin/inventaire": ["Inventaire & stock", "Produits, variantes et mouvements"],
  "/admin/commandes": ["Commandes en ligne", "File de validation"],
  "/admin/clientes": ["Clientes & fidélité", "Segments, historique et points"],
  "/admin/marketing": ["Marketing & analyse", "Performances produits et promotions"],
  "/admin/finance": ["Finance", "Transactions, encaissements et marges"],
  "/admin/personnalisation": ["Personnalisation", "Apparence de votre vitrine"],
  "/admin/vitrine": ["Éditeur de vitrine", "Modifiez le contenu de votre page d'accueil"],
  "/admin/boutique": ["Boutique", "Aperçu et raccourcis vers votre boutique en ligne"],
};
