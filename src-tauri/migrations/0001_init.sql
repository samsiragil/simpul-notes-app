-- Skema v1 (lihat PRD: Model data dan penyimpanan)
-- Semua waktu: INTEGER milidetik UTC (BIGINT di Postgres).
-- Semua tabel sinkron punya updated_at + deleted_at (soft delete) agar siap sync ke Supabase (M5).
-- Hanya tipe TEXT / INTEGER / REAL supaya kompatibel dengan Postgres.

CREATE TABLE IF NOT EXISTS card (
  id          TEXT PRIMARY KEY,                -- UUID v7
  type        TEXT NOT NULL CHECK (type IN ('note', 'todo')),
  title       TEXT NOT NULL DEFAULT '',
  body        TEXT,                            -- Markdown, hanya untuk note
  pinned      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  trashed_at  INTEGER,                         -- di Trash (bisa dipulihkan)
  deleted_at  INTEGER                          -- dihapus permanen (tombstone untuk sync)
);
CREATE INDEX IF NOT EXISTS idx_card_list ON card (deleted_at, trashed_at, pinned, updated_at);

CREATE TABLE IF NOT EXISTS todo_item (
  id          TEXT PRIMARY KEY,
  card_id     TEXT NOT NULL REFERENCES card (id),
  text        TEXT NOT NULL DEFAULT '',
  done        INTEGER NOT NULL DEFAULT 0,
  position    REAL NOT NULL,                   -- fractional index untuk drag
  done_at     INTEGER,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_todo_item_card ON todo_item (card_id, deleted_at, position);

CREATE TABLE IF NOT EXISTS link (
  card_a      TEXT NOT NULL REFERENCES card (id),
  card_b      TEXT NOT NULL REFERENCES card (id),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,                         -- link diputus
  PRIMARY KEY (card_a, card_b),
  CHECK (card_a < card_b)                      -- satu baris per pasangan, tanpa self-link
);
CREATE INDEX IF NOT EXISTS idx_link_b ON link (card_b);

CREATE TABLE IF NOT EXISTS grp (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  position    REAL NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER
);

CREATE TABLE IF NOT EXISTS group_member (
  group_id    TEXT NOT NULL REFERENCES grp (id),
  card_id     TEXT NOT NULL REFERENCES card (id),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER,                         -- dikeluarkan dari group
  PRIMARY KEY (group_id, card_id)
);
CREATE INDEX IF NOT EXISTS idx_group_member_card ON group_member (card_id);

-- FTS5 untuk pencarian ditambahkan di migrasi M4 (lokal saja, tidak disinkronkan).
