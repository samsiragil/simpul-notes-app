import { create } from "zustand";
import { applyStyle, DEFAULT_STYLE, type StyleConfig } from "../config/style";
import type { DoneMode } from "../lib/order";
import { isTauri } from "../lib/util";

/** Disimpan di settings.json (Tauri) atau localStorage (browser). Tidak ikut sync. */
export interface Settings {
  style: StyleConfig;
  sidebarOpen: boolean;
  listOpen: boolean;
  lastCardId: string | null;
  /** T-6: item selesai pindah ke bawah atau disembunyikan. */
  todoDoneMode: DoneMode;
  /** P-3: sembunyikan sidebar dan daftar tanpa mengubah `sidebarOpen` / `listOpen`. */
  focusMode: boolean;
  /** P-4: lebar daftar card (px). */
  listWidth: number;
  /** P-4: tampilan terakhir (Semua, Tanpa group, atau satu group). */
  lastView: LastView;
}

export interface LastView {
  view: "all" | "ungrouped" | "group";
  groupId: string | null;
}

export const LIST_WIDTH = { min: 240, max: 480, default: 300 } as const;

export const clampListWidth = (w: number) =>
  Math.round(Math.min(LIST_WIDTH.max, Math.max(LIST_WIDTH.min, Number.isFinite(w) ? w : LIST_WIDTH.default)));

const DEFAULTS: Settings = {
  style: DEFAULT_STYLE,
  sidebarOpen: true,
  listOpen: true,
  lastCardId: null,
  todoDoneMode: "bottom",
  focusMode: false,
  listWidth: LIST_WIDTH.default,
  lastView: { view: "all", groupId: null },
};

const KEYS = Object.keys(DEFAULTS) as (keyof Settings)[];

interface Backend {
  get(): Promise<Partial<Settings>>;
  set(s: Settings): Promise<void>;
}

async function createBackend(): Promise<Backend> {
  if (isTauri()) {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load("settings.json", { autoSave: 300, defaults: {} });
    return {
      async get() {
        return (await store.get<Partial<Settings>>("settings")) ?? {};
      },
      async set(s) {
        await store.set("settings", s);
      },
    };
  }
  const KEY = "notes-app:settings";
  return {
    async get() {
      try {
        return JSON.parse(localStorage.getItem(KEY) ?? "{}");
      } catch {
        return {};
      }
    },
    async set(s) {
      try {
        localStorage.setItem(KEY, JSON.stringify(s));
      } catch {
        /* abaikan */
      }
    },
  };
}

let backend: Backend | null = null;

interface SettingsState extends Settings {
  loaded: boolean;
  init(): Promise<void>;
  setStyle(patch: Partial<StyleConfig>): void;
  resetStyle(): void;
  toggleSidebar(): void;
  toggleList(): void;
  setLastCard(id: string | null): void;
  setTodoDoneMode(mode: DoneMode): void;
  toggleFocus(): void;
  setListWidth(px: number, persist?: boolean): void;
  setLastView(v: LastView): void;
}

export const useSettings = create<SettingsState>((set, get) => {
  const persist = () => {
    const s = get();
    void backend?.set(Object.fromEntries(KEYS.map((k) => [k, s[k]])) as unknown as Settings);
  };

  return {
    ...DEFAULTS,
    loaded: false,

    async init() {
      backend = await createBackend();
      const saved = await backend.get();
      const style = { ...DEFAULT_STYLE, ...(saved.style ?? {}) };
      applyStyle(style);
      set({ ...DEFAULTS, ...saved, style, listWidth: clampListWidth(saved.listWidth ?? LIST_WIDTH.default), loaded: true });
    },

    setStyle(patch) {
      const style = { ...get().style, ...patch };
      applyStyle(style);
      set({ style });
      persist();
    },

    resetStyle() {
      applyStyle(DEFAULT_STYLE);
      set({ style: DEFAULT_STYLE });
      persist();
    },

    // Saat mode fokus, menampilkan sidebar/daftar berarti keluar dari mode fokus.
    toggleSidebar() {
      const { focusMode, sidebarOpen } = get();
      set(focusMode ? { focusMode: false, sidebarOpen: true } : { sidebarOpen: !sidebarOpen });
      persist();
    },

    toggleList() {
      const { focusMode, listOpen } = get();
      set(focusMode ? { focusMode: false, listOpen: true } : { listOpen: !listOpen });
      persist();
    },

    toggleFocus() {
      set({ focusMode: !get().focusMode });
      persist();
    },

    setListWidth(px, save = true) {
      set({ listWidth: clampListWidth(px) });
      if (save) persist();
    },

    setLastView(lastView) {
      const cur = get().lastView;
      if (cur.view === lastView.view && cur.groupId === lastView.groupId) return;
      set({ lastView });
      persist();
    },

    setLastCard(id) {
      if (get().lastCardId === id) return;
      set({ lastCardId: id });
      persist();
    },

    setTodoDoneMode(todoDoneMode) {
      set({ todoDoneMode });
      persist();
    },
  };
});
