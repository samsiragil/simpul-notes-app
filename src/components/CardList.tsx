import { useEffect, useState } from "react";
import type { Card } from "../db";
import { relativeTime, snippetFromMarkdown } from "../lib/util";
import { useApp, visibleCards, type TypeFilter } from "../store/app";
import { useSettings } from "../store/settings";
import { IconList, IconNote, IconPin, IconPlus, IconSidebar, IconTodo } from "./Icons";

const FILTERS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "note", label: "Note" },
  { key: "todo", label: "Todo" },
];

export function TypeIcon({ type }: { type: Card["type"] }) {
  return <span className={`type-dot ${type}`}>{type === "note" ? <IconNote /> : <IconTodo />}</span>;
}

export function CardList() {
  const view = useApp((s) => s.view);
  const list = useApp((s) => s.list);
  const typeFilter = useApp((s) => s.typeFilter);
  const selectedId = useApp((s) => s.selectedId);
  const select = useApp((s) => s.select);
  const setTypeFilter = useApp((s) => s.setTypeFilter);
  const createCard = useApp((s) => s.createCard);
  const sidebarOpen = useSettings((s) => s.sidebarOpen);
  const toggleSidebar = useSettings((s) => s.toggleSidebar);
  const toggleList = useSettings((s) => s.toggleList);

  // Perbarui label waktu relatif tiap menit.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const cards = visibleCards({ list, typeFilter });
  const pinned = view === "all" ? cards.filter((c) => c.pinned) : [];
  const rest = view === "all" ? cards.filter((c) => !c.pinned) : cards;
  const title = view === "trash" ? "Trash" : "Semua";

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
          {view === "all" && (
            <>
              <button className="add-btn" title="Note baru (Ctrl+N)" onClick={() => createCard("note")}>
                <IconPlus style={{ color: "var(--note)" }} />
                Note
              </button>
              <button className="add-btn" title="Todo Card hadir di M2" disabled>
                <IconPlus style={{ color: "var(--todo)" }} />
                Todo
              </button>
            </>
          )}
          <button className="icon-btn" title="Ciutkan daftar (Ctrl+Shift+\)" onClick={toggleList}>
            <IconList />
          </button>
        </div>
        {view === "all" && (
          <div className="segmented" role="tablist">
            {FILTERS.map((f) => (
              <button key={f.key} role="tab" className={typeFilter === f.key ? "active" : ""} onClick={() => setTypeFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="list-body">
        {cards.length === 0 && (
          <div className="list-empty">
            {view === "trash" ? (
              "Trash kosong. Card yang dihapus disimpan di sini selama 30 hari."
            ) : (
              <>
                Belum ada card.
                <br />
                Tekan <span className="kbd">Ctrl</span> + <span className="kbd">N</span> untuk membuat Note.
              </>
            )}
          </div>
        )}
        {pinned.length > 0 && <div className="list-section">Disematkan</div>}
        {pinned.map((c) => (
          <Row key={c.id} card={c} active={c.id === selectedId} onClick={() => select(c.id)} timeOf={c.updatedAt} />
        ))}
        {pinned.length > 0 && rest.length > 0 && <div className="list-section">Lainnya</div>}
        {rest.map((c) => (
          <Row key={c.id} card={c} active={c.id === selectedId} onClick={() => select(c.id)} timeOf={view === "trash" ? c.trashedAt ?? c.updatedAt : c.updatedAt} />
        ))}
      </div>
    </section>
  );
}

function Row({ card, active, onClick, timeOf }: { card: Card; active: boolean; onClick(): void; timeOf: number }) {
  const snippet = card.type === "note" ? snippetFromMarkdown(card.body) : "";
  return (
    <button className={`row ${active ? "active" : ""}`} onClick={onClick}>
      <div className="row-top">
        <TypeIcon type={card.type} />
        <span className={`row-title ${card.title.trim() ? "" : "untitled"}`}>{card.title.trim() || "Tanpa judul"}</span>
        {card.pinned && <IconPin size={12} filled style={{ color: "var(--text-4)" }} />}
        <span className="row-time">{relativeTime(timeOf)}</span>
      </div>
      {snippet && <div className="row-snippet">{snippet}</div>}
    </button>
  );
}
