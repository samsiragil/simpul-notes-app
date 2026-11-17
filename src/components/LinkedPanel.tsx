import type { Card } from "../db";
import { useApp } from "../store/app";
import { TypeIcon } from "./CardList";
import { IconClose, IconLink, IconPlus } from "./Icons";
import { TodoProgress } from "./TodoProgress";

/** L-3, L-4, L-5: panel "Terhubung" di bawah isi card. */
export function LinkedPanel({ card }: { card: Card }) {
  const linkedIds = useApp((s) => s.linkedIds);
  const list = useApp((s) => s.list);
  const openCard = useApp((s) => s.openCard);
  const unlinkCard = useApp((s) => s.unlinkCard);
  const setLinkDialogOpen = useApp((s) => s.setLinkDialogOpen);

  // Ambil dari daftar agar judul dan progres selalu yang terbaru.
  const linked = linkedIds.map((id) => list.find((c) => c.id === id)).filter((c): c is Card => !!c);

  return (
    <section className="linked" aria-label="Card terhubung">
      <div className="linked-head">
        <IconLink size={14} />
        <span className="linked-label">Terhubung</span>
        {linked.length > 0 && <span className="linked-count">{linked.length}</span>}
        <span className="spacer" />
        <button className="ghost-btn" title="Hubungkan card (Ctrl+L)" onClick={() => setLinkDialogOpen(true)}>
          <IconPlus size={11} />
          Hubungkan
        </button>
      </div>

      {linked.length === 0 ? (
        <div className="linked-empty">
          Belum ada card terhubung. Tekan <span className="kbd">Ctrl</span> + <span className="kbd">L</span> untuk menghubungkan.
        </div>
      ) : (
        <div className="linked-list">
          {linked.map((c) => (
            <div key={c.id} className="linked-row-wrap">
              <button
                className="linked-row"
                title={`Buka "${c.title.trim() || "Tanpa judul"}"`}
                onClick={() => openCard(c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Delete") {
                    e.preventDefault();
                    void unlinkCard(card.id, c.id);
                  }
                }}
              >
                <TypeIcon type={c.type} />
                <span className={`linked-title ${c.title.trim() ? "" : "untitled"}`}>{c.title.trim() || "Tanpa judul"}</span>
                {c.progress && <TodoProgress progress={c.progress} compact />}
              </button>
              <button className="icon-btn unlink" title="Putuskan link (Delete)" onClick={() => void unlinkCard(card.id, c.id)}>
                <IconClose size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
