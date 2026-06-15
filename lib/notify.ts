import { getSetting, Severity, SEVERITY_RANK } from "./db";

export type Notification = {
  title: string;
  body: string;
  severity: Severity;
  url?: string;
  tags?: string[];
};

function ntfyPriority(sev: Severity): number {
  switch (sev) {
    case "critical":
      return 5;
    case "high":
      return 4;
    case "medium":
      return 3;
    case "low":
      return 2;
    default:
      return 1;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 5000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function sendNotification(n: Notification): Promise<{
  delivered: string[];
  errors: string[];
}> {
  const delivered: string[] = [];
  const errors: string[] = [];

  const ntfyUrlRaw = getSetting("ntfy_url", "").trim();
  const ntfyTopic = getSetting("ntfy_topic", "").trim();
  if (ntfyUrlRaw && ntfyTopic && isHttpUrl(ntfyUrlRaw)) {
    try {
      const base = ntfyUrlRaw.replace(/\/+$/, "");
      const target = `${base}/${encodeURIComponent(ntfyTopic)}`;
      const r = await fetchWithTimeout(target, {
        method: "POST",
        headers: {
          Title: n.title,
          Priority: String(ntfyPriority(n.severity)),
          Tags: (n.tags ?? ["recon", n.severity]).join(","),
          ...(n.url ? { Click: n.url } : {}),
        },
        body: n.body,
      });
      if (r.ok) delivered.push("ntfy");
      else errors.push(`ntfy: HTTP ${r.status}`);
    } catch (e) {
      errors.push(`ntfy: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const webhookUrl = getSetting("webhook_url", "").trim();
  if (webhookUrl && isHttpUrl(webhookUrl)) {
    try {
      const r = await fetchWithTimeout(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "recon",
          severity: n.severity,
          title: n.title,
          body: n.body,
          url: n.url,
          tags: n.tags ?? [],
          at: Date.now(),
        }),
      });
      if (r.ok) delivered.push("webhook");
      else errors.push(`webhook: HTTP ${r.status}`);
    } catch (e) {
      errors.push(`webhook: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { delivered, errors };
}

export function shouldNotify(sev: Severity): boolean {
  const min = (getSetting("notify_severity_min", "high") as Severity) || "high";
  if (!(min in SEVERITY_RANK)) return SEVERITY_RANK[sev] <= SEVERITY_RANK.high;
  return SEVERITY_RANK[sev] <= SEVERITY_RANK[min];
}

export function notifyOnNewDevice(): boolean {
  return getSetting("notify_on_new_device", "true") === "true";
}
