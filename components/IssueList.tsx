"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import SeverityBadge from "./SeverityBadge";
import type { IssueWithHost } from "@/lib/issues";

export default function IssueList({
  issues,
  showHost = true,
}: {
  issues: IssueWithHost[];
  showHost?: boolean;
}) {
  const router = useRouter();
  const [dismissing, setDismissing] = useState<number | null>(null);

  async function dismiss(id: number) {
    setDismissing(id);
    const r = await fetch(`/api/issues/${id}`, { method: "DELETE" });
    setDismissing(null);
    if (r.ok) router.refresh();
  }

  if (issues.length === 0) {
    return (
      <p className="text-sm text-muted">No open issues. Clean network ✓</p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {issues.map((i) => (
        <li key={i.id} className="py-3 flex items-start gap-3">
          <div className="pt-0.5">
            <SeverityBadge severity={i.severity} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{i.title}</div>
            {i.detail && (
              <div className="text-xs text-muted mt-0.5 break-words">
                {i.detail}
              </div>
            )}
            <div className="text-xs text-muted mt-1 flex items-center gap-2 flex-wrap">
              {showHost && (
                <Link
                  href={`/devices/${i.host_id}`}
                  className="text-accent hover:underline font-mono"
                >
                  {i.ip}
                  {i.hostname ? ` (${i.hostname})` : ""}
                </Link>
              )}
              {i.port !== null && (
                <span className="font-mono">
                  {i.port}/{i.protocol}
                  {i.service ? ` · ${i.service}` : ""}
                </span>
              )}
              <span>{i.kind === "event" ? "event" : "state"}</span>
            </div>
          </div>
          <button
            className="text-xs text-muted hover:text-accent shrink-0"
            onClick={() => dismiss(i.id)}
            disabled={dismissing === i.id}
            title="Dismiss"
          >
            {dismissing === i.id ? "…" : "dismiss"}
          </button>
        </li>
      ))}
    </ul>
  );
}
