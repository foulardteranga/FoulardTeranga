import { colors } from "@/lib/theme/tokens";
import { STATUS_LABELS } from "@/lib/platform/transitions";
import type { TenantStatus } from "@/lib/generated/prisma/enums";

// `colors.surfaceMuted` n'existe pas dans lib/theme/tokens.ts (confirmé par
// lecture) : littéral utilisé directement, un `??` dessus serait une erreur
// TypeScript strict (propriété inexistante), pas un repli gracieux.
const STYLES: Record<TenantStatus, { background: string; color: string }> = {
  active: { background: colors.bgSuccess, color: colors.fgSuccess },
  suspended: { background: colors.bgDanger, color: colors.fgDanger },
  archived: { background: "#EFEBE3", color: colors.muted },
};

/** Pastille d'état d'une boutique, partagée par la liste du parc et la fiche. */
export function StatusBadge({ status }: { status: TenantStatus }) {
  const style = STYLES[status];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 9px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: style.background,
        color: style.color,
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
