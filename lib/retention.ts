import { db, getSetting } from "./db";

/**
 * Purge stale rows outside the retention window. Events first (largest
 * table), then resolved/expired issues, then completed scans. Running
 * scans are never deleted.
 */
export function runRetention(): {
  events: number;
  issues: number;
  scans: number;
} {
  const days = parseInt(getSetting("event_retention_days", "90"), 10);
  if (!Number.isFinite(days) || days <= 0) {
    return { events: 0, issues: 0, scans: 0 };
  }
  const cutoff = Date.now() - days * 86_400_000;
  const e = db.prepare("DELETE FROM events WHERE at < ?").run(cutoff);
  const i = db
    .prepare(
      "DELETE FROM issues WHERE resolved_at IS NOT NULL AND resolved_at < ?"
    )
    .run(cutoff);
  const s = db
    .prepare(
      "DELETE FROM scans WHERE finished_at IS NOT NULL AND finished_at < ? AND status != 'running'"
    )
    .run(cutoff);
  return { events: e.changes, issues: i.changes, scans: s.changes };
}
