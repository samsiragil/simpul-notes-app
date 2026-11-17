import { create } from "zustand";
import { cards, type Card, type CardPatch, type CardType, type TodoProgress } from "../db";
import { useSettings } from "./settings";

export type View = "all" | "trash";
export type TypeFilter = "all" | "note" | "todo";

interface AppState {
  ready: boolean;
  error: string | null;
  view: View;
  typeFilter: TypeFilter;
  list: Card[];
  selectedId: string | null;
  settingsOpen: boolean;
  /** Fokuskan judul setelah card baru dibuat. */
  focusTitleId: string | null;

  init(): Promise<void>;
  refresh(): Promise<void>;
  setView(v: View): Promise<void>;
  setTypeFilter(f: TypeFilter): void;
  select(id: string | null): void;
  createCard(type: CardType): Promise<void>;
  /** Simpan perubahan; daftar diperbarui tanpa reload penuh. */
  saveCard(id: string, patch: CardPatch): Promise<void>;
  /** Cerminkan perubahan item Todo ke daftar (progres T-5 dan urutan S-1) tanpa query ulang. */
  patchProgress(id: string, progress: TodoProgress, updatedAt: number): void;
  togglePin(id: string): Promise<void>;
  trashCard(id: string): Promise<void>;
  restoreCard(id: string): Promise<void>;
  destroyCard(id: string): Promise<void>;
  setSettingsOpen(open: boolean): void;
  consumeFocusTitle(): void;
}

const sortActive = (list: Card[]) =>
  [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  error: null,
  view: "all",
  typeFilter: "all",
  list: [],
  selectedId: null,
  settingsOpen: false,
  focusTitleId: null,

  async init() {
    try {
      const purged = await cards().purgeTrash(30);
      if (purged) console.info(`Trash: ${purged} card lama dihapus permanen`);
      const list = await cards().list("active");
      const last = useSettings.getState().lastCardId;
      const selectedId = list.find((c) => c.id === last)?.id ?? list[0]?.id ?? null;
      set({ list, selectedId, ready: true });
    } catch (e) {
      set({ error: String(e), ready: true });
    }
  },

  async refresh() {
    const list = await cards().list(get().view === "trash" ? "trash" : "active");
    set({ list });
  },

  async setView(view) {
    set({ view, typeFilter: "all" });
    await get().refresh();
    set({ selectedId: get().list[0]?.id ?? null });
  },

  setTypeFilter(typeFilter) {
    set({ typeFilter });
  },

  select(id) {
    set({ selectedId: id });
    if (get().view === "all") useSettings.getState().setLastCard(id);
  },

  async createCard(type) {
    const card = await cards().create(type);
    if (get().view !== "all") set({ view: "all" });
    set({ typeFilter: "all" });
    await get().refresh();
    set({ focusTitleId: card.id });
    get().select(card.id);
  },

  async saveCard(id, patch) {
    const updated = await cards().update(id, patch);
    const list = get().list.map((c) => (c.id === id ? updated : c));
    set({ list: get().view === "trash" ? list : sortActive(list) });
  },

  patchProgress(id, progress, updatedAt) {
    const { list, view } = get();
    if (!list.some((c) => c.id === id)) return;
    const next = list.map((c) => (c.id === id ? { ...c, progress, updatedAt } : c));
    set({ list: view === "trash" ? next : sortActive(next) });
  },

  async togglePin(id) {
    const card = get().list.find((c) => c.id === id);
    if (!card) return;
    await get().saveCard(id, { pinned: !card.pinned });
  },

  async trashCard(id) {
    const { list } = get();
    const idx = list.findIndex((c) => c.id === id);
    await cards().trash(id);
    await get().refresh();
    const next = get().list;
    get().select(next[Math.min(idx, next.length - 1)]?.id ?? null);
  },

  async restoreCard(id) {
    await cards().restore(id);
    await get().refresh();
    set({ selectedId: get().list[0]?.id ?? null });
  },

  async destroyCard(id) {
    await cards().destroy(id);
    await get().refresh();
    set({ selectedId: get().list[0]?.id ?? null });
  },

  setSettingsOpen(settingsOpen) {
    set({ settingsOpen });
  },

  consumeFocusTitle() {
    set({ focusTitleId: null });
  },
}));

export const visibleCards = (s: Pick<AppState, "list" | "typeFilter">) =>
  s.typeFilter === "all" ? s.list : s.list.filter((c) => c.type === s.typeFilter);
