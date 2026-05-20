import { getSetting } from "@/lib/db";
import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const settings = {
    subnets: getSetting("subnets"),
    nmap_args: getSetting("nmap_args"),
    nmap_path: getSetting("nmap_path"),
    schedule_cron: getSetting("schedule_cron"),
    schedule_enabled: getSetting("schedule_enabled") === "true",
  };
  return (
    <div className="p-8 max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted">
          Configure what gets scanned, how, and on what schedule.
        </p>
      </header>
      <SettingsForm initial={settings} />
    </div>
  );
}
