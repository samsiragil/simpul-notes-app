# CLAUDE.md

## Spesifikasi

- Spesifikasi lengkap ada di `docs/PRD.md`. Ikuti ID kebutuhan (C-1, N-1, T-1, dst.) saat mengerjakan dan merujuk fitur.

## Target & Stack

- Target platform: Windows saja.
- Stack: Tauri v2, React + TypeScript, TipTap, Zustand, SQLite via `tauri-plugin-sql`.

## Akses Data

- Semua akses data lewat `src/db` (repository). UI tidak boleh menulis SQL.

## Skema Database

- Skema harus tetap siap sync:
  - ID memakai UUID v7.
  - Setiap tabel punya kolom `updated_at`.
  - Hapus data dengan soft delete (`deleted_at`). Jangan pakai `DELETE`.
- Perubahan skema = file migrasi baru di `src-tauri/migrations`. Jangan ubah file migrasi yang sudah ada.

## UI

- Style mengikuti token di `src/styles/tokens.css`.
- Bahasa UI: Indonesia.
