import cron, { ScheduledTask } from "node-cron";
import { getSetting } from "./db";
import { startScan } from "./scans";
import { runRetention } from "./retention";

declare global {
  // eslint-disable-next-line no-var
  var __reconScheduler:
    | { task: ScheduledTask | null; cronExpr: string; enabled: boolean }
    | undefined;
  // eslint-disable-next-line no-var
  var __reconRetentionTask: ScheduledTask | null | undefined;
}

export function refreshSchedule() {
  const cronExpr = getSetting("schedule_cron", "0 */6 * * *");
  const enabled = getSetting("schedule_enabled", "false") === "true";
  const state = global.__reconScheduler ?? {
    task: null,
    cronExpr: "",
    enabled: false,
  };
  if (state.task && (state.cronExpr !== cronExpr || !enabled)) {
    state.task.stop();
    state.task = null;
  }
  if (enabled && !state.task) {
    if (!cron.validate(cronExpr)) {
      console.warn(`[scheduler] invalid cron expression: ${cronExpr}`);
      return;
    }
    state.task = cron.schedule(cronExpr, () => {
      void startScan({ source: "scheduled" });
    });
    state.cronExpr = cronExpr;
    state.enabled = true;
    console.log(`[scheduler] active: ${cronExpr}`);
  } else if (!enabled) {
    state.enabled = false;
  }
  global.__reconScheduler = state;
}

function startRetentionTask() {
  if (global.__reconRetentionTask) return;
  // Nightly at 03:17 local — slightly off the hour to avoid colliding
  // with other cron jobs.
  global.__reconRetentionTask = cron.schedule("17 3 * * *", () => {
    try {
      const { events, issues, scans } = runRetention();
      if (events > 0 || issues > 0 || scans > 0) {
        console.log(
          `[retention] purged ${events} events, ${issues} issues, ${scans} scans`
        );
      }
    } catch (e) {
      console.warn(
        `[retention] failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  });
}

refreshSchedule();
startRetentionTask();
