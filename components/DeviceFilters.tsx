"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { CATEGORY_LABELS } from "@/lib/classify";
import type { Category } from "@/lib/db";

const CATEGORIES: Category[] = [
  "router",
  "nas",
  "printer",
  "camera",
  "voice",
  "iot",
  "phone",
  "server",
  "laptop",
  "tv",
  "gaming",
  "unknown",
];

export default function DeviceFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const set = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params);
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
      router.replace(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router]
  );

  const status = params.get("status") ?? "";
  const category = params.get("category") ?? "";
  const hasIssues = params.get("issues") === "1";

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <select
        className="input w-auto text-xs py-1.5"
        value={status}
        onChange={(e) => set("status", e.target.value || null)}
      >
        <option value="">All status</option>
        <option value="up">Up</option>
        <option value="down">Down</option>
      </select>
      <select
        className="input w-auto text-xs py-1.5"
        value={category}
        onChange={(e) => set("category", e.target.value || null)}
      >
        <option value="">All categories</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-xs text-muted ml-1">
        <input
          type="checkbox"
          checked={hasIssues}
          onChange={(e) => set("issues", e.target.checked ? "1" : null)}
        />
        Only with open issues
      </label>
      <a
        href="/api/export/devices"
        className="ml-auto text-xs text-accent hover:underline"
        download
      >
        Export CSV ↓
      </a>
    </div>
  );
}
