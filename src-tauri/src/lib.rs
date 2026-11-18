use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Manager, State, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_sql::{Migration, MigrationKind};

/// Nama file database di folder data.
const DB_FILE: &str = "notes.db";
/// URL database di folder data bawaan (%APPDATA%\com.pribadi.simpul\notes.db).
/// Dipertahankan apa adanya agar database lama tetap terbaca.
const DEFAULT_DB_URL: &str = "sqlite:notes.db";
/// P-5: lokasi folder data pilihan pengguna, disimpan di folder config aplikasi.
const LOCATION_FILE: &str = "data-location.json";
/// Subfolder backup harian di dalam folder data.
const BACKUP_DIR: &str = "backups";
/// Subfolder lampiran di dalam folder data. Nama file: `<sha256>.<ext>`.
const ATTACH_DIR: &str = "attachments";
/// Batas ukuran satu lampiran.
const ATTACH_MAX_BYTES: u64 = 500 * 1024 * 1024;

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
        Migration {
            version: 3,
            description: "attachment: metadata lampiran Note",
            sql: include_str!("../migrations/0003_attachment.sql"),
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
    attachment_dir: String,
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

/// Lampiran yang ikut diexport: salin `file` (nama di folder lampiran) ke `path` (relatif).
#[derive(Deserialize)]
struct ExportAttachment {
    file: String,
    path: String,
}

/// File lampiran yang sudah disalin ke folder lampiran.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StoredFile {
    sha256: String,
    ext: String,
    file_name: String,
    size: u64,
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
        attachment_dir: path_str(&paths.data_dir.join(ATTACH_DIR)),
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

// ---------- Lampiran ----------

/// Ekstensi huruf kecil tanpa titik; kosong jika tidak ada atau tidak wajar.
fn clean_ext(name: &str) -> String {
    let ext = Path::new(name).extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    if ext.len() <= 16 && ext.chars().all(|c| c.is_ascii_alphanumeric()) {
        ext
    } else {
        String::new()
    }
}

fn stored_name(sha256: &str, ext: &str) -> String {
    if ext.is_empty() {
        sha256.to_string()
    } else {
        format!("{sha256}.{ext}")
    }
}

/// Hanya nama file lampiran (`<64 hex>` atau `<64 hex>.<ext>`) yang boleh diakses dari frontend.
fn valid_stored(file: &str) -> bool {
    let (hash, ext) = file.split_once('.').unwrap_or((file, ""));
    hash.len() == 64
        && hash.chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase())
        && ext.len() <= 16
        && ext.chars().all(|c| c.is_ascii_alphanumeric() && !c.is_ascii_uppercase())
        && (ext.is_empty() == !file.contains('.'))
}

fn attachment_path(paths: &DataPaths, file: &str) -> Result<PathBuf, String> {
    if !valid_stored(file) {
        return Err(format!("Nama lampiran tidak valid: {file}"));
    }
    let path = paths.data_dir.join(ATTACH_DIR).join(file);
    if !path.is_file() {
        return Err("File lampiran tidak ditemukan".into());
    }
    Ok(path)
}

fn too_big() -> String {
    format!("File terlalu besar (maksimal {} MB)", ATTACH_MAX_BYTES / 1024 / 1024)
}

/// Salin isi `reader` ke folder lampiran sambil menghitung sha256.
/// Ditulis ke file sementara dulu, lalu di-rename; file dengan hash sama tidak ditulis ulang.
fn store_attachment(dir: &Path, mut reader: impl Read, name: &str) -> Result<StoredFile, String> {
    fs::create_dir_all(dir).map_err(err)?;
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    let tmp = dir.join(format!(".tmp-{}-{nanos}", std::process::id()));
    let result = (|| {
        let mut out = fs::File::create(&tmp).map_err(err)?;
        let mut hasher = Sha256::new();
        let mut buf = vec![0u8; 256 * 1024];
        let mut size: u64 = 0;
        loop {
            let n = reader.read(&mut buf).map_err(err)?;
            if n == 0 {
                break;
            }
            size += n as u64;
            if size > ATTACH_MAX_BYTES {
                return Err(too_big());
            }
            hasher.update(&buf[..n]);
            out.write_all(&buf[..n]).map_err(err)?;
        }
        out.sync_all().map_err(err)?;
        let sha256: String = hasher.finalize().iter().map(|b| format!("{b:02x}")).collect();
        Ok((sha256, size))
    })();
    let (sha256, size) = match result {
        Ok(v) => v,
        Err(e) => {
            let _ = fs::remove_file(&tmp);
            return Err(e);
        }
    };
    let ext = clean_ext(name);
    let target = dir.join(stored_name(&sha256, &ext));
    if target.exists() {
        let _ = fs::remove_file(&tmp);
    } else {
        fs::rename(&tmp, &target).map_err(err)?;
    }
    Ok(StoredFile { sha256, ext, file_name: name.to_string(), size })
}

