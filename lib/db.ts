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

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_hosts_ip ON hosts(ip);
    CREATE INDEX IF NOT EXISTS idx_hosts_hostname ON hosts(hostname);
    CREATE INDEX IF NOT EXISTS idx_ports_host ON ports(host_id);
    CREATE INDEX IF NOT EXISTS idx_ports_service ON ports(service);
    CREATE INDEX IF NOT EXISTS idx_events_host ON events(host_id);
    CREATE INDEX IF NOT EXISTS idx_events_at ON events(at);
  `);

  // Seed default settings
  const setIfMissing = db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
  );
  setIfMissing.run("subnets", "192.168.1.0/24");
  setIfMissing.run("nmap_args", "-sV -T4 --top-ports 1000");
  setIfMissing.run("schedule_cron", "0 */6 * * *");
  setIfMissing.run("schedule_enabled", "false");
  setIfMissing.run("nmap_path", "nmap");
}

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
