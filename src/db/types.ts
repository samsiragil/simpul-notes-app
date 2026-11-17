export type CardType = "note" | "todo";

export interface Card {
  id: string;
  type: CardType;
  title: string;
  body: string | null; // Markdown (note)
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  trashedAt: number | null;
  deletedAt: number | null;
  /** Progres item (T-5). Hanya untuk Todo Card; `null` untuk Note. */
  progress: TodoProgress | null;
}

export interface TodoProgress {
  done: number;
  total: number;
}

export type CardPatch = Partial<Pick<Card, "title" | "body" | "pinned">>;

export type CardScope = "active" | "trash";

/**
 * Repository: satu-satunya pintu ke data. UI tidak pernah menulis SQL.
 * Sync ke Supabase (M5) nanti cukup ditambahkan di lapisan ini.
 */
export interface CardRepo {
  list(scope: CardScope): Promise<Card[]>;
  get(id: string): Promise<Card | null>;
  create(type: CardType): Promise<Card>;
  update(id: string, patch: CardPatch): Promise<Card>;
  trash(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  /** Hapus permanen: isi deleted_at (tombstone), bukan DELETE. */
  destroy(id: string): Promise<void>;
  /** Hapus permanen card yang sudah di Trash lebih dari `days` hari. */
  purgeTrash(days: number): Promise<number>;
}

export interface TodoItem {
  id: string;
  cardId: string;
  text: string;
  done: boolean;
  /** Fractional index: urutan item dalam card (T-4). */
  position: number;
  doneAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/** ID (UUID v7) dibuat pemanggil agar item bisa tampil sebelum INSERT selesai. */
export type NewTodoItem = Pick<TodoItem, "id" | "cardId" | "text" | "position">;

export type TodoItemPatch = Partial<Pick<TodoItem, "text" | "done" | "position">>;

/**
 * Item Todo Card (T-1 sampai T-6). Setiap perubahan item juga memperbarui
 * `card.updated_at` agar urutan daftar card (S-1) ikut berubah.
 */
export interface TodoRepo {
  /** Item yang belum dihapus, urut `position`. */
  list(cardId: string): Promise<TodoItem[]>;
  create(item: NewTodoItem): Promise<TodoItem>;
  /** `done` mengisi atau mengosongkan `done_at`. */
  update(id: string, patch: TodoItemPatch): Promise<TodoItem>;
  /** Soft delete: isi deleted_at, bukan DELETE. */
  remove(id: string): Promise<void>;
  /** Beri ulang posisi 1..n (dipakai jika jarak fractional index terlalu rapat). */
  rebalance(cardId: string): Promise<TodoItem[]>;
}