/// Decode `encodeURIComponent` (nama file dikirim lewat header).
fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(b) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(b);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Salin file dari path lokal (dialog atau drag & drop) ke folder lampiran.
#[tauri::command]
async fn import_attachment(paths: State<'_, DataPaths>, path: String) -> Result<StoredFile, String> {
    let dir = paths.data_dir.join(ATTACH_DIR);
    tauri::async_runtime::spawn_blocking(move || {
        let src = PathBuf::from(&path);
        let meta = fs::metadata(&src).map_err(|_| format!("File tidak ditemukan: {path}"))?;
        if !meta.is_file() {
            return Err(format!("Bukan file: {path}"));
        }
        if meta.len() > ATTACH_MAX_BYTES {
            return Err(too_big());
        }
        let name = src.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "file".into());
        store_attachment(&dir, fs::File::open(&src).map_err(err)?, &name)
    })
    .await
    .map_err(err)?
}

/// Simpan isi file dari clipboard (tanpa path). Nama file di header `x-file-name`.
#[tauri::command]
async fn import_attachment_bytes(paths: State<'_, DataPaths>, request: Request<'_>) -> Result<StoredFile, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("Isi file tidak valid".into());
    };
    let bytes = bytes.clone();
    let name = request
        .headers()
        .get("x-file-name")
        .and_then(|v| v.to_str().ok())
        .map(percent_decode)
        .filter(|n| !n.trim().is_empty())
        .unwrap_or_else(|| "file".into());
    let dir = paths.data_dir.join(ATTACH_DIR);
    tauri::async_runtime::spawn_blocking(move || store_attachment(&dir, bytes.as_slice(), &name))
        .await
        .map_err(err)?
}

/// Buka lampiran dengan aplikasi default Windows.
#[tauri::command]
fn open_attachment(app: AppHandle, paths: State<DataPaths>, file: String) -> Result<(), String> {
    let path = attachment_path(&paths, &file)?;
    app.opener().open_path(path_str(&path), None::<&str>).map_err(err)
}

/// Buka link dari item Todo di browser default. Hanya http(s) dan mailto.
#[tauri::command]
fn open_url(app: AppHandle, url: String) -> Result<(), String> {
    let lower = url.to_ascii_lowercase();
    if !(lower.starts_with("http://") || lower.starts_with("https://") || lower.starts_with("mailto:")) {
        return Err("URL tidak didukung".into());
    }
    app.opener().open_url(url, None::<&str>).map_err(err)
}

/// Tampilkan lampiran di File Explorer.
#[tauri::command]
fn reveal_attachment(app: AppHandle, paths: State<DataPaths>, file: String) -> Result<(), String> {
    let path = attachment_path(&paths, &file)?;
    app.opener().reveal_item_in_dir(path).map_err(err)
}

/// Salin lampiran ke lokasi pilihan pengguna (dialog "Simpan sebagai").
#[tauri::command]
async fn save_attachment_as(paths: State<'_, DataPaths>, file: String, dest: String) -> Result<(), String> {
    let src = attachment_path(&paths, &file)?;
    tauri::async_runtime::spawn_blocking(move || fs::copy(src, dest).map(|_| ()).map_err(err))
        .await
        .map_err(err)?
}

