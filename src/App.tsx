import { useEffect } from "react";
import { CardList } from "./components/CardList";
import { CardPane } from "./components/CardPane";
import { SettingsDialog } from "./components/SettingsDialog";
import { Sidebar } from "./components/Sidebar";
import { useApp } from "./store/app";
import { useSettings } from "./store/settings";

export default function App() {
  const ready = useApp((s) => s.ready);
  const error = useApp((s) => s.error);
  const sidebarOpen = useSettings((s) => s.sidebarOpen);
  const listOpen = useSettings((s) => s.listOpen);

  useShortcuts();

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
    <div className="app">
      {sidebarOpen && <Sidebar />}
      {listOpen && <CardList />}
      <CardPane />
      <SettingsDialog />
    </div>
  );
}

/** Shortcut global (PRD: C-1, P-3). */
function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey) return;
      const app = useApp.getState();
      const settings = useSettings.getState();
      const key = e.key.toLowerCase();

      if (key === "n" && !e.shiftKey) {
        e.preventDefault();
        void app.createCard("note");
      } else if (e.key === "\\" || e.code === "Backslash") {
        e.preventDefault();
        if (e.shiftKey) settings.toggleList();
        else settings.toggleSidebar();
      } else if (key === "f" && e.shiftKey) {
        e.preventDefault();
        const focus = !settings.sidebarOpen && !settings.listOpen;
        if (focus) {
          settings.toggleSidebar();
          settings.toggleList();
        } else {
          if (settings.sidebarOpen) settings.toggleSidebar();
          if (settings.listOpen) settings.toggleList();
        }
      } else if (e.key === ",") {
        e.preventDefault();
        app.setSettingsOpen(!app.settingsOpen);
      } else if (e.key === "Delete" && app.selectedId && app.view === "all") {
        e.preventDefault();
        void app.trashCard(app.selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
