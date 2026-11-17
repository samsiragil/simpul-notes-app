import { describe, expect, it } from "vitest";
import { createMemoryRepo } from "../db/memoryRepo";
import { ftsQuery, HIT_END, HIT_START, hitSegments, markHits, markSnippet, matchesAll, searchTerms } from "./search";

const m = (s: string) => `${HIT_START}${s}${HIT_END}`;

describe("ftsQuery", () => {
  it("jadikan setiap kata prefix phrase yang harus cocok semua", () => {
    expect(ftsQuery("rapat  senin")).toBe('"rapat"* "senin"*');
  });

  it("netralkan sintaks FTS5 dari input pengguna", () => {
    expect(ftsQuery('a" OR b')).toBe('"a"* "OR"* "b"*');
    expect(ftsQuery("NEAR(x y)")).toBe('"NEAR(x"* "y)"*');
  });

  it("abaikan kata tanpa huruf atau angka", () => {
    expect(ftsQuery("  -- ... ")).toBeNull();
    expect(searchTerms("c++ & go")).toEqual(["c++", "go"]);
  });
});

describe("penanda sorotan", () => {
  it("pecah teks berpenanda jadi potongan", () => {
    expect(hitSegments(`Riset ${m("font")} baru`)).toEqual([
      { text: "Riset ", hit: false },
      { text: "font", hit: true },
      { text: " baru", hit: false },
    ]);
  });

  it("tandai awal kata yang cocok, tanpa beda huruf besar dan diakritik", () => {
    expect(markHits("Rapat Senin, résumé", ["sen", "resu"])).toBe(`Rapat ${m("Sen")}in, ${m("résu")}mé`);
    expect(markHits("persen", ["sen"])).toBe("persen");
  });

  it("matchesAll butuh semua kata", () => {
    expect(matchesAll(["Belanja", "beras kopi"], ["bel", "kop"])).toBe(true);
    expect(matchesAll(["Belanja", "beras kopi"], ["bel", "teh"])).toBe(false);
  });

  it("snippet di sekitar kecocokan", () => {
    const text = Array.from({ length: 40 }, (_, i) => `kata${i}`).join(" ");
    const snip = markSnippet(text, ["kata20"], 6);
    expect(snip.startsWith("…")).toBe(true);
    expect(snip.endsWith("…")).toBe(true);
    expect(snip).toContain(m("kata20"));
    expect(markSnippet(text, ["tidakada"])).toBe("");
  });
});

describe("memoryRepo.search", () => {
  it("cari judul, isi Note, item Todo, dengan filter tipe", async () => {
    const repo = createMemoryRepo();
    const note = await repo.cards.create("note", { title: "Rapat Senin" });
    await repo.cards.update(note.id, { body: "Bahas **sprint** UI" });
    const todo = await repo.cards.create("todo", { title: "Minggu ini" });
    await repo.todos.create({ id: "item-1", cardId: todo.id, text: "Siapkan sprint review", position: 1 });

    const all = await repo.search.search("sprint", { type: null, groupId: null });
    expect(all.map((h) => h.cardId).sort()).toEqual([note.id, todo.id].sort());
    expect(all.find((h) => h.cardId === note.id)?.snippet).toContain(m("sprint"));

    const todos = await repo.search.search("sprint", { type: "todo", groupId: null });
    expect(todos.map((h) => h.cardId)).toEqual([todo.id]);

    await repo.cards.trash(todo.id);
    const afterTrash = await repo.search.search("sprint", { type: null, groupId: null });
    expect(afterTrash.map((h) => h.cardId)).toEqual([note.id]);
  });

  it("filter group", async () => {
    const repo = createMemoryRepo();
    const a = await repo.cards.create("note", { title: "Ide aplikasi" });
    await repo.cards.create("note", { title: "Ide liburan" });
    const g = await repo.groups.create("Proyek", 1);
    await repo.groups.addCard(g.id, a.id);
    const hits = await repo.search.search("ide", { type: null, groupId: g.id });
    expect(hits.map((h) => h.cardId)).toEqual([a.id]);
    expect(hits[0].title).toBe(`${m("Ide")} aplikasi`);
  });
});
