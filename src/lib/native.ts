// Pintu ke command backend Tauri (src-tauri/src/lib.rs): folder data, backup, export.
// Hanya file system dan jendela; data card tetap lewat repository `src/db`.
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./util";

export interface DataInfo {
  dataDir: string;
  defaultDir: string;
  dbUrl: string;
  backupDir: string;
  isDefault: boolean;
  /** Folder data pilihan yang tidak ditemukan saat start; aplikasi memakai folder bawaan. */
  missingDir: string | null;
}

export interface FolderInfo {
  exists: boolean;
  hasDb: boolean;
}

export interface BackupFile {
  name: string;
  size: number;
  modified: number;
}

export interface ExportFile {
  path: string;
  content: string;
}

export const DB_FILE = "notes.db";

export const hasNative = isTauri;

export const dataInfo = () => invoke<DataInfo>("data_info");
export const inspectFolder = (path: string) => invoke<FolderInfo>("inspect_folder", { path });
/** Simpan folder data (`null` = bawaan) lalu restart aplikasi. */
export const setDataDir = (path: string | null) => invoke<void>("set_data_dir", { path });
/** Path backup untuk tanggal itu, atau `null` jika backup hari itu sudah ada. */
export const backupTarget = (date: string) => invoke<string | null>("backup_target", { date });
export const listBackups = () => invoke<BackupFile[]>("list_backups");
export const pruneBackups = (keep: number) => invoke<number>("prune_backups", { keep });
export const writeExport = (dir: string, folder: string, files: ExportFile[]) =>
  invoke<string>("write_export", { dir, folder, files });

/** Pemilih folder bawaan Windows. `null` jika dibatalkan. */
export async function pickFolder(title: string): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({ directory: true, multiple: false, title });
  return typeof picked === "string" ? picked : null;
}

/** Gabung folder dan nama file (Windows). */
export const joinPath = (dir: string, name: string) => `${dir.replace(/[\\/]+$/, "")}\\${name}`;
