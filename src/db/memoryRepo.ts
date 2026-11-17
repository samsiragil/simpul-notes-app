import { newId, now } from "../lib/util";
import type { Card, CardPatch, CardRepo, CardScope, CardType } from "./types";

/**
 * Repository cadangan untuk `npm run dev` di browser biasa (tanpa Tauri).
 * Disimpan di localStorage; hanya untuk mencoba UI, bukan untuk data sungguhan.
 */
const KEY = "notes-app:dev-cards";

function load(): Card[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Card[];
  } catch {
    return [];
  }
}

function save(cards: Card[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cards));
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

export function createMemoryRepo(): CardRepo {
  let cards = load();
  if (cards.length === 0) {
    const t = now();
    cards = [
      { id: newId(), type: "note", title: "Riset Font", body: SAMPLE_BODY, pinned: true, createdAt: t, updatedAt: t, trashedAt: null, deletedAt: null },
      { id: newId(), type: "note", title: "Rapat Senin", body: "Agenda: review sidebar, keputusan group tidak bersarang.", pinned: false, createdAt: t - 86_400_000, updatedAt: t - 86_400_000, trashedAt: null, deletedAt: null },
    ];
    save(cards);
  }

  const alive = () => cards.filter((c) => c.deletedAt === null);
  const find = (id: string) => alive().find((c) => c.id === id) ?? null;
  const mutate = (id: string, fn: (c: Card) => Card) => {
    cards = cards.map((c) => (c.id === id ? fn(c) : c));
    save(cards);
  };

  return {
    async list(scope: CardScope) {
      const list = alive().filter((c) => (scope === "trash" ? c.trashedAt !== null : c.trashedAt === null));
      return scope === "trash"
        ? list.sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0))
        : list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
    },
    async get(id) {
      return find(id);
    },
    async create(type: CardType) {
      const t = now();
      const c: Card = { id: newId(), type, title: "", body: type === "note" ? "" : null, pinned: false, createdAt: t, updatedAt: t, trashedAt: null, deletedAt: null };
      cards = [c, ...cards];
      save(cards);
      return c;
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
      mutate(id, (c) => ({ ...c, deletedAt: now(), body: null, title: "" }));
    },
    async purgeTrash(days) {
      const cutoff = now() - days * 86_400_000;
      const old = alive().filter((c) => c.trashedAt !== null && c.trashedAt < cutoff);
      old.forEach((c) => mutate(c.id, (x) => ({ ...x, deletedAt: now() })));
      return old.length;
    },
  };
}
