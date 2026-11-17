// Config style (PRD: Config style). Semua font di-bundle lewat @fontsource agar jalan offline.
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/inter/wght-italic.css";
import "@fontsource/atkinson-hyperlegible-next/400.css";
import "@fontsource/atkinson-hyperlegible-next/400-italic.css";
import "@fontsource/atkinson-hyperlegible-next/600.css";
import "@fontsource/atkinson-hyperlegible-next/700.css";
import "@fontsource-variable/literata/wght.css";
import "@fontsource-variable/literata/wght-italic.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/400-italic.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource-variable/source-serif-4/wght.css";
import "@fontsource-variable/source-serif-4/wght-italic.css";
import "@fontsource-variable/jetbrains-mono/wght.css";

export type FontKey = "inter" | "atkinson" | "literata" | "plex" | "sourceSerif";

export interface FontOption {
  key: FontKey;
  name: string;
  kind: "Sans-serif" | "Serif";
  stack: string;
  note: string;
}

export const FONTS: FontOption[] = [
  { key: "inter", name: "Inter", kind: "Sans-serif", stack: "'Inter Variable', system-ui, sans-serif", note: "Pemakaian umum, UI" },
  { key: "atkinson", name: "Atkinson Hyperlegible Next", kind: "Sans-serif", stack: "'Atkinson Hyperlegible Next', system-ui, sans-serif", note: "Sesi panjang, mata lelah" },
  { key: "literata", name: "Literata", kind: "Serif", stack: "'Literata Variable', Georgia, serif", note: "Jurnal, tulisan panjang" },
  { key: "plex", name: "IBM Plex Sans", kind: "Sans-serif", stack: "'IBM Plex Sans', system-ui, sans-serif", note: "Catatan teknis" },
  { key: "sourceSerif", name: "Source Serif 4", kind: "Serif", stack: "'Source Serif 4 Variable', Georgia, serif", note: "Gaya artikel" },
];

export const MONO_STACK = "'JetBrains Mono Variable', ui-monospace, monospace";

export interface StyleConfig {
  bodyFont: FontKey;
  uiFont: FontKey;
  fontSize: number; // px, 14–22
  lineHeight: number; // 1.3–2.0
  contentWidth: number; // px, 600–900
}

export const DEFAULT_STYLE: StyleConfig = {
  bodyFont: "inter",
  uiFont: "inter",
  fontSize: 17,
  lineHeight: 1.65,
  contentWidth: 720,
};

export const STYLE_LIMITS = {
  fontSize: { min: 14, max: 22, step: 1 },
  lineHeight: { min: 1.3, max: 2, step: 0.05 },
  contentWidth: { min: 600, max: 900, step: 20 },
} as const;

export function fontStack(key: FontKey): string {
  return (FONTS.find((f) => f.key === key) ?? FONTS[0]).stack;
}

/** Terapkan config style ke CSS variables di :root. */
export function applyStyle(s: StyleConfig): void {
  const root = document.documentElement.style;
  root.setProperty("--font-body", fontStack(s.bodyFont));
  root.setProperty("--font-ui", fontStack(s.uiFont));
  root.setProperty("--font-mono", MONO_STACK);
  root.setProperty("--fs", `${s.fontSize}px`);
  root.setProperty("--lh", String(s.lineHeight));
  root.setProperty("--content-w", `${s.contentWidth}px`);
}
