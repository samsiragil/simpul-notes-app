import Database from "@tauri-apps/plugin-sql";
import { newId, now } from "../lib/util";
import type { Card, CardPatch, CardRepo, CardScope, CardType } from "./types";

/** Harus sama dengan DB_URL di src-tauri/src/lib.rs (migrasi dijalankan di sana). */
const DB_URL = "sqlite:notes.db";

interface CardRow {
  id: string;
  type: CardType;
  title: string;
  body: string | null;
  pinned: number;
  created_at: number;
  updated_at: number;
  trashed_at: number | null;
  deleted_at: number | null;
}

const toCard = (r: CardRow): Card => ({
  id: r.id,
  type: r.type,
  title: r.title,
  body: r.body,
  pinned: !!r.pinned,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  trashedAt: r.trashed_at,
  deletedAt: r.deleted_at,
});

export async function createSqlRepo(): Promise<CardRepo> {
  const db = await Database.load(DB_URL);
  await db.execute("PRAGMA journal_mode = WAL");
  await db.execute("PRAGMA foreign_keys = ON");

  const get = async (id: string): Promise<Card | null> => {
    const rows = await db.select<CardRow[]>("SELECT * FROM card WHERE id = $1 AND deleted_at IS NULL", [id]);
    return rows[0] ? toCard(rows[0]) : null;
  };

  const destroyMany = async (ids: string[]) => {
    const t = now();
    for (const id of ids) {
      // Tombstone card beserta relasinya agar ikut terhapus di perangkat lain saat sync.
      await db.execute("UPDATE card SET deleted_at = $1, updated_at = $1, body = NULL, title = '' WHERE id = $2", [t, id]);
      await db.execute("UPDATE todo_item SET deleted_at = $1, updated_at = $1 WHERE card_id = $2 AND deleted_at IS NULL", [t, id]);
      await db.execute("UPDATE link SET deleted_at = $1, updated_at = $1 WHERE (card_a = $2 OR card_b = $2) AND deleted_at IS NULL", [t, id]);
      await db.execute("UPDATE group_member SET deleted_at = $1, updated_at = $1 WHERE card_id = $2 AND deleted_at IS NULL", [t, id]);
    }
  };

  return {
    async list(scope: CardScope) {
      const where = scope === "trash" ? "trashed_at IS NOT NULL" : "trashed_at IS NULL";
      const order = scope === "trash" ? "trashed_at DESC" : "pinned DESC, updated_at DESC";
      const rows = await db.select<CardRow[]>(`SELECT * FROM card WHERE deleted_at IS NULL AND ${where} ORDER BY ${order}`);
      return rows.map(toCard);
    },

    get,

    async create(type: CardType) {
      const t = now();
      const id = newId();
      await db.execute(
        "INSERT INTO card (id, type, title, body, pinned, created_at, updated_at) VALUES ($1, $2, '', $3, 0, $4, $4)",
        [id, type, type === "note" ? "" : null, t],
      );
      return (await get(id))!;
    },

    async update(id: string, patch: CardPatch) {
      const sets: string[] = [];
      const params: unknown[] = [];
      const add = (col: string, v: unknown) => {
        params.push(v);
        sets.push(`${col} = $${params.length}`);
      };
      if (patch.title !== undefined) add("title", patch.title);
      if (patch.body !== undefined) add("body", patch.body);
      if (patch.pinned !== undefined) add("pinned", patch.pinned ? 1 : 0);
      add("updated_at", now());
      params.push(id);
      await db.execute(`UPDATE card SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
      return (await get(id))!;
    },

    async trash(id: string) {
      const t = now();
      await db.execute("UPDATE card SET trashed_at = $1, updated_at = $1, pinned = 0 WHERE id = $2", [t, id]);
    },

    async restore(id: string) {
      await db.execute("UPDATE card SET trashed_at = NULL, updated_at = $1 WHERE id = $2", [now(), id]);
    },

    async destroy(id: string) {
      await destroyMany([id]);
    },

    async purgeTrash(days: number) {
      const cutoff = now() - days * 86_400_000;
      const rows = await db.select<{ id: string }[]>(
        "SELECT id FROM card WHERE deleted_at IS NULL AND trashed_at IS NOT NULL AND trashed_at < $1",
        [cutoff],
      );
      await destroyMany(rows.map((r) => r.id));
      return rows.length;
    },
  };
}
