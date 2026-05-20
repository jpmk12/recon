"use client";
import { useEffect, useState } from "react";
import type { Scan } from "@/lib/db";

function fmt(ts: number) {
  return new Date(ts).toLocaleString();
}

function dur(s: Scan) {
  if (!s.finished_at) return "…";
  const ms = s.finished_at - s.started_at;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export default function ScanList({ scans }: { scans: Scan[] }) {
  const [rows, setRows] = useState(scans);

  useEffect(() => setRows(scans), [scans]);

  useEffect(() => {
    if (!rows.some((r) => r.status === "running")) return;
    const t = setInterval(async () => {
      const r = await fetch("/api/scans");
      if (r.ok) setRows(await r.json());
    }, 2000);
    return () => clearInterval(t);
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-muted">
        No scans yet.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-bg/60 border-b border-border text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-left px-4 py-3">Target</th>
            <th className="text-left px-4 py-3">Source</th>
            <th className="text-left px-4 py-3">Started</th>
            <th className="text-right px-4 py-3">Duration</th>
            <th className="text-right px-4 py-3">Hosts up / total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr
              key={s.id}
              className="border-b border-border last:border-0 hover:bg-bg/40"
            >
              <td className="px-4 py-3">
                <span
                  className={
                    s.status === "ok"
                      ? "text-accent2"
                      : s.status === "running"
                      ? "text-warn"
                      : s.status === "error"
                      ? "text-danger"
                      : "text-muted"
                  }
                >
                  {s.status}
                </span>
                {s.error && (
                  <div
                    className="text-xs text-danger truncate max-w-xs"
                    title={s.error}
                  >
                    {s.error}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 font-mono">{s.target}</td>
              <td className="px-4 py-3 text-muted">{s.source}</td>
              <td className="px-4 py-3 text-muted">{fmt(s.started_at)}</td>
              <td className="px-4 py-3 text-right text-muted">{dur(s)}</td>
              <td className="px-4 py-3 text-right text-muted">
                {s.hosts_up}/{s.hosts_total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
