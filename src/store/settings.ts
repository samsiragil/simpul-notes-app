import { create } from "zustand";
import { applyStyle, DEFAULT_STYLE, type StyleConfig } from "../config/style";
import { isTauri } from "../lib/util";

/** Disimpan di settings.json (Tauri) atau localStorage (browser). Tidak ikut sync. */
export interface Settings {
  style: StyleConfig;
  sidebarOpen: boolean;
  listOpen: boolean;
  lastCardId: string | null;
}

const DEFAULTS: Settings = {
  style: DEFAULT_STYLE,
  sidebarOpen: true,
  listOpen: true,
  lastCardId: null,
};

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
}

export const useSettings = create<SettingsState>((set, get) => {
  const persist = () => {
    const { style, sidebarOpen, listOpen, lastCardId } = get();
    void backend?.set({ style, sidebarOpen, listOpen, lastCardId });
  };

  return {
    ...DEFAULTS,
    loaded: false,

    async init() {
      backend = await createBackend();
      const saved = await backend.get();
      const style = { ...DEFAULT_STYLE, ...(saved.style ?? {}) };
      applyStyle(style);
      set({ ...DEFAULTS, ...saved, style, loaded: true });
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

    toggleSidebar() {
      set({ sidebarOpen: !get().sidebarOpen });
      persist();
    },

    toggleList() {
      set({ listOpen: !get().listOpen });
      persist();
    },

    setLastCard(id) {
      if (get().lastCardId === id) return;
      set({ lastCardId: id });
      persist();
    },
  };
});
