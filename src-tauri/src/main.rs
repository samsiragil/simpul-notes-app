// Sembunyikan jendela console di build release Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    simpul_lib::run()
}
