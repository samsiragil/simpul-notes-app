import { isTauri } from "../lib/util";
import { createMemoryRepo } from "./memoryRepo";
import type { CardRepo } from "./types";

export * from "./types";

let repo: CardRepo | null = null;

/** Di Tauri: SQLite. Di browser biasa (npm run dev): localStorage, untuk mencoba UI. */
export async function initRepo(): Promise<CardRepo> {
  if (repo) return repo;
  if (isTauri()) {
    const { createSqlRepo } = await import("./sqlRepo");
    repo = await createSqlRepo();
  } else {
    repo = createMemoryRepo();
  }
  return repo;
}

export function cards(): CardRepo {
  if (!repo) throw new Error("Repository belum diinisialisasi");
  return repo;
}
