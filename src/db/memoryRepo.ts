import { newId, now } from "../lib/util";
import type {
  Card,
  CardPatch,
  CardRepo,
  CardScope,
  CardType,
  NewTodoItem,
  TodoItem,
  TodoItemPatch,
  TodoRepo,
} from "./types";

/**
 * Repository cadangan untuk `npm run dev` di browser biasa (tanpa Tauri).
 * Disimpan di localStorage; hanya untuk mencoba UI, bukan untuk data sungguhan.
 */
const KEY = "notes-app:dev-cards";
const ITEMS_KEY = "notes-app:dev-todo-items";

/** Progres dihitung saat dibaca, tidak disimpan. */
type StoredCard = Omit<Card, "progress">;
type StoredItem = TodoItem & { deletedAt: number | null };

function load<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
  } catch {
    return [];
  }
}

function save(key: string, rows: unknown[]) {
  try {
    localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    /* abaikan */
  }
}

const SAMPLE_BODY = `Aplikasi ini dibuat dengan **Tauri** supaya ringan. Fokusnya *menulis tanpa gangguan*, dengan ==autosave== dan <u>config style</u>.

## Font pilihan

- Inter
- Atkinson Hyperlegible Next
- Literata

> Tulisan yang baik dimulai dari tempat menulis yang tenang.

\`\`\`ts
const style = { bodyFont: "inter", fontSize: 17 };
\`\`\`
`;

export interface MemoryRepos {
  cards: CardRepo;
  todos: TodoRepo;
}

export function createMemoryRepo(): MemoryRepos {
  let cards = load<StoredCard>(KEY);
  let items = load<StoredItem>(ITEMS_KEY);
  if (cards.length === 0) {
    const t = now();
    cards = [
      { id: newId(), type: "note", title: "Riset Font", body: SAMPLE_BODY, pinned: true, createdAt: t, updatedAt: t, trashedAt: null, deletedAt: null },
      { id: newId(), type: "note", title: "Rapat Senin", body: "Agenda: review sidebar, keputusan group tidak bersarang.", pinned: false, createdAt: t - 86_400_000, updatedAt: t - 86_400_000, trashedAt: null, deletedAt: null },
    ];
    save(KEY, cards);
  }

  const aliveItems = (cardId: string) =>
    items
      .filter((i) => i.cardId === cardId && i.deletedAt === null)
      .sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1));

  const withProgress = (c: StoredCard): Card => {
    if (c.type !== "todo") return { ...c, progress: null };
    const list = aliveItems(c.id);
    return { ...c, progress: { done: list.filter((i) => i.done).length, total: list.length } };
  };

  const alive = () => cards.filter((c) => c.deletedAt === null);
  const find = (id: string) => {
    const c = alive().find((x) => x.id === id);
    return c ? withProgress(c) : null;
  };
  const mutate = (id: string, fn: (c: StoredCard) => StoredCard) => {
    cards = cards.map((c) => (c.id === id ? fn(c) : c));
    save(KEY, cards);
  };
  const mutateItem = (id: string, fn: (i: StoredItem) => StoredItem) => {
    items = items.map((i) => (i.id === id ? fn(i) : i));
    save(ITEMS_KEY, items);
  };
  const toItem = ({ deletedAt: _, ...rest }: StoredItem): TodoItem => rest;
  const getItem = (id: string): TodoItem => {
    const i = items.find((x) => x.id === id && x.deletedAt === null);
    if (!i) throw new Error(`Item todo ${id} tidak ditemukan`);
    return toItem(i);
  };
  const touchCardOf = (itemId: string, t: number) => {
    const cardId = items.find((i) => i.id === itemId)?.cardId;
    if (cardId) mutate(cardId, (c) => ({ ...c, updatedAt: t }));
  };
  const destroy = (id: string) => {
    const t = now();
    mutate(id, (c) => ({ ...c, deletedAt: t, updatedAt: t, body: null, title: "" }));
    items = items.map((i) => (i.cardId === id && i.deletedAt === null ? { ...i, deletedAt: t, updatedAt: t } : i));
    save(ITEMS_KEY, items);
  };

  const cardRepo: CardRepo = {
    async list(scope: CardScope) {
      const list = alive().filter((c) => (scope === "trash" ? c.trashedAt !== null : c.trashedAt === null));
      const sorted =
        scope === "trash"
          ? list.sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0))
          : list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
      return sorted.map(withProgress);
    },
    async get(id) {
      return find(id);
    },
    async create(type: CardType) {
      const t = now();
      const c: StoredCard = { id: newId(), type, title: "", body: type === "note" ? "" : null, pinned: false, createdAt: t, updatedAt: t, trashedAt: null, deletedAt: null };
      cards = [c, ...cards];
      save(KEY, cards);
      return withProgress(c);
    },
    async update(id: string, patch: CardPatch) {
      mutate(id, (c) => ({ ...c, ...patch, updatedAt: now() }));
      return find(id)!;
    },
    async trash(id) {
      mutate(id, (c) => ({ ...c, trashedAt: now(), pinned: false, updatedAt: now() }));
    },
    async restore(id) {
      mutate(id, (c) => ({ ...c, trashedAt: null, updatedAt: now() }));
    },
    async destroy(id) {
      destroy(id);
    },
    async purgeTrash(days) {
      const cutoff = now() - days * 86_400_000;
      const old = alive().filter((c) => c.trashedAt !== null && c.trashedAt < cutoff);
      old.forEach((c) => destroy(c.id));
      return old.length;
    },
  };

  const todoRepo: TodoRepo = {
    async list(cardId) {
      return aliveItems(cardId).map(toItem);
    },
    async create(item: NewTodoItem) {
      const t = now();
      items = [...items, { ...item, done: false, doneAt: null, createdAt: t, updatedAt: t, deletedAt: null }];
      save(ITEMS_KEY, items);
      touchCardOf(item.id, t);
      return getItem(item.id);
    },
    async update(id: string, patch: TodoItemPatch) {
      const t = now();
      mutateItem(id, (i) => ({
        ...i,
        ...patch,
        ...(patch.done !== undefined ? { doneAt: patch.done ? t : null } : {}),
        updatedAt: t,
      }));
      touchCardOf(id, t);
      return getItem(id);
    },
    async remove(id) {
      const t = now();
      mutateItem(id, (i) => (i.deletedAt === null ? { ...i, deletedAt: t, updatedAt: t } : i));
      touchCardOf(id, t);
    },
    async rebalance(cardId) {
      const t = now();
      const order = new Map(aliveItems(cardId).map((i, n) => [i.id, n + 1]));
      items = items.map((i) => (order.has(i.id) ? { ...i, position: order.get(i.id)!, updatedAt: t } : i));
      save(ITEMS_KEY, items);
      return aliveItems(cardId).map(toItem);
    },
  };

  return { cards: cardRepo, todos: todoRepo };
}
