import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { search, type Card, type CardType, type SearchHit } from "../db";
import { hitSegments, markHits, searchTerms } from "../lib/search";
import { relativeTime, snippetFromMarkdown } from "../lib/util";
import { useApp } from "../store/app";
import { TypeIcon } from "./CardList";
import { IconClose, IconSearch } from "./Icons";
import { TodoProgress } from "./TodoProgress";

const SEARCH_DELAY_MS = 60;
const RECENT_COUNT = 12;

const TYPES: { key: CardType | null; label: string }[] = [
  { key: null, label: "Semua" },
  { key: "note", label: "Note" },
  { key: "todo", label: "Todo" },
];

/** Teks berpenanda HIT_START/HIT_END jadi teks dengan `<mark>`. */
function Marked({ text }: { text: string }) {
  return (
    <>
      {hitSegments(text).map((s, i) => (s.hit ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}
    </>
  );
}

interface Row {
  card: Card;
  hit: SearchHit | null;
}

/** S-3, S-4, S-5: command palette pencarian `Ctrl+K`. */
export function SearchPalette() {
  const open = useApp((s) => s.searchOpen);
  if (!open) return null;
  return <SearchPaletteInner />;
}

function SearchPaletteInner() {
  const list = useApp((s) => s.list);
  const groups = useApp((s) => s.groups);
  const setOpen = useApp((s) => s.setSearchOpen);
  const revealCard = useApp((s) => s.revealCard);
  const currentGroup = useApp((s) => (s.view === "group" ? s.groupId : null));

  const [query, setQuery] = useState("");
  const [type, setType] = useState<CardType | null>(null);
  // Dari dalam group, pencarian langsung dibatasi ke group itu (bisa diganti).
  const [groupId, setGroupId] = useState<string | null>(currentGroup);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searched, setSearched] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const terms = useMemo(() => searchTerms(query), [query]);
  const hasQuery = terms.length > 0;

  // Query FTS dengan jeda singkat; hasil lama diabaikan jika input sudah berubah.
  useEffect(() => {
    if (!hasQuery) {
      setHits([]);
      setSearched("");
      return;
    }
    let stale = false;
    const t = setTimeout(async () => {
      try {
        const res = await search().search(query, { type, groupId });
        if (!stale) {
          setHits(res);
          setSearched(query);
        }
      } catch (e) {
        console.error("Pencarian gagal", e);
      }
    }, SEARCH_DELAY_MS);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [query, type, groupId, hasQuery]);

  const rows: Row[] = useMemo(() => {
    const byId = new Map(list.map((c) => [c.id, c]));
    if (hasQuery) {
      return hits.flatMap((hit) => {
        const card = byId.get(hit.cardId);
        return card ? [{ card, hit }] : [];
      });
    }
    // Tanpa kata kunci: card yang terakhir diubah, sesuai filter.
    return [...list]
      .filter((c) => (!type || c.type === type) && (!groupId || c.groupIds.includes(groupId)))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, RECENT_COUNT)
      .map((card) => ({ card, hit: null }));
  }, [hasQuery, hits, list, type, groupId]);

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => setActive(0), [query, type, groupId]);
  useEffect(() => {
    bodyRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(".pane .title-input")?.focus());
  };

  const openRow = (row: Row | undefined) => {
    if (!row) return;
    setOpen(false);
    revealCard(row.card.id);
  };

  const cycle = <T,>(options: readonly T[], current: T, dir: number) =>
    options[(options.indexOf(current) + dir + options.length) % options.length];
  const groupOptions = useMemo(() => [null, ...groups.map((g) => g.id)], [groups]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" && rows.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % rows.length);
    } else if (e.key === "ArrowUp" && rows.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + rows.length) % rows.length);
    } else if ((e.key === "PageDown" || e.key === "PageUp") && rows.length) {
      e.preventDefault();
      setActive((a) => Math.max(0, Math.min(rows.length - 1, a + (e.key === "PageDown" ? 8 : -8))));
    } else if (e.key === "Enter") {
      e.preventDefault();
      openRow(rows[active]);
    } else if (e.key === "Tab") {
      // S-5: Tab / Shift+Tab mengganti filter tipe tanpa meninggalkan kotak pencarian.
      e.preventDefault();
      setType((t) => cycle(TYPES.map((x) => x.key), t, e.shiftKey ? -1 : 1));
    } else if (e.altKey && e.key.toLowerCase() === "g" && groupOptions.length > 1) {
      e.preventDefault();
      setGroupId((g) => cycle(groupOptions, g, e.shiftKey ? -1 : 1));
    }
  };

  const pending = hasQuery && searched !== query;

  return (
    <div className="overlay top" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="palette search" role="dialog" aria-label="Cari card" onKeyDown={onKeyDown}>
        <div className="palette-head">
          <IconSearch style={{ color: "var(--text-3)" }} />
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="Cari judul, isi Note, dan item Todo…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            role="combobox"
            aria-expanded
            aria-controls="search-results"
            aria-activedescendant={rows[active] ? `search-row-${active}` : undefined}
          />
          <button className="icon-btn" title="Tutup (Esc)" onClick={close}>
            <IconClose />
          </button>
        </div>

        <div className="search-filters">
          <div className="segmented" role="radiogroup" aria-label="Tipe card">
            {TYPES.map((t) => (
              <button
                key={t.label}
                role="radio"
                aria-checked={type === t.key}
                tabIndex={-1}
                className={type === t.key ? "active" : ""}
                onClick={() => {
                  setType(t.key);
                  inputRef.current?.focus();
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <select
            className="select search-group"
            aria-label="Group"
            tabIndex={-1}
            value={groupId ?? ""}
            onChange={(e) => {
              setGroupId(e.target.value || null);
              inputRef.current?.focus();
            }}
          >
            <option value="">Semua group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div className="palette-body" ref={bodyRef} id="search-results" role="listbox">
          {!hasQuery && rows.length > 0 && <div className="palette-section">Terakhir diubah</div>}
          {rows.length === 0 && !pending && (
            <div className="palette-empty">
              {hasQuery ? `Tidak ada card yang cocok dengan “${query.trim()}”.` : "Belum ada card di sini."}
            </div>
          )}
          {rows.map((row, idx) => (
            <ResultRow
              key={row.card.id}
              idx={idx}
              row={row}
              terms={terms}
              active={idx === active}
              groupName={(id) => groups.find((g) => g.id === id)?.name}
              onHover={() => setActive(idx)}
              onOpen={() => openRow(row)}
            />
          ))}
        </div>

        <div className="palette-foot">
          <span>
            <span className="kbd">↑</span> <span className="kbd">↓</span> pilih
          </span>
          <span>
            <span className="kbd">Enter</span> buka
          </span>
          <span>
            <span className="kbd">Tab</span> tipe
          </span>
          {groups.length > 0 && (
            <span>
              <span className="kbd">Alt</span> + <span className="kbd">G</span> group
            </span>
          )}
          <span className="spacer" />
          {hasQuery && !pending && <span>{rows.length} hasil</span>}
        </div>
      </div>
    </div>
  );
}

function ResultRow(props: {
  idx: number;
  row: Row;
  terms: string[];
  active: boolean;
  groupName(id: string): string | undefined;
  onHover(): void;
  onOpen(): void;
}) {
  const { card, hit } = props.row;
  const untitled = !card.title.trim();
  const title = hit && !untitled ? hit.title : card.title.trim() || "Tanpa judul";
  // Tanpa kata kunci: potongan isi biasa. Dengan kata kunci: potongan yang cocok dari FTS.
  const snippet = hit ? hit.snippet : card.type === "note" ? markHits(snippetFromMarkdown(card.body, 120), props.terms) : "";
  const groupNames = card.groupIds.map(props.groupName).filter((n): n is string => !!n);

  return (
    <div
      id={`search-row-${props.idx}`}
      data-idx={props.idx}
      role="option"
      aria-selected={props.active}
      className={`palette-row ${props.active ? "active" : ""}`}
      onMouseMove={props.onHover}
      onClick={props.onOpen}
    >
      <TypeIcon type={card.type} />
      <span className="palette-main">
        <span className={`palette-title ${untitled ? "untitled" : ""}`}>
          <Marked text={title} />
        </span>
        {snippet && (
          <span className="palette-snippet">
            <Marked text={snippet} />
          </span>
        )}
      </span>
      {groupNames.length > 0 && <span className="search-groups">{groupNames.join(", ")}</span>}
      {card.progress && <TodoProgress progress={card.progress} compact />}
      <span className="row-time">{relativeTime(card.updatedAt)}</span>
    </div>
  );
}
