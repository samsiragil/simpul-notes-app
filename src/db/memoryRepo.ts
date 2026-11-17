import { markHits, markSnippet, matchesAll, searchTerms } from "../lib/search";
import { markdownToText, newId, now } from "../lib/util";
import type { Repos } from "./index";
import {
  linkPair,
  type Card,
  type CardPatch,
  type CardRepo,
  type CardScope,
  type CardType,
  type DataRepo,
  type Group,
  type GroupRepo,
  type LinkRepo,
  type NewCard,
  type NewTodoItem,
  type SearchRepo,
  type TodoItem,
  type TodoItemPatch,
  type TodoRepo,
} from "./types";

/**
 * Repository cadangan untuk `npm run dev` di browser biasa (tanpa Tauri).
 * Disimpan di localStorage; hanya untuk mencoba UI, bukan untuk data sungguhan.
 */
const KEY = "notes-app:dev-cards";
const ITEMS_KEY = "notes-app:dev-todo-items";
const LINKS_KEY = "notes-app:dev-links";
const GROUPS_KEY = "notes-app:dev-groups";
const MEMBERS_KEY = "notes-app:dev-group-members";

/** Progres, jumlah link, dan group dihitung saat dibaca, tidak disimpan. */
type StoredCard = Omit<Card, "progress" | "linkCount" | "groupIds">;
type StoredItem = TodoItem & { deletedAt: number | null };
interface StoredLink {
  cardA: string;
  cardB: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}
