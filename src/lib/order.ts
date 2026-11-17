/**
 * Urutan item Todo Card (T-4, T-6). Fungsi murni, tanpa akses data.
 *
 * `position` adalah fractional index global per card dan tidak pernah diubah
 * saat item dicentang, sehingga item yang batal dicentang kembali ke tempat asalnya.
 * Tampilan dibagi dua seksi: belum selesai (`open`) dan selesai (`done`);
 * item hanya bisa dipindah di dalam seksinya sendiri.
 */

export interface Ordered {
  id: string;
  position: number;
  done: boolean;
}

/** T-6: item selesai pindah ke bawah atau disembunyikan. */
export type DoneMode = "bottom" | "hide";

/** Jarak minimum antar posisi; di bawah ini posisi perlu di-rebalance. */
export const MIN_GAP = 1e-9;

/**
 * Hasil penempatan:
 * - `{ position }`: posisi baru yang aman dipakai.
 * - `"edge"`: item sudah di ujung seksinya, tidak ada yang perlu diubah.
 * - `"crowded"`: jarak terlalu rapat; panggil `rebalance` lalu hitung ulang.
 */
export type Placement = { position: number } | "edge" | "crowded";

export const byPosition = (a: Ordered, b: Ordered): number =>
  a.position - b.position || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Posisi di antara dua tetangga; `null` berarti ujung daftar. */
export function positionBetween(prev: number | null, next: number | null): Placement {
  if (prev === null && next === null) return { position: 1 };
  if (prev === null) return { position: next! - 1 };
  if (next === null) return { position: prev + 1 };
  const mid = (prev + next) / 2;
  if (next - prev < MIN_GAP || mid <= prev || mid >= next) return "crowded";
  return { position: mid };
}

export function splitByDone<T extends Ordered>(items: readonly T[]): { open: T[]; done: T[] } {
  const sorted = [...items].sort(byPosition);
  return { open: sorted.filter((i) => !i.done), done: sorted.filter((i) => i.done) };
}

/** Urutan tampil: belum selesai dulu, lalu selesai (disembunyikan di mode `hide` kecuali `showDone`). */
export function displayOrder<T extends Ordered>(items: readonly T[], mode: DoneMode, showDone = false): T[] {
  const { open, done } = splitByDone(items);
  return mode === "hide" && !showDone ? open : [...open, ...done];
}

/**
 * Posisi item baru tepat setelah `afterId` (urutan global), atau di akhir jika `afterId` null
 * atau tidak ditemukan (T-1).
 */
export function positionAfter(items: readonly Ordered[], afterId: string | null): Placement {
  const sorted = [...items].sort(byPosition);
  const idx = afterId === null ? -1 : sorted.findIndex((i) => i.id === afterId);
  if (idx === -1) return positionBetween(sorted.at(-1)?.position ?? null, null);
  return positionBetween(sorted[idx].position, sorted[idx + 1]?.position ?? null);
}

const sectionOf = <T extends Ordered>(items: readonly T[], id: string): T[] | null => {
  const item = items.find((i) => i.id === id);
  if (!item) return null;
  const { open, done } = splitByDone(items);
  return item.done ? done : open;
};

/** Pindahkan item ke indeks `toIndex` di dalam seksinya (drag-and-drop, T-4). */
export function positionMoveTo(items: readonly Ordered[], id: string, toIndex: number): Placement {
  const section = sectionOf(items, id);
  if (!section) return "edge";
  const from = section.findIndex((i) => i.id === id);
  const to = Math.max(0, Math.min(toIndex, section.length - 1));
  if (from === to) return "edge";
  const rest = section.filter((i) => i.id !== id);
  return positionBetween(rest[to - 1]?.position ?? null, rest[to]?.position ?? null);
}

/** Geser item satu langkah di dalam seksinya (`Alt+Up/Down`, T-4). */
export function positionMoveBy(items: readonly Ordered[], id: string, dir: -1 | 1): Placement {
  const section = sectionOf(items, id);
  if (!section) return "edge";
  const from = section.findIndex((i) => i.id === id);
  return positionMoveTo(items, id, from + dir);
}
