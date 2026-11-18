import { isTauri } from "../lib/util";
import { createMemoryRepo } from "./memoryRepo";
import type { AttachmentRepo, CardRepo, DataRepo, GroupRepo, LinkRepo, SearchRepo, TodoRepo } from "./types";

export * from "./types";

export interface Repos {
  cards: CardRepo;
  todos: TodoRepo;
  links: LinkRepo;
  groups: GroupRepo;
  search: SearchRepo;
  data: DataRepo;
  attachments: AttachmentRepo;
}

let repos: Repos | null = null;

/** Di Tauri: SQLite. Di browser biasa (npm run dev): localStorage, untuk mencoba UI. */
export async function initRepo(): Promise<void> {
  if (repos) return;
  if (isTauri()) {
    const [{ createSqlRepo }, { dataInfo }] = await Promise.all([import("./sqlRepo"), import("../lib/native")]);
    repos = await createSqlRepo((await dataInfo()).dbUrl);
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
export const links = (): LinkRepo => ready().links;
export const groups = (): GroupRepo => ready().groups;
export const search = (): SearchRepo => ready().search;
export const data = (): DataRepo => ready().data;
export const attachments = (): AttachmentRepo => ready().attachments;
