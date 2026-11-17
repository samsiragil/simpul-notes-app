import Database from "@tauri-apps/plugin-sql";
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
  item_total: number | null;
  item_done: number | null;
}

interface TodoItemRow {
  id: string;
  card_id: string;
  text: string;
  done: number;
  position: number;
  done_at: number | null;
  created_at: number;
  updated_at: number;
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
  progress: r.type === "todo" ? { done: r.item_done ?? 0, total: r.item_total ?? 0 } : null,
});

const toItem = (r: TodoItemRow): TodoItem => ({
  id: r.id,
  cardId: r.card_id,
  text: r.text,
  done: !!r.done,
  position: r.position,
  doneAt: r.done_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** Card beserta progres item (T-5) dalam satu query, tanpa N+1. */
const CARD_SELECT = `
  SELECT c.*, p.item_total, p.item_done
  FROM card c
  LEFT JOIN (
    SELECT card_id, COUNT(*) AS item_total, SUM(done) AS item_done
    FROM todo_item
    WHERE deleted_at IS NULL
    GROUP BY card_id
  ) p ON p.card_id = c.id`;

export interface SqlRepos {
  cards: CardRepo;
  todos: TodoRepo;
}

export async function createSqlRepo(): Promise<SqlRepos> {
  const db = await Database.load(DB_URL);
  await db.execute("PRAGMA journal_mode = WAL");
  await db.execute("PRAGMA foreign_keys = ON");

  return { cards: cardRepo(db), todos: todoRepo(db) };
}

function cardRepo(db: Database): CardRepo {
  const get = async (id: string): Promise<Card | null> => {
    const rows = await db.select<CardRow[]>(`${CARD_SELECT} WHERE c.id = $1 AND c.deleted_at IS NULL`, [id]);
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
      const where = scope === "trash" ? "c.trashed_at IS NOT NULL" : "c.trashed_at IS NULL";
      const order = scope === "trash" ? "c.trashed_at DESC" : "c.pinned DESC, c.updated_at DESC";
      const rows = await db.select<CardRow[]>(`${CARD_SELECT} WHERE c.deleted_at IS NULL AND ${where} ORDER BY ${order}`);
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

function todoRepo(db: Database): TodoRepo {
  const get = async (id: string): Promise<TodoItem> => {
    const rows = await db.select<TodoItemRow[]>("SELECT * FROM todo_item WHERE id = $1 AND deleted_at IS NULL", [id]);
    if (!rows[0]) throw new Error(`Item todo ${id} tidak ditemukan`);
    return toItem(rows[0]);
  };

  const list = async (cardId: string): Promise<TodoItem[]> => {
    const rows = await db.select<TodoItemRow[]>(
      "SELECT * FROM todo_item WHERE card_id = $1 AND deleted_at IS NULL ORDER BY position, id",
      [cardId],
    );
    return rows.map(toItem);
  };

  /** Perubahan item dihitung sebagai perubahan card (urutan daftar S-1). */
  const touchCardOf = (itemId: string, t: number) =>
    db.execute("UPDATE card SET updated_at = $1 WHERE id = (SELECT card_id FROM todo_item WHERE id = $2)", [t, itemId]);

  return {
    list,

    async create(item: NewTodoItem) {
      const t = now();
      await db.execute(
        "INSERT INTO todo_item (id, card_id, text, done, position, created_at, updated_at) VALUES ($1, $2, $3, 0, $4, $5, $5)",
        [item.id, item.cardId, item.text, item.position, t],
      );
      await touchCardOf(item.id, t);
      return get(item.id);
    },

    async update(id: string, patch: TodoItemPatch) {
      const t = now();
      const sets: string[] = [];
      const params: unknown[] = [];
      const add = (col: string, v: unknown) => {
        params.push(v);
        sets.push(`${col} = $${params.length}`);
      };
      if (patch.text !== undefined) add("text", patch.text);
      if (patch.done !== undefined) {
        add("done", patch.done ? 1 : 0);
        add("done_at", patch.done ? t : null);
      }
      if (patch.position !== undefined) add("position", patch.position);
      add("updated_at", t);
      params.push(id);
      await db.execute(`UPDATE todo_item SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
      await touchCardOf(id, t);
      return get(id);
    },

    async remove(id: string) {
      const t = now();
      await db.execute("UPDATE todo_item SET deleted_at = $1, updated_at = $1 WHERE id = $2 AND deleted_at IS NULL", [t, id]);
      await touchCardOf(id, t);
    },

    async rebalance(cardId: string) {
      // Satu statement: BEGIN/COMMIT lintas execute() tidak aman di pool tauri-plugin-sql.
      await db.execute(
        `UPDATE todo_item SET position = r.rn, updated_at = $1
         FROM (
           SELECT id, ROW_NUMBER() OVER (ORDER BY position, id) AS rn
           FROM todo_item
           WHERE card_id = $2 AND deleted_at IS NULL
         ) AS r
         WHERE todo_item.id = r.id`,
        [now(), cardId],
      );
      return list(cardId);
    },
  };
}
