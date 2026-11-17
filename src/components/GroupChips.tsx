import { useEffect, useRef, useState } from "react";
import type { Card } from "../db";
import { useApp } from "../store/app";
import { IconCheck, IconClose, IconGroup, IconPlus } from "./Icons";

/** G-2, G-3, G-4: chip group di card, plus menu untuk menambah atau mengeluarkan card dari group. */
export function GroupChips({ card, readOnly }: { card: Card; readOnly: boolean }) {
  const groups = useApp((s) => s.groups);
  const removeFromGroup = useApp((s) => s.removeFromGroup);
  const setView = useApp((s) => s.setView);
  const [menuOpen, setMenuOpen] = useState(false);

  const mine = groups.filter((g) => card.groupIds.includes(g.id));

  return (
    <span className="group-chips">
      {mine.map((g) => (
        <span key={g.id} className="chip-group">
          <button className="chip-group-name" title={`Buka group "${g.name}"`} onClick={() => setView("group", g.id)}>
            <IconGroup size={11} />
            {g.name}
          </button>
          {!readOnly && (
            <button className="chip-group-x" title="Keluarkan dari group" onClick={() => void removeFromGroup(card.id, g.id)}>
              <IconClose size={10} />
            </button>
          )}
        </span>
      ))}
      {!readOnly && (
        <span className="group-menu-anchor">
          <button className="chip-add" title="Tambah ke group" onClick={() => setMenuOpen((o) => !o)}>
            <IconPlus size={9} />
            Group
          </button>
          {menuOpen && <GroupMenu card={card} onClose={() => setMenuOpen(false)} />}
        </span>
      )}
    </span>
  );
}

function GroupMenu({ card, onClose }: { card: Card; onClose(): void }) {
  const groups = useApp((s) => s.groups);
  const addToGroup = useApp((s) => s.addToGroup);
  const removeFromGroup = useApp((s) => s.removeFromGroup);
  const createGroup = useApp((s) => s.createGroup);
  const [name, setName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const q = name.trim().toLowerCase();
  const shown = q ? groups.filter((g) => g.name.toLowerCase().includes(q)) : groups;
  const exact = groups.some((g) => g.name.toLowerCase() === q);

  const toggle = (id: string) =>
    card.groupIds.includes(id) ? void removeFromGroup(card.id, id) : void addToGroup(card.id, id);

  const createAndAdd = async () => {
    const g = await createGroup(name);
    if (g) await addToGroup(card.id, g.id);
    setName("");
  };

  return (
    <div
      ref={ref}
      className="menu"
      role="menu"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <input
        ref={inputRef}
        className="menu-input"
        placeholder="Cari atau buat group…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          // Nama persis: centang/batal; selain itu buat group baru.
          const match = groups.find((g) => g.name.toLowerCase() === q);
          if (match) toggle(match.id);
          else if (q) void createAndAdd();
        }}
      />
      <div className="menu-list">
        {shown.map((g) => {
          const on = card.groupIds.includes(g.id);
          return (
            <button key={g.id} role="menuitemcheckbox" aria-checked={on} className="menu-item" onClick={() => toggle(g.id)}>
              <span className={`pick ${on ? "on" : ""}`} aria-hidden>
                {on && <IconCheck size={10} />}
              </span>
              <span className="menu-label">{g.name}</span>
            </button>
          );
        })}
        {q && !exact && (
          <button className="menu-item" onClick={() => void createAndAdd()}>
            <span className="pick ghost" aria-hidden>
              <IconPlus size={10} />
            </span>
            <span className="menu-label">
              Buat group <strong>“{name.trim()}”</strong>
            </span>
          </button>
        )}
        {!q && groups.length === 0 && <div className="menu-empty">Belum ada group. Ketik nama untuk membuat.</div>}
      </div>
    </div>
  );
}
