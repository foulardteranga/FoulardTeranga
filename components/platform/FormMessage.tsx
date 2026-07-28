import { colors } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";

export type FormMessageState = { kind: "ok" | "error"; text: string } | null;

/**
 * Bandeau de retour de formulaire (succès/erreur), factorisé depuis les trois
 * écrans plateforme qui le dupliquaient à l'identique — texte et sémantique
 * inchangés, ajout d'une icône (DESIGN.md §6 : « message d'erreur + icône
 * danger inline »).
 */
export function FormMessage({ message }: { message: FormMessageState }) {
  if (!message) return null;
  const ok = message.kind === "ok";
  return (
    <p
      role={ok ? "status" : "alert"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: ok ? colors.bgSuccess : colors.bgDanger,
        color: ok ? colors.fgSuccess : colors.fgDanger,
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 14,
        // Marge portée par l'élément lui-même : rendu conditionnel (null si pas
        // de message), donc aucun espace résiduel quand rien ne s'affiche.
        margin: "14px 0 0",
      }}
    >
      <Icon path={ok ? ICONS.check : ICONS.alertTriangle} size={16} style={{ flexShrink: 0 }} />
      {message.text}
    </p>
  );
}
