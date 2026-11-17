import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState, type ReactNode } from "react";
import { useApp } from "../store/app";
import { TypeIcon } from "./CardList";

const CARD = "card:";
const GROUP = "group:";

/** Card dijatuhkan tepat di bawah pointer; group diurutkan ke posisi terdekat. */
const collision: CollisionDetection = (args) => {
  const isCard = String(args.active.id).startsWith(CARD);
  if (!isCard) return closestCenter(args);
  return pointerWithin(args).filter((c) => String(c.id).startsWith(GROUP));
};

/**
 * Drag-and-drop lintas kolom: urutkan group di sidebar (G-1) dan seret card
 * dari daftar ke group di sidebar (G-2). Memakai pointer events (dnd-kit), bukan
 * HTML5 drag-and-drop, agar tidak bentrok dengan drag-drop file di WebView2.
 */
export function AppDnd({ children }: { children: ReactNode }) {
  const [draggingCard, setDraggingCard] = useState<string | null>(null);
  const card = useApp((s) => (draggingCard ? s.list.find((c) => c.id === draggingCard) ?? null : null));
  const groups = useApp((s) => s.groups);
  const addToGroup = useApp((s) => s.addToGroup);
  const moveGroup = useApp((s) => s.moveGroup);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragStart = ({ active }: DragStartEvent) => {
    const id = String(active.id);
    setDraggingCard(id.startsWith(CARD) ? id.slice(CARD.length) : null);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingCard(null);
    if (!over) return;
    const from = String(active.id);
    const to = String(over.id);
    if (!to.startsWith(GROUP)) return;
    const groupId = to.slice(GROUP.length);
    if (from.startsWith(CARD)) {
      void addToGroup(from.slice(CARD.length), groupId);
    } else if (from.startsWith(GROUP) && from !== to) {
      const toIndex = groups.findIndex((g) => g.id === groupId);
      if (toIndex !== -1) void moveGroup(from.slice(GROUP.length), toIndex);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDraggingCard(null)}>
      {children}
      <DragOverlay dropAnimation={null}>
        {card && (
          <div className="drag-chip">
            <TypeIcon type={card.type} />
            <span>{card.title.trim() || "Tanpa judul"}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
