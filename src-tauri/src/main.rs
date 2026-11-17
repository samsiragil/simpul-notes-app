// Sembunyikan jendela console di build release Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    notes_app_lib::run()
}
