"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import SeverityBadge from "./SeverityBadge";
import type { IssueWithHost } from "@/lib/issues";

type Action = "dismiss" | "snooze1h" | "snooze24h" | "snooze7d";

export default function IssueList({
  issues,
  showHost = true,
}: {
  issues: IssueWithHost[];
  showHost?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<{ id: number; action: Action } | null>(
    null
  );

  async function dismiss(id: number) {
    setPending({ id, action: "dismiss" });
    const r = await fetch(`/api/issues/${id}`, { method: "DELETE" });
    setPending(null);
    if (r.ok) router.refresh();
  }

  async function snooze(id: number, duration: "1h" | "24h" | "7d") {
    const action: Action =
      duration === "1h" ? "snooze1h" : duration === "24h" ? "snooze24h" : "snooze7d";
    setPending({ id, action });
    const r = await fetch(`/api/issues/${id}/snooze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duration }),
    });
    setPending(null);
    if (r.ok) router.refresh();
  }

  if (issues.length === 0) {
    return (
      <p className="text-sm text-muted">No open issues. Clean network ✓</p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {issues.map((i) => {
        const isPending = pending?.id === i.id;
        return (
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
            <div className="shrink-0 flex items-center gap-2 text-xs text-muted">
              <details className="relative">
                <summary className="cursor-pointer hover:text-accent list-none">
                  snooze
                </summary>
                <div className="absolute right-0 mt-1 card p-1 z-10 flex flex-col text-right min-w-[80px]">
                  <button
                    className="px-2 py-1 hover:text-accent"
                    onClick={() => snooze(i.id, "1h")}
                    disabled={isPending}
                  >
                    1 hour
                  </button>
                  <button
                    className="px-2 py-1 hover:text-accent"
                    onClick={() => snooze(i.id, "24h")}
                    disabled={isPending}
                  >
                    1 day
                  </button>
                  <button
                    className="px-2 py-1 hover:text-accent"
                    onClick={() => snooze(i.id, "7d")}
                    disabled={isPending}
                  >
                    1 week
                  </button>
                </div>
              </details>
              <button
                onClick={() => dismiss(i.id)}
                disabled={isPending}
                className="hover:text-accent"
                title="Resolve"
              >
                {pending?.id === i.id && pending.action === "dismiss"
                  ? "…"
                  : "dismiss"}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
