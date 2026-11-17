import { describe, expect, it } from "vitest";
import type { Snapshot } from "../db/types";
import { buildExport, exportFolderName, localDate, safeFileName } from "./exporter";

const T = Date.UTC(2026, 10, 17, 2, 30);

const snap: Snapshot = {
  cards: [
    { id: "n1", type: "note", title: "Rapat: Senin?", body: "## Agenda\n\n- sidebar", pinned: true, createdAt: T, updatedAt: T, trashedAt: null },
    { id: "t1", type: "todo", title: "Sprint UI", body: null, pinned: false, createdAt: T, updatedAt: T, trashedAt: null },
    { id: "n2", type: "note", title: "Rapat: Senin?", body: "", pinned: false, createdAt: T, updatedAt: T, trashedAt: null },
    { id: "x1", type: "note", title: "", body: "lama", pinned: false, createdAt: T, updatedAt: T, trashedAt: T },
  ],
  todoItems: [
    { id: "i1", cardId: "t1", text: "Desain", done: true, position: 1, doneAt: T, createdAt: T, updatedAt: T },
    { id: "i2", cardId: "t1", text: "Review", done: false, position: 2, doneAt: null, createdAt: T, updatedAt: T },
  ],
  links: [{ cardA: "n1", cardB: "t1", createdAt: T, updatedAt: T }],
  groups: [{ id: "g1", name: "Proyek", position: 1, createdAt: T, updatedAt: T }],
  groupMembers: [{ groupId: "g1", cardId: "n1", createdAt: T, updatedAt: T }],
};

describe("safeFileName", () => {
  it("buang karakter terlarang Windows dan nama khusus", () => {
    expect(safeFileName('a<b>:c"/d\\e|f?g*')).toBe("a b c d e f g");
    expect(safeFileName("  ")).toBe("Tanpa judul");
    expect(safeFileName("CON")).toBe("CON_");
    expect(safeFileName("akhir titik...")).toBe("akhir titik");
  });
});

describe("nama folder dan tanggal", () => {
  it("format lokal", () => {
    const d = new Date(2026, 0, 5, 9, 7);
    expect(localDate(d)).toBe("2026-01-05");
    expect(exportFolderName(d)).toBe("Simpul-export-2026-01-05-0907");
  });
});

describe("buildExport", () => {
  const files = buildExport(snap, T);
  const byPath = new Map(files.map((f) => [f.path, f.content]));

  it("data.json berisi seluruh snapshot", () => {
    const json = JSON.parse(byPath.get("data.json")!);
    expect(json.version).toBe(1);
    expect(json.cards).toHaveLength(4);
    expect(json.links).toEqual(snap.links);
  });

  it("satu Markdown per card, nama unik, Trash terpisah", () => {
    expect([...byPath.keys()].sort()).toEqual(
      ["cards/Rapat Senin.md", "cards/Rapat Senin (2).md", "cards/Sprint UI.md", "data.json", "trash/Tanpa judul.md"].sort(),
    );
  });

  it("Note: frontmatter + isi Markdown", () => {
    const md = byPath.get("cards/Rapat Senin.md")!;
    expect(md).toContain('title: "Rapat: Senin?"');
    expect(md).toContain("pinned: true");
    expect(md).toContain('groups: ["Proyek"]');
    expect(md).toContain('links: ["Sprint UI"]');
    expect(md).toContain("# Rapat: Senin?\n\n## Agenda\n\n- sidebar\n");
  });

  it("Todo: checklist Markdown", () => {
    const md = byPath.get("cards/Sprint UI.md")!;
    expect(md).toContain("- [x] Desain\n- [ ] Review");
    expect(md).toContain('links: ["Rapat: Senin?"]');
  });

  it("card di Trash mencatat waktu dibuang", () => {
    expect(byPath.get("trash/Tanpa judul.md")).toContain("trashed: 2026-11-17T02:30:00.000Z");
  });
});
