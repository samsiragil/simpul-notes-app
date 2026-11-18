// Lampiran Note: jenis file, format ukuran, dan referensi Markdown `![nama](attachment:<id>)`.
// File fisik ada di `<folder data>/attachments/<sha256>.<ext>`; metadatanya di tabel `attachment`.

/** Batas ukuran satu lampiran; sama dengan `ATTACH_MAX_BYTES` di src-tauri/src/lib.rs. */
export const ATTACH_MAX_BYTES = 500 * 1024 * 1024;

export type AttachmentKind = "image" | "video" | "audio" | "file";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  avif: "image/avif",
  ico: "image/x-icon",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  ogv: "video/ogg",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  wmv: "video/x-ms-wmv",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/opus",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  weba: "audio/webm",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  md: "text/markdown",
  txt: "text/plain",
  json: "application/json",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
};

/** Format yang bisa diputar WebView2 (Chromium) langsung di Note. */
const INLINE_IMAGE = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif", "ico"]);
const INLINE_VIDEO = new Set(["mp4", "m4v", "webm", "mov", "ogv"]);
const INLINE_AUDIO = new Set(["mp3", "wav", "ogg", "oga", "opus", "m4a", "aac", "flac", "weba"]);

/** Ekstensi huruf kecil tanpa titik; aturannya sama dengan `clean_ext` di Rust. */
export function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  const ext = name.slice(dot + 1).toLowerCase();
  return ext.length <= 16 && /^[a-z0-9]+$/.test(ext) ? ext : "";
}

export function mimeOf(ext: string): string {
  return MIME[ext] ?? "application/octet-stream";
}

export function kindOf(ext: string): AttachmentKind {
  if (INLINE_IMAGE.has(ext)) return "image";
  if (INLINE_VIDEO.has(ext)) return "video";
  if (INLINE_AUDIO.has(ext)) return "audio";
  return "file";
}

/** Nama file fisik di folder lampiran. */
export function storedName(sha256: string, ext: string): string {
  return ext ? `${sha256}.${ext}` : sha256;
}

/** Ukuran file berbahasa Indonesia, misal `1,2 MB`. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toLocaleString("id-ID", { maximumFractionDigits: v < 10 ? 1 : 0 })} ${units[u]}`;
}

// ---------- Markdown ----------

/** Skema URL lampiran di Markdown. */
export const ATTACH_SCHEME = "attachment:";

const escapeName = (name: string) => name.replace(/[\\[\]\n\r]/g, (c) => (c === "\n" || c === "\r" ? " " : `\\${c}`));
const unescapeName = (name: string) => name.replace(/\\(.)/g, "$1");

/** Referensi Markdown satu lampiran (satu baris tersendiri). */
export function attachmentMarkdown(id: string, name: string): string {
  return `![${escapeName(name)}](${ATTACH_SCHEME}${id})`;
}

const NAME = String.raw`((?:\\.|[^\]\\\n])*)`;
const ID = String.raw`([0-9a-fA-F-]{36})`;

/** Lampiran sebagai block: satu baris berisi referensi saja. */
export const ATTACH_BLOCK_RE = new RegExp(String.raw`^!\[${NAME}\]\(attachment:${ID}\)[ \t]*(?:\n|$)`);
const ATTACH_START_RE = new RegExp(String.raw`(^|\n)!\[${NAME}\]\(attachment:${ID}\)`);
const ATTACH_ALL_RE = new RegExp(String.raw`!\[${NAME}\]\(attachment:${ID}\)`, "g");

export function parseAttachmentBlock(src: string): { raw: string; name: string; id: string } | null {
  const m = ATTACH_BLOCK_RE.exec(src);
  return m ? { raw: m[0], name: unescapeName(m[1]), id: m[2] } : null;
}

/** Posisi awal referensi lampiran di awal baris berikutnya; -1 jika tidak ada. */
export function attachmentStart(src: string): number {
  const m = ATTACH_START_RE.exec(src);
  return m ? m.index + m[1].length : -1;
}

/** Ganti setiap referensi lampiran di Markdown. */
export function replaceAttachments(md: string, fn: (id: string, name: string) => string): string {
  return md.replace(ATTACH_ALL_RE, (_, name: string, id: string) => fn(id, unescapeName(name)));
}
