import type { BlockId } from "@/lib/store/useStorefront";

/** Enveloppe neutre d'un bloc de vitrine. L'habillage d'édition vit désormais
 * exclusivement dans l'éditeur back-office (components/editor), jamais côté public. */
export function BlockFrame({ id, children }: { id: BlockId; children: React.ReactNode }) {
  return <section data-block={id}>{children}</section>;
}
