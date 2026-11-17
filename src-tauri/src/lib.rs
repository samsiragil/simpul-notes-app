use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager, State, WebviewWindowBuilder};
use tauri_plugin_sql::{Migration, MigrationKind};

/// Nama file database di folder data.
const DB_FILE: &str = "notes.db";
/// URL database di folder data bawaan (%APPDATA%\com.pribadi.notes\notes.db).
/// Dipertahankan apa adanya agar database lama tetap terbaca.
const DEFAULT_DB_URL: &str = "sqlite:notes.db";
/// P-5: lokasi folder data pilihan pengguna, disimpan di folder config aplikasi.
const LOCATION_FILE: &str = "data-location.json";
/// Subfolder backup harian di dalam folder data.
const BACKUP_DIR: &str = "backups";

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "init: card, todo_item, link, grp, group_member",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "search: card_fts (FTS5, lokal saja)",
            sql: include_str!("../migrations/0002_search.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

/// Lokasi data yang dipakai sesi ini. Ditentukan sekali saat start;
/// mengganti folder data memerlukan restart.
struct DataPaths {
    config_dir: PathBuf,
    data_dir: PathBuf,
    db_url: String,
    /// Folder pilihan yang tidak ditemukan saat start (misal drive dilepas).
    missing_dir: Option<PathBuf>,
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct Location {
    data_dir: Option<PathBuf>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DataInfo {
    data_dir: String,
    default_dir: String,
    db_url: String,
    backup_dir: String,
    is_default: bool,
    missing_dir: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FolderInfo {
    exists: bool,
    has_db: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupFile {
    name: String,
    size: u64,
    modified: u64,
}

#[derive(Deserialize)]
struct ExportFile {
    path: String,
    content: String,
}

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

fn path_str(p: &Path) -> String {
    p.to_string_lossy().into_owned()
}

/// sqlx men-decode persen pada path database, jadi `%` harus di-encode.
fn db_url_for(dir: &Path) -> String {
    format!("sqlite:{}", path_str(&dir.join(DB_FILE)).replace('%', "%25"))
}

fn read_location(config_dir: &Path) -> Option<PathBuf> {
    let text = fs::read_to_string(config_dir.join(LOCATION_FILE)).ok()?;
    serde_json::from_str::<Location>(&text).ok()?.data_dir
}

fn resolve_paths(config_dir: PathBuf) -> DataPaths {
    match read_location(&config_dir) {
        Some(dir) if dir.is_dir() => DataPaths {
            db_url: db_url_for(&dir),
            data_dir: dir,
            config_dir,
            missing_dir: None,
        },
        missing => DataPaths {
            data_dir: config_dir.clone(),
            config_dir,
            db_url: DEFAULT_DB_URL.into(),
            missing_dir: missing,
        },
    }
}

/// Hanya path relatif biasa (tanpa `..`, root, atau drive) yang boleh ditulis export.
fn safe_relative(p: &str) -> Option<PathBuf> {
    let path = Path::new(p);
    let ok = !p.is_empty() && path.components().all(|c| matches!(c, Component::Normal(_)));
    ok.then(|| path.to_path_buf())
}

#[tauri::command]
fn data_info(paths: State<DataPaths>) -> DataInfo {
    DataInfo {
        data_dir: path_str(&paths.data_dir),
        default_dir: path_str(&paths.config_dir),
        db_url: paths.db_url.clone(),
        backup_dir: path_str(&paths.data_dir.join(BACKUP_DIR)),
        is_default: paths.data_dir == paths.config_dir,
        missing_dir: paths.missing_dir.as_deref().map(path_str),
    }
}

#[tauri::command]
fn inspect_folder(path: String) -> FolderInfo {
    let dir = PathBuf::from(path);
    FolderInfo {
        exists: dir.is_dir(),
        has_db: dir.join(DB_FILE).is_file(),
    }
}

/// P-5: simpan folder data baru (`None` = kembali ke bawaan) lalu restart aplikasi.
/// Database sudah disalin ke folder tujuan oleh frontend (`VACUUM INTO`) sebelum ini dipanggil.
#[tauri::command]
fn set_data_dir(app: AppHandle, paths: State<DataPaths>, path: Option<String>) -> Result<(), String> {
    let data_dir = path.map(PathBuf::from).filter(|p| *p != paths.config_dir);
    if let Some(dir) = &data_dir {
        if !dir.join(DB_FILE).is_file() {
            return Err(format!("{DB_FILE} tidak ditemukan di {}", path_str(dir)));
        }
    }
    let json = serde_json::to_string_pretty(&Location { data_dir }).map_err(err)?;
    fs::write(paths.config_dir.join(LOCATION_FILE), json).map_err(err)?;
    app.restart();
}

/// Path file backup untuk tanggal `date` (YYYY-MM-DD), atau `None` jika sudah ada.
#[tauri::command]
fn backup_target(paths: State<DataPaths>, date: String) -> Result<Option<String>, String> {
    let valid = date.len() == 10 && date.chars().enumerate().all(|(i, c)| if i == 4 || i == 7 { c == '-' } else { c.is_ascii_digit() });
    if !valid {
        return Err(format!("Tanggal backup tidak valid: {date}"));
    }
    let dir = paths.data_dir.join(BACKUP_DIR);
    fs::create_dir_all(&dir).map_err(err)?;
    let file = dir.join(format!("notes-{date}.db"));
    Ok((!file.exists()).then(|| path_str(&file)))
}

fn backup_files(dir: &Path) -> Vec<(PathBuf, BackupFile)> {
    let Ok(entries) = fs::read_dir(dir) else { return vec![] };
    let mut files: Vec<(PathBuf, BackupFile)> = entries
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            if !(name.starts_with("notes-") && name.ends_with(".db")) {
                return None;
            }
            let meta = e.metadata().ok()?;
            let modified = meta.modified().ok()?.duration_since(UNIX_EPOCH).ok()?.as_millis() as u64;
            Some((e.path(), BackupFile { name, size: meta.len(), modified }))
        })
        .collect();
    // Nama berisi tanggal, jadi urut nama = urut waktu. Terbaru di depan.
    files.sort_by(|a, b| b.1.name.cmp(&a.1.name));
    files
}

#[tauri::command]
fn list_backups(paths: State<DataPaths>) -> Vec<BackupFile> {
    backup_files(&paths.data_dir.join(BACKUP_DIR)).into_iter().map(|(_, f)| f).collect()
}

/// Simpan `keep` backup terbaru, hapus file backup yang lebih lama.
#[tauri::command]
fn prune_backups(paths: State<DataPaths>, keep: usize) -> Result<usize, String> {
    let old: Vec<_> = backup_files(&paths.data_dir.join(BACKUP_DIR)).into_iter().skip(keep).collect();
    for (path, _) in &old {
        fs::remove_file(path).map_err(err)?;
    }
    Ok(old.len())
}

/// P-6: tulis file export ke `<dir>/<folder>/...`. Mengembalikan path folder hasil.
#[tauri::command]
fn write_export(dir: String, folder: String, files: Vec<ExportFile>) -> Result<String, String> {
    let base = PathBuf::from(dir);
    if !base.is_dir() {
        return Err(format!("Folder tidak ditemukan: {}", path_str(&base)));
    }
    let folder = safe_relative(&folder).ok_or("Nama folder export tidak valid")?;
    let root = base.join(folder);
    if root.exists() {
        return Err(format!("Folder sudah ada: {}", path_str(&root)));
    }
    for f in files {
        let rel = safe_relative(&f.path).ok_or_else(|| format!("Path tidak valid: {}", f.path))?;
        let target = root.join(rel);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(err)?;
        }
        fs::write(&target, f.content).map_err(err)?;
    }
    Ok(path_str(&root))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            data_info,
            inspect_folder,
            set_data_dir,
            backup_target,
            list_backups,
            prune_backups,
            write_export
        ])
        .setup(|app| {
            let config_dir = app.path().app_config_dir()?;
            fs::create_dir_all(&config_dir)?;
            let paths = resolve_paths(config_dir);
            // Plugin SQL didaftarkan di sini karena URL database (dan migrasinya)
            // bergantung pada folder data pilihan pengguna (P-5).
            app.handle().plugin(
                tauri_plugin_sql::Builder::default()
                    .add_migrations(&paths.db_url, migrations())
                    .build(),
            )?;
            app.manage(paths);
            // Jendela dibuat setelah plugin SQL siap (`create: false` di tauri.conf.json).
            for config in app.config().app.windows.iter().filter(|w| !w.create) {
                WebviewWindowBuilder::from_config(app.handle(), config)?.build()?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("gagal menjalankan aplikasi");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_relative_rejects_escape() {
        assert!(safe_relative("cards/a.md").is_some());
        assert!(safe_relative("../a.md").is_none());
        assert!(safe_relative("C:\\x\\a.md").is_none());
        assert!(safe_relative("\\a.md").is_none());
        assert!(safe_relative("").is_none());
    }

    #[test]
    fn db_url_encodes_percent() {
        let url = db_url_for(Path::new("C:\\Data 100%"));
        assert!(url.starts_with("sqlite:C:\\Data 100%25"));
        assert!(url.ends_with(DB_FILE));
    }
}
