import { db, Issue, Severity } from "./db";

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export type IssueWithHost = Issue & {
  ip: string;
  hostname: string | null;
  port: number | null;
  protocol: string | null;
  service: string | null;
};

export function listOpenIssues(limit = 500): IssueWithHost[] {
  return db
    .prepare(
      `SELECT i.*, h.ip, h.hostname, p.port, p.protocol, p.service
       FROM issues i
       JOIN hosts h ON h.id = i.host_id
       LEFT JOIN ports p ON p.id = i.port_id
       WHERE i.resolved_at IS NULL
       ORDER BY
         CASE i.severity
           WHEN 'critical' THEN 0
           WHEN 'high'     THEN 1
           WHEN 'medium'   THEN 2
           WHEN 'low'      THEN 3
           ELSE 4
         END,
         i.last_seen DESC
       LIMIT ?`
    )
    .all(limit) as IssueWithHost[];
}

export function listOpenIssuesForHost(hostId: number): IssueWithHost[] {
  return db
    .prepare(
      `SELECT i.*, h.ip, h.hostname, p.port, p.protocol, p.service
       FROM issues i
       JOIN hosts h ON h.id = i.host_id
       LEFT JOIN ports p ON p.id = i.port_id
       WHERE i.host_id = ? AND i.resolved_at IS NULL
       ORDER BY
         CASE i.severity
           WHEN 'critical' THEN 0
           WHEN 'high'     THEN 1
           WHEN 'medium'   THEN 2
           WHEN 'low'      THEN 3
           ELSE 4
         END,
         i.last_seen DESC`
    )
    .all(hostId) as IssueWithHost[];
}

export function issueCountsBySeverity(): Record<Severity, number> {
  const rows = db
    .prepare(
      `SELECT severity, COUNT(*) AS n FROM issues WHERE resolved_at IS NULL GROUP BY severity`
    )
    .all() as { severity: Severity; n: number }[];
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
  const r = db
    .prepare(
      "SELECT COUNT(*) AS n FROM issues WHERE host_id=? AND resolved_at IS NULL"
    )
    .get(hostId) as { n: number };
  return r.n;
}

export function dismissIssue(id: number) {
  db.prepare("UPDATE issues SET resolved_at=? WHERE id=?").run(Date.now(), id);
}

export { SEVERITY_RANK };
