import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import type { TodoItem } from "../db";
import { openUrl } from "../lib/native";
import { DIVIDER, isDivider, isDividerShortcut, parseInline, shortUrl, type TextSegment } from "../lib/todoText";
import { useTodo } from "../store/todo";
import { IconCheck, IconClose, IconGrip } from "./Icons";
import { TodoTextEditor, type TodoCaret } from "./TodoTextEditor";

interface Props {
  item: TodoItem;
  readOnly: boolean;
  /** Item tampil sebelum / sesudah, untuk navigasi panah dan fokus setelah hapus. */
  prevId: string | null;
  nextId: string | null;
  /** Panah atas dari item pertama / bawah dari item terakhir. */
  onExitUp(): void;
  onExitDown(): void;
}

const openLink = (href: string) => void openUrl(href).catch((e) => console.error("Gagal membuka link", e));

/**
 * Satu segmen tampilan baca: format dibungkus `strong`/`em`/`mark`, link paling luar.
 * `data-start` = offset segmen di teks editor, untuk menaruh kursor di titik yang diklik.
 */
function renderSegment(s: TextSegment, key: number, start: number) {
  let node: ReactNode = s.href && s.raw ? shortUrl(s.text) : s.text;
  if (s.mark) node = <mark className="todo-mark">{node}</mark>;
  if (s.italic) node = <em>{node}</em>;
  if (s.bold) node = <strong>{node}</strong>;
  return s.href ? (
    <a key={key} className="todo-link" data-href={s.href} title={s.href}>
      {node}
    </a>
  ) : (
    <span key={key} data-start={start}>
      {node}
    </span>
  );
}

function renderSegments(segments: TextSegment[]) {
  let start = 0;
  return segments.map((s, i) => {
    const el = renderSegment(s, i, start);
    start += s.text.length;
    return el;
  });
}

/** Offset karakter (di teks editor) dari titik klik pada tampilan baca. */
function caretFromPoint(e: MouseEvent<HTMLDivElement>): TodoCaret {
  const doc = document as Document & {
    caretPositionFromPoint?(x: number, y: number): { offsetNode: globalThis.Node; offset: number } | null;
  };
  let node: globalThis.Node | null = null;
  let offset = 0;
  const pos = doc.caretPositionFromPoint?.(e.clientX, e.clientY);
  if (pos) {
    node = pos.offsetNode;
    offset = pos.offset;
  } else {
    const range = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (range) {
      node = range.startContainer;
      offset = range.startOffset;
    }
  }
  const el = node && (node.nodeType === 3 ? node.parentElement : (node as Element));
  const span = el?.closest<HTMLElement>("[data-start]");
  if (!node || node.nodeType !== 3 || !span) return "end";
  return Number(span.dataset.start) + offset;
}

