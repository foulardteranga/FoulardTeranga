import { prisma } from "@/lib/db/client";
import { getCurrentTenant } from "@/lib/tenant";
import type { Prisma, PromoCode } from "@/lib/generated/prisma/client";

export interface PromoCodeView {
  id: string;
  code: string;
  kind: "percent" | "amount";
  value: number;
  minTotal: number | null;
  startsAt: string | null;
  endsAt: string | null;
  vipOnly: boolean;
  active: boolean;
  usedCount: number;
}

function toView(row: PromoCode): PromoCodeView {
  return {
    id: row.id,
    code: row.code,
    kind: row.kind,
    value: row.value,
    minTotal: row.minTotal,
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    vipOnly: row.vipOnly,
    active: row.active,
    usedCount: row.usedCount,
  };
}

/** Codes promo du tenant courant, plus récents d'abord (écran Marketing). */
export async function getPromoCodes(): Promise<PromoCodeView[]> {
  const tenant = await getCurrentTenant();
  const rows = await prisma.promoCode.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toView);
}

/** Lookup d'un code (normalisé MAJUSCULES) — utilisable dans ou hors transaction. */
export async function findPromoByCode(
  db: Prisma.TransactionClient | typeof prisma,
  tenantId: string,
  code: string
): Promise<PromoCode | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  return db.promoCode.findFirst({ where: { tenantId, code: normalized } });
}
