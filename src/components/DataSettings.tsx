import { useCallback, useEffect, useState } from "react";
import { BACKUP_KEEP, checkDataDir, exportTo, moveDataDir, resetDataDir, runDailyBackup, type MoveCheck } from "../lib/dataOps";
import * as native from "../lib/native";
import { fullDate } from "../lib/util";
import { ConfirmDialog } from "./ConfirmDialog";
import { IconBackup, IconExport, IconFolderOpen, IconRestore } from "./Icons";

type Status = { kind: "ok" | "error"; text: string } | null;
type PendingMove = Extract<MoveCheck, { kind: "copy" | "useExisting" }> | { kind: "reset" };

const sizeLabel = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;

/** Tab Data di Pengaturan: folder data (P-5), backup harian, dan Export (P-6). */
export function DataSettings() {
  if (!native.hasNative()) {
    return (
      <div className="data-settings">
        <p className="data-note">
          Folder data, backup, dan export hanya tersedia di aplikasi desktop. Mode browser (<code>npm run dev</code>) menyimpan data di
          localStorage untuk mencoba UI.
        </p>
      </div>
    );
  }
  return <DataSettingsNative />;
}

function DataSettingsNative() {
  const [info, setInfo] = useState<native.DataInfo | null>(null);
  const [backups, setBackups] = useState<native.BackupFile[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [move, setMove] = useState<PendingMove | null>(null);

  const reload = useCallback(async () => {
    const [i, b] = await Promise.all([native.dataInfo(), native.listBackups()]);
    setInfo(i);
    setBackups(b);
  }, []);

  useEffect(() => {
    reload().catch((e) => setStatus({ kind: "error", text: String(e) }));
  }, [reload]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setStatus(null);
    try {
      await fn();
    } catch (e) {
      setStatus({ kind: "error", text: String(e) });
    } finally {
      setBusy(null);
    }
  };

  const pickDataDir = () =>
    run("folder", async () => {
      if (!info) return;
      const dir = await native.pickFolder("Pilih folder data");
      if (!dir) return;
      const check = await checkDataDir(dir, info);
      if (check.kind === "same") setStatus({ kind: "ok", text: "Folder itu sudah menjadi folder data." });
      else if (check.kind === "missing") setStatus({ kind: "error", text: "Folder tidak ditemukan." });
      else setMove(check);
    });

  const confirmMove = (m: PendingMove) => {
    setMove(null);
    void run("folder", () => (m.kind === "reset" ? resetDataDir() : moveDataDir(m)));
  };

  const backupNow = () =>
    run("backup", async () => {
      const made = await runDailyBackup();
      await reload();
      setStatus({ kind: "ok", text: made ? "Backup hari ini dibuat." : "Backup hari ini sudah ada." });
    });

  const exportAll = () =>
    run("export", async () => {
      const dir = await native.pickFolder("Pilih folder tujuan export");
      if (!dir) return;
      const out = await exportTo(dir);
      setStatus({ kind: "ok", text: `Export selesai: ${out}` });
    });

  if (!info) return <div className="data-settings" />;

  return (
    <div className="data-settings">
      <section>
        <div className="field-label">Folder data</div>
        <div className="data-path" title={info.dataDir}>
          {info.dataDir}
        </div>
        <p className="data-note">
          Berisi <code>notes.db</code> dan subfolder <code>backups</code>. {info.isDefault ? "Ini folder bawaan aplikasi." : "Folder pilihan sendiri."}
        </p>
        {info.missingDir && (
          <p className="data-warn">
            Folder data pilihan <code>{info.missingDir}</code> tidak ditemukan saat aplikasi dibuka, jadi folder bawaan yang dipakai. Sambungkan
            kembali drive-nya lalu buka ulang aplikasi, atau pilih folder lain.
          </p>
        )}
        <div className="data-actions">
          <button className="btn" disabled={!!busy} onClick={pickDataDir}>
            <IconFolderOpen />
            Ganti folder…
          </button>
          {!info.isDefault && (
            <button className="btn" disabled={!!busy} onClick={() => setMove({ kind: "reset" })}>
              <IconRestore size={14} />
              Kembali ke folder bawaan
            </button>
          )}
        </div>
      </section>

      <section>
        <div className="field-label">
          Backup harian
          <output>{BACKUP_KEEP} terakhir</output>
        </div>
        <p className="data-note">
          Salinan <code>notes.db</code> dibuat otomatis sekali sehari di <code>{info.backupDir}</code>.
        </p>
        {backups.length === 0 ? (
          <p className="data-note">Belum ada backup.</p>
        ) : (
          <ul className="backup-list">
            {backups.map((b) => (
              <li key={b.name}>
                <span className="backup-name">{b.name}</span>
                <span>{fullDate(b.modified)}</span>
                <span className="backup-size">{sizeLabel(b.size)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="data-actions">
          <button className="btn" disabled={!!busy} onClick={backupNow}>
            <IconBackup />
            {busy === "backup" ? "Membuat backup…" : "Backup sekarang"}
          </button>
        </div>
      </section>

      <section>
        <div className="field-label">Export</div>
        <p className="data-note">
          Semua card ke folder baru: satu file Markdown per card (<code>cards/</code>, <code>trash/</code>) dan <code>data.json</code> berisi
          seluruh data termasuk link dan group.
        </p>
        <div className="data-actions">
          <button className="btn" disabled={!!busy} onClick={exportAll}>
            <IconExport />
            {busy === "export" ? "Mengekspor…" : "Export ke folder…"}
          </button>
        </div>
      </section>

      {status && <p className={status.kind === "error" ? "data-warn" : "data-ok"}>{status.text}</p>}

      {move && (
        <ConfirmDialog
          title={
            move.kind === "reset"
              ? "Kembali ke folder data bawaan?"
              : move.kind === "copy"
                ? "Pindahkan data ke folder ini?"
                : "Pakai data di folder ini?"
          }
          message={
            move.kind === "reset"
              ? `Aplikasi akan memakai notes.db di ${info.defaultDir} lalu dibuka ulang. Perubahan sejak pindah folder ada di folder saat ini dan tidak ikut.`
              : move.kind === "copy"
                ? `Database saat ini disalin ke ${move.dir}, lalu aplikasi dibuka ulang memakai folder itu. Data di folder lama tidak dihapus.`
                : `${move.dir} sudah berisi notes.db. Aplikasi akan dibuka ulang memakai data di folder itu; data di folder saat ini tidak disalin dan tidak dihapus.`
          }
          confirmLabel={move.kind === "copy" ? "Salin dan buka ulang" : "Buka ulang"}
          onCancel={() => setMove(null)}
          onConfirm={() => confirmMove(move)}
        />
      )}
    </div>
  );
}
