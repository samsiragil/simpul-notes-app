import { useEffect, useMemo, useRef } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import type { Editor } from "@tiptap/core";
import { IconBold, IconCode, IconHeading, IconHighlight, IconItalic, IconLink, IconStrike, IconUnderline } from "../components/Icons";

interface Props {
  /** Markdown awal. Editor dibuat ulang saat cardId berganti. */
  cardId: string;
  initialMarkdown: string;
  editable: boolean;
  onChange(markdown: string): void;
}

function getMarkdown(editor: Editor): string {
  return editor.getMarkdown();
}

export function NoteEditor({ cardId, initialMarkdown, editable, onChange }: Props) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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
      editorProps: { attributes: { class: "note-body", spellcheck: "false" } },
      onUpdate: ({ editor }) => onChangeRef.current(getMarkdown(editor)),
    },
    [cardId],
  );

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) return null;
  return (
    <>
      {editable && <FormatBubble editor={editor} />}
      <EditorContent editor={editor} />
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