/// P-5: salin semua lampiran ke `<dir>/attachments` saat pindah folder data. File yang sudah ada dilewati.
#[tauri::command]
async fn copy_attachments(paths: State<'_, DataPaths>, dir: String) -> Result<usize, String> {
    let from = paths.data_dir.join(ATTACH_DIR);
    let to = PathBuf::from(dir).join(ATTACH_DIR);
    tauri::async_runtime::spawn_blocking(move || {
        let Ok(entries) = fs::read_dir(&from) else { return Ok(0) };
        fs::create_dir_all(&to).map_err(err)?;
        let mut copied = 0;
        for e in entries.flatten() {
            let name = e.file_name().to_string_lossy().into_owned();
            let target = to.join(&name);
            if valid_stored(&name) && !target.exists() {
                fs::copy(e.path(), target).map_err(err)?;
                copied += 1;
            }
        }
        Ok(copied)
    })
    .await
    .map_err(err)?
}

/// P-6: tulis file export ke `<dir>/<folder>/...` beserta salinan lampiran. Mengembalikan path folder hasil.
#[tauri::command]
async fn write_export(
    paths: State<'_, DataPaths>,
    dir: String,
    folder: String,
    files: Vec<ExportFile>,
    attachments: Vec<ExportAttachment>,
) -> Result<String, String> {
    let attach_dir = paths.data_dir.join(ATTACH_DIR);
    tauri::async_runtime::spawn_blocking(move || export_files(dir, folder, files, attachments, &attach_dir))
        .await
        .map_err(err)?
}

fn export_files(
    dir: String,
    folder: String,
    files: Vec<ExportFile>,
    attachments: Vec<ExportAttachment>,
    attach_dir: &Path,
) -> Result<String, String> {
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
    for a in attachments {
        let rel = safe_relative(&a.path).ok_or_else(|| format!("Path tidak valid: {}", a.path))?;
        if !valid_stored(&a.file) {
            return Err(format!("Nama lampiran tidak valid: {}", a.file));
        }
        let src = attach_dir.join(&a.file);
        if !src.is_file() {
            continue; // File fisik hilang: lewati, referensinya tetap ada di Markdown.
        }
        let target = root.join(rel);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(err)?;
        }
        fs::copy(&src, &target).map_err(err)?;
    }
    Ok(path_str(&root))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            data_info,
            inspect_folder,
            set_data_dir,
            backup_target,
            list_backups,
            prune_backups,
            write_export,
            import_attachment,
            import_attachment_bytes,
            open_attachment,
            reveal_attachment,
            open_url,
            save_attachment_as,
            copy_attachments
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
            // Gambar, video, dan audio lampiran ditampilkan lewat asset protocol.
            // Folder data bisa dipilih pengguna (P-5), jadi scope-nya diatur saat runtime.
            let attach_dir = paths.data_dir.join(ATTACH_DIR);
            fs::create_dir_all(&attach_dir)?;
            app.asset_protocol_scope().allow_directory(&attach_dir, false)?;
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
    fn attachment_names() {
        let hash = "a".repeat(64);
        assert!(valid_stored(&hash));
        assert!(valid_stored(&format!("{hash}.pdf")));
        assert!(!valid_stored(&format!("{hash}.")));
        assert!(!valid_stored(&format!("{hash}.PDF")));
        assert!(!valid_stored(&format!("{hash}.tar.gz")));
        assert!(!valid_stored("../notes.db"));
        assert!(!valid_stored(&"A".repeat(64)));
        assert_eq!(clean_ext("Laporan Akhir.PDF"), "pdf");
        assert_eq!(clean_ext("tanpa-ekstensi"), "");
        assert_eq!(clean_ext("aneh.p d f"), "");
    }

    #[test]
    fn store_attachment_dedups() {
        let dir = std::env::temp_dir().join(format!("simpul-test-{}", std::process::id()));
        let a = store_attachment(&dir, &b"halo"[..], "a.txt").unwrap();
        let b = store_attachment(&dir, &b"halo"[..], "B.TXT").unwrap();
        assert_eq!(a.sha256, b.sha256);
        assert_eq!(a.size, 4);
        let files: Vec<_> = fs::read_dir(&dir).unwrap().flatten().collect();
        assert_eq!(files.len(), 1);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn percent_decode_utf8() {
        assert_eq!(percent_decode("Foto%20Liburan%20%F0%9F%8C%B4.png"), "Foto Liburan 🌴.png");
        assert_eq!(percent_decode("100%"), "100%");
    }

    #[test]
    fn db_url_encodes_percent() {
        let url = db_url_for(Path::new("C:\\Data 100%"));
        assert!(url.starts_with("sqlite:C:\\Data 100%25"));
        assert!(url.ends_with(DB_FILE));
    }
}
