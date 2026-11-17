import { useEffect, useState, type ReactNode } from "react";
import { ACCENTS, FONTS, STYLE_LIMITS, THEMES, UI_FONTS } from "../config/style";
import type { DoneMode } from "../lib/order";
import { useApp } from "../store/app";
import { useSettings } from "../store/settings";
import { DataSettings } from "./DataSettings";
import { IconClose, IconData, IconMonitor, IconMoon, IconPalette, IconRestore, IconSun, IconText, IconTodoList } from "./Icons";

type Tab = "look" | "text" | "todo" | "data";
const TABS: { key: Tab; label: string; icon: typeof IconData; hint: string }[] = [
  { key: "look", label: "Tampilan", icon: IconPalette, hint: "Tema dan aksen warna" },
  { key: "text", label: "Teks", icon: IconText, hint: "Font, ukuran, dan lebar kolom" },
  { key: "todo", label: "Todo", icon: IconTodoList, hint: "Perilaku Todo Card" },
  { key: "data", label: "Data", icon: IconData, hint: "Folder data, backup, dan export" },
];

const THEME_ICONS = { light: IconSun, dark: IconMoon, system: IconMonitor } as const;

const DONE_MODES: { key: DoneMode; label: string; note: string }[] = [
  { key: "bottom", label: "Pindah ke bawah", note: "Item selesai tetap terlihat di bagian bawah daftar." },
  { key: "hide", label: "Sembunyikan", note: "Item selesai tidak ditampilkan, progres tetap dihitung." },
];

