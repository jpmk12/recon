import { ensureAuth } from "@/lib/auth";
import {
  listOpenIssues,
  issueCountsBySeverity,
  listSnoozedIssues,
} from "@/lib/issues";
import IssueList from "@/components/IssueList";
import SeverityBadge from "@/components/SeverityBadge";

export const dynamic = "force-dynamic";

export default async function IssuesPage() {
  await ensureAuth();
  const issues = listOpenIssues();
  const snoozed = listSnoozedIssues();
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

      <div className="card p-5 mb-6">
        <IssueList issues={issues} />
      </div>

      {snoozed.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm uppercase tracking-wider text-muted mb-4">
            Snoozed ({snoozed.length})
          </h2>
          <IssueList issues={snoozed} />
        </div>
      )}
    </div>
  );
}
