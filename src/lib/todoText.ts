// Format teks item Todo: link (raw URL atau `[teks](url)`), format inline gaya Markdown
// (`**tebal**`, `*miring*`, `==highlight==`), dan item pemisah (divider).
// Semua tetap disimpan sebagai teks biasa di `todo_item.text`, jadi skema tidak berubah.

/** Teks item pemisah. Item ini tampil sebagai garis dan tidak dihitung di progres. */
export const DIVIDER = "---";

export const isDivider = (text: string): boolean => text.trim() === DIVIDER;

/** Diketik di item kosong (seperti Notion), langsung diubah menjadi divider. */
export const isDividerShortcut = (text: string): boolean => text === "-- " || text === "--- ";

export interface TextSegment {
  text: string;
  /** Ada jika segmen ini link. */
  href?: string;
  /** `true` untuk URL mentah; `false` untuk link `[teks](url)`. */
  raw?: boolean;
  bold?: boolean;
  italic?: boolean;
  /** Highlight `==teks==` (latar kuning, sama dengan Note). */
  mark?: boolean;
}

type Style = Pick<TextSegment, "bold" | "italic" | "mark">;

const URL_CHARS = String.raw`[^\s<>"'\]]+`;
// Urutan alternatif penting: pada posisi yang sama link menang atas format, `**` atas `*`.
const INLINE_RE = new RegExp(
  [
    String.raw`\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)`, // 1-2: [teks](url)
    String.raw`((?:https?:\/\/|www\.)${URL_CHARS})`, // 3: URL mentah
    String.raw`\*\*(?=\S)(.+?)(?<=\S)\*\*(?!\*)`, // 4: **tebal** (`***` ditutup di dua bintang terakhir)
    String.raw`==(?=\S)(.+?)(?<=\S)==`, // 5: ==highlight==
    String.raw`\*(?=[^\s*])(.+?)(?<=[^\s*])\*`, // 6: *miring*
    String.raw`(?<![\w])_(?=[^\s_])(.+?)(?<=[^\s_])_(?![\w])`, // 7: _miring_
  ].join("|"),
  "g",
);

/** Buang tanda baca penutup kalimat yang ikut tertangkap di akhir URL mentah. */
function trimUrl(url: string): string {
  let out = url.replace(/[.,;:!?*]+$/, "");
  while (out.endsWith(")") && (out.match(/\(/g)?.length ?? 0) < (out.match(/\)/g)?.length ?? 0)) {
    out = out.slice(0, -1).replace(/[.,;:!?*]+$/, "");
  }
  return out;
}

const hrefOf = (url: string) => (/^www\./i.test(url) ? `https://${url}` : url);

function parseInto(text: string, style: Style, out: TextSegment[]) {
  const push = (s: TextSegment) => {
    if (s.text) out.push({ ...s, ...style });
  };
  const re = new RegExp(INLINE_RE.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index;
    push({ text: text.slice(last, start) });
    let end = start + m[0].length;
    if (m[1] !== undefined) {
      push({ text: m[1], href: m[2], raw: false });
    } else if (m[3] !== undefined) {
      const url = trimUrl(m[3]);
      end = start + url.length;
      push({ text: url, href: hrefOf(url), raw: true });
    } else if (m[4] !== undefined) {
      parseInto(m[4], { ...style, bold: true }, out);
    } else if (m[5] !== undefined) {
      parseInto(m[5], { ...style, mark: true }, out);
    } else {
      parseInto(m[6] ?? m[7], { ...style, italic: true }, out);
    }
    last = end;
    re.lastIndex = end;
  }
  push({ text: text.slice(last) });
}

/** Pecah teks menjadi segmen: teks biasa, link, dan format inline (tebal, miring, highlight). */
export function parseInline(text: string): TextSegment[] {
  const out: TextSegment[] = [];
  parseInto(text, {}, out);
  return out;
}