/** Satu baris item Todo (T-2, T-3, T-4), termasuk link, format inline, dan item pemisah. */
export function TodoItemRow({ item, readOnly, prevId, nextId, onExitUp, onExitDown }: Props) {
  const add = useTodo((s) => s.add);
  const setText = useTodo((s) => s.setText);
  const toggle = useTodo((s) => s.toggle);
  const remove = useTodo((s) => s.remove);
  const move = useTodo((s) => s.move);
  const focus = useTodo((s) => s.focus);
  const setFocus = useTodo((s) => s.setFocus);

  const dividerRef = useRef<HTMLDivElement>(null);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: readOnly,
  });

  const divider = isDivider(item.text);
  const segments = useMemo(() => parseInline(item.text), [item.text]);

  // Tampilan baca (format jadi, link bisa diklik). Klik atau fokus keyboard memasang
  // editor WYSIWYG di tempat yang sama, dengan kursor di titik yang diklik.
  const [editCaret, setEditCaret] = useState<TodoCaret | null>(null);
  const editing = editCaret !== null && !readOnly;

  const startEditing = (caret: TodoCaret) => {
    if (!readOnly) setEditCaret(caret);
  };

  // Layout effect: editor terpasang dan fokus sebelum event keyboard berikutnya diproses.
  useLayoutEffect(() => {
    if (focus?.id !== item.id) return;
    if (divider) dividerRef.current?.focus();
    else startEditing(focus.caret);
    setFocus(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, item.id, setFocus]);

  const removeAndFocusNeighbour = () => {
    const target = prevId ?? nextId;
    remove(item.id);
    if (target) setFocus({ id: target, caret: prevId ? "end" : "start" });
    else onExitDown();
  };

  const moveItem = (dir: -1 | 1) =>
    void move(item.id, dir).then(() => setFocus({ id: item.id, caret: "end" }));

  const toggleAndKeepSlot = () => {
    // Item pindah seksi; fokus tetap di slot yang sama agar bisa lanjut mencentang.
    const target = nextId ?? prevId;
    toggle(item.id);
    if (target) setFocus({ id: target, caret: "end" });
    else onExitDown();
  };

  const onChange = (text: string) => {
    // `--` lalu spasi di item kosong menjadi garis pemisah, lalu lanjut ke item baru.
    if (!item.done && isDividerShortcut(text)) {
      setText(item.id, DIVIDER);
      void add(item.id);
      return;
    }
    setText(item.id, text);
  };

  const onDividerKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      removeAndFocusNeighbour();
    } else if (e.key === "Enter") {
      e.preventDefault();
      void add(item.id);
    } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      moveItem(e.key === "ArrowUp" ? -1 : 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (prevId) setFocus({ id: prevId, caret: "end" });
      else onExitUp();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (nextId) setFocus({ id: nextId, caret: "start" });
      else onExitDown();
    }
  };

  const onViewMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const anchor = (e.target as HTMLElement).closest("a");
    if (anchor) openLink(anchor.dataset.href ?? "");
    else startEditing(caretFromPoint(e));
  };

  const onReadOnlyMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    const anchor = (e.target as HTMLElement).closest("a");
    if (e.button === 0 && anchor) openLink(anchor.dataset.href ?? "");
  };

  const grip = !readOnly && (
    <button
      ref={setActivatorNodeRef}
      className="todo-grip"
      title="Seret untuk mengurutkan (Alt+↑/↓)"
      {...attributes}
      {...listeners}
      tabIndex={-1}
    >
      <IconGrip />
    </button>
  );
  const removeButton = !readOnly && (
    <button className="todo-remove" title="Hapus item" tabIndex={-1} onClick={() => remove(item.id)}>
      <IconClose size={12} />
    </button>
  );

  return (
    <li
      ref={setNodeRef}
      className={`todo-item ${divider ? "divider" : ""} ${item.done ? "done" : ""} ${isDragging ? "dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {grip}
      {divider ? (
        <div
          ref={dividerRef}
          className="todo-divider"
          role="separator"
          tabIndex={readOnly ? -1 : 0}
          title="Pemisah · Backspace untuk menghapus"
          onKeyDown={readOnly ? undefined : onDividerKeyDown}
        />
      ) : (
        <>
          <button
            className="todo-check"
            role="checkbox"
            aria-checked={item.done}
            aria-label={item.done ? "Batal centang" : "Centang"}
            title={item.done ? "Batal centang (Ctrl+Enter)" : "Centang (Ctrl+Enter)"}
            tabIndex={-1}
            disabled={readOnly}
            onClick={() => toggle(item.id)}
          >
            {item.done && <IconCheck />}
          </button>
          {editing ? (
            <TodoTextEditor
              text={item.text}
              caret={editCaret}
              onChange={onChange}
              onEnter={() => void add(item.id)}
              onToggle={toggleAndKeepSlot}
              onRemoveEmpty={removeAndFocusNeighbour}
              onMove={moveItem}
              onExit={(dir) => {
                if (dir === "up") {
                  if (prevId) setFocus({ id: prevId, caret: "end" });
                  else onExitUp();
                } else if (nextId) setFocus({ id: nextId, caret: "start" });
                else onExitDown();
              }}
              onOpenLink={openLink}
              onBlur={() => setEditCaret(null)}
            />
          ) : (
            <div
              className={`todo-text todo-view ${item.text ? "" : "empty"}`}
              tabIndex={readOnly ? -1 : 0}
              onMouseDown={readOnly ? onReadOnlyMouseDown : onViewMouseDown}
              onFocus={() => startEditing("end")}
            >
              {item.text ? renderSegments(segments) : "Item kosong"}
            </div>
          )}
        </>
      )}
      {removeButton}
    </li>
  );
}
