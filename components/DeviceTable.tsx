import Link from "next/link";
import type { Host } from "@/lib/db";

function ipSortKey(ip: string) {
  return ip
    .split(".")
    .map((n) => n.padStart(3, "0"))
    .join(".");
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function DeviceTable({ hosts }: { hosts: Host[] }) {
  const sorted = [...hosts].sort((a, b) => {
    if (a.is_up !== b.is_up) return b.is_up - a.is_up;
    return ipSortKey(a.ip).localeCompare(ipSortKey(b.ip));
  });
  if (sorted.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-muted">
        No devices match.
      </div>
    );
  }
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-bg/60 border-b border-border text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-left px-4 py-3">IP</th>
            <th className="text-left px-4 py-3">Hostname</th>
            <th className="text-left px-4 py-3">Vendor / OS</th>
            <th className="text-left px-4 py-3">Label</th>
            <th className="text-right px-4 py-3">Seen</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((h) => (
            <tr
              key={h.id}
              className="border-b border-border last:border-0 hover:bg-bg/40"
            >
              <td className="px-4 py-3">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    h.is_up ? "bg-accent2" : "bg-muted"
                  }`}
                />
              </td>
              <td className="px-4 py-3 font-mono">
                <Link
                  href={`/devices/${h.id}`}
                  className="text-accent hover:underline"
                >
                  {h.ip}
                </Link>
              </td>
              <td className="px-4 py-3 truncate max-w-[200px]">
                {h.hostname ?? <span className="text-muted">—</span>}
              </td>
              <td className="px-4 py-3 text-muted truncate max-w-[260px]">
                {[h.vendor, h.os].filter(Boolean).join(" · ") || "—"}
              </td>
              <td className="px-4 py-3">
                {h.label ? (
                  <span className="tag border-accent text-accent">{h.label}</span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right text-xs text-muted">
                {timeAgo(h.last_seen)} ago
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
