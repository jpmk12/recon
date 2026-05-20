"use client";
import { useState } from "react";

type Settings = {
  subnets: string;
  nmap_args: string;
  nmap_path: string;
  schedule_cron: string;
  schedule_enabled: boolean;
};

export default function SettingsForm({ initial }: { initial: Settings }) {
  const [s, setS] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "err">(
    "idle"
  );

  async function save() {
    setState("saving");
    const r = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    setState(r.ok ? "saved" : "err");
    if (r.ok) setTimeout(() => setState("idle"), 1200);
  }

  function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    setS((cur) => ({ ...cur, [k]: v }));
  }

  return (
    <div className="card p-6 space-y-5">
      <Field
        label="Subnets to scan"
        hint="Single nmap target spec. e.g. 192.168.1.0/24 or 10.0.0.1-254"
      >
        <input
          className="input"
          value={s.subnets}
          onChange={(e) => set("subnets", e.target.value)}
        />
      </Field>

      <Field
        label="nmap arguments"
        hint="Passed verbatim. -oX is added automatically. Avoid -O without root."
      >
        <input
          className="input font-mono"
          value={s.nmap_args}
          onChange={(e) => set("nmap_args", e.target.value)}
        />
      </Field>

      <Field label="nmap binary path" hint="Defaults to 'nmap' on $PATH.">
        <input
          className="input font-mono"
          value={s.nmap_path}
          onChange={(e) => set("nmap_path", e.target.value)}
        />
      </Field>

      <Field
        label="Schedule (cron)"
        hint="Standard 5-field cron. Default: every 6 hours."
      >
        <input
          className="input font-mono"
          value={s.schedule_cron}
          onChange={(e) => set("schedule_cron", e.target.value)}
        />
      </Field>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={s.schedule_enabled}
          onChange={(e) => set("schedule_enabled", e.target.checked)}
        />
        Enable scheduled scans
      </label>

      <div className="flex items-center justify-end gap-3">
        {state === "saved" && (
          <span className="text-xs text-accent2">Saved ✓</span>
        )}
        {state === "err" && (
          <span className="text-xs text-danger">Save failed</span>
        )}
        <button onClick={save} className="btn btn-primary">
          {state === "saving" ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-muted">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  );
}
