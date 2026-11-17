import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Card } from "../db";
import { snippetFromMarkdown } from "../lib/util";
import { selectedCard, useApp } from "../store/app";
import { TypeIcon } from "./CardList";
import { IconCheck, IconClose, IconPlus, IconSearch } from "./Icons";
import { TodoProgress } from "./TodoProgress";

const MAX_RESULTS = 50;

/** Cocokkan judul dulu, lalu isi Note (pencarian FTS5 lengkap di M4). */
export function searchCandidates(list: readonly Card[], excluded: ReadonlySet<string>, query: string): Card[] {
  const q = query.trim().toLowerCase();
  const pool = list.filter((c) => !excluded.has(c.id));
  if (!q) return pool.slice(0, MAX_RESULTS);
  const inTitle = pool.filter((c) => c.title.toLowerCase().includes(q));
  const inBody = pool.filter((c) => !c.title.toLowerCase().includes(q) && (c.body ?? "").toLowerCase().includes(q));
  return [...inTitle, ...inBody].slice(0, MAX_RESULTS);
}

function highlight(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const at = text.toLowerCase().indexOf(q.toLowerCase());
  if (at === -1) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

/** L-1, L-2: dialog Hubungkan. Bisa memilih beberapa card atau membuat Todo Card baru. */
export function LinkDialog() {
  const open = useApp((s) => s.linkDialogOpen);
  const from = useApp(selectedCard);
  if (!open || !from) return null;
  return <LinkDialogInner from={from} />;
}

function LinkDialogInner({ from }: { from: Card }) {
  const list = useApp((s) => s.list);
  const linkedIds = useApp((s) => s.linkedIds);
  const setOpen = useApp((s) => s.setLinkDialogOpen);
  const linkCards = useApp((s) => s.linkCards);
  const createCard = useApp((s) => s.createCard);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // L-2: card sendiri dan card yang sudah terhubung tidak muncul.
  const excluded = useMemo(() => new Set([from.id, ...linkedIds]), [from.id, linkedIds]);
  const results = useMemo(() => searchCandidates(list, excluded, query), [list, excluded, query]);
  const newTitle = query.trim();
  const rowCount = results.length + (newTitle ? 1 : 0);
  const createIdx = newTitle ? results.length : -1;

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    bodyRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const close = () => {
    setOpen(false);
    // Kembalikan fokus ke area card agar alur keyboard berlanjut.
    requestAnimationFrame(() => document.querySelector<HTMLElement>(".pane .title-input")?.focus());
  };

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const confirm = async (ids: string[]) => {
    if (ids.length === 0) return;
    setOpen(false);
    await linkCards(from.id, ids);
  };

  const createTodo = async () => {
    if (!newTitle) return;
    setOpen(false);
    if (picked.length) await linkCards(from.id, picked);
    await createCard("todo", { title: newTitle, linkTo: from.id });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" && rowCount) {
      e.preventDefault();
      setActive((a) => (a + 1) % rowCount);
    } else if (e.key === "ArrowUp" && rowCount) {
      e.preventDefault();
      setActive((a) => (a - 1 + rowCount) % rowCount);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active === createIdx) return void createTodo();
      const card = results[active];
      if (e.shiftKey) {
        if (card) toggle(card.id);
      } else if (picked.length) {
        void confirm(picked);
      } else if (card) {
        void confirm([card.id]);
      }
    }
  };

  return (
    <div className="overlay top" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="palette" role="dialog" aria-label="Hubungkan card" onKeyDown={onKeyDown}>
        <div className="palette-head">
          <IconSearch style={{ color: "var(--text-3)" }} />
          <input
            ref={inputRef}
            className="palette-input"
            placeholder={`Hubungkan "${from.title.trim() || "Tanpa judul"}" ke…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="icon-btn" title="Tutup (Esc)" onClick={close}>
            <IconClose />
          </button>
        </div>

        <div className="palette-body" ref={bodyRef}>
          {results.length === 0 && !newTitle && <div className="palette-empty">Tidak ada card lain untuk dihubungkan.</div>}
          {results.length === 0 && newTitle && <div className="palette-empty">Tidak ada card yang cocok.</div>}
          {results.map((c, idx) => {
            const isPicked = picked.includes(c.id);
            const snippet = c.type === "note" ? snippetFromMarkdown(c.body, 90) : "";
            return (
              <div
                key={c.id}
                data-idx={idx}
                role="option"
                aria-selected={isPicked}
                className={`palette-row ${idx === active ? "active" : ""}`}
                onMouseMove={() => setActive(idx)}
                onClick={() => toggle(c.id)}
              >
                <span className={`pick ${isPicked ? "on" : ""}`} aria-hidden>
                  {isPicked && <IconCheck size={10} />}
                </span>
                <TypeIcon type={c.type} />
                <span className="palette-main">
                  <span className={`palette-title ${c.title.trim() ? "" : "untitled"}`}>{highlight(c.title.trim() || "Tanpa judul", query)}</span>
                  {snippet && <span className="palette-snippet">{highlight(snippet, query)}</span>}
                </span>
                {c.progress && <TodoProgress progress={c.progress} compact />}
              </div>
            );
          })}
          {newTitle && (
            <div
              data-idx={createIdx}
              className={`palette-row create ${active === createIdx ? "active" : ""}`}
              onMouseMove={() => setActive(createIdx)}
              onClick={() => void createTodo()}
            >
              <span className="pick ghost" aria-hidden>
                <IconPlus size={10} />
              </span>
              <span className="palette-main">
                <span className="palette-title">
                  Buat Todo Card <strong>“{newTitle}”</strong>
                </span>
                <span className="palette-snippet">Langsung terhubung dan masuk group yang sama</span>
              </span>
            </div>
          )}
        </div>

        <div className="palette-foot">
          <span>
            <span className="kbd">↑</span> <span className="kbd">↓</span> pilih
          </span>
          <span>
            <span className="kbd">Shift</span> + <span className="kbd">Enter</span> pilih banyak
          </span>
          <span>
            <span className="kbd">Enter</span> hubungkan
          </span>
          <span className="spacer" />
          <button className="btn primary" disabled={picked.length === 0} onClick={() => void confirm(picked)}>
            Hubungkan{picked.length ? ` (${picked.length})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
