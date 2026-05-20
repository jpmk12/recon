import { db, getSetting } from "./db";
import { runNmap, parseNmapXml, applyScan } from "./nmap";

export async function startScan(opts: {
  target?: string;
  args?: string;
  source?: string;
}): Promise<number> {
  const target = opts.target ?? getSetting("subnets", "192.168.1.0/24");
  const args = opts.args ?? getSetting("nmap_args", "-sV -T4 --top-ports 1000");
  const source = opts.source ?? "manual";
  const now = Date.now();
  const info = db
    .prepare(
      "INSERT INTO scans (target, args, started_at, status, source) VALUES (?, ?, ?, 'running', ?)"
    )
    .run(target, args, now, source);
  const scanId = Number(info.lastInsertRowid);
  // Fire and forget; UI polls scan status.
  void executeScan(scanId, target, args);
  return scanId;
}

async function executeScan(scanId: number, target: string, args: string) {
  try {
    const { xml } = await runNmap(target, args);
    const hosts = await parseNmapXml(xml);
    const { up, total } = applyScan(scanId, hosts);
    db.prepare(
      "UPDATE scans SET finished_at=?, status='ok', hosts_up=?, hosts_total=? WHERE id=?"
    ).run(Date.now(), up, total, scanId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    db.prepare(
      "UPDATE scans SET finished_at=?, status='error', error=? WHERE id=?"
    ).run(Date.now(), message, scanId);
  }
}
