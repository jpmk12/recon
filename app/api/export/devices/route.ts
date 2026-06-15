import { db } from "@/lib/db";
import { toCsv } from "@/lib/csv";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const auth = requireAuth();
  if (auth) return auth;
  const rows = db
    .prepare(
      `SELECT h.ip, h.hostname, h.mac, h.vendor, h.os, h.category, h.label,
              h.is_up AS up, h.first_seen, h.last_seen,
              (SELECT GROUP_CONCAT(p.port || '/' || p.protocol, ' ')
                 FROM ports p WHERE p.host_id = h.id AND p.is_open = 1) AS open_ports,
              (SELECT COUNT(*) FROM issues i
                 WHERE i.host_id = h.id AND i.resolved_at IS NULL) AS open_issues
       FROM hosts h
       ORDER BY h.is_up DESC, h.ip`
    )
    .all() as Record<string, unknown>[];
  const normalized = rows.map((r) => ({
    ...r,
    first_seen: r.first_seen ? new Date(Number(r.first_seen)).toISOString() : "",
    last_seen: r.last_seen ? new Date(Number(r.last_seen)).toISOString() : "",
  }));
  const csv = toCsv(normalized);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="recon-devices-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
