import { db, Severity } from "./db";

export type IssueCandidate = {
  port_id: number; // 0 = host-level
  code: string;
  severity: Severity;
  title: string;
  detail?: string;
};

type OpenPortRow = {
  id: number;
  port: number;
  protocol: string;
  service: string | null;
  product: string | null;
  version: string | null;
};

const cveSeverity = (cvss: number): Severity =>
  cvss >= 9 ? "critical" : cvss >= 7 ? "high" : cvss >= 4 ? "medium" : "low";

/**
 * Read current open ports + their nmap NSE script output for a host,
 * then derive issues. Idempotent — re-running on the same DB state
 * yields the same set.
 */
export function detectIssuesForHost(hostId: number): IssueCandidate[] {
  const ports = db
    .prepare(
      "SELECT id, port, protocol, service, product, version FROM ports WHERE host_id=? AND is_open=1"
    )
    .all(hostId) as OpenPortRow[];
  const scriptStmt = db.prepare(
    "SELECT script_id, output FROM port_scripts WHERE port_id=?"
  );

  const issues: IssueCandidate[] = [];
  for (const p of ports) {
    const scripts = new Map<string, string>();
    for (const row of scriptStmt.all(p.id) as {
      script_id: string;
      output: string;
    }[]) {
      scripts.set(row.script_id, row.output);
    }
    issues.push(...detectFromService(p));
    issues.push(...detectFromScripts(p, scripts));
  }
  return issues;
}

function detectFromService(p: OpenPortRow): IssueCandidate[] {
  const out: IssueCandidate[] = [];
  const service = (p.service ?? "").toLowerCase();
  const where = `${p.port}/${p.protocol}`;

  if (service === "telnet" || p.port === 23) {
    out.push({
      port_id: p.id,
      code: "service.telnet",
      severity: "high",
      title: "Telnet exposed",
      detail: `Telnet on ${where} transmits credentials in cleartext. Disable or replace with SSH.`,
    });
  }
  if (
    (service === "ftp" || (p.port === 21 && !service)) &&
    !service.includes("ftps")
  ) {
    out.push({
      port_id: p.id,
      code: "service.ftp",
      severity: "medium",
      title: "Cleartext FTP exposed",
      detail: `FTP on ${where} sends credentials in cleartext. Use SFTP or FTPS.`,
    });
  }
  if (service.startsWith("vnc")) {
    out.push({
      port_id: p.id,
      code: "service.vnc",
      severity: "high",
      title: "VNC exposed",
      detail: `VNC on ${where} is often unauthenticated or weakly authenticated. Restrict to localhost or tunnel via SSH.`,
    });
  }
  if (service === "rdp" || p.port === 3389) {
    out.push({
      port_id: p.id,
      code: "service.rdp-lan",
      severity: "low",
      title: "RDP exposed on LAN",
      detail: `RDP on ${where}. Ensure NLA is required and patches are current; prefer VPN access.`,
    });
  }
  return out;
}

function detectFromScripts(
  p: OpenPortRow,
  scripts: Map<string, string>
): IssueCandidate[] {
  const out: IssueCandidate[] = [];

  const ssl = scripts.get("ssl-cert");
  if (ssl) {
    const m = ssl.match(/Not valid after:\s*([0-9T:\-Z]+)/);
    if (m) {
      const expiry = Date.parse(m[1]);
      if (isFinite(expiry)) {
        const daysLeft = Math.floor((expiry - Date.now()) / 86_400_000);
        if (daysLeft < 0) {
          out.push({
            port_id: p.id,
            code: "tls.expired",
            severity: "high",
            title: "TLS certificate expired",
            detail: `Cert on ${p.port}/${p.protocol} expired ${Math.abs(daysLeft)} day(s) ago.`,
          });
        } else if (daysLeft <= 30) {
          out.push({
            port_id: p.id,
            code: "tls.expiring",
            severity: "medium",
            title: "TLS certificate expiring soon",
            detail: `Cert on ${p.port}/${p.protocol} expires in ${daysLeft} day(s).`,
          });
        }
      }
    }
    const issuerMatch = ssl.match(/Issuer:\s*([^\n]+)/);
    const subjectMatch = ssl.match(/Subject:\s*([^\n]+)/);
    if (
      issuerMatch &&
      subjectMatch &&
      issuerMatch[1].trim() === subjectMatch[1].trim()
    ) {
      out.push({
        port_id: p.id,
        code: "tls.self-signed",
        severity: "info",
        title: "Self-signed TLS certificate",
        detail: `Cert on ${p.port}/${p.protocol} is self-signed. Often fine on LAN — flagged for visibility.`,
      });
    }
  }

  const vulners = scripts.get("vulners");
  if (vulners) {
    const seen = new Set<string>();
    const lines = vulners.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/(CVE-\d{4}-\d{4,7})\s+(\d+(?:\.\d+)?)/);
      if (!m) continue;
      const cve = m[1];
      if (seen.has(cve)) continue;
      seen.add(cve);
      const cvss = parseFloat(m[2]);
      out.push({
        port_id: p.id,
        code: `cve.${cve}`,
        severity: cveSeverity(cvss),
        title: `${cve} (CVSS ${cvss.toFixed(1)})`,
        detail: `${[p.service, p.product, p.version]
          .filter(Boolean)
          .join(" ")} on ${p.port}/${p.protocol} — https://vulners.com/cve/${cve}`,
      });
    }
  }

  return out;
}

/**
 * Persist detected state issues for a host. Re-detected issues bump
 * last_seen and clear resolved_at; previously-open state issues that
 * did not re-detect are marked resolved. Event-kind issues (e.g.
 * device.new) are never auto-resolved here.
 */
export function reconcileStateIssues(
  hostId: number,
  detected: IssueCandidate[],
  now: number
) {
  const upsert = db.prepare(`
    INSERT INTO issues (host_id, port_id, code, severity, title, detail, kind, first_seen, last_seen)
    VALUES (@host_id, @port_id, @code, @severity, @title, @detail, 'state', @now, @now)
    ON CONFLICT(host_id, port_id, code) DO UPDATE SET
      severity = excluded.severity,
      title    = excluded.title,
      detail   = excluded.detail,
      last_seen= excluded.last_seen,
      resolved_at = NULL
  `);
  const seen = new Set<string>();
  for (const i of detected) {
    upsert.run({
      host_id: hostId,
      port_id: i.port_id,
      code: i.code,
      severity: i.severity,
      title: i.title,
      detail: i.detail ?? null,
      now,
    });
    seen.add(`${i.port_id}:${i.code}`);
  }

  const openState = db
    .prepare(
      "SELECT id, port_id, code FROM issues WHERE host_id=? AND kind='state' AND resolved_at IS NULL"
    )
    .all(hostId) as { id: number; port_id: number; code: string }[];
  const resolve = db.prepare("UPDATE issues SET resolved_at=? WHERE id=?");
  for (const o of openState) {
    if (!seen.has(`${o.port_id}:${o.code}`)) {
      resolve.run(now, o.id);
    }
  }
}
