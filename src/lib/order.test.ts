import { describe, expect, it } from "vitest";
import {
  displayOrder,
  MIN_GAP,
  positionAfter,
  positionBetween,
  positionMoveBy,
  positionMoveTo,
  splitByDone,
  type Ordered,
  type Placement,
} from "./order";

const item = (id: string, position: number, done = false): Ordered => ({ id, position, done });
const ids = (list: Ordered[]) => list.map((i) => i.id);
const pos = (p: Placement): number => {
  if (typeof p === "string") throw new Error(`expected position, got ${p}`);
  return p.position;
};

/** Terapkan posisi baru lalu kembalikan urutan tampil, untuk menguji hasil akhir. */
const apply = (items: Ordered[], id: string, p: Placement) =>
  ids(displayOrder(items.map((i) => (i.id === id ? { ...i, position: pos(p) } : i)), "bottom"));

describe("positionBetween", () => {
  it("handles empty list and both ends", () => {
    expect(positionBetween(null, null)).toEqual({ position: 1 });
    expect(positionBetween(3, null)).toEqual({ position: 4 });
    expect(positionBetween(null, 3)).toEqual({ position: 2 });
  });

  it("returns the midpoint", () => {
    expect(positionBetween(1, 2)).toEqual({ position: 1.5 });
  });

  it("reports crowded when the gap is too small", () => {
    expect(positionBetween(1, 1 + MIN_GAP / 2)).toBe("crowded");
    expect(positionBetween(2, 2)).toBe("crowded");
  });

  it("stays strictly ordered across repeated halving until crowded", () => {
    let prev = 1;
    const next = 2;
    let steps = 0;
    for (;;) {
      const p = positionBetween(prev, next);
      if (p === "crowded") break;
      expect(pos(p)).toBeGreaterThan(prev);
      expect(pos(p)).toBeLessThan(next);
      prev = pos(p);
      steps++;
    }
    expect(steps).toBeGreaterThan(25);
  });
});

describe("splitByDone / displayOrder", () => {
  const items = [item("c", 3), item("a", 1, true), item("b", 2), item("d", 4, true)];

  it("sorts by position within each section", () => {
    const { open, done } = splitByDone(items);
    expect(ids(open)).toEqual(["b", "c"]);
    expect(ids(done)).toEqual(["a", "d"]);
  });

  it("puts done items at the bottom", () => {
    expect(ids(displayOrder(items, "bottom"))).toEqual(["b", "c", "a", "d"]);
  });

  it("hides done items unless showDone", () => {
    expect(ids(displayOrder(items, "hide"))).toEqual(["b", "c"]);
    expect(ids(displayOrder(items, "hide", true))).toEqual(["b", "c", "a", "d"]);
  });

  it("breaks position ties by id", () => {
    expect(ids(displayOrder([item("y", 1), item("x", 1)], "bottom"))).toEqual(["x", "y"]);
  });

  it("returns an unchecked item to its original place", () => {
    const list = [item("a", 1), item("b", 2, true), item("c", 3)];
    expect(ids(displayOrder(list, "bottom"))).toEqual(["a", "c", "b"]);
    const unchecked = list.map((i) => (i.id === "b" ? { ...i, done: false } : i));
    expect(ids(displayOrder(unchecked, "bottom"))).toEqual(["a", "b", "c"]);
  });
});

describe("positionAfter", () => {
  const items = [item("a", 1), item("b", 2), item("c", 3)];

  it("appends to the end", () => {
    expect(positionAfter(items, null)).toEqual({ position: 4 });
    expect(positionAfter([], null)).toEqual({ position: 1 });
  });

  it("inserts right after the given item", () => {
    expect(positionAfter(items, "a")).toEqual({ position: 1.5 });
    expect(positionAfter(items, "c")).toEqual({ position: 4 });
  });

  it("falls back to append for an unknown id", () => {
    expect(positionAfter(items, "zz")).toEqual({ position: 4 });
  });

  it("uses global order, including done items", () => {
    const list = [item("a", 1), item("b", 2, true), item("c", 3)];
    expect(positionAfter(list, "a")).toEqual({ position: 1.5 });
  });
});

describe("positionMoveTo", () => {
  const items = [item("a", 1), item("b", 2), item("c", 3), item("d", 4)];

  it("moves down and up within the list", () => {
    expect(apply(items, "a", positionMoveTo(items, "a", 2))).toEqual(["b", "c", "a", "d"]);
    expect(apply(items, "d", positionMoveTo(items, "d", 0))).toEqual(["d", "a", "b", "c"]);
    expect(apply(items, "b", positionMoveTo(items, "b", 3))).toEqual(["a", "c", "d", "b"]);
  });

  it("clamps the target index", () => {
    expect(apply(items, "b", positionMoveTo(items, "b", 99))).toEqual(["a", "c", "d", "b"]);
    expect(apply(items, "c", positionMoveTo(items, "c", -5))).toEqual(["c", "a", "b", "d"]);
  });

  it("returns edge when nothing changes or the id is unknown", () => {
    expect(positionMoveTo(items, "b", 1)).toBe("edge");
    expect(positionMoveTo(items, "zz", 0)).toBe("edge");
  });

  it("only moves within the item's section", () => {
    const list = [item("a", 1), item("x", 2, true), item("b", 3), item("y", 4, true)];
    // Indeks dihitung di seksi open [a, b]: pindah a ke indeks 1 = setelah b.
    expect(apply(list, "a", positionMoveTo(list, "a", 1))).toEqual(["b", "a", "x", "y"]);
    // Seksi done [x, y]: pindah y ke awal.
    expect(apply(list, "y", positionMoveTo(list, "y", 0))).toEqual(["a", "b", "y", "x"]);
  });

  it("reports crowded neighbours", () => {
    const list = [item("a", 1), item("b", 1 + MIN_GAP / 4), item("c", 2)];
    expect(positionMoveTo(list, "c", 1)).toBe("crowded");
  });
});

describe("positionMoveBy", () => {
  const items = [item("a", 1), item("b", 2), item("c", 3)];

  it("swaps with the neighbour", () => {
    expect(apply(items, "b", positionMoveBy(items, "b", -1))).toEqual(["b", "a", "c"]);
    expect(apply(items, "b", positionMoveBy(items, "b", 1))).toEqual(["a", "c", "b"]);
  });

  it("returns edge at either end of the section", () => {
    expect(positionMoveBy(items, "a", -1)).toBe("edge");
    expect(positionMoveBy(items, "c", 1)).toBe("edge");
    const list = [item("a", 1), item("x", 2, true)];
    expect(positionMoveBy(list, "a", 1)).toBe("edge");
    expect(positionMoveBy(list, "x", -1)).toBe("edge");
  });
});
