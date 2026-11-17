import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Card } from "../db";
import { NoteEditor } from "../editor/NoteEditor";
import { registerFlush } from "../lib/dataOps";
import { debounce, fullDate, relativeTime } from "../lib/util";
import { selectedCard, useApp } from "../store/app";
import { useSettings } from "../store/settings";
import { GroupChips } from "./GroupChips";
import { IconBack, IconFocus, IconLink, IconList, IconPin, IconRestore, IconSearch, IconSidebar, IconTrash } from "./Icons";
import { LinkedPanel } from "./LinkedPanel";
import { focusFirstTodo, TodoList } from "./TodoList";
import { TodoProgress } from "./TodoProgress";

const AUTOSAVE_MS = 800;

export function CardPane() {
  const card = useApp(selectedCard);
  const view = useApp((s) => s.view);
  const canBack = useApp((s) => s.history.length > 0 && s.view !== "trash");
  const back = useApp((s) => s.back);
  const listOpen = useSettings((s) => s.listOpen);
  const sidebarOpen = useSettings((s) => s.sidebarOpen);
  const toggleList = useSettings((s) => s.toggleList);
  const focusMode = useSettings((s) => s.focusMode);
  const toggleFocus = useSettings((s) => s.toggleFocus);
  const setSearchOpen = useApp((s) => s.setSearchOpen);
  const listShown = listOpen && !focusMode;

  return (
    <main className="pane">
      <div className="pane-bar">
        {!listShown && (
          <button className="icon-btn" title="Tampilkan daftar (Ctrl+Shift+\)" onClick={toggleList}>
            {sidebarOpen && !focusMode ? <IconList /> : <IconSidebar />}
          </button>
        )}
        {canBack && (
          <button className="icon-btn" title="Kembali (Alt+←)" onClick={back}>
            <IconBack />
          </button>
        )}
        <span className="meta">{card ? `Diubah ${relativeTime(card.updatedAt).toLowerCase()}` : ""}</span>
        {!listShown && (
          <button className="icon-btn" title="Cari (Ctrl+K)" onClick={() => setSearchOpen(true)}>
            <IconSearch />
          </button>
        )}
        {card && view !== "trash" && <CardActions card={card} />}
        <button className={`icon-btn ${focusMode ? "on" : ""}`} title={focusMode ? "Keluar dari mode fokus (Ctrl+Shift+F / Esc)" : "Mode fokus (Ctrl+Shift+F)"} onClick={toggleFocus}>
          <IconFocus />
        </button>
      </div>
      {card ? (
        <CardBody key={card.id} card={card} readOnly={view === "trash"} />
      ) : (
        <div className="pane-empty">
          {view === "trash" ? (
            "Pilih card di Trash untuk melihat atau memulihkannya."
          ) : (
            <>
              <span>Tidak ada card yang dibuka.</span>
              <span>
                <span className="kbd">Ctrl</span> + <span className="kbd">N</span> &nbsp;Note baru
              </span>
              <span>
                <span className="kbd">Ctrl</span> + <span className="kbd">Shift</span> + <span className="kbd">T</span> &nbsp;Todo Card baru
              </span>
            </>
          )}
        </div>
      )}
    </main>
  );
}

function CardActions({ card }: { card: Card }) {
  const togglePin = useApp((s) => s.togglePin);
  const trashCard = useApp((s) => s.trashCard);
  const setLinkDialogOpen = useApp((s) => s.setLinkDialogOpen);
  return (
    <>
      <button className="icon-btn" title="Hubungkan card (Ctrl+L)" onClick={() => setLinkDialogOpen(true)}>
        <IconLink />
      </button>
      <button className={`icon-btn ${card.pinned ? "on" : ""}`} title={card.pinned ? "Lepas sematan" : "Sematkan di atas"} onClick={() => togglePin(card.id)}>
        <IconPin filled={card.pinned} />
      </button>
      <button className="icon-btn" title="Pindahkan ke Trash (Ctrl+Delete)" onClick={() => trashCard(card.id)}>
        <IconTrash />
      </button>
    </>
  );
}

