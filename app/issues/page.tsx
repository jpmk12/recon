import { listOpenIssues, issueCountsBySeverity } from "@/lib/issues";
import IssueList from "@/components/IssueList";
import SeverityBadge from "@/components/SeverityBadge";

export const dynamic = "force-dynamic";

export default function IssuesPage() {
  const issues = listOpenIssues();
  const counts = issueCountsBySeverity();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div className="p-8 max-w-7xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Issues</h1>
        <p className="text-sm text-muted">
          Problems detected from nmap NSE output and service heuristics. State
          issues auto-resolve when the underlying cause goes away.
        </p>
      </header>

      <div className="card p-5 mb-6 flex items-center gap-4 flex-wrap">
        <span className="text-sm text-muted">Open:</span>
        <span className="text-lg font-semibold">{total}</span>
        <div className="flex gap-2 flex-wrap">
          {(["critical", "high", "medium", "low", "info"] as const).map((s) =>
            counts[s] > 0 ? (
              <SeverityBadge key={s} severity={s} count={counts[s]} />
            ) : null
          )}
        </div>
      </div>

      <div className="card p-5">
        <IssueList issues={issues} />
      </div>
    </div>
  );
}
