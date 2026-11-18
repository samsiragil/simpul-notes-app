// Pintu ke command backend Tauri (src-tauri/src/lib.rs): folder data, backup, export.
// Hanya file system dan jendela; data card tetap lewat repository `src/db`.
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./util";

export interface DataInfo {
  dataDir: string;
  defaultDir: string;
  dbUrl: string;
  backupDir: string;
  attachmentDir: string;
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

/** Lampiran yang ikut diexport: `file` di folder lampiran disalin ke `path` (relatif folder export). */
export interface ExportAttachment {
  file: string;
  path: string;
}

/** File yang sudah disalin ke folder lampiran oleh backend. */
export interface StoredFile {
  sha256: string;
  ext: string;
  fileName: string;
  size: number;
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
export const writeExport = (dir: string, folder: string, files: ExportFile[], attachments: ExportAttachment[]) =>
  invoke<string>("write_export", { dir, folder, files, attachments });

// ---------- Lampiran ----------
/** Salin file dari path lokal ke folder lampiran. */
export const importAttachment = (path: string) => invoke<StoredFile>("import_attachment", { path });
/** Simpan isi file tanpa path (misal paste dari clipboard). */
export const importAttachmentBytes = async (file: File) =>
  invoke<StoredFile>("import_attachment_bytes", new Uint8Array(await file.arrayBuffer()), {
    headers: { "x-file-name": encodeURIComponent(file.name || "file") },
  });
/** Buka link (http/https/mailto) di browser default. */
export const openUrl = (url: string): Promise<void> =>
  isTauri() ? invoke<void>("open_url", { url }) : Promise.resolve(void window.open(url, "_blank", "noopener"));
export const openAttachment = (file: string) => invoke<void>("open_attachment", { file });
export const revealAttachment = (file: string) => invoke<void>("reveal_attachment", { file });
export const copyAttachments = (dir: string) => invoke<number>("copy_attachments", { dir });

/** Dialog "Simpan sebagai" lalu salin lampiran ke sana. `false` jika dibatalkan. */
export async function saveAttachmentAs(file: string, fileName: string): Promise<boolean> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const dest = await save({ title: "Simpan lampiran", defaultPath: fileName });
  if (!dest) return false;
  await invoke<void>("save_attachment_as", { file, dest });
  return true;
}

/** Pemilih file bawaan Windows (boleh banyak). */
export async function pickFiles(title: string): Promise<string[]> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({ multiple: true, directory: false, title });
  if (!picked) return [];
  return Array.isArray(picked) ? picked : [picked];
}

let attachDir: Promise<string> | null = null;
/** URL file lampiran untuk `<img>`, `<video>`, dan `<audio>` (asset protocol). */
export async function attachmentUrl(file: string): Promise<string> {
  const { convertFileSrc } = await import("@tauri-apps/api/core");
  attachDir ??= dataInfo().then((i) => i.attachmentDir);
  return convertFileSrc(joinPath(await attachDir, file));
}

/** Pemilih folder bawaan Windows. `null` jika dibatalkan. */
export async function pickFolder(title: string): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({ directory: true, multiple: false, title });
  return typeof picked === "string" ? picked : null;
}

/** Gabung folder dan nama file (Windows). */
export const joinPath = (dir: string, name: string) => `${dir.replace(/[\\/]+$/, "")}\\${name}`;