function CardBody({ card, readOnly }: { card: Card; readOnly: boolean }) {
  const saveCard = useApp((s) => s.saveCard);
  const restoreCard = useApp((s) => s.restoreCard);
  const destroyCard = useApp((s) => s.destroyCard);
  const focusTitleId = useApp((s) => s.focusTitleId);
  const consumeFocusTitle = useApp((s) => s.consumeFocusTitle);

  const [title, setTitle] = useState(card.title);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Satu debouncer per card; perubahan judul + isi digabung lalu disimpan.
  const saver = useMemo(() => {
    let pending: { title?: string; body?: string } = {};
    let inflight: Promise<void> = Promise.resolve();
    const d = debounce(() => {
      const patch = pending;
      pending = {};
      inflight = saveCard(card.id, patch);
    }, AUTOSAVE_MS);
    return {
      queue(p: { title?: string; body?: string }) {
        pending = { ...pending, ...p };
        d();
      },
      /** Tulis yang tertunda sekarang; selesai setelah tersimpan di database. */
      flush: () => {
        d.flush();
        return inflight;
      },
    };
  }, [card.id, saveCard]);

  // Simpan yang tertunda saat pindah card, jendela ditutup, atau sebelum backup/export.
  useEffect(() => {
    const onHide = () => void saver.flush();
    window.addEventListener("beforeunload", onHide);
    const unregister = registerFlush(saver.flush);
    return () => {
      window.removeEventListener("beforeunload", onHide);
      unregister();
      void saver.flush();
    };
  }, [saver]);

  // Judul auto-tinggi.
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  useEffect(() => {
    if (focusTitleId === card.id) {
      titleRef.current?.focus();
      consumeFocusTitle();
    }
  }, [focusTitleId, card.id, consumeFocusTitle]);

  const focusEditor = () => {
    if (card.type === "todo") return focusFirstTodo();
    document.querySelector<HTMLElement>(".pane .ProseMirror")?.focus();
  };

  return (
    <div className="pane-scroll">
      <div className="pane-content">
        {readOnly && (
          <div className="trash-banner">
            <IconTrash />
            <span>Card ini ada di Trash.</span>
            <span className="spacer" />
            {confirmDelete ? (
              <>
                <span>Hapus permanen?</span>
                <button className="btn" onClick={() => setConfirmDelete(false)}>Batal</button>
                <button className="btn danger" onClick={() => destroyCard(card.id)}>Hapus permanen</button>
              </>
            ) : (
              <>
                <button className="btn" onClick={() => setConfirmDelete(true)}>Hapus permanen</button>
                <button className="btn primary" onClick={() => restoreCard(card.id)}>
                  <IconRestore size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                  Pulihkan
                </button>
              </>
            )}
          </div>
        )}

        <textarea
          ref={titleRef}
          className="title-input"
          spellCheck={false}
          rows={1}
          placeholder="Tanpa judul"
          value={title}
          readOnly={readOnly}
          onChange={(e) => {
            const v = e.target.value.replace(/\n/g, " ");
            setTitle(v);
            saver.queue({ title: v });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || (e.key === "ArrowDown" && !e.shiftKey)) {
              e.preventDefault();
              focusEditor();
            }
          }}
        />
        <div className="card-meta">
          <span className={`chip-type ${card.type}`}>{card.type === "note" ? "Note" : "Todo"}</span>
          <span title={`Dibuat ${fullDate(card.createdAt)}`}>{fullDate(card.updatedAt)}</span>
          {card.progress && <TodoProgress progress={card.progress} />}
          <GroupChips card={card} readOnly={readOnly} />
        </div>

        {card.type === "note" ? (
          <NoteEditor
            cardId={card.id}
            initialMarkdown={card.body ?? ""}
            editable={!readOnly}
            onChange={(body) => saver.queue({ body })}
          />
        ) : (
          <TodoList cardId={card.id} readOnly={readOnly} />
        )}

        {!readOnly && <LinkedPanel card={card} />}
      </div>
    </div>
  );
}