type StoredGroup = Group & { deletedAt: number | null };
interface StoredMember {
  groupId: string;
  cardId: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

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

export function createMemoryRepo(): Repos {
  let cards = load<StoredCard>(KEY);
  let items = load<StoredItem>(ITEMS_KEY);
  let links = load<StoredLink>(LINKS_KEY);
  let groups = load<StoredGroup>(GROUPS_KEY);
  let members = load<StoredMember>(MEMBERS_KEY);

  if (cards.length === 0) {
    const t = now();
    const riset = newId();
    const todoId = newId();
    const rapat = newId();
    cards = [
      { id: riset, type: "note", title: "Riset Font", body: SAMPLE_BODY, pinned: true, createdAt: t, updatedAt: t, trashedAt: null, deletedAt: null },
      { id: todoId, type: "todo", title: "Belanja Bulanan", body: null, pinned: false, createdAt: t - 3_600_000, updatedAt: t - 3_600_000, trashedAt: null, deletedAt: null },
      { id: rapat, type: "note", title: "Rapat Senin", body: "Agenda: review sidebar, keputusan group tidak bersarang.", pinned: false, createdAt: t - 86_400_000, updatedAt: t - 86_400_000, trashedAt: null, deletedAt: null },
    ];
    items = ["Beras 5 kg", "Minyak goreng", "Sabun cuci", "Kopi"].map((text, n) => ({
      id: newId(),
      cardId: todoId,
      text,
      done: n === 1,
      position: n + 1,
      doneAt: n === 1 ? t - 3_600_000 : null,
      createdAt: t - 3_600_000,
      updatedAt: t - 3_600_000,
      deletedAt: null,
    }));
    const [a, b] = linkPair(riset, rapat);
    links = [{ cardA: a, cardB: b, createdAt: t, updatedAt: t, deletedAt: null }];
    const proyek = newId();
    groups = [{ id: proyek, name: "Proyek Notes App", position: 1, createdAt: t, updatedAt: t, deletedAt: null }];
    members = [riset, rapat].map((cardId) => ({ groupId: proyek, cardId, createdAt: t, updatedAt: t, deletedAt: null }));
    save(KEY, cards);
    save(ITEMS_KEY, items);
    save(LINKS_KEY, links);
    save(GROUPS_KEY, groups);
    save(MEMBERS_KEY, members);
  }

  const aliveItems = (cardId: string) =>
    items
      .filter((i) => i.cardId === cardId && i.deletedAt === null)
      .sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1));

  const alive = () => cards.filter((c) => c.deletedAt === null);
  const isActive = (id: string) => cards.some((c) => c.id === id && c.deletedAt === null && c.trashedAt === null);
  const aliveGroups = () =>
    groups.filter((g) => g.deletedAt === null).sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1));

  const linkedIds = (cardId: string) =>
    links
      .filter((l) => l.deletedAt === null && (l.cardA === cardId || l.cardB === cardId))
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .map((l) => (l.cardA === cardId ? l.cardB : l.cardA))
      .filter(isActive);

  const groupIdsOf = (cardId: string) => {
    const live = new Set(aliveGroups().map((g) => g.id));
    return members.filter((m) => m.cardId === cardId && m.deletedAt === null && live.has(m.groupId)).map((m) => m.groupId);
  };

  const enrich = (c: StoredCard): Card => {
    const extra = { linkCount: linkedIds(c.id).length, groupIds: groupIdsOf(c.id) };
    if (c.type !== "todo") return { ...c, ...extra, progress: null };
    const list = aliveItems(c.id);
    return { ...c, ...extra, progress: { done: list.filter((i) => i.done).length, total: list.length } };
  };

  const find = (id: string) => {
    const c = alive().find((x) => x.id === id);
    return c ? enrich(c) : null;
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
  const toGroup = ({ deletedAt: _, ...rest }: StoredGroup): Group => rest;
  const getItem = (id: string): TodoItem => {
    const i = items.find((x) => x.id === id && x.deletedAt === null);
    if (!i) throw new Error(`Item todo ${id} tidak ditemukan`);
    return toItem(i);
  };
  const getGroup = (id: string): Group => {
    const g = groups.find((x) => x.id === id && x.deletedAt === null);
    if (!g) throw new Error(`Group ${id} tidak ditemukan`);
    return toGroup(g);
  };
  const touchCardOf = (itemId: string, t: number) => {
    const cardId = items.find((i) => i.id === itemId)?.cardId;
    if (cardId) mutate(cardId, (c) => ({ ...c, updatedAt: t }));
  };
  const destroy = (id: string) => {
    const t = now();
    mutate(id, (c) => ({ ...c, deletedAt: t, updatedAt: t, body: null, title: "" }));
    items = items.map((i) => (i.cardId === id && i.deletedAt === null ? { ...i, deletedAt: t, updatedAt: t } : i));
    links = links.map((l) => ((l.cardA === id || l.cardB === id) && l.deletedAt === null ? { ...l, deletedAt: t, updatedAt: t } : l));
    members = members.map((m) => (m.cardId === id && m.deletedAt === null ? { ...m, deletedAt: t, updatedAt: t } : m));
    save(ITEMS_KEY, items);
    save(LINKS_KEY, links);
    save(MEMBERS_KEY, members);
  };

  const cardRepo: CardRepo = {
    async list(scope: CardScope) {
      const list = alive().filter((c) => (scope === "trash" ? c.trashedAt !== null : c.trashedAt === null));
      const sorted =
        scope === "trash"
          ? list.sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0))
          : list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
      return sorted.map(enrich);
    },
    async get(id) {
      return find(id);
    },
    async create(type: CardType, init: NewCard = {}) {
      const t = now();
      const c: StoredCard = { id: newId(), type, title: init.title ?? "", body: type === "note" ? "" : null, pinned: false, createdAt: t, updatedAt: t, trashedAt: null, deletedAt: null };
      cards = [c, ...cards];
      save(KEY, cards);
      return enrich(c);
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

  const linkRepo: LinkRepo = {
    async linkedIds(cardId) {
      return linkedIds(cardId);
    },
    async link(a, b) {
      if (a === b) return;
      const [x, y] = linkPair(a, b);
      const t = now();
      const existing = links.find((l) => l.cardA === x && l.cardB === y);
      if (!existing) links = [...links, { cardA: x, cardB: y, createdAt: t, updatedAt: t, deletedAt: null }];
      else if (existing.deletedAt !== null) links = links.map((l) => (l === existing ? { ...l, deletedAt: null, updatedAt: t } : l));
      save(LINKS_KEY, links);
    },
    async unlink(a, b) {
      const [x, y] = linkPair(a, b);
      const t = now();
      links = links.map((l) => (l.cardA === x && l.cardB === y && l.deletedAt === null ? { ...l, deletedAt: t, updatedAt: t } : l));
      save(LINKS_KEY, links);
    },
  };

  const groupRepo: GroupRepo = {
    async list() {
      return aliveGroups().map(toGroup);
    },
    async create(name, position) {
      const t = now();
      const g: StoredGroup = { id: newId(), name, position, createdAt: t, updatedAt: t, deletedAt: null };
      groups = [...groups, g];
      save(GROUPS_KEY, groups);
      return toGroup(g);
    },
    async update(id, patch) {
      groups = groups.map((g) => (g.id === id ? { ...g, ...patch, updatedAt: now() } : g));
      save(GROUPS_KEY, groups);
      return getGroup(id);
    },
    async remove(id) {
      const t = now();
      groups = groups.map((g) => (g.id === id && g.deletedAt === null ? { ...g, deletedAt: t, updatedAt: t } : g));
      members = members.map((m) => (m.groupId === id && m.deletedAt === null ? { ...m, deletedAt: t, updatedAt: t } : m));
      save(GROUPS_KEY, groups);
      save(MEMBERS_KEY, members);
    },
    async rebalance() {
      const t = now();
      const order = new Map(aliveGroups().map((g, n) => [g.id, n + 1]));
      groups = groups.map((g) => (order.has(g.id) ? { ...g, position: order.get(g.id)!, updatedAt: t } : g));
      save(GROUPS_KEY, groups);
      return aliveGroups().map(toGroup);
    },
    async addCard(groupId, cardId) {
      const t = now();
      const existing = members.find((m) => m.groupId === groupId && m.cardId === cardId);
      if (!existing) members = [...members, { groupId, cardId, createdAt: t, updatedAt: t, deletedAt: null }];
      else if (existing.deletedAt !== null) members = members.map((m) => (m === existing ? { ...m, deletedAt: null, updatedAt: t } : m));
      save(MEMBERS_KEY, members);
    },
    async removeCard(groupId, cardId) {
      const t = now();
      members = members.map((m) => (m.groupId === groupId && m.cardId === cardId && m.deletedAt === null ? { ...m, deletedAt: t, updatedAt: t } : m));
      save(MEMBERS_KEY, members);
    },
  };

  // Setara FTS5 di sqlRepo: semua kata harus cocok sebagai awal kata; judul didahulukan.
  const searchRepo: SearchRepo = {
    async search(query, filter, limit = 50) {
      const terms = searchTerms(query);
      if (!terms.length) return [];
      const hits = alive()
        .filter((c) => c.trashedAt === null)
        .filter((c) => !filter.type || c.type === filter.type)
        .filter((c) => !filter.groupId || groupIdsOf(c.id).includes(filter.groupId))
        .map((c) => {
          const body = markdownToText(c.body, true);
          const itemText = aliveItems(c.id)
            .map((i) => i.text)
            .filter(Boolean)
            .join(" \u00b7 ");
          return { c, body, itemText, inTitle: matchesAll([c.title], terms) };
        })
        .filter((x) => matchesAll([x.c.title, x.body, x.itemText], terms))
        .sort((a, b) => Number(b.inTitle) - Number(a.inTitle) || b.c.updatedAt - a.c.updatedAt)
        .slice(0, limit);
      return hits.map(({ c, body, itemText }) => ({
        cardId: c.id,
        title: markHits(c.title, terms),
        snippet: markSnippet(body, terms) || markSnippet(itemText, terms),
      }));
    },
  };

  const dataRepo: DataRepo = {
    async snapshot() {
      const live = alive();
      const ids = new Set(live.map((c) => c.id));
      const liveGroups = new Set(aliveGroups().map((g) => g.id));
      return {
        cards: live.map(({ deletedAt: _, ...c }) => c),
        todoItems: items.filter((i) => i.deletedAt === null && ids.has(i.cardId)).map(toItem),
        links: links.filter((l) => l.deletedAt === null).map(({ deletedAt: _, ...l }) => l),
        groups: aliveGroups().map(toGroup),
        groupMembers: members.filter((m) => m.deletedAt === null && liveGroups.has(m.groupId)).map(({ deletedAt: _, ...m }) => m),
      };
    },
    async copyTo() {
      throw new Error("Salinan database hanya tersedia di aplikasi desktop");
    },
  };

  return { cards: cardRepo, todos: todoRepo, links: linkRepo, groups: groupRepo, search: searchRepo, data: dataRepo };
}
