use tauri_plugin_sql::{Migration, MigrationKind};

/// URL database yang sama dipakai di frontend (`src/db/client.ts`).
/// File `notes.db` dibuat di folder data aplikasi:
/// %APPDATA%\com.pribadi.notes\notes.db
const DB_URL: &str = "sqlite:notes.db";

fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "init: card, todo_item, link, grp, group_member",
        sql: include_str!("../migrations/0001_init.sql"),
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations())
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("gagal menjalankan aplikasi");
}
