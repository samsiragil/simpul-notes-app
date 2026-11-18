import { describe, expect, it } from "vitest";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Heading from "@tiptap/extension-heading";
import Bold from "@tiptap/extension-bold";
import { MarkdownManager } from "@tiptap/markdown";
import { Attachment } from "./Attachment";

const ID = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
const ID2 = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c";

const md = new MarkdownManager({ extensions: [Document, Paragraph, Text, Heading, Bold, Attachment] });

describe("node lampiran di Markdown", () => {
  it("parse jadi node block di antara paragraf", () => {
    const doc = md.parse(`Awal **tebal**\n\n![Foto \\[1\\].png](attachment:${ID})\n\nAkhir`);
    expect(doc.content?.map((n) => n.type)).toEqual(["paragraph", "attachment", "paragraph"]);
    expect(doc.content?.[1].attrs).toEqual({ id: ID, name: "Foto [1].png" });
  });

  it("baris lampiran tepat setelah paragraf tetap dikenali", () => {
    const doc = md.parse(`Lihat file:\n![Laporan.pdf](attachment:${ID})\n![Data.xlsx](attachment:${ID2})`);
    expect(doc.content?.map((n) => n.type)).toEqual(["paragraph", "attachment", "attachment"]);
  });

  it("bolak-balik tanpa kehilangan lampiran", () => {
    const src = `# Judul\n\n![Foto \\[1\\].png](attachment:${ID})\n\nTeks`;
    expect(md.serialize(md.parse(src))).toBe(src);
  });

  it("gambar web biasa tidak dianggap lampiran", () => {
    const doc = md.parse("Teks ![x](https://x.test/a.png) lanjut");
    expect(doc.content?.map((n) => n.type)).toEqual(["paragraph"]);
  });
});
