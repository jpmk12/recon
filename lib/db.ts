import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const dbPath = path.join(DATA_DIR, "recon.db");

declare global {
  // eslint-disable-next-line no-var
  var __reconDb: Database.Database | undefined;
}

export const db: Database.Database =
  global.__reconDb ?? new Database(dbPath);
if (!global.__reconDb) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  global.__reconDb = db;
  migrate();
}

function tryExec(sql: string) {
  try {
    db.exec(sql);
  } catch {
    // ignore "duplicate column" errors on re-run
  }
}

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hosts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL UNIQUE,
      hostname TEXT,
      mac TEXT,
      vendor TEXT,
      os TEXT,
      first_seen INTEGER NOT NULL,
      last_seen INTEGER NOT NULL,
      is_up INTEGER NOT NULL DEFAULT 1,
      label TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS ports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host_id INTEGER NOT NULL,
      port INTEGER NOT NULL,
      protocol TEXT NOT NULL,
      state TEXT NOT NULL,
      service TEXT,
      product TEXT,
      version TEXT,
      first_seen INTEGER NOT NULL,
      last_seen INTEGER NOT NULL,
      is_open INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE,
      UNIQUE (host_id, port, protocol)
    );

    CREATE TABLE IF NOT EXISTS port_scripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      port_id INTEGER NOT NULL,
      script_id TEXT NOT NULL,
      output TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (port_id) REFERENCES ports(id) ON DELETE CASCADE,
      UNIQUE (port_id, script_id)
    );

    CREATE TABLE IF NOT EXISTS host_scripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host_id INTEGER NOT NULL,
      script_id TEXT NOT NULL,
      output TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE,
      UNIQUE (host_id, script_id)
    );

    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target TEXT NOT NULL,
      args TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      status TEXT NOT NULL,
      hosts_up INTEGER DEFAULT 0,
      hosts_total INTEGER DEFAULT 0,
      error TEXT,
      source TEXT NOT NULL DEFAULT 'manual'
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id INTEGER,
      host_id INTEGER,
      kind TEXT NOT NULL,
      detail TEXT,
      at INTEGER NOT NULL,
      FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE SET NULL,
      FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host_id INTEGER NOT NULL,
      port_id INTEGER NOT NULL DEFAULT 0,
      code TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT,
      kind TEXT NOT NULL DEFAULT 'state',
      first_seen INTEGER NOT NULL,
      last_seen INTEGER NOT NULL,
      resolved_at INTEGER,
      FOREIGN KEY (host_id) REFERENCES hosts(id) ON DELETE CASCADE,
      UNIQUE (host_id, port_id, code)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_hosts_ip ON hosts(ip);
    CREATE INDEX IF NOT EXISTS idx_hosts_hostname ON hosts(hostname);
    CREATE INDEX IF NOT EXISTS idx_ports_host ON ports(host_id);
    CREATE INDEX IF NOT EXISTS idx_ports_service ON ports(service);
    CREATE INDEX IF NOT EXISTS idx_port_scripts_port ON port_scripts(port_id);
    CREATE INDEX IF NOT EXISTS idx_events_host ON events(host_id);
    CREATE INDEX IF NOT EXISTS idx_events_at ON events(at);
    CREATE INDEX IF NOT EXISTS idx_events_scan ON events(scan_id);
    CREATE INDEX IF NOT EXISTS idx_issues_host ON issues(host_id);
    CREATE INDEX IF NOT EXISTS idx_issues_open ON issues(resolved_at);
    CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity);
  `);

  // Idempotent column additions for upgrades from earlier versions.
  tryExec(`ALTER TABLE hosts ADD COLUMN category TEXT`);
  tryExec(`ALTER TABLE issues ADD COLUMN snoozed_until INTEGER`);

  const setIfMissing = db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
  );
  setIfMissing.run("subnets", "192.168.1.0/24");
  setIfMissing.run(
    "nmap_args",
    "-sV -T4 --top-ports 1000 --script default,vulners"
  );
  setIfMissing.run("schedule_cron", "0 */6 * * *");
  setIfMissing.run("schedule_enabled", "false");
  setIfMissing.run("nmap_path", "nmap");
  setIfMissing.run("mdns_enabled", "true");
  setIfMissing.run("ntfy_url", "");
  setIfMissing.run("ntfy_topic", "");
  setIfMissing.run("webhook_url", "");
  setIfMissing.run("notify_severity_min", "high");
  setIfMissing.run("notify_on_new_device", "true");
  setIfMissing.run("event_retention_days", "90");
  setIfMissing.run("auth_password_hash", "");
  setIfMissing.run("auth_session_token", "");
}

export type Category =
  | "router"
  | "nas"
  | "printer"
  | "camera"
  | "voice"
  | "iot"
  | "phone"
  | "server"
  | "laptop"
  | "tv"
  | "gaming"
  | "unknown";

export type Host = {
  id: number;
  ip: string;
  hostname: string | null;
  mac: string | null;
  vendor: string | null;
  os: string | null;
  first_seen: number;
  last_seen: number;
  is_up: number;
  label: string | null;
  notes: string | null;
  category: Category | null;
};

export type Port = {
  id: number;
  host_id: number;
  port: number;
  protocol: string;
  state: string;
  service: string | null;
  product: string | null;
  version: string | null;
  first_seen: number;
  last_seen: number;
  is_open: number;
};

export type Scan = {
  id: number;
  target: string;
  args: string;
  started_at: number;
  finished_at: number | null;
  status: string;
  hosts_up: number;
  hosts_total: number;
  error: string | null;
  source: string;
};

export type Event = {
  id: number;
  scan_id: number | null;
  host_id: number | null;
  kind: string;
  detail: string | null;
  at: number;
};

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type Issue = {
  id: number;
  host_id: number;
  port_id: number;
  code: string;
  severity: Severity;
  title: string;
  detail: string | null;
  kind: "state" | "event";
  first_seen: number;
  last_seen: number;
  resolved_at: number | null;
  snoozed_until: number | null;
};

export type PortScript = {
  id: number;
  port_id: number;
  script_id: string;
  output: string;
  updated_at: number;
};

export function getSetting(key: string, fallback = ""): string {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};
