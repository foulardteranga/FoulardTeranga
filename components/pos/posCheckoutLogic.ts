import type { PosPaymentMethod } from "@/lib/payments/labels";

export interface SplitPaymentLineItem {
  id: string;
  method: PosPaymentMethod;
  amount: number;
  amountReceived?: number;
}

/** Calcule la monnaie à rendre en FCFA. Ne peut pas être négative. */
export function calculateChange(amountReceived: number, totalDue: number): number {
  return Math.max(0, amountReceived - totalDue);
}

/** Calcule le montant manquant si le montant reçu est inférieur au total. */
export function calculateMissing(amountReceived: number, totalDue: number): number {
  return Math.max(0, totalDue - amountReceived);
}

/** Calcule des suggestions pertinentes de coupures FCFA supérieures au montant dû. */
export function computeCashSuggestions(total: number): number[] {
  const list: number[] = [];
  const pushIfHigher = (val: number) => {
    if (val > total && !list.includes(val)) list.push(val);
  };

  [1000, 2000, 5000, 10000, 15000, 20000, 25000, 30000, 40000, 50000].forEach(pushIfHigher);

  const nextFiveThousand = Math.ceil((total + 1) / 5000) * 5000;
  pushIfHigher(nextFiveThousand);
  const nextTenThousand = Math.ceil((total + 1) / 10000) * 10000;
  pushIfHigher(nextTenThousand);

  list.sort((a, b) => a - b);
  return list.slice(0, 4);
}

/** Somme des montants alloués sur une liste de paiements fractionnés. */
export function calculateSplitTotal(lines: Array<{ amount: number }>): number {
  return lines.reduce((sum, l) => sum + (l.amount || 0), 0);
}

/** Calcule le solde restant à répartir (positif si manque, négatif si dépassement). */
export function calculateSplitRemaining(total: number, allocated: number): number {
  return total - allocated;
}

/** Valide si une répartition mixte est prête à être encaissée (exactement équilibrée et >= 2 lignes). */
export function isSplitPaymentValid(total: number, lines: Array<{ amount: number }>): boolean {
  if (lines.length < 2) return false;
  const sum = calculateSplitTotal(lines);
  return sum === total && lines.every((l) => l.amount > 0);
}
