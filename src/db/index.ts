import { isTauri } from "../lib/util";
import { createMemoryRepo } from "./memoryRepo";
import type { CardRepo, TodoRepo } from "./types";

export * from "./types";

interface Repos {
  cards: CardRepo;
  todos: TodoRepo;
}

let repos: Repos | null = null;

/** Di Tauri: SQLite. Di browser biasa (npm run dev): localStorage, untuk mencoba UI. */
export async function initRepo(): Promise<void> {
  if (repos) return;
  if (isTauri()) {
    const { createSqlRepo } = await import("./sqlRepo");
    repos = await createSqlRepo();
  } else {
    repos = createMemoryRepo();
  }
}

function ready(): Repos {
  if (!repos) throw new Error("Repository belum diinisialisasi");
  return repos;
}

export const cards = (): CardRepo => ready().cards;
export const todos = (): TodoRepo => ready().todos;
