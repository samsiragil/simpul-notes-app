import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import type { TodoItem } from "../db";
import { splitByDone } from "../lib/order";
import { useSettings } from "../store/settings";
import { useTodo } from "../store/todo";
import { IconPlus } from "./Icons";
import { TodoItemRow } from "./TodoItemRow";

/** Fokus ke item pertama, atau ke input "Tambah item" jika belum ada item (dipakai dari judul). */
export function focusFirstTodo() {
  const el = document.querySelector<HTMLElement>(".pane .todo-text:not([readonly])") ?? document.querySelector<HTMLElement>(".pane .todo-add-input");
  el?.focus();
}

const focusTitle = () => document.querySelector<HTMLElement>(".pane .title-input")?.focus();

/** Isi Todo Card: daftar item, input tambah, dan seksi item selesai (T-1 sampai T-6). */
export function TodoList({ cardId, readOnly }: { cardId: string; readOnly: boolean }) {
  const storeCardId = useTodo((s) => s.cardId);
  const items = useTodo((s) => s.items);
  const loading = useTodo((s) => s.loading);
  const showDone = useTodo((s) => s.showDone);
  const load = useTodo((s) => s.load);
  const flush = useTodo((s) => s.flush);
  const moveTo = useTodo((s) => s.moveTo);
  const setShowDone = useTodo((s) => s.setShowDone);
  const setFocus = useTodo((s) => s.setFocus);
  const mode = useSettings((s) => s.todoDoneMode);

  const addRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void load(cardId);
    const onHide = () => void flush();
    window.addEventListener("beforeunload", onHide);
    return () => {
      window.removeEventListener("beforeunload", onHide);
      void flush();
    };
  }, [cardId, load, flush]);

  const { open, done } = useMemo(() => splitByDone(items), [items]);
  const doneVisible = mode === "bottom" || showDone;
  const visible = doneVisible ? [...open, ...done] : open;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const section = open.some((i) => i.id === active.id) ? open : done;
    const toIndex = section.findIndex((i) => i.id === over.id);
    // Item hanya bisa dipindah di dalam seksinya sendiri.
    if (toIndex !== -1) void moveTo(String(active.id), toIndex);
  };

  // Hindari menampilkan item card sebelumnya selama satu frame sebelum load berjalan.
  if (storeCardId !== cardId || loading) return <div className="todo-list" />;

  const lastVisibleId = visible.at(-1)?.id ?? null;
  const focusAdd = () => (readOnly ? undefined : addRef.current?.focus());

  const rows = (list: TodoItem[]) =>
    list.map((item) => {
      const idx = visible.findIndex((v) => v.id === item.id);
      return (
        <TodoItemRow
          key={item.id}
          item={item}
          readOnly={readOnly}
          prevId={visible[idx - 1]?.id ?? null}
          nextId={visible[idx + 1]?.id ?? null}
          onExitUp={focusTitle}
          onExitDown={focusAdd}
        />
      );
    });

  return (
    <div className="todo-list">
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
        <SortableContext items={open.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ul className="todo-items">{rows(open)}</ul>
        </SortableContext>

        {!readOnly && (
          <AddItem
            inputRef={addRef}
            onExitUp={() => {
              const target = open.at(-1)?.id ?? lastVisibleId;
              if (target) setFocus({ id: target, caret: "end" });
              else focusTitle();
            }}
          />
        )}

        {readOnly && items.length === 0 && <p className="todo-empty">Belum ada item.</p>}

        {done.length > 0 && mode === "bottom" && <div className="todo-section">Selesai · {done.length}</div>}
        {done.length > 0 && mode === "hide" && (
          <button className="todo-section toggle" onClick={() => setShowDone(!showDone)}>
            {showDone ? `Sembunyikan ${done.length} item selesai` : `${done.length} item selesai disembunyikan · Tampilkan`}
          </button>
        )}
        {doneVisible && (
          <SortableContext items={done.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="todo-items">{rows(done)}</ul>
          </SortableContext>
        )}
      </DndContext>
    </div>
  );
}

/** Input di bawah daftar: `Enter` menambah item di akhir dan kursor tetap di sini (T-1). */
function AddItem({ inputRef, onExitUp }: { inputRef: RefObject<HTMLInputElement | null>; onExitUp(): void }) {
  const add = useTodo((s) => s.add);
  const [text, setText] = useState("");

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = text.trim();
      if (!value) return;
      setText("");
      void add(null, value, false);
    } else if (e.key === "ArrowUp" || (e.key === "Backspace" && text === "")) {
      e.preventDefault();
      onExitUp();
    }
  };

  return (
    <label className="todo-add">
      <span className="todo-add-icon">
        <IconPlus size={12} />
      </span>
      <input
        ref={inputRef}
        className="todo-add-input"
        value={text}
        placeholder="Tambah item…"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
      />
    </label>
  );
}
