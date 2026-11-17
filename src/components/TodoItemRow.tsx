import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from "react";
import type { TodoItem } from "../db";
import { useTodo } from "../store/todo";
import { IconCheck, IconClose, IconGrip } from "./Icons";

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

/** Satu baris item Todo (T-2, T-3, T-4). */
export function TodoItemRow({ item, readOnly, prevId, nextId, onExitUp, onExitDown }: Props) {
  const add = useTodo((s) => s.add);
  const setText = useTodo((s) => s.setText);
  const toggle = useTodo((s) => s.toggle);
  const remove = useTodo((s) => s.remove);
  const move = useTodo((s) => s.move);
  const focus = useTodo((s) => s.focus);
  const setFocus = useTodo((s) => s.setFocus);

  const ref = useRef<HTMLTextAreaElement>(null);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: readOnly,
  });

  // Tinggi mengikuti isi (teks boleh membungkus, tanpa baris baru).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [item.text]);

  useEffect(() => {
    if (focus?.id !== item.id) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    const at = focus.caret === "start" ? 0 : el.value.length;
    el.setSelectionRange(at, at);
    setFocus(null);
  }, [focus, item.id, setFocus]);

  const removeAndFocusNeighbour = () => {
    const target = prevId ?? nextId;
    remove(item.id);
    if (target) setFocus({ id: target, caret: prevId ? "end" : "start" });
    else onExitDown();
  };

  /** Panah pindah item hanya jika kursor sudah di tepi teks atau item satu baris. */
  const atEdge = (el: HTMLTextAreaElement, dir: "up" | "down") => {
    if (el.selectionStart !== el.selectionEnd) return false;
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 24;
    if (el.scrollHeight < lineHeight * 1.5) return true;
    return dir === "up" ? el.selectionStart === 0 : el.selectionEnd === el.value.length;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      // Item pindah seksi; fokus tetap di slot yang sama agar bisa lanjut mencentang.
      const target = nextId ?? prevId;
      toggle(item.id);
      if (target) setFocus({ id: target, caret: "end" });
      else onExitDown();
    } else if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      void add(item.id);
    } else if (e.key === "Backspace" && el.value === "") {
      e.preventDefault();
      removeAndFocusNeighbour();
    } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      void move(item.id, e.key === "ArrowUp" ? -1 : 1).then(() => setFocus({ id: item.id, caret: "end" }));
    } else if (e.key === "ArrowUp" && !e.shiftKey && atEdge(el, "up")) {
      e.preventDefault();
      if (prevId) setFocus({ id: prevId, caret: "end" });
      else onExitUp();
    } else if (e.key === "ArrowDown" && !e.shiftKey && atEdge(el, "down")) {
      e.preventDefault();
      if (nextId) setFocus({ id: nextId, caret: "start" });
      else onExitDown();
    }
  };

  return (
    <li
      ref={setNodeRef}
      className={`todo-item ${item.done ? "done" : ""} ${isDragging ? "dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {!readOnly && (
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
      )}
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
      <textarea
        ref={ref}
        className="todo-text"
        rows={1}
        value={item.text}
        readOnly={readOnly}
        placeholder="Item kosong"
        onChange={(e) => setText(item.id, e.target.value.replace(/\n/g, " "))}
        onKeyDown={readOnly ? undefined : onKeyDown}
      />
      {!readOnly && (
        <button className="todo-remove" title="Hapus item" tabIndex={-1} onClick={() => remove(item.id)}>
          <IconClose size={12} />
        </button>
      )}
    </li>
  );
}
