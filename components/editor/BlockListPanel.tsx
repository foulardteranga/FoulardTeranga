"use client";

import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { colors, fonts } from "@/lib/theme/tokens";
import { Icon, ICONS } from "@/components/ui/Icon";
import { BLOCK_ICONS } from "./blockIcons";
import type { BlockInstance } from "@/lib/storefront/pageContent";

export function BlockListPanel({
  blocks,
  selectedId,
  onSelect,
  onReorder,
  onAddClick,
}: {
  blocks: BlockInstance[];
  selectedId: string;
  onSelect: (id: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  onAddClick: () => void;
}) {
  // distance minimale avant d'activer le drag : laisse passer un simple tap
  // (sélection) sans déclencher un déplacement involontaire.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  }

  return (
    <div style={{ padding: "16px 18px", borderBottom: `1px solid ${colors.borderSoft}` }}>
      <div style={{ fontFamily: fonts.display, fontWeight: 600, fontSize: 17, marginBottom: 12 }}>
        Blocs de la page
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {blocks.map((b) => (
              <BlockRow key={b.id} block={b} selected={b.id === selectedId} onSelect={() => onSelect(b.id)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button onClick={onAddClick} style={addBtnStyle}>
        <Icon path={ICONS.plus} size={16} stroke={colors.primary} strokeWidth={2} />
        Ajouter un bloc
      </button>
    </div>
  );
}

function BlockRow({
  block,
  selected,
  onSelect,
}: {
  block: BlockInstance;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9,
        border: `1.5px solid ${selected ? colors.primary : colors.borderSoft}`,
        background: selected ? "#EEF0F7" : "#fff", cursor: "pointer",
      }}
      onClick={onSelect}
    >
      <span
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        aria-label="Réordonner ce bloc"
        style={{ display: "flex", cursor: "grab", touchAction: "none", color: colors.muted, flex: "none" }}
      >
        <Icon path={ICONS.menu} size={16} stroke="currentColor" />
      </span>
      <Icon path={BLOCK_ICONS[block.type]} size={17} stroke={colors.primary} strokeWidth={1.6} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {block.name}
      </span>
      {!block.visible && (
        <span style={{ font: `600 10px ${fonts.ui}`, padding: "2px 7px", borderRadius: 999, background: colors.borderSoft, color: colors.muted, flex: "none" }}>
          Masqué
        </span>
      )}
    </div>
  );
}

const addBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 40,
  border: `1.5px dashed ${colors.borderField}`, borderRadius: 9, background: "#fff", color: colors.primary,
  font: `600 13px ${fonts.ui}`, cursor: "pointer",
};
