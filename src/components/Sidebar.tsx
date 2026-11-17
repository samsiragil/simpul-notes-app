import { useDndContext } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Group } from "../db";
import { useApp } from "../store/app";
import { useSettings } from "../store/settings";
import { ConfirmDialog } from "./ConfirmDialog";
import { IconAll, IconGroup, IconInbox, IconMore, IconPlus, IconSettings, IconSidebar, IconTrash } from "./Icons";

/** ID dnd-kit: group di sidebar dan card di daftar (lihat `AppDnd`). */
export const groupDndId = (id: string) => `group:${id}`;

export function Sidebar() {
  const view = useApp((s) => s.view);
  const groupId = useApp((s) => s.groupId);
  const groups = useApp((s) => s.groups);
  const list = useApp((s) => s.list);
  const trashedCount = useApp((s) => s.trashed.length);
  const setView = useApp((s) => s.setView);
  const createGroup = useApp((s) => s.createGroup);
  const deleteGroup = useApp((s) => s.deleteGroup);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const toggleSidebar = useSettings((s) => s.toggleSidebar);

  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Group | null>(null);

  const ungroupedCount = list.filter((c) => c.groupIds.length === 0).length;
  const countOf = (id: string) => list.filter((c) => c.groupIds.includes(id)).length;

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span className="brand">Simpul</span>
        <button className="icon-btn" title="Ciutkan sidebar (Ctrl+\)" onClick={toggleSidebar}>
          <IconSidebar />
        </button>
      </div>

      <nav className="nav">
        <button className={`nav-item ${view === "all" ? "active" : ""}`} onClick={() => setView("all")}>
          <IconAll />
          <span>Semua</span>
          <span className="count">{list.length}</span>
        </button>
        <button className={`nav-item ${view === "ungrouped" ? "active" : ""}`} onClick={() => setView("ungrouped")}>
          <IconInbox />
          <span>Tanpa group</span>
          <span className="count">{ungroupedCount}</span>
        </button>
      </nav>

      <div className="nav-label with-action">
        <span>Group</span>
        <button className="icon-btn small" title="Group baru" onClick={() => setAdding(true)}>
          <IconPlus size={11} />
        </button>
      </div>

      <div className="nav groups">
        <SortableContext items={groups.map((g) => groupDndId(g.id))} strategy={verticalListSortingStrategy}>
          {groups.map((g) => (
            <GroupItem
              key={g.id}
              group={g}
              count={countOf(g.id)}
              active={view === "group" && groupId === g.id}
              onOpen={() => setView("group", g.id)}
              onDelete={() => setConfirmDelete(g)}
            />
          ))}
        </SortableContext>
        {adding && (
          <NameInput
            placeholder="Nama group"
            onSubmit={async (name) => {
              setAdding(false);
              const g = await createGroup(name);
              if (g) await setView("group", g.id);
            }}
            onCancel={() => setAdding(false)}
          />
        )}
        {groups.length === 0 && !adding && (
          <div className="nav-hint">Belum ada group. Klik + untuk membuat, lalu seret card ke sini.</div>
        )}
      </div>

      <div className="spacer" />

      <nav className="nav">
        <button className={`nav-item ${view === "trash" ? "active" : ""}`} onClick={() => setView("trash")}>
          <IconTrash />
          <span>Trash</span>
          {trashedCount > 0 && <span className="count">{trashedCount}</span>}
        </button>
        <button className="nav-item" onClick={() => setSettingsOpen(true)} title="Pengaturan (Ctrl+,)">
          <IconSettings />
          <span>Pengaturan</span>
        </button>
      </nav>

      {confirmDelete && (
        <ConfirmDialog
          title={`Hapus group "${confirmDelete.name}"?`}
          message="Card di dalam group ini tidak ikut terhapus dan tetap ada di tampilan Semua."
          confirmLabel="Hapus group"
          danger
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            const id = confirmDelete.id;
            setConfirmDelete(null);
            void deleteGroup(id);
          }}
        />
      )}
    </aside>
  );
}

function GroupItem({ group, count, active, onOpen, onDelete }: { group: Group; count: number; active: boolean; onOpen(): void; onDelete(): void }) {
  const renameGroup = useApp((s) => s.renameGroup);
  const [renaming, setRenaming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { active: dragging } = useDndContext();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: groupDndId(group.id) });

  // Sorot group saat card diseret ke atasnya (G-2).
  const cardOver = isOver && String(dragging?.id ?? "").startsWith("card:");

  if (renaming) {
    return (
      <NameInput
        initial={group.name}
        placeholder="Nama group"
        onSubmit={(name) => {
          setRenaming(false);
          void renameGroup(group.id, name);
        }}
        onCancel={() => setRenaming(false)}
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`group-item ${isDragging ? "dragging" : ""}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <button
        className={`nav-item ${active ? "active" : ""} ${cardOver ? "drop-target" : ""}`}
        onClick={onOpen}
        onDoubleClick={() => setRenaming(true)}
        onKeyDown={(e) => {
          if (e.key === "F2") {
            e.preventDefault();
            setRenaming(true);
          }
        }}
        title="Seret untuk mengurutkan. F2 atau klik dua kali untuk ganti nama."
        {...attributes}
        {...listeners}
      >
        <IconGroup />
        <span className="nav-name">{group.name}</span>
        <span className="count">{count}</span>
      </button>
      <button className="icon-btn small group-more" title="Opsi group" onClick={() => setMenuOpen((o) => !o)}>
        <IconMore size={13} />
      </button>
      {menuOpen && (
        <PopMenu onClose={() => setMenuOpen(false)}>
          <button
            className="menu-item"
            onClick={() => {
              setMenuOpen(false);
              setRenaming(true);
            }}
          >
            <span className="menu-label">Ganti nama</span>
          </button>
          <button
            className="menu-item danger"
            onClick={() => {
              setMenuOpen(false);
              onDelete();
            }}
          >
            <span className="menu-label">Hapus group</span>
          </button>
        </PopMenu>
      )}
    </div>
  );
}

function PopMenu({ children, onClose }: { children: ReactNode; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="menu right"
      role="menu"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      {children}
    </div>
  );
}

function NameInput({ initial = "", placeholder, onSubmit, onCancel }: { initial?: string; placeholder: string; onSubmit(name: string): void; onCancel(): void }) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  // Enter lalu blur (saat input dilepas) tidak boleh mengirim dua kali.
  const finished = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (submit: boolean) => {
    if (finished.current) return;
    finished.current = true;
    if (submit && value.trim()) onSubmit(value);
    else onCancel();
  };
  const done = () => finish(true);
  return (
    <input
      ref={ref}
      className="nav-input"
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={done}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          done();
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        }
      }}
    />
  );
}