/** Ada link atau format, sehingga item perlu tampilan baca (bukan teks mentah). */
export const isRich = (text: string): boolean => parseInline(text).some((s) => s.href || s.bold || s.italic || s.mark);

/** Tampilan ringkas URL mentah: tanpa protokol, `www.`, query, dan dipotong jika panjang. */
export function shortUrl(url: string, max = 48): string {
  let s = url.replace(/^[a-z]+:\/\//i, "").replace(/^www\./i, "");
  s = s.replace(/[?#].*$/, "").replace(/\/$/, "");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export type Mark = "bold" | "italic" | "mark";

/** Potongan teks dengan format seragam, hasil editor item (TipTap). */
export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  mark?: boolean;
  href?: string;
}

// Urutan buka dari luar ke dalam.
const MARK_ORDER: Mark[] = ["bold", "italic", "mark"];

/**
 * Penanda miring: `*` biasa, `_` tepat setelah `*` (misal `**a**_b_`, karena `**a***b*` ambigu),
 * atau dipaksa salah satunya.
 */
type ItalicMode = "auto" | "*" | "_";

const linkSource = (r: InlineRun) =>
  r.href === r.text || r.href === hrefOf(r.text) ? r.text : `[${r.text.replace(/[[\]]/g, "")}](${r.href})`;

function serializeWith(runs: readonly InlineRun[], italic: ItalicMode): string {
  let out = "";
  const stack: { mark: Mark; marker: string }[] = [];
  const closeTo = (keep: number) => {
    if (stack.length <= keep) return;
    const trail = /\s*$/.exec(out)![0];
    out = out.slice(0, out.length - trail.length);
    while (stack.length > keep) out += stack.pop()!.marker;
    out += trail;
  };
  const markerOf = (m: Mark) => {
    if (m === "bold") return "**";
    if (m === "mark") return "==";
    if (italic !== "auto") return italic;
    return out.endsWith("*") ? "_" : "*";
  };
  for (const r of runs) {
    if (!r.text) continue;
    const blank = !r.text.trim();
    const active = (m: Mark) => stack.some((s) => s.mark === m);
    // Run berisi spasi saja tidak membuka penanda baru.
    const want = MARK_ORDER.filter((m) => r[m] && (!blank || active(m)));
    let keep = 0;
    while (keep < stack.length && want.includes(stack[keep].mark)) keep++;
    closeTo(keep);
    let text = r.href ? linkSource(r) : r.text;
    const open = want.filter((m) => !active(m));
    if (open.length) {
      const lead = /^\s*/.exec(text)![0];
      out += lead;
      text = text.slice(lead.length);
      for (const m of open) {
        const marker = markerOf(m);
        out += marker;
        stack.push({ mark: m, marker });
      }
    }
    out += text;
  }
  closeTo(0);
  return out;
}

/** Gabungkan run bertetangga yang formatnya sama, untuk membandingkan hasil. */
function normalize(runs: readonly InlineRun[]): string {
  const key = (r: InlineRun) => `${!!r.bold}|${!!r.italic}|${!!r.mark}|${r.href ?? ""}`;
  const out: { k: string; text: string }[] = [];
  for (const r of runs) {
    if (!r.text) continue;
    const k = key(r);
    const last = out.at(-1);
    if (last && last.k === k) last.text += r.text;
    else out.push({ k, text: r.text });
  }
  return JSON.stringify(out);
}

/**
 * Kebalikan `parseInline`: susun run menjadi teks bergaya Markdown. Spasi di tepi run
 * diletakkan di luar penanda karena `** a**` tidak dikenali sebagai tebal. Beberapa
 * pilihan penanda miring dicoba; dipakai yang terbaca ulang persis sama.
 */
export function serializeInline(runs: readonly InlineRun[]): string {
  const target = normalize(runs);
  let first = "";
  for (const mode of ["auto", "*", "_"] as const) {
    const text = serializeWith(runs, mode);
    if (mode === "auto") first = text;
    if (normalize(parseInline(text)) === target) return text;
  }
  return first;
}
