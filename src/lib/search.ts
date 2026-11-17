// Utilitas pencarian (S-3): query FTS5, penanda sorotan, dan pencocokan untuk repo browser.

/** Penanda awal/akhir bagian yang cocok di `SearchHit.title` dan `SearchHit.snippet`. */
export const HIT_START = "\u0001";
export const HIT_END = "\u0002";

const WORD = /[\p{L}\p{N}]/u;

/** Kata-kata pencarian: dipisah spasi, tanpa tanda kutip, minimal satu huruf/angka. */
export function searchTerms(query: string): string[] {
  return query
    .replace(/["\u0001\u0002]/g, " ")
    .split(/\s+/)
    .filter((t) => WORD.test(t));
}

/**
 * Query FTS5 dari teks bebas: setiap kata jadi prefix phrase (`"kata"*`) dan semuanya
 * harus cocok (AND). Sintaks FTS5 di input pengguna tidak ikut ditafsirkan.
 * `null` jika tidak ada kata yang bisa dicari.
 */
export function ftsQuery(query: string): string | null {
  const terms = searchTerms(query);
  return terms.length ? terms.map((t) => `"${t}"*`).join(" ") : null;
}

export interface HitSegment {
  text: string;
  hit: boolean;
}

/** Pecah teks berpenanda jadi potongan biasa dan potongan yang disorot. */
export function hitSegments(marked: string): HitSegment[] {
  const out: HitSegment[] = [];
  let hit = false;
  let buf = "";
  const push = () => {
    if (buf) out.push({ text: buf, hit });
    buf = "";
  };
  for (const ch of marked) {
    if (ch === HIT_START || ch === HIT_END) {
      push();
      hit = ch === HIT_START;
    } else {
      buf += ch;
    }
  }
  push();
  return out;
}

export const hasHit = (marked: string): boolean => marked.includes(HIT_START);

/** Huruf kecil tanpa diakritik, panjang tetap sama per karakter (untuk indeks posisi). */
function fold(text: string): string {
  return [...text].map((ch) => ch.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().charAt(0) || ch).join("");
}

/** Rentang [awal, akhir) kata yang diawali salah satu `terms` (prefix, tanpa beda huruf besar dan diakritik). */
function matchRanges(text: string, terms: readonly string[]): [number, number][] {
  const chars = [...text];
  const folded = fold(text);
  const foldedChars = [...folded];
  const needles = terms.map(fold);
  const ranges: [number, number][] = [];
  for (let i = 0; i < chars.length; i++) {
    const startsWord = WORD.test(chars[i]) && (i === 0 || !WORD.test(chars[i - 1]));
    if (!startsWord) continue;
    let best = 0;
    for (const n of needles) {
      const len = [...n].length;
      if (len > best && foldedChars.slice(i, i + len).join("") === n) best = len;
    }
    if (best) {
      ranges.push([i, i + best]);
      i += best - 1;
    }
  }
  return ranges;
}

/** Apakah semua `terms` muncul sebagai awal kata di salah satu teks. */
export function matchesAll(texts: readonly string[], terms: readonly string[]): boolean {
  return terms.every((t) => texts.some((text) => matchRanges(text, [t]).length > 0));
}

/** Beri penanda pada kata yang cocok (setara `highlight()` FTS5). */
export function markHits(text: string, terms: readonly string[]): string {
  const chars = [...text];
  let out = "";
  let at = 0;
  for (const [s, e] of matchRanges(text, terms)) {
    out += chars.slice(at, s).join("") + HIT_START + chars.slice(s, e).join("") + HIT_END;
    at = e;
  }
  return out + chars.slice(at).join("");
}

/** Potongan sekitar kecocokan pertama, berpenanda (setara `snippet()` FTS5). Kosong jika tidak cocok. */
export function markSnippet(text: string, terms: readonly string[], words = 12): string {
  const ranges = matchRanges(text, terms);
  if (!ranges.length) return "";
  const chars = [...text];
  const first = ranges[0][0];
  // Mundur sekitar sepertiga jendela kata dari kecocokan pertama.
  let start = first;
  let seen = 0;
  while (start > 0 && seen < Math.floor(words / 3)) {
    start--;
    if (chars[start] === " " && chars[start - 1] !== " ") seen++;
  }
  if (start > 0) start++;
  let end = first;
  let count = 0;
  while (end < chars.length && count < words) {
    if (chars[end] === " ") count++;
    end++;
  }
  const slice = chars.slice(start, end).join("").trim();
  return (start > 0 ? "…" : "") + markHits(slice, terms) + (end < chars.length ? "…" : "");
}
