import { db, Host, Port, Scan, Event, Category } from "./db";

export type DeviceFilter = {
  q?: string;
  status?: "up" | "down";
  category?: Category;
  hasIssues?: boolean;
};

export function searchHosts(filter: DeviceFilter, limit = 500): Host[] {
  const where: string[] = [];
  const params: Record<string, unknown> = { limit };

  if (filter.status === "up") where.push("h.is_up = 1");
  if (filter.status === "down") where.push("h.is_up = 0");
  if (filter.category) {
    where.push("h.category = @category");
    params.category = filter.category;
  }
  if (filter.hasIssues) {
    where.push(
      "EXISTS (SELECT 1 FROM issues i WHERE i.host_id = h.id AND i.resolved_at IS NULL AND (i.snoozed_until IS NULL OR i.snoozed_until < @now))"
    );
    params.now = Date.now();
  }

  const q = (filter.q ?? "").trim();
  let sql: string;
  if (q) {
    params.term = `%${q}%`;
    params.raw = q;
    where.push(
      `(h.ip LIKE @term OR h.hostname LIKE @term OR h.mac LIKE @term
        OR h.vendor LIKE @term OR h.os LIKE @term OR h.label LIKE @term
        OR h.category LIKE @term
        OR EXISTS (SELECT 1 FROM ports p WHERE p.host_id = h.id
          AND (p.service LIKE @term OR p.product LIKE @term OR CAST(p.port AS TEXT) = @raw)))`
    );
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  sql = `SELECT h.* FROM hosts h ${whereClause}
         ORDER BY h.is_up DESC, h.last_seen DESC LIMIT @limit`;

  return db.prepare(sql).all(params) as Host[];
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

export function listPortScripts(
  portId: number
): { script_id: string; output: string }[] {
  return db
    .prepare(
      "SELECT script_id, output FROM port_scripts WHERE port_id = ? ORDER BY script_id"
    )
    .all(portId) as { script_id: string; output: string }[];
}

export function listEventsForHost(hostId: number, limit = 100): Event[] {
  return db
    .prepare("SELECT * FROM events WHERE host_id = ? ORDER BY at DESC LIMIT ?")
    .all(hostId, limit) as Event[];
}

export function listRecentEvents(limit = 50): Event[] {
  return db
    .prepare("SELECT * FROM events ORDER BY at DESC LIMIT ?")
    .all(limit) as Event[];
}

export function listEventsForScan(scanId: number, limit = 500): Event[] {
  return db
    .prepare(
      "SELECT * FROM events WHERE scan_id = ? ORDER BY at DESC LIMIT ?"
    )
    .all(scanId, limit) as Event[];
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
  const categories = db
    .prepare(
      `SELECT COALESCE(category,'unknown') AS category, COUNT(*) AS count
       FROM hosts WHERE is_up=1
       GROUP BY COALESCE(category,'unknown') ORDER BY count DESC`
    )
    .all() as { category: Category; count: number }[];
  const lastScan = db
    .prepare("SELECT * FROM scans ORDER BY started_at DESC LIMIT 1")
    .get() as Scan | undefined;
  return { totals, topServices, vendors, categories, lastScan };
}

export function updateHostMeta(
  id: number,
  patch: { label?: string | null; notes?: string | null }
) {
  const cur = db
    .prepare("SELECT label, notes FROM hosts WHERE id=?")
    .get(id) as { label: string | null; notes: string | null } | undefined;
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

export function deleteHost(id: number) {
  db.prepare("DELETE FROM hosts WHERE id=?").run(id);
}

export function resetAllData() {
  db.transaction(() => {
    db.prepare("DELETE FROM issues").run();
    db.prepare("DELETE FROM events").run();
    db.prepare("DELETE FROM port_scripts").run();
    db.prepare("DELETE FROM host_scripts").run();
    db.prepare("DELETE FROM ports").run();
    db.prepare("DELETE FROM hosts").run();
    db.prepare("DELETE FROM scans").run();
  })();
}
