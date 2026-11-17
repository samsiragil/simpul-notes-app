-- M4: indeks pencarian S-3 (lihat PRD: Model data dan penyimpanan).
-- Lokal saja, tidak disinkronkan, dan bukan sumber data: isinya turunan dari card + todo_item
-- dan dibangun ulang oleh repository (src/db/sqlRepo.ts). Tabel sinkron tetap tanpa trigger.
--   title  judul card
--   body   isi Note sebagai teks polos (Markdown sudah dibersihkan)
--   items  teks item Todo, satu per baris
CREATE VIRTUAL TABLE IF NOT EXISTS card_fts USING fts5(
  card_id UNINDEXED,
  title,
  body,
  items,
  tokenize = 'unicode61 remove_diacritics 2',
  prefix = '2 3'
);
