import cron, { ScheduledTask } from "node-cron";
import { getSetting } from "./db";
import { startScan } from "./scans";

declare global {
  // eslint-disable-next-line no-var
  var __reconScheduler:
    | { task: ScheduledTask | null; cronExpr: string; enabled: boolean }
    | undefined;
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

// Auto-initialize on import (Next.js server runtime).
refreshSchedule();
