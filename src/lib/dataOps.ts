// Operasi data tingkat aplikasi: backup harian, export (P-6), dan pindah folder data (P-5).
import { data } from "../db";
import { useTodo } from "../store/todo";
import { buildExport, exportFolderName, localDate } from "./exporter";
import * as native from "./native";

/** Jumlah backup harian yang disimpan. */
export const BACKUP_KEEP = 7;

// ---------- Simpanan tertunda ----------
// Autosave memakai debounce; sebelum menyalin database, semua yang tertunda ditulis dulu.
const flushers = new Set<() => Promise<void> | void>();

export function registerFlush(fn: () => Promise<void> | void): () => void {
  flushers.add(fn);
  return () => flushers.delete(fn);
}

export async function flushPending(): Promise<void> {
  await Promise.all([useTodo.getState().flush(), ...[...flushers].map((f) => f())]);
}

// ---------- Backup ----------
/** Salin `notes.db` ke `backups/notes-YYYY-MM-DD.db` jika hari ini belum ada; simpan 7 terakhir. */
export async function runDailyBackup(): Promise<string | null> {
  if (!native.hasNative()) return null;
  const target = await native.backupTarget(localDate());
  if (target) {
    await flushPending();
    await data().copyTo(target);
  }
  await native.pruneBackups(BACKUP_KEEP);
  return target;
}

/** Cek backup saat start lalu tiap jam (aplikasi bisa terbuka berhari-hari). */
export function scheduleDailyBackup(): () => void {
  const run = () => runDailyBackup().catch((e) => console.error("Backup harian gagal", e));
  const first = setTimeout(run, 5_000);
  const every = setInterval(run, 3_600_000);
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
}

// ---------- Export ----------
/** Tulis export ke subfolder baru di `dir`. Mengembalikan path folder hasil. */
export async function exportTo(dir: string): Promise<string> {
  await flushPending();
  const files = buildExport(await data().snapshot());
  return native.writeExport(dir, exportFolderName(), files);
}

// ---------- Folder data ----------
export type MoveCheck = { kind: "same" } | { kind: "missing" } | { kind: "copy"; dir: string } | { kind: "useExisting"; dir: string };

export async function checkDataDir(dir: string, info: native.DataInfo): Promise<MoveCheck> {
  const norm = (p: string) => p.replace(/[\\/]+$/, "").toLowerCase();
  if (norm(dir) === norm(info.dataDir)) return { kind: "same" };
  const f = await native.inspectFolder(dir);
  if (!f.exists) return { kind: "missing" };
  return f.hasDb ? { kind: "useExisting", dir } : { kind: "copy", dir };
}

/**
 * Pindah ke folder data `dir` lalu restart. `copy`: salin database saat ini ke sana dulu.
 * Data di folder lama tidak dihapus.
 */
export async function moveDataDir(check: Extract<MoveCheck, { kind: "copy" | "useExisting" }>): Promise<void> {
  await flushPending();
  if (check.kind === "copy") await data().copyTo(native.joinPath(check.dir, native.DB_FILE));
  await native.setDataDir(check.dir);
}

/** Kembali ke folder data bawaan; database lama di folder bawaan dipakai lagi. */
export async function resetDataDir(): Promise<void> {
  await flushPending();
  await native.setDataDir(null);
}
