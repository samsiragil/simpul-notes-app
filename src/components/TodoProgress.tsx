import type { TodoProgress as Progress } from "../db";

/** Progres Todo Card, misal "3/5" dengan bar tipis (T-5). */
export function TodoProgress({ progress, compact = false }: { progress: Progress; compact?: boolean }) {
  const { done, total } = progress;
  if (total === 0) return <span className="todo-progress empty">Belum ada item</span>;
  const pct = Math.round((done / total) * 100);
  return (
    <span
      className={`todo-progress ${compact ? "compact" : ""} ${done === total ? "complete" : ""}`}
      title={`${done} dari ${total} item selesai`}
    >
      <span className="todo-progress-bar" aria-hidden>
        <span style={{ width: `${pct}%` }} />
      </span>
      <span className="todo-progress-label">
        {done}/{total}
      </span>
    </span>
  );
}
