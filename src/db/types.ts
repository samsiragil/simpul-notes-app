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
  /** L-7: jumlah card terhubung yang tidak di Trash (L-6). */
  linkCount: number;
  /** G-3: group tempat card berada (group yang belum dihapus). */
  groupIds: string[];
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
export interface NewCard {
  title?: string;
}

export interface CardRepo {
  list(scope: CardScope): Promise<Card[]>;
  get(id: string): Promise<Card | null>;
  create(type: CardType, init?: NewCard): Promise<Card>;
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

/**
 * Link tidak berarah antar card (L-1 sampai L-7). Disimpan satu baris per pasangan
 * dengan `card_a < card_b`; memutus link mengisi `deleted_at`, menghubungkan ulang
 * menghidupkan baris yang sama.
 */
export interface LinkRepo {
  /** ID card terhubung yang tidak di Trash dan tidak dihapus (L-3, L-6), urut waktu dihubungkan. */
  linkedIds(cardId: string): Promise<string[]>;
  /** Abaikan self-link; link yang sudah ada tidak digandakan. */
  link(a: string, b: string): Promise<void>;
  unlink(a: string, b: string): Promise<void>;
}

export interface Group {
  id: string;
  name: string;
  /** Fractional index urutan di sidebar (G-1). */
  position: number;
  createdAt: number;
  updatedAt: number;
}

/** Group sebagai label (G-1 sampai G-7). Menghapus group tidak menghapus card. */
export interface GroupRepo {
  /** Group yang belum dihapus, urut `position`. */
  list(): Promise<Group[]>;
  create(name: string, position: number): Promise<Group>;
  update(id: string, patch: Partial<Pick<Group, "name" | "position">>): Promise<Group>;
  /** Soft delete group beserta keanggotaannya; card tetap utuh (G-5). */
  remove(id: string): Promise<void>;
  /** Beri ulang posisi 1..n. */
  rebalance(): Promise<Group[]>;
  /** G-2: tambah card ke group (menghidupkan keanggotaan lama jika ada). */
  addCard(groupId: string, cardId: string): Promise<void>;
  /** G-4: keluarkan card dari group tanpa menghapus card. */
  removeCard(groupId: string, cardId: string): Promise<void>;
}

/** Urutan pasangan link: satu baris per pasangan (`card_a < card_b`). */
export function linkPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export interface SearchFilter {
  /** S-4: hanya Note atau hanya Todo; `null` = semua tipe. */
  type: CardType | null;
  /** S-4: hanya card di group ini; `null` = semua group. */
  groupId: string | null;
}

/**
 * Hasil pencarian (S-3). Bagian yang cocok di `title` dan `snippet` diapit penanda
 * `HIT_START` / `HIT_END` (lihat `src/lib/search.ts`) agar UI bisa menyorotnya.
 */
export interface SearchHit {
  cardId: string;
  title: string;
  /** Potongan isi Note atau item Todo yang cocok; kosong jika hanya judul yang cocok. */
  snippet: string;
}

/** Pencarian card aktif (tidak di Trash) atas judul, isi Note, dan item Todo. */
export interface SearchRepo {
  search(query: string, filter: SearchFilter, limit?: number): Promise<SearchHit[]>;
}

/** Baris data tanpa kolom turunan; dipakai Export (P-6). Tombstone tidak ikut. */
export type SnapshotCard = Omit<Card, "progress" | "linkCount" | "groupIds" | "deletedAt">;

export interface SnapshotLink {
  cardA: string;
  cardB: string;
  createdAt: number;
  updatedAt: number;
}

export interface SnapshotMember {
  groupId: string;
  cardId: string;
  createdAt: number;
  updatedAt: number;
}

export interface Snapshot {
  cards: SnapshotCard[];
  todoItems: TodoItem[];
  links: SnapshotLink[];
  groups: Group[];
  groupMembers: SnapshotMember[];
}

/** Operasi atas seluruh data: export (P-6) dan salinan database (backup, pindah folder P-5). */
export interface DataRepo {
  /** Semua card (termasuk Trash) beserta item, link, dan group yang belum dihapus. */
  snapshot(): Promise<Snapshot>;
  /** Salinan database yang konsisten ke file baru (`VACUUM INTO`). File tujuan belum boleh ada. */
  copyTo(path: string): Promise<void>;
}
