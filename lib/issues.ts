import { db, Issue, Severity, SEVERITY_RANK } from "./db";

export type IssueWithHost = Issue & {
  ip: string;
  hostname: string | null;
  port: number | null;
  protocol: string | null;
  service: string | null;
};

const ORDER_CASE = `CASE i.severity
    WHEN 'critical' THEN 0
    WHEN 'high'     THEN 1
    WHEN 'medium'   THEN 2
    WHEN 'low'      THEN 3
    ELSE 4
  END`;

const OPEN_FILTER = `i.resolved_at IS NULL AND (i.snoozed_until IS NULL OR i.snoozed_until < ?)`;

export function listOpenIssues(limit = 500): IssueWithHost[] {
  const now = Date.now();
  return db
    .prepare(
      `SELECT i.*, h.ip, h.hostname, p.port, p.protocol, p.service
       FROM issues i
       JOIN hosts h ON h.id = i.host_id
       LEFT JOIN ports p ON p.id = i.port_id
       WHERE ${OPEN_FILTER}
       ORDER BY ${ORDER_CASE}, i.last_seen DESC
       LIMIT ?`
    )
    .all(now, limit) as IssueWithHost[];
}

export function listOpenIssuesForHost(hostId: number): IssueWithHost[] {
  const now = Date.now();
  return db
    .prepare(
      `SELECT i.*, h.ip, h.hostname, p.port, p.protocol, p.service
       FROM issues i
       JOIN hosts h ON h.id = i.host_id
       LEFT JOIN ports p ON p.id = i.port_id
       WHERE i.host_id = ? AND ${OPEN_FILTER}
       ORDER BY ${ORDER_CASE}, i.last_seen DESC`
    )
    .all(hostId, now) as IssueWithHost[];
}

export function listSnoozedIssues(limit = 200): IssueWithHost[] {
  const now = Date.now();
  return db
    .prepare(
      `SELECT i.*, h.ip, h.hostname, p.port, p.protocol, p.service
       FROM issues i
       JOIN hosts h ON h.id = i.host_id
       LEFT JOIN ports p ON p.id = i.port_id
       WHERE i.resolved_at IS NULL AND i.snoozed_until IS NOT NULL AND i.snoozed_until >= ?
       ORDER BY i.snoozed_until ASC
       LIMIT ?`
    )
    .all(now, limit) as IssueWithHost[];
}

export function issueCountsBySeverity(): Record<Severity, number> {
  const now = Date.now();
  const rows = db
    .prepare(
      `SELECT severity, COUNT(*) AS n FROM issues
       WHERE resolved_at IS NULL AND (snoozed_until IS NULL OR snoozed_until < ?)
       GROUP BY severity`
    )
    .all(now) as { severity: Severity; n: number }[];
  const out: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const r of rows) out[r.severity] = r.n;
  return out;
}

export function issueCountForHost(hostId: number): number {
  const now = Date.now();
  const r = db
    .prepare(
      `SELECT COUNT(*) AS n FROM issues
       WHERE host_id=? AND resolved_at IS NULL AND (snoozed_until IS NULL OR snoozed_until < ?)`
    )
    .get(hostId, now) as { n: number };
  return r.n;
}

export function dismissIssue(id: number) {
  db.prepare("UPDATE issues SET resolved_at=? WHERE id=?").run(Date.now(), id);
}

export function snoozeIssue(id: number, durationMs: number) {
  const until = Date.now() + durationMs;
  db.prepare("UPDATE issues SET snoozed_until=? WHERE id=?").run(until, id);
}

export { SEVERITY_RANK };
