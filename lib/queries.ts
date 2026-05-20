import { db, Host, Port, Scan, Event } from "./db";

export function searchHosts(q: string, limit = 200): Host[] {
  const term = `%${q.trim()}%`;
  if (!q.trim()) {
    return db
      .prepare("SELECT * FROM hosts ORDER BY is_up DESC, last_seen DESC LIMIT ?")
      .all(limit) as Host[];
  }
  return db
    .prepare(
      `SELECT DISTINCT h.* FROM hosts h
       LEFT JOIN ports p ON p.host_id = h.id
       WHERE h.ip LIKE @term OR h.hostname LIKE @term OR h.mac LIKE @term
          OR h.vendor LIKE @term OR h.os LIKE @term OR h.label LIKE @term
          OR p.service LIKE @term OR p.product LIKE @term
          OR CAST(p.port AS TEXT) = @raw
       ORDER BY h.is_up DESC, h.last_seen DESC LIMIT @limit`
    )
    .all({ term, raw: q.trim(), limit }) as Host[];
}

export function getHost(id: number): Host | undefined {
  return db.prepare("SELECT * FROM hosts WHERE id = ?").get(id) as
    | Host
    | undefined;
}

export function listPorts(hostId: number): Port[] {
  return db
    .prepare(
      "SELECT * FROM ports WHERE host_id = ? ORDER BY is_open DESC, port ASC"
    )
    .all(hostId) as Port[];
}

export function listEventsForHost(hostId: number, limit = 100): Event[] {
  return db
    .prepare(
      "SELECT * FROM events WHERE host_id = ? ORDER BY at DESC LIMIT ?"
    )
    .all(hostId, limit) as Event[];
}

export function listRecentEvents(limit = 50): Event[] {
  return db
    .prepare("SELECT * FROM events ORDER BY at DESC LIMIT ?")
    .all(limit) as Event[];
}

export function listScans(limit = 50): Scan[] {
  return db
    .prepare("SELECT * FROM scans ORDER BY started_at DESC LIMIT ?")
    .all(limit) as Scan[];
}

export function getScan(id: number): Scan | undefined {
  return db.prepare("SELECT * FROM scans WHERE id = ?").get(id) as
    | Scan
    | undefined;
}

export function dashboardStats() {
  const totals = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM hosts) AS hosts_total,
        (SELECT COUNT(*) FROM hosts WHERE is_up=1) AS hosts_up,
        (SELECT COUNT(*) FROM ports WHERE is_open=1) AS ports_open,
        (SELECT COUNT(DISTINCT service) FROM ports WHERE is_open=1 AND service IS NOT NULL) AS services`
    )
    .get() as {
    hosts_total: number;
    hosts_up: number;
    ports_open: number;
    services: number;
  };
  const topServices = db
    .prepare(
      `SELECT service, COUNT(*) AS count
       FROM ports WHERE is_open=1 AND service IS NOT NULL
       GROUP BY service ORDER BY count DESC LIMIT 8`
    )
    .all() as { service: string; count: number }[];
  const vendors = db
    .prepare(
      `SELECT vendor, COUNT(*) AS count FROM hosts WHERE vendor IS NOT NULL
       GROUP BY vendor ORDER BY count DESC LIMIT 6`
    )
    .all() as { vendor: string; count: number }[];
  const lastScan = db
    .prepare("SELECT * FROM scans ORDER BY started_at DESC LIMIT 1")
    .get() as Scan | undefined;
  return { totals, topServices, vendors, lastScan };
}

export function updateHostMeta(
  id: number,
  patch: { label?: string | null; notes?: string | null }
) {
  const cur = db.prepare("SELECT label, notes FROM hosts WHERE id=?").get(id) as
    | { label: string | null; notes: string | null }
    | undefined;
  if (!cur) return;
  const next = {
    label: patch.label !== undefined ? patch.label : cur.label,
    notes: patch.notes !== undefined ? patch.notes : cur.notes,
  };
  db.prepare("UPDATE hosts SET label=?, notes=? WHERE id=?").run(
    next.label,
    next.notes,
    id
  );
}
