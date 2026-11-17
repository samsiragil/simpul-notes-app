import { create } from "zustand";
import { todos, type TodoItem, type TodoProgress } from "../db";
import { positionAfter, positionMoveBy, positionMoveTo, type Placement } from "../lib/order";
import { debounce, newId, now } from "../lib/util";
import { useApp } from "./app";

/** Sama dengan autosave Note (C-7). */
export const TEXT_SAVE_MS = 800;

/** Item yang perlu difokuskan setelah render berikutnya. */
export interface TodoFocus {
  id: string;
  caret: "start" | "end";
}

interface TodoState {
  /** Todo Card yang sedang dibuka; store hanya memegang satu card. */
  cardId: string | null;
  /** Item yang belum dihapus, tanpa urutan tertentu (pakai `displayOrder` untuk tampil). */
  items: TodoItem[];
  loading: boolean;
  focus: TodoFocus | null;
  /** Mode `hide` (T-6): tampilkan sementara item selesai. Direset saat pindah card. */
  showDone: boolean;

  load(cardId: string): Promise<void>;
  /** T-1: tambah item setelah `afterId` (atau di akhir), lalu fokus ke item baru. */
  add(afterId: string | null, text?: string): Promise<string | null>;
  /** T-3: edit teks; disimpan dengan debounce. */
  setText(id: string, text: string): void;
  /** T-2 */
  toggle(id: string): void;
  /** T-3: soft delete. */
  remove(id: string): void;
  /** T-4: `Alt+Up/Down`. */
  move(id: string, dir: -1 | 1): Promise<void>;
  /** T-4: drag-and-drop ke indeks di dalam seksi item. */
  moveTo(id: string, toIndex: number): Promise<void>;
  setShowDone(show: boolean): void;
  setFocus(focus: TodoFocus | null): void;
  /** Tulis teks yang tertunda lalu tunggu semua penulisan selesai (pindah card / tutup). */
  flush(): Promise<void>;
}

export const progressOf = (items: readonly TodoItem[]): TodoProgress => ({
  done: items.filter((i) => i.done).length,
  total: items.length,
});

export const useTodo = create<TodoState>((set, get) => {
  /**
   * Semua penulisan ke repo dijalankan berurutan, sehingga misalnya `update` tidak pernah
   * mendahului `create` item yang sama. Jika gagal, state diselaraskan ulang dari repo.
   */
  let queue: Promise<void> = Promise.resolve();
  const write = (fn: () => Promise<unknown>): Promise<void> => {
    queue = queue.then(fn).then(
      () => undefined,
      (e) => {
        console.error("Gagal menyimpan item todo", e);
        return resync();
      },
    );
    return queue;
  };

  let loadSeq = 0;

  const report = (cardId: string, items: readonly TodoItem[]) =>
    useApp.getState().patchProgress(cardId, progressOf(items), now());

  const patchItem = (id: string, patch: Partial<TodoItem>) =>
    set({ items: get().items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });

  async function resync() {
    const cardId = get().cardId;
    if (!cardId) return;
    try {
      const items = await todos().list(cardId);
      if (get().cardId !== cardId) return;
      set({ items });
      report(cardId, items);
    } catch (e) {
      console.error("Gagal memuat ulang item todo", e);
    }
  }

  // Teks per item yang belum ditulis; digabung lalu disimpan setelah berhenti mengetik.
  const pendingText = new Map<string, string>();
  const saveText = debounce(() => {
    const cardId = get().cardId;
    if (!cardId || pendingText.size === 0) return;
    const entries = [...pendingText];
    pendingText.clear();
    void write(async () => {
      for (const [id, text] of entries) await todos().update(id, { text });
    });
    report(cardId, get().items);
  }, TEXT_SAVE_MS);

  async function rebalance() {
    const cardId = get().cardId;
    if (!cardId) return;
    saveText.flush();
    await write(async () => {
      const fresh = await todos().rebalance(cardId);
      if (get().cardId === cardId) set({ items: fresh });
    });
  }

  /** Hitung posisi; jika terlalu rapat, rebalance dulu lalu hitung ulang sekali. */
  async function placement(compute: () => Placement): Promise<number | null> {
    let p = compute();
    if (p === "crowded") {
      await rebalance();
      p = compute();
    }
    return typeof p === "string" ? null : p.position;
  }

  async function reposition(id: string, compute: () => Placement) {
    const cardId = get().cardId;
    const position = await placement(compute);
    if (position === null || !cardId || get().cardId !== cardId) return;
    patchItem(id, { position });
    void write(() => todos().update(id, { position }));
    report(cardId, get().items);
  }

  return {
    cardId: null,
    items: [],
    loading: false,
    focus: null,
    showDone: false,

    async load(cardId) {
      saveText.flush();
      const seq = ++loadSeq;
      set({ cardId, items: [], loading: true, focus: null, showDone: false });
      // Tunggu penulisan sebelumnya agar data yang dibaca sudah terbaru.
      await queue;
      try {
        const items = await todos().list(cardId);
        if (seq === loadSeq) set({ items, loading: false });
      } catch (e) {
        console.error("Gagal memuat item todo", e);
        if (seq === loadSeq) set({ loading: false });
      }
    },

    async add(afterId, text = "") {
      const cardId = get().cardId;
      if (!cardId) return null;
      const position = await placement(() => positionAfter(get().items, afterId));
      if (position === null || get().cardId !== cardId) return null;
      const t = now();
      const item: TodoItem = { id: newId(), cardId, text, done: false, position, doneAt: null, createdAt: t, updatedAt: t };
      set({ items: [...get().items, item], focus: { id: item.id, caret: "end" } });
      void write(() => todos().create({ id: item.id, cardId, text, position }));
      report(cardId, get().items);
      return item.id;
    },

    setText(id, text) {
      patchItem(id, { text });
      pendingText.set(id, text);
      saveText();
    },

    toggle(id) {
      const cardId = get().cardId;
      const item = get().items.find((i) => i.id === id);
      if (!cardId || !item) return;
      const done = !item.done;
      patchItem(id, { done, doneAt: done ? now() : null });
      void write(() => todos().update(id, { done }));
      report(cardId, get().items);
    },

    remove(id) {
      const cardId = get().cardId;
      if (!cardId || !get().items.some((i) => i.id === id)) return;
      pendingText.delete(id);
      set({ items: get().items.filter((i) => i.id !== id) });
      void write(() => todos().remove(id));
      report(cardId, get().items);
    },

    move(id, dir) {
      return reposition(id, () => positionMoveBy(get().items, id, dir));
    },

    moveTo(id, toIndex) {
      return reposition(id, () => positionMoveTo(get().items, id, toIndex));
    },

    setShowDone(showDone) {
      set({ showDone });
    },

    setFocus(focus) {
      set({ focus });
    },

    async flush() {
      saveText.flush();
      await queue;
    },
  };
});
