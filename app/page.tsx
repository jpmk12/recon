import Link from "next/link";
import { dashboardStats, listRecentEvents } from "@/lib/queries";
import {
  issueCountsBySeverity,
  listOpenIssues,
} from "@/lib/issues";
import StatCard from "@/components/StatCard";
import ServicesChart from "@/components/ServicesChart";
import EventRow from "@/components/EventRow";
import ScanNowButton from "@/components/ScanNowButton";
import SeverityBadge from "@/components/SeverityBadge";
import IssueList from "@/components/IssueList";

export const dynamic = "force-dynamic";

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function DashboardPage() {
  const { totals, topServices, vendors, lastScan } = dashboardStats();
  const events = listRecentEvents(10);
  const issueCounts = issueCountsBySeverity();
  const issueTotal = Object.values(issueCounts).reduce((a, b) => a + b, 0);
  const topIssues = listOpenIssues(6);
  const hasHighOrCrit = issueCounts.critical + issueCounts.high > 0;

  return (
    <div className="p-8 max-w-7xl">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted">
            {lastScan
              ? `Last scan ${timeAgo(lastScan.started_at)} · ${lastScan.target}`
              : "No scans yet — kick one off to populate the inventory."}
          </p>
        </div>
        <ScanNowButton />
      </header>

      <div className="grid grid-cols-5 gap-4 mb-8">
        <StatCard
          label="Hosts up"
          value={totals.hosts_up}
          sub={`of ${totals.hosts_total} known`}
          accent="accent2"
        />
        <StatCard label="Open ports" value={totals.ports_open} accent="accent" />
        <StatCard label="Services" value={totals.services} accent="warn" />
        <StatCard
          label="Open issues"
          value={issueTotal}
          accent={hasHighOrCrit ? "danger" : issueTotal > 0 ? "warn" : "accent2"}
        >
          <div className="flex gap-1 flex-wrap mt-2">
            {(["critical", "high", "medium", "low", "info"] as const).map((s) =>
              issueCounts[s] > 0 ? (
                <SeverityBadge key={s} severity={s} count={issueCounts[s]} />
              ) : null
            )}
          </div>
        </StatCard>
        <StatCard
          label="Last scan"
          value={lastScan ? lastScan.status : "—"}
          sub={lastScan ? timeAgo(lastScan.started_at) : "never"}
          accent={lastScan?.status === "error" ? "danger" : "accent2"}
        />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card p-5 col-span-2">
          <h2 className="text-sm uppercase tracking-wider text-muted mb-4">
            Top services
          </h2>
          <ServicesChart data={topServices} />
        </div>
        <div className="card p-5">
          <h2 className="text-sm uppercase tracking-wider text-muted mb-4">
            Vendors
          </h2>
          <ul className="space-y-2">
            {vendors.length === 0 && (
              <li className="text-sm text-muted">No data yet.</li>
            )}
            {vendors.map((v) => (
              <li
                key={v.vendor}
                className="flex justify-between text-sm border-b border-border pb-2 last:border-0"
              >
                <span className="truncate pr-2">{v.vendor}</span>
                <span className="text-muted">{v.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm uppercase tracking-wider text-muted">
              Top issues
            </h2>
            <Link href="/issues" className="text-xs text-accent hover:underline">
              View all →
            </Link>
          </div>
          <IssueList issues={topIssues} />
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm uppercase tracking-wider text-muted">
              Recent changes
            </h2>
            <Link href="/devices" className="text-xs text-accent hover:underline">
              View devices →
            </Link>
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-muted">
              No activity yet. Changes will appear here after the next scan.
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
    </div>
  );
}
