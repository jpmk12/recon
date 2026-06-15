import { ChildProcess } from "node:child_process";
import { db, getSetting } from "./db";
import {
  runNmap,
  parseNmapXml,
  applyScan,
  FiredNotification,
} from "./nmap";
import { sendNotification, shouldNotify, notifyOnNewDevice } from "./notify";
import { discoverMdns, applyMdns } from "./mdns";

declare global {
  // eslint-disable-next-line no-var
  var __reconActiveScans: Map<number, ChildProcess> | undefined;
}
const activeScans: Map<number, ChildProcess> =
  global.__reconActiveScans ?? new Map();
global.__reconActiveScans = activeScans;

export async function startScan(opts: {
  target?: string;
  args?: string;
  source?: string;
}): Promise<{ id: number; alreadyRunning?: boolean }> {
  const target = opts.target ?? getSetting("subnets", "192.168.1.0/24");
  const args = opts.args ?? getSetting("nmap_args", "-sV -T4 --top-ports 1000");
  const source = opts.source ?? "manual";
  const now = Date.now();

  // Atomic claim: a single SQLite transaction does the running-count check
  // and the INSERT together, so two concurrent /api/scans POSTs can't both
  // start a scan (better-sqlite3 transactions hold a reserved write lock).
  let result: { id: number; alreadyRunning?: boolean } | null = null;
  const claim = db.transaction(() => {
    const r = db
      .prepare("SELECT id FROM scans WHERE status='running' ORDER BY started_at DESC LIMIT 1")
      .get() as { id: number } | undefined;
    if (r) {
      result = { id: r.id, alreadyRunning: true };
      return;
    }
    const info = db
      .prepare(
        "INSERT INTO scans (target, args, started_at, status, source) VALUES (?, ?, ?, 'running', ?)"
      )
      .run(target, args, now, source);
    result = { id: Number(info.lastInsertRowid) };
  });
  claim();
  const claimed = result!;
  if (claimed.alreadyRunning) return claimed;
  void executeScan(claimed.id, target, args);
  return claimed;
}

async function executeScan(scanId: number, target: string, args: string) {
  try {
    const { xml } = await runNmap(target, args, {
      onProcess: (p) => activeScans.set(scanId, p),
    });
    activeScans.delete(scanId);
    const hosts = await parseNmapXml(xml);
    const { up, total, fired } = applyScan(scanId, hosts);

    if (getSetting("mdns_enabled", "true") === "true") {
      try {
        const records = await discoverMdns(5000);
        applyMdns(records);
      } catch (e) {
        console.warn(
          `[scan] mDNS pass failed: ${
            e instanceof Error ? e.message : String(e)
          }`
        );
      }
    }

    db.prepare(
      "UPDATE scans SET finished_at=?, status='ok', hosts_up=?, hosts_total=? WHERE id=?"
    ).run(Date.now(), up, total, scanId);

    await dispatchNotifications(fired);
  } catch (err: unknown) {
    activeScans.delete(scanId);
    const message = err instanceof Error ? err.message : String(err);
    db.prepare(
      "UPDATE scans SET finished_at=?, status='error', error=? WHERE id=?"
    ).run(Date.now(), message, scanId);
  }
}

async function dispatchNotifications(fired: FiredNotification[]) {
  for (const f of fired) {
    if (f.kind === "device.new") {
      if (!notifyOnNewDevice()) continue;
      await sendNotification({
        severity: "medium",
        title: "New device on network",
        body: `${f.ip}${f.hostname ? " (" + f.hostname + ")" : ""}${
          f.vendor ? " · " + f.vendor : ""
        }`,
        tags: ["new-device"],
      });
    } else {
      if (!shouldNotify(f.issue.severity)) continue;
      await sendNotification({
        severity: f.issue.severity,
        title: f.issue.title,
        body: f.issue.detail ?? f.issue.code,
        tags: [f.issue.severity, f.issue.code.split(".")[0]],
      });
    }
  }
}
