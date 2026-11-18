// Node lampiran di Note: gambar, video, dan audio tampil langsung; file lain tampil sebagai kartu.
// Di Markdown: satu baris `![nama](attachment:<id>)` (lihat src/lib/attachments.ts).
import { useEffect, useState } from "react";
import { Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { attachments, type Attachment as AttachmentMeta } from "../db";
import { attachmentMarkdown, attachmentStart, extOf, formatSize, kindOf, parseAttachmentBlock, storedName } from "../lib/attachments";
import * as native from "../lib/native";
import {
  IconDownload,
  IconFile,
  IconFileArchive,
  IconFileAudio,
  IconFileDoc,
  IconFileImage,
  IconFileSheet,
  IconFileVideo,
  IconFolderOpen,
  IconOpenExternal,
  IconWarning,
} from "../components/Icons";

export const Attachment = Node.create({
  name: "attachment",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      id: { default: null },
      name: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-attachment]",
        getAttrs: (el) => ({ id: el.getAttribute("data-attachment"), name: el.getAttribute("data-name") ?? "" }),
      },
    ];
  },

  renderHTML({ node }) {
    return ["div", { "data-attachment": node.attrs.id, "data-name": node.attrs.name }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AttachmentView, {
      // Kontrol video/audio dan tombol aksi menerima klik sendiri, bukan memilih node.
      stopEvent: ({ event }) => event.target instanceof Element && !!event.target.closest("video, audio, button"),
    });
  },

  markdownTokenName: "attachment",
  markdownTokenizer: {
    name: "attachment",
    level: "block",
    start: (src) => attachmentStart(src),
    tokenize(src) {
      const m = parseAttachmentBlock(src);
      if (m) return { type: "attachment", raw: m.raw, id: m.id, name: m.name };
    },
  },
  parseMarkdown: (token, helpers) => helpers.createNode("attachment", { id: token.id, name: token.name }),
  renderMarkdown: (node) => attachmentMarkdown(node.attrs?.id ?? "", node.attrs?.name ?? ""),
});

// ---------- Metadata ----------

const metaCache = new Map<string, Promise<AttachmentMeta | null>>();

/** Simpan metadata lampiran baru ke cache supaya langsung tampil setelah disisipkan. */
export function primeAttachment(meta: AttachmentMeta) {
  metaCache.set(meta.id, Promise.resolve(meta));
}

type State =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; meta: AttachmentMeta; file: string; url: string | null };

function useAttachment(id: string | null): State {
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    if (!id) return setState({ status: "missing" });
    let alive = true;
    let p = metaCache.get(id);
    if (!p) {
      p = attachments().get(id).catch(() => null);
      metaCache.set(id, p);
    }
    p.then(async (meta) => {
      if (!meta) return alive && setState({ status: "missing" });
      const file = storedName(meta.sha256, meta.ext);
      const url = native.hasNative() ? await native.attachmentUrl(file).catch(() => null) : null;
      if (alive) setState({ status: "ready", meta, file, url });
    });
    return () => {
      alive = false;
    };
  }, [id]);
  return state;
}

// ---------- Tampilan ----------

function fileIcon(ext: string) {
  if (["pdf", "doc", "docx", "odt", "rtf", "txt", "md"].includes(ext)) return <IconFileDoc />;
  if (["xls", "xlsx", "ods", "csv"].includes(ext)) return <IconFileSheet />;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return <IconFileArchive />;
  const kind = kindOf(ext);
  if (kind === "image" || ["heic", "tif", "tiff", "psd"].includes(ext)) return <IconFileImage />;
  if (kind === "video" || ["mkv", "avi", "wmv", "flv"].includes(ext)) return <IconFileVideo />;
  if (kind === "audio" || ["wma", "mid", "midi"].includes(ext)) return <IconFileAudio />;
  return <IconFile />;
}

function report(e: unknown) {
  console.error(e);
  window.alert(`Lampiran: ${e instanceof Error ? e.message : String(e)}`);
}

function Actions({ file, name }: { file: string; name: string }) {
  if (!native.hasNative()) return null;
  const run = (fn: () => Promise<unknown>) => () => void fn().catch(report);
  return (
    <span className="att-actions">
      <button type="button" title="Buka dengan aplikasi default" onClick={run(() => native.openAttachment(file))}>
        <IconOpenExternal />
      </button>
      <button type="button" title="Tampilkan di File Explorer" onClick={run(() => native.revealAttachment(file))}>
        <IconFolderOpen />
      </button>
      <button type="button" title="Simpan sebagai…" onClick={run(() => native.saveAttachmentAs(file, name))}>
        <IconDownload />
      </button>
    </span>
  );
}

function FileCard({ name, meta, file, broken }: { name: string; meta: AttachmentMeta; file: string; broken?: boolean }) {
  const ext = meta.ext || extOf(name);
  const open = () => native.hasNative() && void native.openAttachment(file).catch(report);
  return (
    <div className="att-file" onDoubleClick={open} title="Klik dua kali untuk membuka">
      <span className="att-file-icon">{fileIcon(ext)}</span>
      <span className="att-file-text">
        <span className="att-file-name">{name}</span>
        <span className="att-file-meta">
          {broken ? "Tidak bisa diputar di sini" : `${ext ? ext.toUpperCase() : "File"} · ${formatSize(meta.sizeBytes)}`}
        </span>
      </span>
      <Actions file={file} name={name} />
    </div>
  );
}

function AttachmentView({ node, selected }: ReactNodeViewProps) {
  const id = node.attrs.id as string | null;
  const name = (node.attrs.name as string) || "Lampiran";
  const state = useAttachment(id);
  const [broken, setBroken] = useState(false);

  let body: React.ReactNode;
  if (state.status === "loading") {
    body = <div className="att-file att-loading">{name}</div>;
  } else if (state.status === "missing") {
    body = (
      <div className="att-file att-missing">
        <span className="att-file-icon"><IconWarning /></span>
        <span className="att-file-text">
          <span className="att-file-name">{name}</span>
          <span className="att-file-meta">Lampiran tidak ditemukan</span>
        </span>
      </div>
    );
  } else {
    const { meta, file, url } = state;
    const kind = kindOf(meta.ext);
    if (!url || broken || kind === "file") {
      body = <FileCard name={name} meta={meta} file={file} broken={broken && kind !== "image"} />;
    } else if (kind === "image") {
      body = (
        <figure className="att-media">
          <img src={url} alt={name} draggable={false} onError={() => setBroken(true)} onDoubleClick={() => void native.openAttachment(file).catch(report)} />
          <Actions file={file} name={name} />
        </figure>
      );
    } else if (kind === "video") {
      body = (
        <figure className="att-media">
          <video src={url} controls preload="metadata" onError={() => setBroken(true)} />
          <Actions file={file} name={name} />
        </figure>
      );
    } else {
      body = (
        <div className="att-file att-audio">
          <span className="att-file-icon"><IconFileAudio /></span>
          <span className="att-file-text">
            <span className="att-file-name">{name}</span>
            <audio src={url} controls preload="metadata" onError={() => setBroken(true)} />
          </span>
          <Actions file={file} name={name} />
        </div>
      );
    }
  }

  return (
    <NodeViewWrapper className={`att${selected ? " is-selected" : ""}`} contentEditable={false} data-drag-handle="">
      {body}
    </NodeViewWrapper>
  );
}
