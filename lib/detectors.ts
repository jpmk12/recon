import { db, Severity } from "./db";

export type IssueCandidate = {
  port_id: number;
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
  return dedupe(issues);
}

function dedupe(issues: IssueCandidate[]): IssueCandidate[] {
  const seen = new Set<string>();
  const out: IssueCandidate[] = [];
  for (const i of issues) {
    const k = `${i.port_id}:${i.code}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(i);
  }
  return out;
}

function detectFromService(p: OpenPortRow): IssueCandidate[] {
  const out: IssueCandidate[] = [];
  const service = (p.service ?? "").toLowerCase();
  const where = `${p.port}/${p.protocol}`;

  if (service === "telnet" || (p.port === 23 && p.protocol === "tcp")) {
    out.push({
      port_id: p.id,
      code: "service.telnet",
      severity: "high",
      title: "Telnet exposed",
      detail: `Telnet on ${where} transmits credentials in cleartext. Disable or replace with SSH.`,
    });
  }
  if (
    service === "ftp" ||
    (p.port === 21 && p.protocol === "tcp" && !service.includes("ftps"))
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
      detail: `VNC on ${where} is often unauthenticated. Restrict to localhost or tunnel via SSH.`,
    });
  }
  if (service === "rdp" || (p.port === 3389 && p.protocol === "tcp")) {
    out.push({
      port_id: p.id,
      code: "service.rdp-lan",
      severity: "low",
      title: "RDP exposed on LAN",
      detail: `RDP on ${where}. Ensure NLA is required and patches are current.`,
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
        detail: `Cert on ${p.port}/${p.protocol} is self-signed.`,
      });
    }
  }

  const sslEnum = scripts.get("ssl-enum-ciphers");
  if (sslEnum) {
    if (/SSLv2|SSLv3|TLSv1\.0|TLSv1\.1/.test(sslEnum)) {
      out.push({
        port_id: p.id,
        code: "tls.weak-version",
        severity: "medium",
        title: "Deprecated TLS protocol enabled",
        detail: `Service on ${p.port}/${p.protocol} accepts SSLv2/v3 or TLS 1.0/1.1.`,
      });
    }
    if (/RC4|3DES|EXPORT|NULL|MD5/.test(sslEnum)) {
      out.push({
        port_id: p.id,
        code: "tls.weak-cipher",
        severity: "medium",
        title: "Weak TLS cipher available",
        detail: `${p.port}/${p.protocol} advertises RC4, 3DES, EXPORT, or other weak ciphers.`,
      });
    }
  }

  const sshAlgos = scripts.get("ssh2-enum-algos");
  if (sshAlgos) {
    if (/ssh-dss|ssh-rsa\s/.test(sshAlgos) || /diffie-hellman-group1-sha1/.test(sshAlgos)) {
      out.push({
        port_id: p.id,
        code: "ssh.weak-algo",
        severity: "low",
        title: "Weak SSH algorithm offered",
        detail: `SSH on ${p.port}/${p.protocol} offers DSA host keys or DH group1 — disable in sshd_config.`,
      });
    }
  }

  const smbProtocols = scripts.get("smb-protocols") ?? scripts.get("smb-os-discovery");
  if (smbProtocols && /SMBv1|NT LM 0\.12|2\.02/i.test(smbProtocols)) {
    out.push({
      port_id: p.id,
      code: "smb.v1",
      severity: "high",
      title: "SMBv1 enabled",
      detail: `${p.port}/${p.protocol} accepts SMBv1. Vulnerable to EternalBlue and similar. Disable it.`,
    });
  }

  const vulners = scripts.get("vulners");
  if (vulners) {
    const seen = new Set<string>();
    for (const line of vulners.split(/\r?\n/)) {
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

  // Catch-all: any NSE script output that contains a VULNERABLE marker.
  for (const [scriptId, output] of scripts) {
    if (scriptId === "vulners") continue;
    if (/\bVULNERABLE\b/i.test(output)) {
      const firstLine = output.split(/\r?\n/).find((l) => /VULNERABLE/i.test(l));
      out.push({
        port_id: p.id,
        code: `nse.${scriptId}`,
        severity: "high",
        title: `${scriptId} reports vulnerability`,
        detail: (firstLine ?? "").trim().slice(0, 240),
      });
    }
  }

  return out;
}

/**
 * Persist detected state issues. Returns the subset that newly transitioned
 * into the open state (newly inserted, or previously resolved and now
 * re-opened) so the caller can fire notifications without re-spamming on
 * repeat re-detection.
 */
export function reconcileStateIssues(
  hostId: number,
  detected: IssueCandidate[],
  now: number
): IssueCandidate[] {
  const lookup = db.prepare(
    "SELECT resolved_at FROM issues WHERE host_id=? AND port_id=? AND code=?"
  );
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
  const fired: IssueCandidate[] = [];
  const seen = new Set<string>();
  for (const i of detected) {
    const prior = lookup.get(hostId, i.port_id, i.code) as
      | { resolved_at: number | null }
      | undefined;
    const isNewOpen = !prior || prior.resolved_at !== null;
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
    if (isNewOpen) fired.push(i);
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
  return fired;
}
