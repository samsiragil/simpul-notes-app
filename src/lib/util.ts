import { v7 as uuidv7 } from "uuid";

export const newId = (): string => uuidv7();
export const now = (): number => Date.now();

export const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Waktu relatif berbahasa Indonesia untuk daftar card. */
export function relativeTime(ms: number, ref = Date.now()): string {
  const diff = Math.max(0, ref - ms);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Baru saja";
  if (min < 60) return `${min} mnt lalu`;
  const d = new Date(ms);
  const today = new Date(ref);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (ms >= startOfToday) return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  if (ms >= startOfToday - 86_400_000) return "Kemarin";
  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

export function fullDate(ms: number): string {
  return new Date(ms).toLocaleString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Potongan teks polos dari Markdown, untuk preview di daftar card. */
export function snippetFromMarkdown(md: string | null, max = 140): string {
  if (!md) return "";
  const text = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+(\[[ xX]\]\s+)?/gm, "")
    .replace(/[*_~`=|]/g, "")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;
  const run = () => {
    t = undefined;
    if (lastArgs) {
      const a = lastArgs;
      lastArgs = undefined;
      fn(...a);
    }
  };
  const d = (...args: A) => {
    lastArgs = args;
    if (t) clearTimeout(t);
    t = setTimeout(run, wait);
  };
  /** Jalankan sekarang jika ada yang tertunda (dipakai saat pindah card / tutup aplikasi). */
  d.flush = () => {
    if (t) clearTimeout(t);
    run();
  };
  return d;
}
