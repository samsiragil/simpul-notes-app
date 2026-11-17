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

import { isTauri } from "../lib/util";

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

export type UiFontKey = "segoeVariable" | "segoe" | "system" | "inter" | "plex" | "atkinson";

/** Font antarmuka (sidebar, daftar, tombol, dialog). Terpisah dari font isi Note & Todo. */
export const UI_FONTS: { key: UiFontKey; name: string; stack: string; note: string }[] = [
  { key: "segoeVariable", name: "Segoe UI Variable", stack: "'Segoe UI Variable Text', 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif", note: "Font sistem Windows 11" },
  { key: "segoe", name: "Segoe UI", stack: "'Segoe UI', system-ui, sans-serif", note: "Font sistem Windows klasik" },
  { key: "system", name: "Bawaan sistem", stack: "system-ui, sans-serif", note: "Ikuti font default OS" },
  { key: "inter", name: "Inter", stack: "'Inter Variable', system-ui, sans-serif", note: "Rapat dan netral" },
  { key: "plex", name: "IBM Plex Sans", stack: "'IBM Plex Sans', system-ui, sans-serif", note: "Teknis, sedikit bersudut" },
  { key: "atkinson", name: "Atkinson Hyperlegible Next", stack: "'Atkinson Hyperlegible Next', system-ui, sans-serif", note: "Paling mudah dibaca" },
];

export function uiFontStack(key: UiFontKey): string {
  return (UI_FONTS.find((f) => f.key === key) ?? UI_FONTS[3]).stack;
}

export const MONO_STACK = "'JetBrains Mono Variable', ui-monospace, monospace";

export type ThemeMode = "light" | "dark" | "system";

export const THEMES: { key: ThemeMode; label: string }[] = [
  { key: "light", label: "Terang" },
  { key: "dark", label: "Gelap" },
  { key: "system", label: "Ikuti sistem" },
];

export type AccentKey = "ink" | "teal" | "sage" | "violet" | "terracotta" | "amber" | "rose" | "graphite";

/** P-7: preset aksen sebagai hue + chroma OKLCH. Lightness diatur token per tema. */
export const ACCENTS: { key: AccentKey; name: string; hue: number; chroma: number }[] = [
  { key: "ink", name: "Biru tinta", hue: 252, chroma: 0.13 },
  { key: "teal", name: "Teal", hue: 195, chroma: 0.1 },
  { key: "sage", name: "Sage", hue: 150, chroma: 0.1 },
  { key: "violet", name: "Ungu", hue: 295, chroma: 0.15 },
  { key: "terracotta", name: "Terakota", hue: 40, chroma: 0.14 },
  { key: "amber", name: "Amber", hue: 70, chroma: 0.13 },
  { key: "rose", name: "Rose", hue: 10, chroma: 0.15 },
  { key: "graphite", name: "Grafit", hue: 250, chroma: 0.015 },
];

export interface StyleConfig {
  theme: ThemeMode;
  accent: AccentKey;
  bodyFont: FontKey;
  uiFont: UiFontKey;
  fontSize: number; // px, 14–22
  lineHeight: number; // 1.3–2.0
  contentWidth: number; // px, 600–900
}

export const DEFAULT_STYLE: StyleConfig = {
  theme: "light",
  accent: "ink",
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

export function accentOf(key: AccentKey) {
  return ACCENTS.find((a) => a.key === key) ?? ACCENTS[0];
}

const THEME_CACHE = "simpul:theme";
const darkQuery = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
let themeMode: ThemeMode = "light";

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode !== "light" && mode !== "dark" && mode !== "system") return "light";
  return mode === "system" ? (darkQuery?.matches ? "dark" : "light") : mode;
}

function setResolvedTheme(theme: "light" | "dark"): void {
  document.documentElement.dataset.theme = theme;
}

/** Pasang tema dari cache sebelum settings termuat, agar tidak berkedip putih saat start. */
export function applyCachedTheme(): void {
  try {
    const t = localStorage.getItem(THEME_CACHE);
    if (t === "light" || t === "dark") setResolvedTheme(t);
  } catch {
    /* abaikan */
  }
}

darkQuery?.addEventListener("change", () => {
  if (themeMode === "system") applyTheme("system");
});

function applyTheme(mode: ThemeMode): void {
  themeMode = mode;
  const theme = resolveTheme(mode);
  setResolvedTheme(theme);
  try {
    localStorage.setItem(THEME_CACHE, theme);
  } catch {
    /* abaikan */
  }
  // Samakan title bar Windows dengan tema aplikasi.
  if (isTauri()) {
    void import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => getCurrentWindow().setTheme(mode === "system" ? null : mode))
      .catch(() => {});
  }
}

/** Terapkan config style ke CSS variables di :root. */
export function applyStyle(s: StyleConfig): void {
  applyTheme(s.theme);
  const root = document.documentElement.style;
  const accent = accentOf(s.accent);
  root.setProperty("--accent-h", String(accent.hue));
  root.setProperty("--accent-c", String(accent.chroma));
  root.setProperty("--font-body", fontStack(s.bodyFont));
  root.setProperty("--font-ui", uiFontStack(s.uiFont));
  root.setProperty("--font-mono", MONO_STACK);
  root.setProperty("--fs", `${s.fontSize}px`);
  root.setProperty("--lh", String(s.lineHeight));
  root.setProperty("--content-w", `${s.contentWidth}px`);
}
