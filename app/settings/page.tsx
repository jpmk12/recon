import { ensureAuth, isAuthEnabled } from "@/lib/auth";
import { getSetting } from "@/lib/db";
import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

type Sev = "critical" | "high" | "medium" | "low" | "info";

export default async function SettingsPage() {
  await ensureAuth();
  const sevRaw = getSetting("notify_severity_min", "high");
  const sev: Sev =
    sevRaw === "critical" ||
    sevRaw === "high" ||
    sevRaw === "medium" ||
    sevRaw === "low" ||
    sevRaw === "info"
      ? sevRaw
      : "high";

  const settings = {
    subnets: getSetting("subnets"),
    nmap_args: getSetting("nmap_args"),
    nmap_path: getSetting("nmap_path"),
    schedule_cron: getSetting("schedule_cron"),
    schedule_enabled: getSetting("schedule_enabled") === "true",
    mdns_enabled: getSetting("mdns_enabled", "true") === "true",
    ntfy_url: getSetting("ntfy_url"),
    ntfy_topic: getSetting("ntfy_topic"),
    webhook_url: getSetting("webhook_url"),
    notify_severity_min: sev,
    notify_on_new_device: getSetting("notify_on_new_device", "true") === "true",
    event_retention_days: getSetting("event_retention_days", "90"),
    auth_enabled: isAuthEnabled(),
  };
  return (
    <div className="p-8 max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted">
          Configure scanning, notifications, retention, and auth.
        </p>
      </header>
      <SettingsForm initial={settings} />
    </div>
  );
}
