import { useEffect, type CSSProperties } from "react";
import { AppDnd } from "./components/AppDnd";
import { CardList } from "./components/CardList";
import { CardPane } from "./components/CardPane";
import { LinkDialog } from "./components/LinkDialog";
import { SearchPalette } from "./components/SearchPalette";
import { SettingsDialog } from "./components/SettingsDialog";
import { Sidebar } from "./components/Sidebar";
import { scheduleDailyBackup } from "./lib/dataOps";
import { useApp } from "./store/app";
import { useSettings } from "./store/settings";

export default function App() {
  const ready = useApp((s) => s.ready);
  const error = useApp((s) => s.error);
  const sidebarOpen = useSettings((s) => s.sidebarOpen);
  const listOpen = useSettings((s) => s.listOpen);
  const focusMode = useSettings((s) => s.focusMode);
  const listWidth = useSettings((s) => s.listWidth);

  useShortcuts();

  // Backup harian notes.db (lihat PRD: Model data dan penyimpanan).
  useEffect(() => {
    if (ready && !error) return scheduleDailyBackup();
  }, [ready, error]);

  if (!ready) return null;
  if (error) {
    return (
      <div className="error-box">
        <strong>Gagal membuka database.</strong>
        <br />
        {error}
      </div>
    );
  }

  return (
    <div className={`app ${focusMode ? "focus" : ""}`} style={{ "--list-w": `${listWidth}px` } as CSSProperties}>
      <AppDnd>
        {sidebarOpen && !focusMode && <Sidebar />}
        {listOpen && !focusMode && <CardList />}
        <CardPane />
      </AppDnd>
      <LinkDialog />
      <SearchPalette />
      <SettingsDialog />
    </div>
  );
}

/** Shortcut global (PRD: C-1, L-1, L-4, S-3, P-3). `Ctrl+Shift+T` membuat Todo Card. */
function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const app = useApp.getState();
      // L-4: Kembali. Juga mencegah navigasi riwayat bawaan WebView2.
      if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key === "ArrowLeft") {
        e.preventDefault();
        if (!app.linkDialogOpen && !app.searchOpen) app.back();
        return;
      }
      // P-3: Esc keluar dari mode fokus jika tidak ada dialog yang terbuka.
      if (e.key === "Escape" && useSettings.getState().focusMode && !app.linkDialogOpen && !app.searchOpen && !app.settingsOpen) {
        if (!document.querySelector(".overlay")) useSettings.getState().toggleFocus();
        return;
      }
      if (!e.ctrlKey || e.altKey) return;
      const settings = useSettings.getState();
      const key = e.key.toLowerCase();

      if (key === "k" && !e.shiftKey) {
        // S-3 (N-5: Ctrl+K untuk pencarian, bukan link).
        e.preventDefault();
        if (!app.linkDialogOpen) app.setSearchOpen(!app.searchOpen);
      } else if (key === "n" && !e.shiftKey) {
        e.preventDefault();
        void app.createCard("note");
      } else if (key === "t" && e.shiftKey) {
        e.preventDefault();
        void app.createCard("todo");
      } else if (e.key === "\\" || e.code === "Backslash") {
        e.preventDefault();
        if (e.shiftKey) settings.toggleList();
        else settings.toggleSidebar();
      } else if (key === "f" && e.shiftKey) {
        e.preventDefault();
        settings.toggleFocus();
      } else if (key === "l" && !e.shiftKey) {
        e.preventDefault();
        if (app.selectedId && app.view !== "trash") app.setLinkDialogOpen(true);
      } else if (e.key === ",") {
        e.preventDefault();
        app.setSettingsOpen(!app.settingsOpen);
      } else if (e.key === "Delete" && app.selectedId && app.view !== "trash") {
        e.preventDefault();
        void app.trashCard(app.selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
