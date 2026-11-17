# Notes

Aplikasi notes dan todo pribadi untuk Windows: Tauri v2, React, dan SQLite local-first.
Lihat PRD untuk gambaran lengkapnya. Repo ini berisi **M1 (Fondasi)**.

## Isi M1

- Layout tiga kolom sesuai design: sidebar, daftar card, dan area card. Sidebar dan daftar bisa diciutkan, plus mode fokus.
- Config style: 5 font isi dan font UI, ukuran teks, jarak baris, lebar kolom. Tersimpan di `settings.json`.
- Note dengan editor rich text (TipTap):
  - heading, bold, italic, underline, coret, highlight, link
  - list, checklist, quote, code, tabel
  - markdown shortcut saat mengetik, dan toolbar yang muncul saat teks dipilih
- Isi Note disimpan sebagai Markdown, dengan autosave sekitar 0,8 detik setelah berhenti mengetik.
- Daftar card: card yang di-pin ada di atas, sisanya urut terakhir diubah, dengan potongan isi dan waktu relatif.
- Trash: pulihkan atau hapus permanen. Card di Trash otomatis dihapus setelah 30 hari.
- SQLite dengan skema lengkap v1, sudah siap sync: UUID v7, `updated_at`, soft delete `deleted_at`.
- Repository layer (`src/db`): UI tidak pernah menulis SQL.

Todo Card (M2), Link dan Group (M3), serta Pencarian (M4) belum ada. Tombol dan menunya sudah disiapkan sebagai tempat.

## Persiapan (sekali saja, di Windows)

1. **Microsoft C++ Build Tools.** Install dari <https://visualstudio.microsoft.com/visual-cpp-build-tools/> dan centang *Desktop development with C++*.
2. **WebView2.** Sudah terpasang di Windows 10/11.
3. **Rust.** Install dari <https://rustup.rs> (pilih toolchain default `stable-msvc`).
4. **Node.js 20+.** Install dari <https://nodejs.org>.

Panduan resmi: <https://v2.tauri.app/start/prerequisites/>

## Menjalankan

```powershell
npm install
npm run tauri dev      # mode pengembangan (hot reload)
npm run tauri build    # installer .msi dan .exe (NSIS) di src-tauri/target/release/bundle/
```

Build pertama butuh waktu beberapa menit karena Rust mengompilasi semua dependensi.

Untuk mengutak-atik UI tanpa Tauri, jalankan `npm run dev` lalu buka <http://localhost:1420>.
Data di mode ini disimpan di localStorage browser, jadi hanya untuk mencoba UI.

## Lokasi data

| File | Lokasi |
| --- | --- |
| Database | `%APPDATA%\com.pribadi.notes\notes.db` |
| Pengaturan | `%APPDATA%\com.pribadi.notes\settings.json` |

Migrasi skema ada di `src-tauri/migrations/` dan didaftarkan di `src-tauri/src/lib.rs`.
Versinya dicatat otomatis oleh `tauri-plugin-sql`. Untuk perubahan skema, tambahkan file `000N_*.sql` baru. Jangan mengubah file migrasi yang lama.

## Shortcut

| Shortcut | Aksi |
| --- | --- |
| `Ctrl+N` | Note baru |
| `Ctrl+\` | Tampilkan/sembunyikan sidebar |
| `Ctrl+Shift+\` | Tampilkan/sembunyikan daftar card |
| `Ctrl+Shift+F` | Mode fokus |
| `Ctrl+,` | Pengaturan tampilan |
| `Ctrl+Delete` | Pindahkan card ke Trash |
| `Enter` di judul | Pindah ke isi |
| `Ctrl+B / I / U` | Bold / italic / underline |
| `Ctrl+Shift+H` | Highlight |

## Struktur

```
src/
  config/style.ts      config style: 5 font, batas slider, applyStyle()
  styles/              tokens.css (design token), app.css (layout), note.css (isi Note)
  db/                  repository: types.ts, sqlRepo.ts (Tauri), memoryRepo.ts (browser)
  store/               zustand: app.ts (card, view), settings.ts (config style, layout)
  editor/NoteEditor.tsx  TipTap + Markdown + toolbar format
  components/          Sidebar, CardList, CardPane, SettingsDialog, Icons
src-tauri/
  src/lib.rs           plugin sql (migrasi), store, window-state
  migrations/          skema SQLite
  capabilities/        izin plugin
```
