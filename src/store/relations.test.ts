import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cards, groups, initRepo, linkPair, links } from "../db";
import { useApp, visibleCards } from "./app";

// memoryRepo memakai localStorage; di Node cukup Map sederhana.
const mem = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (n: number) => [...mem.keys()][n] ?? null,
  get length() {
    return mem.size;
  },
} as Storage;

const app = () => useApp.getState();
const card = (id: string) => app().list.find((c) => c.id === id)!;

beforeAll(async () => {
  await initRepo();
});

beforeEach(async () => {
  useApp.setState({ view: "all", groupId: null, typeFilter: "all", selectedId: null, history: [], linkedIds: [] });
  await app().init();
});

describe("linkPair", () => {
  it("selalu mengurutkan pasangan", () => {
    expect(linkPair("b", "a")).toEqual(["a", "b"]);
    expect(linkPair("a", "b")).toEqual(["a", "b"]);
  });
});

describe("link repo (L-1..L-6)", () => {
  it("link dua arah, tanpa ganda, tanpa self-link", async () => {
    const a = await cards().create("note");
    const b = await cards().create("todo");
    await links().link(a.id, b.id);
    await links().link(b.id, a.id);
    await links().link(a.id, a.id);
    expect(await links().linkedIds(a.id)).toEqual([b.id]);
    expect(await links().linkedIds(b.id)).toEqual([a.id]);
    expect((await cards().get(a.id))!.linkCount).toBe(1);
  });

  it("putus link hilang di kedua sisi; hubungkan ulang menghidupkan lagi", async () => {
    const a = await cards().create("note");
    const b = await cards().create("note");
    await links().link(a.id, b.id);
    await links().unlink(b.id, a.id);
    expect(await links().linkedIds(a.id)).toEqual([]);
    expect(await links().linkedIds(b.id)).toEqual([]);
    await links().link(a.id, b.id);
    expect(await links().linkedIds(b.id)).toEqual([a.id]);
  });

  it("card di Trash disembunyikan dan kembali setelah dipulihkan (L-6)", async () => {
    const a = await cards().create("note");
    const b = await cards().create("note");
    await links().link(a.id, b.id);
    await cards().trash(b.id);
    expect(await links().linkedIds(a.id)).toEqual([]);
    expect((await cards().get(a.id))!.linkCount).toBe(0);
    await cards().restore(b.id);
    expect(await links().linkedIds(a.id)).toEqual([b.id]);
  });

  it("hapus permanen memutus link", async () => {
    const a = await cards().create("note");
    const b = await cards().create("note");
    await links().link(a.id, b.id);
    await cards().trash(b.id);
    await cards().destroy(b.id);
    await cards().restore(b.id);
    expect(await links().linkedIds(a.id)).toEqual([]);
  });
});

describe("group repo (G-1..G-5)", () => {
  it("card bisa di banyak group; keluar dari group tidak menghapus card", async () => {
    const c = await cards().create("note");
    const g1 = await groups().create("Satu", 10);
    const g2 = await groups().create("Dua", 11);
    await groups().addCard(g1.id, c.id);
    await groups().addCard(g2.id, c.id);
    await groups().addCard(g2.id, c.id);
    expect((await cards().get(c.id))!.groupIds.sort()).toEqual([g1.id, g2.id].sort());
    await groups().removeCard(g1.id, c.id);
    expect((await cards().get(c.id))!.groupIds).toEqual([g2.id]);
  });

  it("hapus group tidak menghapus card", async () => {
    const c = await cards().create("todo");
    const g = await groups().create("Sementara", 12);
    await groups().addCard(g.id, c.id);
    await groups().remove(g.id);
    const after = await cards().get(c.id);
    expect(after).not.toBeNull();
    expect(after!.groupIds).toEqual([]);
    expect((await groups().list()).some((x) => x.id === g.id)).toBe(false);
  });
});

describe("store: tampilan dan navigasi", () => {
  it("visibleCards memfilter Semua / Tanpa group / group / tipe (G-6, G-7)", async () => {
    const g = (await app().createGroup("Filter"))!;
    const note = await cards().create("note");
    const todo = await cards().create("todo");
    await groups().addCard(g.id, note.id);
    await groups().addCard(g.id, todo.id);
    await app().refresh();
    const s = app();
    const inGroup = visibleCards({ ...s, view: "group", groupId: g.id, typeFilter: "all" }).map((c) => c.id);
    expect(inGroup.sort()).toEqual([note.id, todo.id].sort());
    expect(visibleCards({ ...s, view: "group", groupId: g.id, typeFilter: "todo" }).map((c) => c.id)).toEqual([todo.id]);
    expect(visibleCards({ ...s, view: "ungrouped", typeFilter: "all" }).some((c) => c.id === note.id)).toBe(false);
  });

  it("card baru di dalam group otomatis masuk group itu (C-2)", async () => {
    const g = (await app().createGroup("Proyek"))!;
    await app().setView("group", g.id);
    await app().createCard("note");
    expect(card(app().selectedId!).groupIds).toEqual([g.id]);
  });

  it("buat Todo Card dari dialog Hubungkan: terhubung dan ikut group card asal", async () => {
    const g = (await app().createGroup("Rapat"))!;
    const note = await cards().create("note", { title: "Rapat Senin" });
    await groups().addCard(g.id, note.id);
    await app().refresh();
    app().select(note.id);

    await app().createCard("todo", { title: "Sprint UI", linkTo: note.id });
    const todo = card(app().selectedId!);
    expect(todo.type).toBe("todo");
    expect(todo.title).toBe("Sprint UI");
    expect(todo.groupIds).toEqual([g.id]);
    expect(await links().linkedIds(todo.id)).toEqual([note.id]);
    expect(app().linkedIds).toEqual([note.id]);

    // L-4: Kembali ke Note.
    app().back();
    expect(app().selectedId).toBe(note.id);
  });

  it("Kembali melewati card yang sudah di Trash", async () => {
    const a = await cards().create("note");
    const b = await cards().create("note");
    const c = await cards().create("note");
    await app().refresh();
    app().select(a.id);
    app().select(b.id);
    app().select(c.id);
    await app().trashCard(b.id);
    app().select(c.id);
    app().back();
    expect(app().selectedId).toBe(a.id);
  });

  it("urutan group bisa diubah (G-1)", async () => {
    const before = app().groups.length;
    const x = (await app().createGroup("X"))!;
    const y = (await app().createGroup("Y"))!;
    await app().moveGroup(y.id, before);
    const ids = app().groups.map((g) => g.id);
    expect(ids.indexOf(y.id)).toBeLessThan(ids.indexOf(x.id));
  });
});
