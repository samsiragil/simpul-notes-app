# PRD — Simpul: Notes & Todo (Tauri)

Nov 17, 2026 · @Ragil Samsi

## Ringkasan

**Simpul** adalah aplikasi desktop (Tauri) untuk pemakaian pribadi yang menggabungkan **Note** dan **Todo Card** sebagai kartu setara. Setiap kartu bisa saling terhubung dan dikumpulkan dalam **Group**.

Nama **Simpul** diambil dari titik pertemuan beberapa tali: setiap card adalah simpul yang bisa terhubung ke card lain.

Masalah yang diselesaikan: catatan dan to-do biasanya terpisah di dua aplikasi, sehingga konteks (kenapa sebuah tugas ada, catatan rapat terkait, referensi) hilang. Di sini, catatan dan daftar tugas hidup berdampingan dan saling menaut, tanpa kerumitan aplikasi produktivitas besar.

Prinsip produk:

- **Simple dulu.** Hanya tiga konsep: Card, Link, Group.
- **Lokal dan cepat.** Data tersimpan di komputer sendiri, aplikasi terbuka dalam hitungan detik.
- **Nyaman dibaca.** Tipografi yang bisa diatur (5 font pilihan) adalah fitur inti, bukan pelengkap.

## Tujuan dan non-tujuan

Versi 1 berhasil jika aku bisa memakainya setiap hari untuk catatan dan to-do tanpa membuka aplikasi lain.

**Tujuan**

1. Membuat, mengedit, dan mencari Note serta Todo Card dengan cepat.
2. Menghubungkan kartu apa pun ke kartu lain, lalu berpindah antar kartu terkait dalam satu klik.
3. Mengelompokkan kartu ke satu atau beberapa Group.
4. Data tidak pernah hilang: autosave, Trash, dan file yang bisa dibackup.
5. Tampilan nyaman dibaca dengan config style font.

**Non-tujuan (sengaja tidak dibuat di v1)**

- Group di dalam group (nested)
- Sub-task, tanggal jatuh tempo, reminder, prioritas
- Link ke item todo tertentu (link selalu ke kartu utuh)
- Tag terpisah dari Group
- Wiki link `[[...]]` di dalam teks
- Sinkronisasi antar perangkat (direncanakan di M5, setelah v1), multi-user, kolaborasi
- Aplikasi mobile (setelah sync M5 tersedia)
- Enkripsi

## Konsep inti

Aplikasi hanya punya tiga konsep: **Card** (Note atau Todo Card), **Link** antar card, dan **Group** sebagai wadah.

&#91;embedded content: contoh card, link, dan group\]

Riset Font ada di dua group sekaligus, Ide Fitur tidak punya group, dan Belanja Bulanan berdiri sendiri tanpa link.

| Konsep | Definisi | Aturan |
| --- | --- | --- |
| Note | Card berisi judul dan rich text | Boleh berisi checklist biasa sebagai format teks; itu bukan Todo Card |
| Todo Card | Card berisi judul dan daftar item checklist | Item hanya punya teks dan status selesai; tanpa tanggal, prioritas, atau sub-task |
| Link | Hubungan dua arah antara dua card | Semua kombinasi boleh: Note-Note, Todo-Todo, Note-Todo. Many-to-many. Tidak bisa link ke diri sendiri, tidak ada link ganda |
| Group | Wadah bernama berisi card | Isi boleh campuran, Note saja, atau Todo saja. Satu card boleh di banyak group. Tidak bisa bersarang |

Sifat penting:

- **Link bersifat referensi.** Menghapus satu card hanya menghapus link-nya; card lain tetap utuh.
- **Link tidak berarah.** Jika A terhubung ke B, maka B otomatis terhubung ke A dan tampil di kedua card.
- **Group seperti label.** Menghapus group tidak menghapus card di dalamnya.
- **Card tanpa group tetap ada** dan muncul di tampilan Semua.

## Kebutuhan fungsional

Semua kebutuhan di bawah wajib untuk v1 kecuali yang ditandai (Nice). ID dipakai untuk merujuk di task dan commit.

### Card (umum)

