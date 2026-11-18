import { describe, expect, it } from "vitest";
import {
  attachmentMarkdown,
  attachmentStart,
  extOf,
  formatSize,
  kindOf,
  parseAttachmentBlock,
  replaceAttachments,
  storedName,
} from "./attachments";
import { markdownToText } from "./util";

const ID = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";

describe("jenis file", () => {
  it("ekstensi dan jenis tampilan", () => {
    expect(extOf("Foto Liburan.JPG")).toBe("jpg");
    expect(extOf(".gitignore")).toBe("");
    expect(extOf("tanpa-ekstensi")).toBe("");
    expect(kindOf("png")).toBe("image");
    expect(kindOf("mp4")).toBe("video");
    expect(kindOf("mkv")).toBe("file");
    expect(kindOf("mp3")).toBe("audio");
    expect(kindOf("xlsx")).toBe("file");
    expect(storedName("ab", "")).toBe("ab");
    expect(storedName("ab", "pdf")).toBe("ab.pdf");
  });

  it("ukuran file", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(1536)).toBe("1,5 KB");
    expect(formatSize(250 * 1024 * 1024)).toBe("250 MB");
  });
});

describe("referensi Markdown", () => {
  it("bolak-balik dengan nama berisi kurung siku", () => {
    const md = attachmentMarkdown(ID, "Foto [final] \\ v2.png");
    expect(parseAttachmentBlock(md + "\n\nlanjut")).toEqual({ raw: md + "\n", name: "Foto [final] \\ v2.png", id: ID });
  });

  it("hanya dikenali sebagai block di awal baris", () => {
    expect(parseAttachmentBlock(`teks ![a](attachment:${ID})`)).toBeNull();
    expect(attachmentStart(`paragraf\n![a](attachment:${ID})`)).toBe(9);
    expect(attachmentStart(`teks ![a](attachment:${ID})`)).toBe(-1);
    expect(attachmentStart("![gambar web](https://x.test/a.png)")).toBe(-1);
  });

  it("ganti semua referensi", () => {
    const md = `a\n\n${attachmentMarkdown(ID, "x.pdf")}\n\nb`;
    expect(replaceAttachments(md, (id, name) => `<${id}|${name}>`)).toBe(`a\n\n<${ID}|x.pdf>\n\nb`);
  });

  it("nama lampiran ikut terindeks pencarian", () => {
    expect(markdownToText(`Lihat\n\n${attachmentMarkdown(ID, "Laporan Q3.pdf")}`)).toBe("Lihat Laporan Q3.pdf");
  });
});