export function SettingsDialog() {
  const open = useApp((s) => s.settingsOpen);
  const setOpen = useApp((s) => s.setSettingsOpen);
  const resetStyle = useSettings((s) => s.resetStyle);
  const [tab, setTab] = useState<Tab>("look");

  useEffect(() => {
    if (!open) return;
    // Esc yang sudah ditangani dialog konfirmasi di dalamnya tidak ikut menutup pengaturan.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;
  const current = TABS.find((t) => t.key === tab)!;

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="dialog settings-dialog" role="dialog" aria-label="Pengaturan">
        <nav className="settings-nav" role="tablist" aria-orientation="vertical">
          <h2>Pengaturan</h2>
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} className={`nav-item ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
              <t.icon size={15} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="settings-main">
          <div className="settings-head">
            <div>
              <h3>{current.label}</h3>
              <p>{current.hint}</p>
            </div>
            <span className="spacer" />
            {(tab === "look" || tab === "text") && (
              <button className="btn" onClick={resetStyle} title="Kembalikan aksen, font, dan ukuran ke bawaan. Tema tidak diubah.">
                <IconRestore size={13} />
                Kembalikan default
              </button>
            )}
            <button className="icon-btn" title="Tutup (Esc)" onClick={() => setOpen(false)}>
              <IconClose />
            </button>
          </div>

          <div className="settings-content">
            {tab === "look" && <LookSettings />}
            {tab === "text" && <TextSettings />}
            {tab === "todo" && <TodoSettings />}
            {tab === "data" && <DataSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="settings-section">
      <div className="field-label">
        {title}
        {aside && <output>{aside}</output>}
      </div>
      {children}
    </section>
  );
}

function LookSettings() {
  const style = useSettings((s) => s.style);
  const setStyle = useSettings((s) => s.setStyle);
  return (
    <>
      <Section title="Tema">
        <div className="theme-options" role="radiogroup" aria-label="Tema">
          {THEMES.map((t) => {
            const I = THEME_ICONS[t.key];
            return (
              <button key={t.key} role="radio" aria-checked={style.theme === t.key} className={`theme-option ${style.theme === t.key ? "active" : ""}`} onClick={() => setStyle({ theme: t.key })}>
                <span className={`theme-thumb ${t.key}`} aria-hidden />
                <span className="theme-label">
                  <I />
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Aksen warna" aside={ACCENTS.find((a) => a.key === style.accent)?.name}>
        <div className="accent-options" role="radiogroup" aria-label="Aksen warna">
          {ACCENTS.map((a) => (
            <button
              key={a.key}
              role="radio"
              aria-checked={style.accent === a.key}
              aria-label={a.name}
              title={a.name}
              className={`accent-swatch ${style.accent === a.key ? "active" : ""}`}
              style={{ ["--swatch-h" as string]: a.hue, ["--swatch-c" as string]: a.chroma }}
              onClick={() => setStyle({ accent: a.key })}
            />
          ))}
        </div>
        <p className="settings-note">Dipakai untuk menu aktif, card terpilih, tombol utama, link, dan Note. Todo tetap hijau.</p>
      </Section>
    </>
  );
}

function TextSettings() {
  const style = useSettings((s) => s.style);
  const setStyle = useSettings((s) => s.setStyle);
  return (
    <>
      <div className="settings-cols">
        <Section title="Font isi Note & Todo">
          <div className="font-list" role="radiogroup" aria-label="Font isi Note & Todo">
            {FONTS.map((f) => (
              <FontRow key={f.key} name={f.name} note={f.kind} stack={f.stack} active={style.bodyFont === f.key} onClick={() => setStyle({ bodyFont: f.key })} />
            ))}
          </div>
        </Section>
        <Section title="Font aplikasi">
          <div className="font-list" role="radiogroup" aria-label="Font aplikasi">
            {UI_FONTS.map((f) => (
              <FontRow key={f.key} name={f.name} note={f.note} stack={f.stack} active={style.uiFont === f.key} onClick={() => setStyle({ uiFont: f.key })} />
            ))}
          </div>
        </Section>
      </div>

      <div className="settings-sliders">
        <Slider label="Ukuran teks" value={style.fontSize} display={`${style.fontSize}px`} {...STYLE_LIMITS.fontSize} onChange={(v) => setStyle({ fontSize: v })} />
        <Slider label="Jarak baris" value={style.lineHeight} display={style.lineHeight.toFixed(2)} {...STYLE_LIMITS.lineHeight} onChange={(v) => setStyle({ lineHeight: Math.round(v * 100) / 100 })} />
        <Slider label="Lebar kolom" value={style.contentWidth} display={`${style.contentWidth}px`} {...STYLE_LIMITS.contentWidth} onChange={(v) => setStyle({ contentWidth: v })} />
      </div>

      <Section title="Pratinjau">
        <div className="preview">
          <div className="note-body" style={{ minHeight: 0 }}>
            <h2>Rencana Minggu Ini</h2>
            <p>
              Aplikasi ini dibuat dengan <b>Tauri</b> supaya ringan. Fokusnya <i>menulis tanpa gangguan</i>, dengan <mark>autosave</mark> dan{" "}
              <u>config style</u>. Referensi: <a>tauri.app</a>.
            </p>
            <ul>
              <li>Editor dengan format dasar</li>
              <li>
                Pencarian cepat dengan <code>Ctrl + K</code>
              </li>
            </ul>
            <blockquote>
              <p>Tulisan yang baik dimulai dari tempat menulis yang tenang.</p>
            </blockquote>
            <p style={{ color: "var(--text-3)" }}>Il1| O0o rn m · 0123456789</p>
          </div>
        </div>
      </Section>
    </>
  );
}

function TodoSettings() {
  const todoDoneMode = useSettings((s) => s.todoDoneMode);
  const setTodoDoneMode = useSettings((s) => s.setTodoDoneMode);
  return (
    <Section title="Item yang selesai">
      <div className="font-list" role="radiogroup" aria-label="Item yang selesai">
        {DONE_MODES.map((m) => (
          <button key={m.key} role="radio" aria-checked={todoDoneMode === m.key} className={`font-row ${todoDoneMode === m.key ? "active" : ""}`} onClick={() => setTodoDoneMode(m.key)}>
            <span className="fname">{m.label}</span>
            <span className="fnote">{m.note}</span>
          </button>
        ))}
      </div>
    </Section>
  );
}

function FontRow(props: { name: string; note: string; stack: string; active: boolean; onClick(): void }) {
  return (
    <button role="radio" aria-checked={props.active} className={`font-row ${props.active ? "active" : ""}`} onClick={props.onClick}>
      <span className="fname" style={{ fontFamily: props.stack }}>{props.name}</span>
      <span className="fnote">{props.note}</span>
    </button>
  );
}

function Slider(props: { label: string; value: number; display: string; min: number; max: number; step: number; onChange(v: number): void }) {
  return (
    <div>
      <div className="field-label">
        {props.label}
        <output>{props.display}</output>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </div>
  );
}
