// P-6: export semua data ke folder Markdown + JSON.
import type { Snapshot, SnapshotCard } from "../db/types";
import type { ExportFile } from "./native";

export const EXPORT_VERSION = 1;

const pad = (n: number) => String(n).padStart(2, "0");

/** Tanggal lokal `YYYY-MM-DD` (nama file backup harian). */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Nama folder export, misal `Simpul-export-2026-11-17-0930`. */
export function exportFolderName(d = new Date()): string {
  return `Simpul-export-${localDate(d)}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** Nama file aman untuk Windows dari judul card. */
export function safeFileName(title: string, max = 80): string {
  let name = title
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .replace(/[. ]+$/, "");
  if (!name) name = "Tanpa judul";
  if (RESERVED.test(name)) name += "_";
  return name;
}

const iso = (ms: number) => new Date(ms).toISOString();
const yamlStr = (s: string) => JSON.stringify(s);
const yamlList = (xs: string[]) => `[${xs.map(yamlStr).join(", ")}]`;

/** Isi file Markdown satu card: frontmatter, judul, lalu isi Note atau checklist Todo. */
export function cardMarkdown(
  card: SnapshotCard,
  ctx: { items: { text: string; done: boolean }[]; groups: string[]; links: string[] },
): string {
  const title = card.title.trim() || "Tanpa judul";
  const front = [
    "---",
    `id: ${card.id}`,
    `type: ${card.type}`,
    `title: ${yamlStr(card.title)}`,
    `pinned: ${card.pinned}`,
    `created: ${iso(card.createdAt)}`,
    `updated: ${iso(card.updatedAt)}`,
    ...(card.trashedAt !== null ? [`trashed: ${iso(card.trashedAt)}`] : []),
    `groups: ${yamlList(ctx.groups)}`,
    `links: ${yamlList(ctx.links)}`,
    "---",
  ].join("\n");
  const body =
    card.type === "note"
      ? (card.body ?? "").trim()
      : ctx.items.map((i) => `- [${i.done ? "x" : " "}] ${i.text.replace(/\s*\n\s*/g, " ")}`).join("\n");
  return `${front}\n\n# ${title}\n${body ? `\n${body}\n` : ""}`;
}

/**
 * Susun file export:
 * - `data.json`: seluruh data (card, item, link, group) untuk impor ulang atau migrasi
 * - `cards/*.md`: satu file per card aktif
 * - `trash/*.md`: card di Trash
 */
export function buildExport(snap: Snapshot, exportedAt = Date.now()): ExportFile[] {
  const titleOf = new Map(snap.cards.map((c) => [c.id, c.title.trim() || "Tanpa judul"]));
  const groupName = new Map(snap.groups.map((g) => [g.id, g.name]));

  const itemsOf = new Map<string, { text: string; done: boolean }[]>();
  for (const i of snap.todoItems) {
    const list = itemsOf.get(i.cardId) ?? [];
    list.push({ text: i.text, done: i.done });
    itemsOf.set(i.cardId, list);
  }
  const groupsOf = new Map<string, string[]>();
  for (const m of snap.groupMembers) {
    const name = groupName.get(m.groupId);
    if (name !== undefined) groupsOf.set(m.cardId, [...(groupsOf.get(m.cardId) ?? []), name]);
  }
  const linksOf = new Map<string, string[]>();
  for (const l of snap.links) {
    for (const [a, b] of [[l.cardA, l.cardB], [l.cardB, l.cardA]]) {
      const other = titleOf.get(b);
      if (other !== undefined) linksOf.set(a, [...(linksOf.get(a) ?? []), other]);
    }
  }

  const used = new Set<string>();
  const unique = (dir: string, base: string) => {
    let path = `${dir}/${base}.md`;
    for (let n = 2; used.has(path.toLowerCase()); n++) path = `${dir}/${base} (${n}).md`;
    used.add(path.toLowerCase());
    return path;
  };

  const files: ExportFile[] = [
    {
      path: "data.json",
      content: JSON.stringify({ app: "Simpul", version: EXPORT_VERSION, exportedAt: iso(exportedAt), ...snap }, null, 2) + "\n",
    },
  ];
  for (const card of snap.cards) {
    const dir = card.trashedAt === null ? "cards" : "trash";
    files.push({
      path: unique(dir, safeFileName(card.title)),
      content: cardMarkdown(card, {
        items: itemsOf.get(card.id) ?? [],
        groups: groupsOf.get(card.id) ?? [],
        links: linksOf.get(card.id) ?? [],
      }),
    });
  }
  return files;
}
