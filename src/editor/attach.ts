// Impor file ke Note: salin ke folder lampiran (backend), catat metadata (repository),
// lalu sisipkan node `attachment` ke editor.
import type { Editor, JSONContent } from "@tiptap/core";
import { attachments } from "../db";
import { ATTACH_MAX_BYTES, extOf, formatSize, mimeOf } from "../lib/attachments";
import * as native from "../lib/native";
import { primeAttachment } from "./Attachment";

/** Path lokal (dialog, drag & drop dari Explorer) atau isi file tanpa path (paste). */
export type AttachSource = string | File;

const nameOf = (s: AttachSource) => (typeof s === "string" ? s.split(/[\\/]/).pop() || s : s.name || "file");

export interface AttachResult {
  inserted: number;
  errors: string[];
}

/**
 * Impor `sources` lalu sisipkan di posisi `pos` (default: kursor saat ini).
 * File yang gagal dilewati; pesan galatnya dikembalikan.
 */
export async function attachFiles(editor: Editor, cardId: string, sources: AttachSource[], pos?: number): Promise<AttachResult> {
  const errors: string[] = [];
  const nodes: JSONContent[] = [];
  for (const src of sources) {
    const label = nameOf(src);
    try {
      if (typeof src !== "string" && src.size > ATTACH_MAX_BYTES) {
        throw new Error(`File terlalu besar (${formatSize(src.size)}, maksimal ${formatSize(ATTACH_MAX_BYTES)})`);
      }
      const stored = typeof src === "string" ? await native.importAttachment(src) : await native.importAttachmentBytes(src);
      const ext = stored.ext || extOf(stored.fileName);
      const meta = await attachments().create({
        cardId,
        fileName: stored.fileName,
        mimeType: (typeof src !== "string" && src.type) || mimeOf(ext),
        sizeBytes: stored.size,
        sha256: stored.sha256,
        ext,
      });
      primeAttachment(meta);
      nodes.push({ type: "attachment", attrs: { id: meta.id, name: meta.fileName } });
    } catch (e) {
      errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (nodes.length && !editor.isDestroyed) {
    const at = pos ?? editor.state.selection.to;
    editor.chain().focus().insertContentAt(at, nodes).run();
  }
  return { inserted: nodes.length, errors };
}
