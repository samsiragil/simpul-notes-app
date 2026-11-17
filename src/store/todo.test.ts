import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cards, initRepo, todos } from "../db";
import { displayOrder, MIN_GAP } from "../lib/order";
import { useApp } from "./app";
import { TEXT_SAVE_MS, useTodo } from "./todo";

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

const state = () => useTodo.getState();
const texts = () => displayOrder(state().items, "bottom").map((i) => i.text);
const saved = async (cardId: string) => (await todos().list(cardId)).map((i) => i.text);
const listCard = (id: string) => useApp.getState().list.find((c) => c.id === id)!;

let cardId: string;

beforeAll(async () => {
  await initRepo();
});

beforeEach(async () => {
  cardId = (await cards().create("todo")).id;
  useApp.setState({ view: "all", list: await cards().list("active") });
  await state().load(cardId);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Tambah beberapa item berurutan di akhir lalu tunggu tersimpan. */
async function seed(...values: string[]) {
  for (const v of values) await state().add(null, v);
  await state().flush();
  return displayOrder(state().items, "bottom").map((i) => i.id);
}

describe("useTodo", () => {
  it("adds an item at the end and focuses it (T-1)", async () => {
    const id = await state().add(null, "Susu");
    expect(state().focus).toEqual({ id, caret: "end" });
    await state().flush();
    expect(await saved(cardId)).toEqual(["Susu"]);
    expect(listCard(cardId).progress).toEqual({ done: 0, total: 1 });
  });

  it("inserts after the given item (Enter in the middle)", async () => {
    const [a] = await seed("A", "C");
    await state().add(a, "B");
    await state().flush();
    expect(texts()).toEqual(["A", "B", "C"]);
    expect(await saved(cardId)).toEqual(["A", "B", "C"]);
  });

  it("debounces text edits and writes the last value (T-3)", async () => {
    const [a] = await seed("");
    vi.useFakeTimers();
    const update = vi.spyOn(todos(), "update");
    state().setText(a, "R");
    state().setText(a, "Ro");
    state().setText(a, "Roti");
    expect(update).not.toHaveBeenCalled();
    vi.advanceTimersByTime(TEXT_SAVE_MS);
    vi.useRealTimers();
    await state().flush();
    expect(update).toHaveBeenCalledTimes(1);
    expect(await saved(cardId)).toEqual(["Roti"]);
  });

  it("toggles done and updates progress in the card list (T-2, T-5)", async () => {
    const [a] = await seed("A", "B");
    state().toggle(a);
    await state().flush();
    expect(listCard(cardId).progress).toEqual({ done: 1, total: 2 });
    const stored = (await todos().list(cardId)).find((i) => i.id === a)!;
    expect(stored.done).toBe(true);
    expect(stored.doneAt).not.toBeNull();

    state().toggle(a);
    await state().flush();
    expect((await todos().list(cardId)).find((i) => i.id === a)!.doneAt).toBeNull();
    expect(listCard(cardId).progress).toEqual({ done: 0, total: 2 });
  });

  it("removes an item and drops its pending text (T-3)", async () => {
    const [a] = await seed("A", "B");
    const error = vi.spyOn(console, "error");
    state().setText(a, "A diubah");
    state().remove(a);
    await state().flush();
    expect(error).not.toHaveBeenCalled();
    expect(await saved(cardId)).toEqual(["B"]);
    expect(listCard(cardId).progress).toEqual({ done: 0, total: 1 });
  });

  it("moves items with Alt+Up/Down and ignores the edges (T-4)", async () => {
    const [a, , c] = await seed("A", "B", "C");
    await state().move(c, -1);
    expect(texts()).toEqual(["A", "C", "B"]);
    await state().move(a, -1);
    expect(texts()).toEqual(["A", "C", "B"]);
    await state().flush();
    expect(await saved(cardId)).toEqual(["A", "C", "B"]);
  });

  it("moves an item to an index by drag (T-4)", async () => {
    const [a] = await seed("A", "B", "C");
    await state().moveTo(a, 2);
    await state().flush();
    expect(texts()).toEqual(["B", "C", "A"]);
    expect(await saved(cardId)).toEqual(["B", "C", "A"]);
  });

  it("rebalances crowded positions before moving", async () => {
    await todos().create({ id: "x1", cardId, text: "A", position: 1 });
    await todos().create({ id: "x2", cardId, text: "B", position: 1 + MIN_GAP / 4 });
    await todos().create({ id: "x3", cardId, text: "C", position: 2 });
    await state().load(cardId);
    const rebalance = vi.spyOn(todos(), "rebalance");
    await state().moveTo("x3", 1);
    await state().flush();
    expect(rebalance).toHaveBeenCalledTimes(1);
    expect(texts()).toEqual(["A", "C", "B"]);
    expect(await saved(cardId)).toEqual(["A", "C", "B"]);
  });

  it("keeps the latest card when loads overlap", async () => {
    await seed("Milik card pertama");
    const other = (await cards().create("todo")).id;
    await todos().create({ id: "o1", cardId: other, text: "Milik card kedua", position: 1 });
    const first = state().load(cardId);
    const second = state().load(other);
    await Promise.all([first, second]);
    expect(state().cardId).toBe(other);
    expect(texts()).toEqual(["Milik card kedua"]);
  });

  it("flushes pending text of the previous card on load", async () => {
    const [a] = await seed("");
    state().setText(a, "Belum tersimpan");
    const other = (await cards().create("todo")).id;
    await state().load(other);
    await state().flush();
    expect(await saved(cardId)).toEqual(["Belum tersimpan"]);
  });

  it("resyncs from the repo when a write fails", async () => {
    await seed("A");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(todos(), "update").mockRejectedValueOnce(new Error("disk penuh"));
    state().toggle(state().items[0].id);
    await state().flush();
    expect(state().items[0].done).toBe(false);
  });
});
