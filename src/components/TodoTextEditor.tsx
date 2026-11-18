import { Node, type Editor, type JSONContent } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useLayoutEffect, useRef } from "react";
import { parseInline, serializeInline, type InlineRun } from "../lib/todoText";

/** Posisi kursor saat editor dibuka: awal, akhir, atau offset karakter teks tampilan. */
export type TodoCaret = "start" | "end" | number;

export interface TodoTextEditorHandlers {
  onChange(text: string): void;
  /** `Enter`: item baru di bawahnya. */
  onEnter(): void;
  /** `Ctrl+Enter`: centang. */
  onToggle(): void;
  /** `Backspace` di item kosong. */
  onRemoveEmpty(): void;
  /** `Alt+Up/Down`. */
  onMove(dir: -1 | 1): void;
  /** Panah atas di baris pertama / bawah di baris terakhir. */
  onExit(dir: "up" | "down"): void;
  onOpenLink(href: string): void;
  onBlur(): void;
}

interface Props extends TodoTextEditorHandlers {
  text: string;
  caret: TodoCaret;
}

/** Dokumen item hanya berisi satu paragraf (item Todo tidak punya baris baru). */
const NBSP = String.fromCharCode(160);

const SingleLineDoc = Node.create({ name: "doc", topNode: true, content: "paragraph" });

function toDoc(text: string): JSONContent {
  const content = parseInline(text).map((s) => {
    const marks: { type: string; attrs?: Record<string, string> }[] = [];
    if (s.bold) marks.push({ type: "bold" });
    if (s.italic) marks.push({ type: "italic" });
    if (s.mark) marks.push({ type: "highlight" });
    if (s.href) marks.push({ type: "link", attrs: { href: s.href } });
    return { type: "text", text: s.text, ...(marks.length ? { marks } : {}) };
  });
  return { type: "doc", content: [{ type: "paragraph", ...(content.length ? { content } : {}) }] };
}

function toText(editor: Editor): string {
  const nodes: JSONContent[] = editor.getJSON().content?.[0]?.content ?? [];
  const runs: InlineRun[] = nodes.map((n: JSONContent) => {
    const has = (t: string) => n.marks?.some((m) => m.type === t) ?? false;
    const href = n.marks?.find((m) => m.type === "link")?.attrs?.href as string | undefined;
    // contenteditable bisa menyisipkan NBSP untuk spasi di akhir teks.
    return { text: (n.text ?? "").replaceAll(NBSP, " "), bold: has("bold"), italic: has("italic"), mark: has("highlight"), href };
  });
  return serializeInline(runs);
}

const extensions = [
  StarterKit.configure({
    document: false,
    heading: false,
    blockquote: false,
    bulletList: false,
    orderedList: false,
    listItem: false,
    listKeymap: false,
    codeBlock: false,
    code: false,
    horizontalRule: false,
    hardBreak: false,
    strike: false,
    underline: false,
    dropcursor: false,
    gapcursor: false,
    trailingNode: false,
    link: { openOnClick: false, autolink: true, linkOnPaste: true },
  }),
  SingleLineDoc,
  Highlight,
  Placeholder.configure({ placeholder: "Item kosong" }),
];

/**
 * Editor teks satu item Todo: WYSIWYG untuk tebal (`Ctrl+B`), miring (`Ctrl+I`),
 * highlight (`Ctrl+Shift+H`) dan link, disimpan sebagai teks bergaya Markdown.
 * Hanya dipasang selama item sedang diedit.
 */
export function TodoTextEditor({ text, caret, ...handlers }: Props) {
  const h = useRef(handlers);
  h.current = handlers;

  const editor = useEditor({
    extensions,
    content: toDoc(text),
    editorProps: {
      attributes: { class: "todo-text todo-editor", spellcheck: "false" },
      // Item satu baris: baris baru dari clipboard menjadi spasi.
      transformPastedText: (t) => t.replace(/\s*\n\s*/g, " "),
      handleKeyDown: (view, e) => {
        const run = (fn: () => void) => {
          e.preventDefault();
          fn();
          return true;
        };
        const mod = e.ctrlKey || e.metaKey;
        if (e.key === "Enter" && mod) return run(() => h.current.onToggle());
        if (e.key === "Enter" && !e.altKey) return run(() => (e.shiftKey ? undefined : h.current.onEnter()));
        if (e.key === "Backspace" && view.state.doc.textContent === "") return run(() => h.current.onRemoveEmpty());
        if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
          return run(() => h.current.onMove(e.key === "ArrowUp" ? -1 : 1));
        }
        if (!e.shiftKey && !mod && view.state.selection.empty) {
          if (e.key === "ArrowUp" && view.endOfTextblock("up")) return run(() => h.current.onExit("up"));
          if (e.key === "ArrowDown" && view.endOfTextblock("down")) return run(() => h.current.onExit("down"));
        }
        return false;
      },
      // Ctrl+klik membuka link saat sedang mengedit.
      handleClick: (view, pos, e) => {
        if (!(e.ctrlKey || e.metaKey)) return false;
        const link = view.state.doc
          .resolve(pos)
          .marks()
          .find((m) => m.type.name === "link");
        if (!link) return false;
        h.current.onOpenLink(link.attrs.href as string);
        return true;
      },
    },
    onUpdate: ({ editor }) => h.current.onChange(toText(editor)),
    // Diperiksa sesudahnya: remount (StrictMode) atau pembuatan ulang editor sempat
    // melepas fokus sesaat, dan itu bukan blur dari pengguna.
    onBlur: ({ editor }) => {
      setTimeout(() => {
        if (!editor.isDestroyed && !editor.view.hasFocus()) h.current.onBlur();
      });
    },
  });

  // Fokus langsung saat terpasang (bukan `autofocus`/`onCreate` TipTap yang tertunda), agar
  // ketikan cepat setelah Enter atau panah tidak jatuh ke item sebelumnya.
  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const end = editor.state.doc.content.size - 1;
    const pos = caret === "start" ? 1 : caret === "end" ? end : Math.min(Math.max(1, caret + 1), end);
    editor.commands.setTextSelection(pos);
    editor.view.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return <EditorContent editor={editor} className="todo-text-wrap" />;
}
