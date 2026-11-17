import { create } from "zustand";
import { cards, groups, links, type Card, type CardPatch, type CardType, type Group, type TodoProgress } from "../db";
import { positionBetween, positionMoveTo } from "../lib/order";
import { useSettings } from "./settings";

/** G-7: tampilan khusus Semua, Tanpa group, Trash, ditambah satu group. */
export type View = "all" | "ungrouped" | "group" | "trash";
export type TypeFilter = "all" | "note" | "todo";

/** Batas riwayat tombol Kembali (L-4). */
const HISTORY_MAX = 50;

export interface NewCardOptions {
  title?: string;
  /** Card asal dialog Hubungkan: card baru langsung terhubung dan masuk group yang sama. */
  linkTo?: string;
}

interface AppState {
  ready: boolean;
  error: string | null;
  view: View;
  /** Group yang dibuka saat `view === "group"`. */
  groupId: string | null;
  typeFilter: TypeFilter;
  /** Semua card aktif (tidak di Trash). Tampilan difilter lewat `visibleCards`. */
  list: Card[];
  /** Card di Trash. */
  trashed: Card[];
  groups: Group[];
  selectedId: string | null;
  /** L-4: card yang dibuka sebelumnya, terakhir di ujung. */
  history: string[];
  /** L-3: ID card yang terhubung ke card terbuka (tanpa card di Trash, L-6). */
  linkedIds: string[];
  linkDialogOpen: boolean;
  /** S-3: command palette pencarian `Ctrl+K`. */
  searchOpen: boolean;
  settingsOpen: boolean;
  /** Fokuskan judul setelah card baru dibuat. */
  focusTitleId: string | null;

  init(): Promise<void>;
  refresh(): Promise<void>;
  setView(v: View, groupId?: string | null): Promise<void>;
  setTypeFilter(f: TypeFilter): void;
  select(id: string | null): void;
  /** Buka card mana pun (misal dari panel Terhubung); pindah dari Trash ke Semua bila perlu. */
  openCard(id: string): void;
  /** Buka card dari hasil pencarian; pindah ke Semua jika card tidak tampil di daftar saat ini. */
  revealCard(id: string): void;
  /** L-4: kembali ke card sebelumnya (`Alt+Left`). */
  back(): void;
  createCard(type: CardType, opts?: NewCardOptions): Promise<void>;
  /** Simpan perubahan; daftar diperbarui tanpa reload penuh. */
  saveCard(id: string, patch: CardPatch): Promise<void>;
  /** Cerminkan perubahan item Todo ke daftar (progres T-5) tanpa query ulang dan tanpa mengubah urutan. */
  patchProgress(id: string, progress: TodoProgress, updatedAt: number): void;
  togglePin(id: string): Promise<void>;
  trashCard(id: string): Promise<void>;
  restoreCard(id: string): Promise<void>;
  destroyCard(id: string): Promise<void>;

  loadLinks(): Promise<void>;
  /** L-1: hubungkan satu atau beberapa card. */
  linkCards(fromId: string, ids: string[]): Promise<void>;
  /** L-5: putuskan link; hilang di kedua sisi. */
  unlinkCard(fromId: string, otherId: string): Promise<void>;
  setLinkDialogOpen(open: boolean): void;

  createGroup(name: string): Promise<Group | null>;
  renameGroup(id: string, name: string): Promise<void>;
  /** G-5: card di dalamnya tidak ikut terhapus. */
  deleteGroup(id: string): Promise<void>;
  /** G-1: urutkan group di sidebar. */
  moveGroup(id: string, toIndex: number): Promise<void>;
  addToGroup(cardId: string, groupId: string): Promise<void>;
  /** G-4 */
  removeFromGroup(cardId: string, groupId: string): Promise<void>;

  setSearchOpen(open: boolean): void;
  setSettingsOpen(open: boolean): void;
  consumeFocusTitle(): void;
}

const sortActive = (list: Card[]) =>
  [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);

type ViewState = Pick<AppState, "list" | "trashed" | "view" | "groupId" | "typeFilter">;

/** Card di tampilan aktif setelah filter tipe (G-6, G-7). */
export function visibleCards(s: ViewState): Card[] {
  let base: Card[];
  if (s.view === "trash") base = s.trashed;
  else if (s.view === "ungrouped") base = s.list.filter((c) => c.groupIds.length === 0);
  else if (s.view === "group") base = s.list.filter((c) => s.groupId !== null && c.groupIds.includes(s.groupId));
  else base = s.list;
  return s.typeFilter === "all" ? base : base.filter((c) => c.type === s.typeFilter);
}

