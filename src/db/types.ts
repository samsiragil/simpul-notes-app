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
