import { notFound } from "next/navigation";
import Link from "next/link";
import { ensureAuth } from "@/lib/auth";
import { getScan, listEventsForScan } from "@/lib/queries";
import EventRow from "@/components/EventRow";

export const dynamic = "force-dynamic";

function fmt(ts: number) {
  return new Date(ts).toLocaleString();
}

export default async function ScanDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await ensureAuth();
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) notFound();
  const scan = getScan(id);
  if (!scan) notFound();
  const events = listEventsForScan(scan.id, 500);

  return (
    <div className="p-8 max-w-7xl">
      <Link href="/scans" className="text-xs text-muted hover:text-accent">
        ← All scans
      </Link>
      <header className="mt-2 mb-6">
        <h1 className="text-2xl font-semibold">Scan #{scan.id}</h1>
        <p className="text-sm text-muted">
          {scan.target} · {scan.source} · {fmt(scan.started_at)}
        </p>
      </header>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-muted">
            Status
          </div>
          <div
            className={`text-xl font-semibold mt-1 ${
              scan.status === "ok"
                ? "text-accent2"
                : scan.status === "error"
                ? "text-danger"
                : "text-warn"
            }`}
          >
            {scan.status}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-muted">
            Hosts up
          </div>
          <div className="text-xl font-semibold mt-1">
            {scan.hosts_up}/{scan.hosts_total}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-muted">
            Duration
          </div>
          <div className="text-xl font-semibold mt-1">
            {scan.finished_at
              ? `${((scan.finished_at - scan.started_at) / 1000).toFixed(1)}s`
              : "running…"}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-muted">
            Events
          </div>
          <div className="text-xl font-semibold mt-1">{events.length}</div>
        </div>
      </div>

      {scan.error && (
        <div className="card p-4 mb-4 border-danger/40 text-sm text-danger">
          {scan.error}
        </div>
      )}

      <div className="card p-5 mb-4">
        <h2 className="text-sm uppercase tracking-wider text-muted mb-2">
          nmap args
        </h2>
        <pre className="font-mono text-xs text-muted whitespace-pre-wrap">
          {scan.args}
        </pre>
      </div>

      <div className="card p-5">
        <h2 className="text-sm uppercase tracking-wider text-muted mb-4">
          Changes this scan
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted">
            No changes — network looked identical to the previous scan.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {events.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
