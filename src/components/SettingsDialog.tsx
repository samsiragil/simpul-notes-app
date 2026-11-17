import { useEffect } from "react";
import { FONTS, STYLE_LIMITS, type FontKey } from "../config/style";
import type { DoneMode } from "../lib/order";
import { useApp } from "../store/app";
import { useSettings } from "../store/settings";
import { IconClose } from "./Icons";

const DONE_MODES: { key: DoneMode; label: string }[] = [
  { key: "bottom", label: "Pindah ke bawah" },
  { key: "hide", label: "Sembunyikan" },
];

export function SettingsDialog() {
  const open = useApp((s) => s.settingsOpen);
  const setOpen = useApp((s) => s.setSettingsOpen);
  const style = useSettings((s) => s.style);
  const setStyle = useSettings((s) => s.setStyle);
  const resetStyle = useSettings((s) => s.resetStyle);
  const todoDoneMode = useSettings((s) => s.todoDoneMode);
  const setTodoDoneMode = useSettings((s) => s.setTodoDoneMode);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="dialog" role="dialog" aria-label="Pengaturan tampilan">
        <div className="dialog-head">
          <h2>Pengaturan · Tampilan</h2>
          <button className="btn" onClick={resetStyle} style={{ marginRight: 8 }}>Kembalikan default</button>
          <button className="icon-btn" title="Tutup (Esc)" onClick={() => setOpen(false)}>
            <IconClose />
          </button>
        </div>
        <div className="dialog-body">
          <div className="settings-form">
            <div>
              <div className="field-label">Font isi catatan</div>
              <div className="font-options">
                {FONTS.map((f) => (
                  <button
                    key={f.key}
                    className={`font-option ${style.bodyFont === f.key ? "active" : ""}`}
                    onClick={() => setStyle({ bodyFont: f.key })}
                  >
                    <span className="fname" style={{ fontFamily: f.stack }}>{f.name}</span>
                    <span className="fnote">{f.kind} · {f.note}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="field-label">Font antarmuka</div>
              <select className="select" value={style.uiFont} onChange={(e) => setStyle({ uiFont: e.target.value as FontKey })}>
                {FONTS.map((f) => (
                  <option key={f.key} value={f.key}>{f.name}</option>
                ))}
              </select>
            </div>

            <Slider label="Ukuran teks" value={style.fontSize} display={`${style.fontSize}px`} {...STYLE_LIMITS.fontSize} onChange={(v) => setStyle({ fontSize: v })} />
            <Slider label="Jarak baris" value={style.lineHeight} display={style.lineHeight.toFixed(2)} {...STYLE_LIMITS.lineHeight} onChange={(v) => setStyle({ lineHeight: Math.round(v * 100) / 100 })} />
            <Slider label="Lebar kolom" value={style.contentWidth} display={`${style.contentWidth}px`} {...STYLE_LIMITS.contentWidth} onChange={(v) => setStyle({ contentWidth: v })} />

            <div>
              <div className="field-label">Item Todo yang selesai</div>
              <div className="segmented" role="radiogroup" style={{ gridTemplateColumns: "1fr 1fr" }}>
                {DONE_MODES.map((m) => (
                  <button key={m.key} role="radio" aria-checked={todoDoneMode === m.key} className={todoDoneMode === m.key ? "active" : ""} onClick={() => setTodoDoneMode(m.key)}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="preview">
            <div className="preview-label">Pratinjau</div>
            <div className="note-body" style={{ minHeight: 0 }}>
              <h2>Rencana Minggu Ini</h2>
              <p>
                Aplikasi ini dibuat dengan <b>Tauri</b> supaya ringan. Fokusnya <i>menulis tanpa gangguan</i>, dengan{" "}
                <mark>autosave</mark> dan <u>config style</u>. Referensi: <a>tauri.app</a>.
              </p>
              <ul>
                <li>Editor dengan format dasar</li>
                <li>Pencarian cepat dengan <code>Ctrl + K</code></li>
              </ul>
              <blockquote><p>Tulisan yang baik dimulai dari tempat menulis yang tenang.</p></blockquote>
              <pre><code>{"const style = { bodyFont: \"inter\", fontSize: 17 };"}</code></pre>
              <p style={{ color: "var(--text-3)" }}>Il1| O0o rn m · 0123456789</p>
            </div>
          </div>
        </div>
      </div>
    </div>
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