| ID | Kebutuhan |
| --- | --- |
| C-1 | Buat card baru: pilih Note atau Todo (tombol + dan shortcut `Ctrl+N` / `Ctrl+Shift+T`) |
| C-2 | Card baru dibuat di group yang sedang dibuka; jika di tampilan Semua, tanpa group |
| C-3 | Judul bisa diedit; judul kosong ditampilkan sebagai "Tanpa judul" |
| C-4 | Pin card agar selalu di atas daftar |
| C-5 | Hapus card memindahkannya ke Trash; bisa dipulihkan atau dihapus permanen |
| C-6 | Trash dikosongkan otomatis untuk item lebih dari 30 hari |
| C-7 | Autosave sekitar 1 detik setelah berhenti mengetik; tidak ada tombol Simpan |
| C-8 | Duplikat card (Nice) |
| C-9 | Ubah Note menjadi Todo Card dari baris checklist-nya, dan sebaliknya (Nice) |

### Note

| ID | Kebutuhan |
| --- | --- |
| N-1 | Editor rich text: H1-H3, bold, italic, underline, coret, highlight, link |
| N-2 | Bullet list, numbered list (bisa bertingkat), checklist teks |
| N-3 | Quote, inline code, code block, garis pemisah, tabel sederhana |
| N-4 | Markdown shortcut saat mengetik (` #  `, ` -  `, ` 1.  `, ` []  `, ` >  `, ` ` \`\`\`) |
| N-5 | Shortcut format standar (`Ctrl+B/I/U`, `Ctrl+Shift+H` highlight, undo/redo). `Ctrl+K` dipakai untuk pencarian (S-3), bukan link |
| N-6 | Paste dari web dibersihkan dari style asing (Nice: paste gambar) |

### Todo Card

| ID | Kebutuhan |
| --- | --- |
| T-1 | Tambah item dengan mengetik lalu `Enter`; item baru langsung siap diketik |
| T-2 | Centang dan batal centang item |
| T-3 | Edit teks item inline; hapus item (tombol atau `Backspace` pada item kosong) |
| T-4 | Urutkan item dengan drag-and-drop dan `Alt+Up/Down` |
| T-5 | Tampilkan progres (misal 3/5) di card dan di daftar |
| T-6 | Opsi: item selesai pindah ke bawah atau disembunyikan |
| T-7 | Catatan singkat di bawah judul Todo Card (Nice) |

### Link

| ID | Kebutuhan |
| --- | --- |
| L-1 | Tombol "Hubungkan" membuka pencarian card; pilih satu atau beberapa |
| L-2 | Semua kombinasi tipe boleh; card sendiri dan card yang sudah terhubung tidak muncul di hasil |
| L-3 | Panel "Terhubung" di setiap card menampilkan daftar card terkait (ikon tipe, judul, progres untuk Todo) |
| L-4 | Klik card terkait membuka card tersebut; tombol Kembali (`Alt+Left`) kembali ke card sebelumnya |
| L-5 | Putuskan link dari panel; hilang di kedua sisi |
| L-6 | Card di Trash tidak tampil di panel Terhubung; link kembali jika card dipulihkan |
| L-7 | Indikator jumlah link di daftar card |

### Group

| ID | Kebutuhan |
| --- | --- |
| G-1 | Buat, ganti nama, hapus group; urutkan group di sidebar dengan drag |
| G-2 | Tambah card ke group: lewat menu card, drag ke sidebar, atau buat card dari dalam group |
| G-3 | Satu card bisa di banyak group; card menampilkan chip group-nya |
| G-4 | Keluarkan card dari group tanpa menghapus card |
| G-5 | Hapus group meminta konfirmasi dan tidak menghapus card |
| G-6 | Filter di dalam group: Semua / Note / Todo |
| G-7 | Tampilan khusus: Semua, Tanpa group, Trash |
| G-8 | Warna atau ikon per group (Nice) |

### Daftar dan pencarian

| ID | Kebutuhan |
| --- | --- |
| S-1 | Daftar card: pinned di atas, lalu urut terakhir diubah (opsi: judul, tanggal dibuat) |
| S-2 | Tampilan daftar (baris ringkas) atau grid kartu |
| S-3 | Pencarian `Ctrl+K` atas judul, isi Note, dan item Todo; hasil di-highlight |
| S-4 | Filter pencarian berdasarkan tipe dan group |
| S-5 | Navigasi keyboard penuh di hasil pencarian |

### Tampilan dan pengaturan

| ID | Kebutuhan |
| --- | --- |
| P-1 | Light mode (dark mode: Nice) |
| P-2 | Config style: pilih font, ukuran, jarak baris, lebar kolom (lihat bagian Config style) |
| P-3 | Mode fokus: sembunyikan sidebar dan daftar |
| P-4 | Ingat ukuran jendela, layout, dan card terakhir yang dibuka |
| P-5 | Pilih lokasi folder data |
| P-6 | Export semua data ke folder Markdown + JSON |

## User flow utama

Empat alur ini harus bisa dilakukan tanpa mouse dan masing-masing dalam beberapa detik.

**1. Mencatat cepat**

1. Buka aplikasi; card terakhir terbuka otomatis.
2. `Ctrl+N` membuat Note baru di group aktif; kursor langsung di judul.
3. `Enter` pindah ke isi, mengetik, tersimpan otomatis.

**2. Membuat to-do dari catatan rapat**

1. Di Note "Rapat Senin", tekan Hubungkan, ketik "Sprint".
2. Tidak ada hasil: pilih "Buat Todo Card 'Sprint UI'" langsung dari pencarian.
3. Todo Card baru terbuat, otomatis terhubung ke Note dan masuk group yang sama dengan Note.
4. Isi item-itemnya; kembali ke Note dengan `Alt+Left`.

**3. Menyusun proyek dengan Group**

1. Buat group "Proyek Notes App" di sidebar.
2. Drag Note dan Todo Card yang sudah ada ke group tersebut, atau buat card baru dari dalam group.
3. Filter group ke Todo saja untuk melihat semua daftar tugas proyek beserta progresnya.

**4. Menelusuri konteks**

1. Buka Todo Card "Desain UI".
2. Panel Terhubung menampilkan Note "Riset Font" dan Todo "Minggu Ini".
3. Klik "Riset Font" untuk membaca, lalu kembali.

## Struktur UI

Layout tiga kolom: sidebar navigasi, daftar card, dan area card yang terbuka. Sidebar dan daftar bisa diciutkan.

| Area | Isi | Lebar |
| --- | --- | --- |
| Sidebar | Semua, Tanpa group, daftar Group, Trash, tombol + Group, Pengaturan | 220 px, bisa diciutkan |
| Daftar card | Pencarian, filter Semua/Note/Todo, tombol + Note / + Todo, daftar card | 300 px, bisa diubah |
| Area card | Judul, chip group, isi Note atau daftar item Todo, panel Terhubung | Sisa layar; teks dibatasi sekitar 70 karakter per baris |

Baris di daftar card menampilkan: ikon tipe, judul, potongan isi (Note) atau progres (Todo), jumlah link, dan waktu diubah.

Panel Terhubung berada di bawah isi card (default) dan bisa dipindah ke sisi kanan pada layar lebar. Command palette `Ctrl+K` tampil sebagai overlay di tengah layar.

## Config style

Kelima font tersedia sebagai pilihan untuk isi card; default Inter 17 px dengan jarak baris 1.65. Semua font di-bundle lewat `@fontsource` agar berjalan offline.

| Kunci | Font | Jenis | Cocok untuk |
| --- | --- | --- | --- |
| `inter` (default) | Inter | Sans-serif | Pemakaian umum, UI |
| `atkinson` | Atkinson Hyperlegible Next | Sans-serif | Sesi panjang, mata lelah |
| `literata` | Literata | Serif | Jurnal, tulisan panjang |
| `plex` | IBM Plex Sans | Sans-serif | Catatan teknis |
| `sourceSerif` | Source Serif 4 | Serif | Gaya artikel |
| `mono` (tetap) | JetBrains Mono | Monospace | Inline code dan code block |

Pengaturan yang bisa diubah:

| Pengaturan | Rentang | Default |
| --- | --- | --- |
| Font isi | 5 pilihan di atas | Inter |
| Font UI | 5 pilihan di atas | Inter |
| Ukuran teks | 14-22 px | 17 px |
| Jarak baris | 1.3-2.0 | 1.65 |
| Lebar kolom | 600-900 px | 720 px |

Style bawaan format teks mengikuti sampel font yang sudah disetujui: heading, highlight kuning lembut, code block abu-abu terang, quote dengan garis kiri, dan tabel bergaris tipis.

```json
{
  "style": {
    "bodyFont": "inter",
    "uiFont": "inter",
    "fontSize": 17,
    "lineHeight": 1.65,
    "contentWidth": 720
  }
}
```

Design token dari [Desain Notes App Desktop](https://claude.ai/artifact/8VkENxeDeBbXw4ESre6MVd), dipakai sebagai CSS variables:

| Token | Nilai | Dipakai untuk |
| --- | --- | --- |
| `--bg` | `#FAF9F6` | Latar area card |
| `--bg-side` | `#F6F4F0` | Latar sidebar |
| `--text` | `#22211F` | Teks utama |
| `--text-2` | `#55524C` | Teks sekunder |
| `--text-3` | `#8A867E` | Meta, ikon, placeholder |
| `--border` | `#E4E1DB` | Garis 1px |
| `--hover` | `#ECE9E3` | Hover dan item aktif |
| `--highlight` | `#FBF0B8` | Highlight teks |
| `--note` | `oklch(0.56 0.09 250)` | Aksen Note (biru tinta) |
| `--note-tint` | `oklch(0.96 0.02 250)` | Latar lembut Note |
| `--todo` | `oklch(0.56 0.09 155)` | Aksen Todo (hijau) |
| `--todo-tint` | `oklch(0.96 0.025 155)` | Latar lembut Todo |

## Model data dan penyimpanan

Arsitektur **local-first**: satu file SQLite (`notes.db`) di komputer menjadi tempat aplikasi membaca dan menulis, sehingga aplikasi cepat dan 100% offline. Skema disiapkan agar kompatibel dengan Postgres, sehingga di M5 data bisa disinkronkan ke Supabase dan diakses dari mobile tanpa migrasi ulang. Isi Note disimpan sebagai teks Markdown, dan Export (P-6) menghasilkan folder `.md` biasa.

```sql
-- Semua waktu: INTEGER milidetik UTC (BIGINT di Postgres)
-- Semua tabel sinkron punya updated_at dan deleted_at (soft delete)

CREATE TABLE card (
  id          TEXT PRIMARY KEY,      -- UUID v7
  type        TEXT NOT NULL CHECK (type IN ('note','todo')),
  title       TEXT NOT NULL DEFAULT '',
  body        TEXT,                  -- Markdown, hanya untuk note
  pinned      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  trashed_at  INTEGER,               -- di Trash (bisa dipulihkan)
  deleted_at  INTEGER                -- dihapus permanen (tombstone untuk sync)
);

CREATE TABLE todo_item (
  id          TEXT PRIMARY KEY,
  card_id     TEXT NOT NULL REFERENCES card(id),
  text        TEXT NOT NULL DEFAULT '',
  done        INTEGER NOT NULL DEFAULT 0,
  position    REAL NOT NULL,          -- fractional index untuk drag
  done_at     INTEGER,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER
);

CREATE TABLE link (
  card_a      TEXT NOT NULL REFERENCES card(id),
  card_b      TEXT NOT NULL REFERENCES card(id),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,               -- link diputus
  PRIMARY KEY (card_a, card_b),
  CHECK (card_a < card_b)            -- satu baris per pasangan, tanpa self-link
);

CREATE TABLE grp (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  position    REAL NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER
);

CREATE TABLE group_member (
  group_id    TEXT NOT NULL REFERENCES grp(id),
  card_id     TEXT NOT NULL REFERENCES card(id),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,               -- dikeluarkan dari group
  PRIMARY KEY (group_id, card_id)
);

-- Lokal saja, tidak disinkronkan
CREATE VIRTUAL TABLE card_fts USING fts5(card_id UNINDEXED, title, body, items);
```

Catatan desain:

- **Soft delete di semua tabel.** Tidak ada `DELETE` langsung; penghapusan mengisi `deleted_at` agar bisa disinkronkan ke perangkat lain. Tombstone lebih dari 90 hari dibersihkan.
- **Trash dan hapus permanen dibedakan.** `trashed_at` = di Trash dan bisa dipulihkan; `deleted_at` = dihapus permanen, beserta link, item, dan keanggotaan group-nya.
- **Link tidak berarah** disimpan sekali dengan `card_a < card_b`. Query card terkait: `WHERE (card_a = :id OR card_b = :id) AND deleted_at IS NULL`. Menghubungkan ulang menghidupkan baris yang sama.
- **Kompatibel Postgres.** Hanya tipe TEXT, INTEGER, REAL; tanpa trigger atau fitur khusus SQLite di tabel sinkron. FTS5 hanya untuk pencarian lokal.
- **Repository layer.** Semua akses data lewat modul repository (misal `cards.save()`); UI tidak menulis SQL. Sync di M5 cukup ditambahkan di lapisan ini.
- **Pengaturan** (config style, layout) disimpan di `settings.json`, tidak disinkronkan.
- **Backup** otomatis: salinan `notes.db` harian ke subfolder `backups/`, menyimpan 7 terakhir.
- **Migrasi** skema berupa file SQL bernomor di `src-tauri/migrations/`; versinya dicatat otomatis oleh `tauri-plugin-sql`.

## Kebutuhan non-fungsional dan stack teknis

**Target kualitas**

| Aspek | Target |
| --- | --- |
| Waktu buka aplikasi | Di bawah 1,5 detik sampai card terakhir tampil |
| Pencarian | Hasil di bawah 100 ms untuk 5.000 card |
| Mengetik | Tanpa jeda terasa pada Note 10.000 kata |
| Ukuran installer | Di bawah 15 MB |
| Memori saat idle | Di bawah 150 MB |
| Keamanan data | Tidak ada data hilang saat aplikasi ditutup paksa (simpan dengan transaksi, WAL mode) |
| Offline | 100% berjalan tanpa internet |

**Stack yang diusulkan**

| Lapisan | Pilihan | Alasan |
| --- | --- | --- |
| Shell desktop | Tauri v2 | Ringan, installer kecil |
| Frontend | React + TypeScript + Vite | Ekosistem editor paling matang |
| Editor Note | TipTap (ProseMirror) + ekstensi Markdown | Rich text dengan input Markdown, mudah dikustom |
| Todo list | Komponen sendiri + dnd-kit | Sederhana, drag-and-drop yang aksesibel |
| State | Zustand | Ringan |
| Database | SQLite via `tauri-plugin-sql` (atau `rusqlite` di command Rust) | Lokal, FTS5, transaksi |
| Font | `@fontsource/*` | Offline, sesuai config style |
| Plugin Tauri | `fs`, `dialog`, `window-state`, `sql` | Folder data, pemilih folder, ingat jendela |

Platform target: **Windows 10/11 saja** untuk v1 (installer `.msi` / NSIS). macOS dan Linux tidak diuji. Backend sync rencana M5: **Supabase** (Postgres), lewat PowerSync atau sync buatan sendiri dengan aturan last-write-wins berdasarkan `updated_at`.

## Milestone dan kriteria selesai

Empat milestone; setiap milestone sudah bisa dipakai sehari-hari sebelum lanjut ke berikutnya. Estimasi untuk pengerjaan part-time.

**M1. Fondasi (sekitar 1 minggu)**

- [ ] Proyek Tauri v2 + React + SQLite berjalan, skema dan migrasi v1
- [ ] Layout tiga kolom, config style (5 font, ukuran, jarak baris)
- [ ] CRUD Note dengan editor TipTap dan autosave
- [ ] Daftar card, pin, Trash

* [x] Ganti nama aplikasi ke Simpul: `productName`, judul jendela, `package.json`, `Cargo.toml`, dan identifier `com.pribadi.simpul` (sebelum menyimpan data sungguhan, karena identifier menentukan folder data)

**M2. Todo Card (sekitar 1 minggu)**

- [ ] CRUD Todo Card dan item (T-1 sampai T-6)
- [ ] Progres tampil di card dan daftar
- [ ] Drag-and-drop dan shortcut urutan item

**M3. Link dan Group (sekitar 1-2 minggu)**

- [ ] Dialog Hubungkan, panel Terhubung, navigasi Kembali (L-1 sampai L-7)
- [ ] Buat Todo Card langsung dari dialog Hubungkan
- [ ] Group: CRUD, multi-group, drag ke sidebar, filter tipe (G-1 sampai G-7)

**M4. Pencarian dan polish (sekitar 1 minggu)**

- [ ] Pencarian FTS5 `Ctrl+K` dengan filter
- [ ] Mode fokus, ingat layout, pilih folder data
- [ ] Backup harian dan Export Markdown + JSON
- [ ] Installer Windows

**M5. Sync ke Supabase (setelah v1, opsional)**

- [ ] Project Supabase + skema Postgres yang sama, RLS per user
- [ ] Login (email magic link) di pengaturan; aplikasi tetap jalan tanpa login
- [ ] Sync dua arah di background: kirim baris dengan `updated_at` lebih baru dari sync terakhir, terima perubahan dari server
- [ ] Indikator status sync dan penanganan offline
- [ ] Dasar untuk aplikasi mobile

v1 dianggap selesai jika keempat user flow utama berjalan tanpa mouse, target kualitas tercapai, dan aplikasi dipakai sendiri selama 2 minggu tanpa kehilangan data.

## Pertanyaan terbuka

Asumsi yang dipakai di dokumen ini, perlu dikonfirmasi sebelum M1:

- [x] Platform utama: Windows 10/11 saja.
- [x] Frontend: React + TypeScript.
- [x] Penyimpanan: SQLite local-first dengan skema siap sync ke Supabase (M5).
- [ ] Card baru yang dibuat dari dialog Hubungkan otomatis masuk group yang sama: setuju?
- [ ] Item Todo yang selesai: pindah ke bawah (default) atau langsung disembunyikan?
- [ ] Dark mode masuk v1 atau ditunda?
