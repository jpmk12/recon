"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Settings = {
  subnets: string;
  nmap_args: string;
  nmap_path: string;
  schedule_cron: string;
  schedule_enabled: boolean;
  mdns_enabled: boolean;
  ntfy_url: string;
  ntfy_topic: string;
  webhook_url: string;
  notify_severity_min: "critical" | "high" | "medium" | "low" | "info";
  notify_on_new_device: boolean;
  event_retention_days: string;
  auth_enabled: boolean;
};

export default function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "err">(
    "idle"
  );
  const [resetting, setResetting] = useState(false);
  const [testing, setTesting] = useState<null | {
    delivered: string[];
    errors: string[];
  }>(null);

  async function save() {
    setState("saving");
    const payload: Record<string, unknown> = { ...s };
    if (password !== "") payload.new_password = password;
    delete (payload as Record<string, unknown>).auth_enabled;
    const r = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setState(r.ok ? "saved" : "err");
    if (r.ok) {
      setPassword("");
      setTimeout(() => setState("idle"), 1200);
      router.refresh();
    }
  }

  async function testNotify() {
    setTesting({ delivered: [], errors: ["Sending…"] });
    const r = await fetch("/api/notify/test", { method: "POST" });
    if (r.ok) setTesting(await r.json());
    else setTesting({ delivered: [], errors: ["request failed"] });
  }

  async function resetAll() {
    if (
      !window.confirm(
        "Delete every device, port, scan, event, and issue? Settings are kept."
      )
    )
      return;
    const t = window.prompt('Type "RESET" to confirm.');
    if (t !== "RESET") return;
    setResetting(true);
    const r = await fetch("/api/reset", { method: "POST" });
    setResetting(false);
    if (r.ok) {
      router.refresh();
      alert("All device data cleared.");
    } else {
      alert("Reset failed.");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function set<K extends keyof Settings>(k: K, v: Settings[K]) {
    setS((cur) => ({ ...cur, [k]: v }));
  }

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-5">
        <div className="text-sm uppercase tracking-wider text-muted">
          Scanning
        </div>
        <Field
          label="Subnets / targets"
          hint="Space, comma, or newline separated. Each token passed to nmap. e.g. 192.168.1.0/24 10.0.0.0/24"
        >
          <textarea
            className="input font-mono min-h-[60px]"
            value={s.subnets}
            onChange={(e) => set("subnets", e.target.value)}
          />
        </Field>
        <Field
          label="nmap arguments"
          hint="Passed verbatim. -oX is appended automatically."
        >
          <input
            className="input font-mono"
            value={s.nmap_args}
            onChange={(e) => set("nmap_args", e.target.value)}
          />
        </Field>
        <Field label="nmap binary path">
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
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={s.mdns_enabled}
            onChange={(e) => set("mdns_enabled", e.target.checked)}
          />
          Run mDNS / Bonjour discovery after each scan
        </label>
      </div>

      <div className="card p-6 space-y-5">
        <div className="text-sm uppercase tracking-wider text-muted">
          Notifications
        </div>
        <Field
          label="ntfy server URL"
          hint="e.g. https://ntfy.sh or your self-hosted ntfy instance. Leave empty to disable."
        >
          <input
            className="input font-mono"
            value={s.ntfy_url}
            onChange={(e) => set("ntfy_url", e.target.value)}
            placeholder="https://ntfy.sh"
          />
        </Field>
        <Field label="ntfy topic" hint="Topic to publish to.">
          <input
            className="input font-mono"
            value={s.ntfy_topic}
            onChange={(e) => set("ntfy_topic", e.target.value)}
            placeholder="my-home-recon-abc123"
          />
        </Field>
        <Field
          label="Webhook URL"
          hint="JSON POST. Receives {source, severity, title, body, url, tags, at}."
        >
          <input
            className="input font-mono"
            value={s.webhook_url}
            onChange={(e) => set("webhook_url", e.target.value)}
            placeholder="https://example.com/hook"
          />
        </Field>
        <Field
          label="Minimum severity to notify"
          hint="Includes severities at and above this level."
        >
          <select
            className="input"
            value={s.notify_severity_min}
            onChange={(e) =>
              set("notify_severity_min", e.target.value as Settings["notify_severity_min"])
            }
          >
            <option value="critical">Critical only</option>
            <option value="high">High and above</option>
            <option value="medium">Medium and above</option>
            <option value="low">Low and above</option>
            <option value="info">Everything</option>
          </select>
        </Field>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={s.notify_on_new_device}
            onChange={(e) => set("notify_on_new_device", e.target.checked)}
          />
          Notify when an unknown device joins the network
        </label>
        <div className="flex items-center gap-3">
          <button onClick={testNotify} className="btn">
            Send test notification
          </button>
          {testing && (
            <span className="text-xs text-muted">
              {testing.delivered.length > 0 &&
                `delivered: ${testing.delivered.join(", ")}`}
              {testing.errors.length > 0 && (
                <span className="text-danger ml-2">
                  {testing.errors.join("; ")}
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      <div className="card p-6 space-y-5">
        <div className="text-sm uppercase tracking-wider text-muted">
          Retention
        </div>
        <Field
          label="Keep events and resolved issues for (days)"
          hint="Older records are purged nightly at 03:17. 0 disables purge."
        >
          <input
            type="number"
            min={0}
            className="input font-mono w-32"
            value={s.event_retention_days}
            onChange={(e) => set("event_retention_days", e.target.value)}
          />
        </Field>
      </div>

      <div className="card p-6 space-y-5">
        <div className="text-sm uppercase tracking-wider text-muted">
          Authentication
        </div>
        <p className="text-xs text-muted">
          Auth is {s.auth_enabled ? "enabled" : "disabled"}. Set a password to
          enable; leave blank when saving to disable. Even on a LAN, this
          prevents anyone on your network from reading the issues page.
        </p>
        <Field
          label={s.auth_enabled ? "Change password" : "Set password"}
          hint="Empty value clears it / disables auth on next save."
        >
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        {s.auth_enabled && (
          <button onClick={logout} className="btn">
            Log out current session
          </button>
        )}
      </div>

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

      <div className="card p-6 border-danger/40">
        <div className="text-sm uppercase tracking-wider text-muted mb-2">
          Danger zone
        </div>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-medium">Clear all device data</div>
            <p className="text-xs text-muted mt-1 max-w-xl">
              Wipes every host, port, scan, event, and issue. Settings stay.
            </p>
          </div>
          <button
            onClick={resetAll}
            disabled={resetting}
            className="btn border-danger/40 text-danger hover:border-danger hover:text-danger"
          >
            {resetting ? "Clearing…" : "Clear all data"}
          </button>
        </div>
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
