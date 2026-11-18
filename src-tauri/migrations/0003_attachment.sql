-- Lampiran Note: gambar, video, audio, dan file lain.
-- File aslinya tidak disimpan di database. File disalin ke `<folder data>/attachments/<sha256>.<ext>`
-- (lihat src-tauri/src/lib.rs), dan tabel ini hanya menyimpan metadatanya.
-- File dengan isi sama memakai satu file fisik (dedup lewat sha256).
-- Isi Note merujuk lampiran dengan Markdown `![nama](attachment:<id>)`.

CREATE TABLE IF NOT EXISTS attachment (
  id          TEXT PRIMARY KEY,                -- UUID v7
  card_id     TEXT NOT NULL REFERENCES card (id),
  file_name   TEXT NOT NULL,                   -- nama file asli saat diunggah
  mime_type   TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL,
  sha256      TEXT NOT NULL,                   -- hash isi file, juga nama file fisik
  ext         TEXT NOT NULL DEFAULT '',        -- ekstensi huruf kecil tanpa titik
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_attachment_card ON attachment (card_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_attachment_sha ON attachment (sha256);
