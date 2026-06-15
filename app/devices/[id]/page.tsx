import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getHost,
  listEventsForHost,
  listPorts,
  listPortScripts,
} from "@/lib/queries";
import { listOpenIssuesForHost } from "@/lib/issues";
import { ensureAuth } from "@/lib/auth";
import EventRow from "@/components/EventRow";
import HostMetaEditor from "@/components/HostMetaEditor";
import PortBadge from "@/components/PortBadge";
import IssueList from "@/components/IssueList";
import CategoryBadge from "@/components/CategoryBadge";

export const dynamic = "force-dynamic";

function fmt(ts: number) {
  return new Date(ts).toLocaleString();
}

export default async function DeviceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await ensureAuth();
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) notFound();
  const host = getHost(id);
  if (!host) notFound();
  const ports = listPorts(host.id);
  const events = listEventsForHost(host.id, 100);
  const issues = listOpenIssuesForHost(host.id);
  const portScripts = new Map<number, { script_id: string; output: string }[]>();
  for (const p of ports) portScripts.set(p.id, listPortScripts(p.id));

  return (
    <div className="p-8 max-w-7xl">
      <Link href="/devices" className="text-xs text-muted hover:text-accent">
        ← All devices
      </Link>
      <div className="flex items-start justify-between mt-2 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                host.is_up ? "bg-accent2" : "bg-muted"
              }`}
            />
            <h1 className="text-2xl font-semibold font-mono">{host.ip}</h1>
            <CategoryBadge category={host.category} />
            {host.label && (
              <span className="tag border-accent text-accent">{host.label}</span>
            )}
            {issues.length > 0 && (
              <span className="tag border-danger text-danger">
                {issues.length} issue{issues.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <p className="text-sm text-muted mt-1">
            {host.hostname ?? "no hostname"} ·{" "}
            {host.vendor ?? "unknown vendor"} · {host.os ?? "unknown OS"}
          </p>
        </div>
        <div className="text-right text-xs text-muted">
          <div>First seen {fmt(host.first_seen)}</div>
          <div>Last seen {fmt(host.last_seen)}</div>
          {host.mac && <div className="font-mono">{host.mac}</div>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          {issues.length > 0 && (
            <div className="card p-5 border-danger/40">
              <h2 className="text-sm uppercase tracking-wider text-muted mb-4">
                Issues
              </h2>
              <IssueList issues={issues} showHost={false} />
            </div>
          )}

          <div className="card p-5">
            <h2 className="text-sm uppercase tracking-wider text-muted mb-4">
              Ports & services
            </h2>
            {ports.length === 0 ? (
              <p className="text-sm text-muted">No ports recorded.</p>
            ) : (
              <ul className="divide-y divide-border">
                {ports.map((p) => {
                  const scripts = portScripts.get(p.id) ?? [];
                  return (
                    <li key={p.id} className="py-2">
                      <div className="flex items-center gap-3">
                        <PortBadge open={!!p.is_open} />
                        <span className="font-mono w-24">
                          {p.port}/{p.protocol}
                        </span>
                        <span className="flex-1">
                          <span className="text-sm">{p.service ?? "—"}</span>
                          {(p.product || p.version) && (
                            <span className="text-xs text-muted ml-2">
                              {[p.product, p.version].filter(Boolean).join(" ")}
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-muted">
                          seen {fmt(p.last_seen)}
                        </span>
                      </div>
                      {scripts.length > 0 && (
                        <details className="mt-2 ml-32 text-xs text-muted">
                          <summary className="cursor-pointer hover:text-accent">
                            {scripts.length} NSE script result
                            {scripts.length === 1 ? "" : "s"}
                          </summary>
                          <div className="mt-2 space-y-2">
                            {scripts.map((s) => (
                              <div key={s.script_id}>
                                <div className="text-[11px] uppercase tracking-wider text-accent">
                                  {s.script_id}
                                </div>
                                <pre className="font-mono text-[11px] whitespace-pre-wrap text-muted bg-bg p-2 rounded border border-border max-h-56 overflow-auto">
                                  {s.output}
                                </pre>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="card p-5">
            <h2 className="text-sm uppercase tracking-wider text-muted mb-4">
              History
            </h2>
            {events.length === 0 ? (
              <p className="text-sm text-muted">No events recorded.</p>
            ) : (
              <ul className="divide-y divide-border">
                {events.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card p-5 h-fit">
          <h2 className="text-sm uppercase tracking-wider text-muted mb-4">
            Notes & label
          </h2>
          <HostMetaEditor
            id={host.id}
            ip={host.ip}
            label={host.label ?? ""}
            notes={host.notes ?? ""}
          />
        </div>
      </div>
    </div>
  );
}
