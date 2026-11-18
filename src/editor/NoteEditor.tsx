import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import type { Editor } from "@tiptap/core";
import * as native from "../lib/native";
import { Attachment } from "./Attachment";
import { attachFiles, type AttachSource } from "./attach";
import { IconBold, IconCode, IconHeading, IconHighlight, IconItalic, IconLink, IconStrike, IconUnderline } from "../components/Icons";

interface Props {
  /** Markdown awal. Editor dibuat ulang saat cardId berganti. */
  cardId: string;
  initialMarkdown: string;
  editable: boolean;
  onChange(markdown: string): void;
  ref?: Ref<NoteEditorHandle>;
}

export interface NoteEditorHandle {
  /** Pilih file lewat dialog lalu lampirkan di posisi kursor. */
  pickAttachments(): void;
}

function getMarkdown(editor: Editor): string {
  return editor.getMarkdown();
}

export function NoteEditor({ cardId, initialMarkdown, editable, onChange, ref }: Props) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const attachRef = useRef<(sources: AttachSource[], pos?: number) => void>(() => {});
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dropOver, setDropOver] = useState(false);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, linkOnPaste: true },
      }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: "Mulai menulis… (ketik # untuk heading, - untuk list, [] untuk checklist)" }),
      Attachment,
      Markdown,
    ],
    [],
  );

  const editor = useEditor(
    {
      extensions,
      content: initialMarkdown,
      contentType: "markdown",
      editable,
      editorProps: {
        attributes: { class: "note-body", spellcheck: "false" },
        // Paste file atau screenshot = lampiran. Paste dari Word/Excel juga membawa gambar,
        // jadi file hanya dipakai jika clipboard tidak berisi teks.
        handlePaste: (view, event) => {
          const files = [...(event.clipboardData?.files ?? [])];
          if (!files.length || !view.editable || !native.hasNative()) return false;
          if ((event.clipboardData?.getData("text/plain") ?? "").trim()) return false;
          event.preventDefault();
          attachRef.current(files);
          return true;
        },
      },
      onUpdate: ({ editor }) => onChangeRef.current(getMarkdown(editor)),
    },
    [cardId],
  );

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  attachRef.current = (sources, pos) => {
    if (!editor || !sources.length) return;
    setErrors([]);
    setBusy(`Menyalin ${sources.length} file…`);
    attachFiles(editor, cardId, sources, pos)
      .then((r) => setErrors(r.errors))
      .finally(() => setBusy(null));
  };

  useImperativeHandle(ref, () => ({
    pickAttachments: () => {
      native
        .pickFiles("Lampirkan file")
        .then((paths) => attachRef.current(paths))
        .catch((e) => setErrors([String(e)]));
    },
  }));

  useEffect(() => {
    if (!errors.length) return;
    const t = setTimeout(() => setErrors([]), 8000);
    return () => clearTimeout(t);
  }, [errors]);

  // Drag & drop file dari File Explorer. Tauri menangkap drop file di tingkat jendela
  // (bukan event HTML5), lengkap dengan path aslinya.
  useEffect(() => {
    if (!editor || !editable || !native.hasNative()) return;
    let unlisten: (() => void) | undefined;
    let disposed = false;
    const target = (pos: { x: number; y: number }) => {
      const x = pos.x / window.devicePixelRatio;
      const y = pos.y / window.devicePixelRatio;
      const el = document.elementFromPoint(x, y);
      const dom = editor.view.dom;
      if (!el) return null;
      if (dom.contains(el)) return editor.view.posAtCoords({ left: x, top: y })?.pos ?? editor.state.doc.content.size;
      const pane = dom.closest(".pane-content");
      return pane?.contains(el) ? editor.state.doc.content.size : null;
    };
    import("@tauri-apps/api/webview").then(({ getCurrentWebview }) =>
      getCurrentWebview()
        .onDragDropEvent(({ payload: p }) => {
          if (p.type === "leave") return setDropOver(false);
          const pos = target(p.position);
          if (p.type === "drop") {
            setDropOver(false);
            if (pos !== null) attachRef.current(p.paths, pos);
          } else {
            setDropOver(pos !== null);
          }
        })
        .then((fn) => (disposed ? fn() : (unlisten = fn))),
    );
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [editor, editable]);

  if (!editor) return null;
  return (
    <>
      {editable && <FormatBubble editor={editor} />}
      <EditorContent editor={editor} className={dropOver ? "drop-over" : undefined} />
      {(busy || errors.length > 0) && (
        <div className={`att-status${errors.length ? " error" : ""}`} role="status">
          {busy && <div>{busy}</div>}
          {errors.map((e) => (
            <div key={e}>Gagal melampirkan {e}</div>
          ))}
        </div>
      )}
    </>
  );
}

function FormatBubble({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      highlight: e.isActive("highlight"),
      code: e.isActive("code"),
      link: e.isActive("link"),
      h2: e.isActive("heading", { level: 2 }),
    }),
  });

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL link", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "") editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const b = (on: boolean, label: React.ReactNode, title: string, run: () => void) => (
    <button type="button" className={on ? "on" : ""} title={title} onMouseDown={(e) => e.preventDefault()} onClick={run}>
      {label}
    </button>
  );

  return (
    <BubbleMenu editor={editor} options={{ placement: "top" }}>
      <div className="bubble">
        {b(s.bold, <IconBold />, "Bold (Ctrl+B)", () => editor.chain().focus().toggleBold().run())}
        {b(s.italic, <IconItalic />, "Italic (Ctrl+I)", () => editor.chain().focus().toggleItalic().run())}
        {b(s.underline, <IconUnderline />, "Underline (Ctrl+U)", () => editor.chain().focus().toggleUnderline().run())}
        {b(s.strike, <IconStrike />, "Coret (Ctrl+Shift+S)", () => editor.chain().focus().toggleStrike().run())}
        {b(s.highlight, <IconHighlight />, "Highlight (Ctrl+Shift+H)", () => editor.chain().focus().toggleHighlight().run())}
        <span className="sep" />
        {b(s.code, <IconCode />, "Inline code (Ctrl+E)", () => editor.chain().focus().toggleCode().run())}
        {b(s.link, <IconLink />, "Link", setLink)}
        {b(s.h2, <IconHeading />, "Heading 2", () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
      </div>
    </BubbleMenu>
  );
}
