import Database from "@tauri-apps/plugin-sql";
import { newId, now } from "../lib/util";
import type { Repos } from "./index";
import {
  linkPair,
  type Card,
  type CardPatch,
  type CardRepo,
  type CardScope,
  type CardType,
  type Group,
  type GroupRepo,
  type LinkRepo,
  type NewCard,
  type NewTodoItem,
  type TodoItem,
  type TodoItemPatch,
  type TodoRepo,
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
  link_count: number | null;
  group_ids: string | null;
}

interface GroupRow {
  id: string;
  name: string;
  position: number;
  created_at: number;
  updated_at: number;
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
  linkCount: r.link_count ?? 0,
  groupIds: r.group_ids ? r.group_ids.split(",") : [],
});

const toGroup = (r: GroupRow): Group => ({
  id: r.id,
  name: r.name,
  position: r.position,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
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

/**
 * Card beserta progres item (T-5), jumlah link aktif (L-7) dan group (G-3) dalam satu query,
 * tanpa N+1. Link ke card di Trash tidak dihitung (L-6). `group_concat` hanya dipakai di
 * query lokal, bukan di skema, jadi skema tetap kompatibel Postgres.
 */
const CARD_SELECT = `
  SELECT c.*, p.item_total, p.item_done, lc.link_count, gm.group_ids
  FROM card c
  LEFT JOIN (
    SELECT card_id, COUNT(*) AS item_total, SUM(done) AS item_done
    FROM todo_item
    WHERE deleted_at IS NULL
    GROUP BY card_id
  ) p ON p.card_id = c.id
  LEFT JOIN (
    SELECT x.id, COUNT(*) AS link_count
    FROM (
      SELECT card_a AS id, card_b AS other FROM link WHERE deleted_at IS NULL
      UNION ALL
      SELECT card_b AS id, card_a AS other FROM link WHERE deleted_at IS NULL
    ) x
    JOIN card o ON o.id = x.other
    WHERE o.deleted_at IS NULL AND o.trashed_at IS NULL
    GROUP BY x.id
  ) lc ON lc.id = c.id
  LEFT JOIN (
    SELECT m.card_id, group_concat(m.group_id) AS group_ids
    FROM group_member m
    JOIN grp g ON g.id = m.group_id
    WHERE m.deleted_at IS NULL AND g.deleted_at IS NULL
    GROUP BY m.card_id
  ) gm ON gm.card_id = c.id`;

export async function createSqlRepo(): Promise<Repos> {
  const db = await Database.load(DB_URL);
  await db.execute("PRAGMA journal_mode = WAL");
  await db.execute("PRAGMA foreign_keys = ON");

  return { cards: cardRepo(db), todos: todoRepo(db), links: linkRepo(db), groups: groupRepo(db) };
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

    async create(type: CardType, init: NewCard = {}) {
      const t = now();
      const id = newId();
      await db.execute(
        "INSERT INTO card (id, type, title, body, pinned, created_at, updated_at) VALUES ($1, $2, $3, $4, 0, $5, $5)",
        [id, type, init.title ?? "", type === "note" ? "" : null, t],
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

function linkRepo(db: Database): LinkRepo {
  return {
    async linkedIds(cardId: string) {
      const rows = await db.select<{ id: string }[]>(
        `SELECT o.id
         FROM link l
         JOIN card o ON o.id = CASE WHEN l.card_a = $1 THEN l.card_b ELSE l.card_a END
         WHERE (l.card_a = $1 OR l.card_b = $1)
           AND l.deleted_at IS NULL AND o.deleted_at IS NULL AND o.trashed_at IS NULL
         ORDER BY l.updated_at, o.id`,
        [cardId],
      );
      return rows.map((r) => r.id);
    },

    async link(a: string, b: string) {
      if (a === b) return;
      const [x, y] = linkPair(a, b);
      // Menghubungkan ulang menghidupkan baris yang sama (tanpa link ganda).
      await db.execute(
        `INSERT INTO link (card_a, card_b, created_at, updated_at) VALUES ($1, $2, $3, $3)
         ON CONFLICT (card_a, card_b) DO UPDATE SET deleted_at = NULL, updated_at = excluded.updated_at
         WHERE link.deleted_at IS NOT NULL`,
        [x, y, now()],
      );
    },

    async unlink(a: string, b: string) {
      const [x, y] = linkPair(a, b);
      const t = now();
      await db.execute(
        "UPDATE link SET deleted_at = $1, updated_at = $1 WHERE card_a = $2 AND card_b = $3 AND deleted_at IS NULL",
        [t, x, y],
      );
    },
  };
}

function groupRepo(db: Database): GroupRepo {
  const get = async (id: string): Promise<Group> => {
    const rows = await db.select<GroupRow[]>("SELECT * FROM grp WHERE id = $1 AND deleted_at IS NULL", [id]);
    if (!rows[0]) throw new Error(`Group ${id} tidak ditemukan`);
    return toGroup(rows[0]);
  };

  const list = async (): Promise<Group[]> => {
    const rows = await db.select<GroupRow[]>("SELECT * FROM grp WHERE deleted_at IS NULL ORDER BY position, id");
    return rows.map(toGroup);
  };

  return {
    list,

    async create(name: string, position: number) {
      const id = newId();
      await db.execute(
        "INSERT INTO grp (id, name, position, created_at, updated_at) VALUES ($1, $2, $3, $4, $4)",
        [id, name, position, now()],
      );
      return get(id);
    },

    async update(id, patch) {
      const sets: string[] = [];
      const params: unknown[] = [];
      const add = (col: string, v: unknown) => {
        params.push(v);
        sets.push(`${col} = $${params.length}`);
      };
      if (patch.name !== undefined) add("name", patch.name);
      if (patch.position !== undefined) add("position", patch.position);
      add("updated_at", now());
      params.push(id);
      await db.execute(`UPDATE grp SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
      return get(id);
    },

    async remove(id: string) {
      const t = now();
      await db.execute("UPDATE grp SET deleted_at = $1, updated_at = $1 WHERE id = $2 AND deleted_at IS NULL", [t, id]);
      await db.execute(
        "UPDATE group_member SET deleted_at = $1, updated_at = $1 WHERE group_id = $2 AND deleted_at IS NULL",
        [t, id],
      );
    },

    async rebalance() {
      // Satu statement: BEGIN/COMMIT lintas execute() tidak aman di pool tauri-plugin-sql.
      await db.execute(
        `UPDATE grp SET position = r.rn, updated_at = $1
         FROM (
           SELECT id, ROW_NUMBER() OVER (ORDER BY position, id) AS rn
           FROM grp
           WHERE deleted_at IS NULL
         ) AS r
         WHERE grp.id = r.id`,
        [now()],
      );
      return list();
    },

    async addCard(groupId: string, cardId: string) {
      await db.execute(
        `INSERT INTO group_member (group_id, card_id, created_at, updated_at) VALUES ($1, $2, $3, $3)
         ON CONFLICT (group_id, card_id) DO UPDATE SET deleted_at = NULL, updated_at = excluded.updated_at
         WHERE group_member.deleted_at IS NOT NULL`,
        [groupId, cardId, now()],
      );
    },

    async removeCard(groupId: string, cardId: string) {
      const t = now();
      await db.execute(
        "UPDATE group_member SET deleted_at = $1, updated_at = $1 WHERE group_id = $2 AND card_id = $3 AND deleted_at IS NULL",
        [t, groupId, cardId],
      );
    },
  };
}
