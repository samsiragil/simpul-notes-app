import { useApp } from "../store/app";
import { useSettings } from "../store/settings";
import { IconAll, IconSettings, IconSidebar, IconTrash } from "./Icons";

export function Sidebar() {
  const view = useApp((s) => s.view);
  const setView = useApp((s) => s.setView);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const toggleSidebar = useSettings((s) => s.toggleSidebar);

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span className="brand">Notes</span>
        <button className="icon-btn" title="Ciutkan sidebar (Ctrl+\)" onClick={toggleSidebar}>
          <IconSidebar />
        </button>
      </div>

      <nav className="nav">
        <button className={`nav-item ${view === "all" ? "active" : ""}`} onClick={() => setView("all")}>
          <IconAll />
          <span>Semua</span>
        </button>
      </nav>

      <div className="nav-label">Group</div>
      <div className="nav-hint">Group hadir di M3.</div>

      <div className="spacer" />

      <nav className="nav">
        <button className={`nav-item ${view === "trash" ? "active" : ""}`} onClick={() => setView("trash")}>
          <IconTrash />
          <span>Trash</span>
        </button>
        <button className="nav-item" onClick={() => setSettingsOpen(true)} title="Pengaturan (Ctrl+,)">
          <IconSettings />
          <span>Pengaturan</span>
        </button>
      </nav>
    </aside>
  );
}