/** Card terbuka: dari Trash saat tampilan Trash, selain itu dari card aktif. */
export const selectedCard = (s: Pick<AppState, "list" | "trashed" | "view" | "selectedId">): Card | null =>
  (s.view === "trash" ? s.trashed : s.list).find((c) => c.id === s.selectedId) ?? null;

export const useApp = create<AppState>((set, get) => {
  /** Ganti card terbuka tanpa menyentuh riwayat. */
  const show = (id: string | null) => {
    set({ selectedId: id, linkedIds: [] });
    if (get().view !== "trash") useSettings.getState().setLastCard(id);
    void get().loadLinks();
  };

  const reloadGroups = async () => set({ groups: await groups().list() });

  return {
    ready: false,
    error: null,
    view: "all",
    groupId: null,
    typeFilter: "all",
    list: [],
    trashed: [],
    groups: [],
    selectedId: null,
    history: [],
    linkedIds: [],
    linkDialogOpen: false,
    searchOpen: false,
    settingsOpen: false,
    focusTitleId: null,

    async init() {
      try {
        const purged = await cards().purgeTrash(30);
        if (purged) console.info(`Trash: ${purged} card lama dihapus permanen`);
        const [list, trashed, groupList] = await Promise.all([cards().list("active"), cards().list("trash"), groups().list()]);
        const { lastCardId: last, lastView } = useSettings.getState();
        // P-4: kembali ke tampilan dan card terakhir.
        const groupOk = lastView.view !== "group" || groupList.some((g) => g.id === lastView.groupId);
        const view: View = groupOk ? lastView.view : "all";
        const groupId = view === "group" ? lastView.groupId : null;
        const visible = visibleCards({ list, trashed, view, groupId, typeFilter: "all" });
        const selectedId = list.find((c) => c.id === last)?.id ?? visible[0]?.id ?? null;
        set({ list, trashed, groups: groupList, view, groupId, selectedId, ready: true });
        void get().loadLinks();
      } catch (e) {
        set({ error: String(e), ready: true });
      }
    },

    async refresh() {
      const [list, trashed] = await Promise.all([cards().list("active"), cards().list("trash")]);
      set({ list, trashed });
    },

    async setView(view, groupId = null) {
      set({ view, groupId: view === "group" ? groupId : null, typeFilter: "all" });
      if (view !== "trash") useSettings.getState().setLastView({ view, groupId: get().groupId });
      await get().refresh();
      const visible = visibleCards(get());
      const { selectedId } = get();
      // Tetap di card yang sama jika masih tampil di tampilan baru.
      if (selectedId && visible.some((c) => c.id === selectedId)) return;
      get().select(visible[0]?.id ?? null);
    },

    setTypeFilter(typeFilter) {
      set({ typeFilter });
    },

    select(id) {
      const { selectedId, history, view } = get();
      if (id === selectedId) return;
      if (selectedId && view !== "trash") set({ history: [...history, selectedId].slice(-HISTORY_MAX) });
      show(id);
    },

    openCard(id) {
      if (get().view === "trash") set({ view: "all", groupId: null, typeFilter: "all" });
      get().select(id);
    },

    revealCard(id) {
      if (!visibleCards(get()).some((c) => c.id === id)) {
        set({ view: "all", groupId: null, typeFilter: "all" });
        useSettings.getState().setLastView({ view: "all", groupId: null });
      }
      get().select(id);
    },

    back() {
      const { history, list, view } = get();
      if (view === "trash") return;
      const rest = [...history];
      while (rest.length) {
        const id = rest.pop()!;
        // Lewati card yang sudah di Trash atau dihapus.
        if (id !== get().selectedId && list.some((c) => c.id === id)) {
          set({ history: rest });
          show(id);
          return;
        }
      }
      set({ history: [] });
    },

    async createCard(type, opts = {}) {
      const { view, groupId, list } = get();
      const card = await cards().create(type, { title: opts.title });
      // C-2: card baru masuk group yang sedang dibuka. Dari dialog Hubungkan: ikut group card asal.
      const from = opts.linkTo ? list.find((c) => c.id === opts.linkTo) : undefined;
      const targetGroups = from ? from.groupIds : view === "group" && groupId ? [groupId] : [];
      for (const g of targetGroups) await groups().addCard(g, card.id);
      if (opts.linkTo) await links().link(opts.linkTo, card.id);

      if (view === "trash") set({ view: "all", groupId: null });
      else if (view === "ungrouped" && targetGroups.length > 0) set({ view: "all" });
      set({ typeFilter: "all" });
      await get().refresh();
      set({ focusTitleId: card.id });
      get().select(card.id);
    },

    async saveCard(id, patch) {
      const updated = await cards().update(id, patch);
      const list = get().list.map((c) => (c.id === id ? updated : c));
      // Edit isi/judul tidak memindahkan card di daftar; urutan S-1 diterapkan saat daftar dimuat ulang.
      // Pin tetap langsung mengubah posisi.
      set({ list: "pinned" in patch ? sortActive(list) : list });
    },

    patchProgress(id, progress, updatedAt) {
      const { list } = get();
      if (!list.some((c) => c.id === id)) return;
      set({ list: list.map((c) => (c.id === id ? { ...c, progress, updatedAt } : c)) });
    },

    async togglePin(id) {
      const card = get().list.find((c) => c.id === id);
      if (!card) return;
      await get().saveCard(id, { pinned: !card.pinned });
    },

    async trashCard(id) {
      const before = visibleCards(get());
      const idx = before.findIndex((c) => c.id === id);
      await cards().trash(id);
      await get().refresh();
      const next = visibleCards(get());
      set({ history: get().history.filter((h) => h !== id) });
      show(next[Math.max(0, Math.min(idx, next.length - 1))]?.id ?? null);
    },

    async restoreCard(id) {
      await cards().restore(id);
      await get().refresh();
      show(get().trashed[0]?.id ?? null);
    },

    async destroyCard(id) {
      await cards().destroy(id);
      await get().refresh();
      show(get().trashed[0]?.id ?? null);
    },

    async loadLinks() {
      const { selectedId: id, view } = get();
      if (!id || view === "trash") return set({ linkedIds: [] });
      const ids = await links().linkedIds(id);
      // Abaikan hasil jika card terbuka sudah berganti selama query berjalan.
      if (get().selectedId === id) set({ linkedIds: ids });
    },

    async linkCards(fromId, ids) {
      for (const id of ids) await links().link(fromId, id);
      await get().refresh();
      await get().loadLinks();
    },

    async unlinkCard(fromId, otherId) {
      await links().unlink(fromId, otherId);
      set({ linkedIds: get().linkedIds.filter((x) => x !== otherId) });
      await get().refresh();
      await get().loadLinks();
    },

    setLinkDialogOpen(linkDialogOpen) {
      set({ linkDialogOpen });
    },

    async createGroup(name) {
      const clean = name.trim();
      if (!clean) return null;
      const last = get().groups.at(-1)?.position ?? null;
      const placement = positionBetween(last, null);
      const position = typeof placement === "object" ? placement.position : (last ?? 0) + 1;
      const group = await groups().create(clean, position);
      await reloadGroups();
      return group;
    },

    async renameGroup(id, name) {
      const clean = name.trim();
      if (!clean) return;
      await groups().update(id, { name: clean });
      await reloadGroups();
    },

    async deleteGroup(id) {
      await groups().remove(id);
      await reloadGroups();
      if (get().view === "group" && get().groupId === id) await get().setView("all");
      else await get().refresh();
    },

    async moveGroup(id, toIndex) {
      const place = () => positionMoveTo(get().groups.map((g) => ({ ...g, done: false })), id, toIndex);
      let p = place();
      if (p === "crowded") {
        set({ groups: await groups().rebalance() });
        p = place();
      }
      if (typeof p !== "object") return;
      const { position } = p;
      // Optimistic: urutan sidebar langsung berubah.
      set({ groups: get().groups.map((g) => (g.id === id ? { ...g, position } : g)).sort((a, b) => a.position - b.position) });
      await groups().update(id, { position });
      await reloadGroups();
    },

    async addToGroup(cardId, groupId) {
      const card = get().list.find((c) => c.id === cardId);
      if (!card || card.groupIds.includes(groupId)) return;
      await groups().addCard(groupId, cardId);
      await get().refresh();
    },

    async removeFromGroup(cardId, groupId) {
      await groups().removeCard(groupId, cardId);
      await get().refresh();
    },

    setSearchOpen(searchOpen) {
      set({ searchOpen });
    },

    setSettingsOpen(settingsOpen) {
      set({ settingsOpen });
    },

    consumeFocusTitle() {
      set({ focusTitleId: null });
    },
  };
});
