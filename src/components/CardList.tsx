import { useDraggable } from "@dnd-kit/core";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Card } from "../db";
import { relativeTime, snippetFromMarkdown } from "../lib/util";
import { useApp, visibleCards, type TypeFilter } from "../store/app";
import { LIST_WIDTH, useSettings } from "../store/settings";
import { IconAll, IconLink, IconList, IconNote, IconPin, IconPlus, IconSearch, IconSidebar, IconTodo, IconTrash } from "./Icons";
import { TodoProgress } from "./TodoProgress";

const FILTERS: { key: TypeFilter; label: string; icon: typeof IconAll }[] = [
  { key: "all", label: "Semua", icon: IconAll },
  { key: "note", label: "Note", icon: IconNote },
  { key: "todo", label: "Todo", icon: IconTodo },
];

export function TypeIcon({ type }: { type: Card["type"] }) {
  return <span className={`type-dot ${type}`}>{type === "note" ? <IconNote /> : <IconTodo />}</span>;
}

/** ID dnd-kit card di daftar; dijatuhkan ke group di sidebar (G-2). */
export const cardDndId = (id: string) => `card:${id}`;

export function CardList() {
  const view = useApp((s) => s.view);
  const groupId = useApp((s) => s.groupId);
  const list = useApp((s) => s.list);
  const trashed = useApp((s) => s.trashed);
  const groups = useApp((s) => s.groups);
  const typeFilter = useApp((s) => s.typeFilter);
  const selectedId = useApp((s) => s.selectedId);
  const select = useApp((s) => s.select);
  const setTypeFilter = useApp((s) => s.setTypeFilter);
  const createCard = useApp((s) => s.createCard);
  const setSearchOpen = useApp((s) => s.setSearchOpen);
  const sidebarOpen = useSettings((s) => s.sidebarOpen);
  const toggleSidebar = useSettings((s) => s.toggleSidebar);
  const toggleList = useSettings((s) => s.toggleList);

  // Perbarui label waktu relatif tiap menit.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const cards = visibleCards({ list, trashed, view, groupId, typeFilter });
  const isTrash = view === "trash";
  const pinned = isTrash ? [] : cards.filter((c) => c.pinned);
  const rest = isTrash ? cards : cards.filter((c) => !c.pinned);
  const title =
    view === "trash" ? "Trash" : view === "ungrouped" ? "Tanpa group" : view === "group" ? groups.find((g) => g.id === groupId)?.name ?? "Group" : "Semua";

  return (
    <section className="list">
      <div className="list-head">
        <div className="list-title-row">
          {!sidebarOpen && (
            <button className="icon-btn" title="Tampilkan sidebar (Ctrl+\)" onClick={toggleSidebar}>
              <IconSidebar />
            </button>
          )}
          <div className="list-title">
            <strong>{title}</strong>
            <span>{cards.length}</span>
          </div>
          {!isTrash && (
            <>
              <button className="add-btn primary" title="Note baru (Ctrl+N)" onClick={() => createCard("note")}>
                <IconPlus />
                Note
              </button>
              <button className="add-btn" title="Todo Card baru (Ctrl+Shift+T)" onClick={() => createCard("todo")}>
                <IconPlus style={{ color: "var(--todo)" }} />
                Todo
              </button>
            </>
          )}
          <button className="icon-btn" title="Ciutkan daftar (Ctrl+Shift+\)" onClick={toggleList}>
            <IconList />
          </button>
        </div>
        <button className="search-trigger" onClick={() => setSearchOpen(true)} title="Cari judul, isi Note, dan item Todo">
          <IconSearch size={13} />
          <span>Cari</span>
          <span className="kbd">Ctrl</span>
          <span className="kbd">K</span>
        </button>
        {!isTrash && (
          <div className="segmented" role="tablist">
            {FILTERS.map((f) => (
              <button key={f.key} role="tab" className={typeFilter === f.key ? "active" : ""} onClick={() => setTypeFilter(f.key)}>
                <f.icon size={13} />
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="list-body">
        {cards.length === 0 && (
          <div className="list-empty">
            <span className="empty-icon">{isTrash ? <IconTrash size={22} /> : typeFilter === "todo" ? <IconTodo size={22} /> : <IconNote size={22} />}</span>
            {isTrash ? (
              "Trash kosong. Card yang dihapus disimpan di sini selama 30 hari."
            ) : view === "group" && typeFilter === "all" ? (
              "Group ini masih kosong. Buat card baru di sini, atau seret card dari tampilan lain ke group di sidebar."
            ) : view === "ungrouped" && typeFilter === "all" ? (
              "Semua card sudah masuk group."
            ) : typeFilter !== "all" ? (
              `Tidak ada ${typeFilter === "note" ? "Note" : "Todo Card"} di sini.`
            ) : (
              <>
                Belum ada card.
                <br />
                Tekan <span className="kbd">Ctrl</span> + <span className="kbd">N</span> untuk membuat Note,
                <br />
                atau <span className="kbd">Ctrl</span> + <span className="kbd">Shift</span> + <span className="kbd">T</span> untuk Todo Card.
              </>
            )}
          </div>
        )}
        {pinned.length > 0 && <div className="list-section">Disematkan</div>}
        {pinned.map((c) => (
          <Row key={c.id} card={c} active={c.id === selectedId} onClick={() => select(c.id)} timeOf={c.updatedAt} draggable />
        ))}
        {pinned.length > 0 && rest.length > 0 && <div className="list-section">Lainnya</div>}
        {rest.map((c) => (
          <Row key={c.id} card={c} active={c.id === selectedId} onClick={() => select(c.id)} timeOf={isTrash ? c.trashedAt ?? c.updatedAt : c.updatedAt} draggable={!isTrash} />
        ))}
      </div>
      <ListResizer />
    </section>
  );
}

/** P-4: lebar daftar card bisa diubah dengan menyeret tepi kanan; klik dua kali = lebar bawaan. */
function ListResizer() {
  const setListWidth = useSettings((s) => s.setListWidth);
  const drag = useRef<{ x: number; w: number } | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, w: useSettings.getState().listWidth };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) setListWidth(drag.current.w + e.clientX - drag.current.x, false);
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    setListWidth(useSettings.getState().listWidth);
  };

  return (
    <div
      className="list-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label="Ubah lebar daftar"
      title="Seret untuk mengubah lebar. Klik dua kali untuk lebar bawaan."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => setListWidth(LIST_WIDTH.default)}
    />
  );
}

interface RowProps {
  card: Card;
  active: boolean;
  onClick(): void;
  timeOf: number;
  draggable: boolean;
}

function Row({ card, active, onClick, timeOf, draggable }: RowProps) {
  const snippet = card.type === "note" ? snippetFromMarkdown(card.body) : "";
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: cardDndId(card.id), disabled: !draggable });
  return (
    <button ref={setNodeRef} className={`row ${active ? "active" : ""} ${isDragging ? "dragging" : ""}`} onClick={onClick} {...listeners}>
      <div className="row-top">
        <TypeIcon type={card.type} />
        <span className={`row-title ${card.title.trim() ? "" : "untitled"}`}>{card.title.trim() || "Tanpa judul"}</span>
        {card.pinned && <IconPin size={12} filled style={{ color: "var(--text-4)" }} />}
        {card.linkCount > 0 && (
          <span className="row-links" title={`${card.linkCount} card terhubung`}>
            <IconLink size={11} />
            {card.linkCount}
          </span>
        )}
        <span className="row-time">{relativeTime(timeOf)}</span>
      </div>
      {snippet && <div className="row-snippet">{snippet}</div>}
      {card.progress && (
        <div className="row-progress">
          <TodoProgress progress={card.progress} compact />
        </div>
      )}
    </button>
  );
}
