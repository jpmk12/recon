import { NextResponse } from "next/server";
import { z } from "zod";
import { getSetting, setSetting } from "@/lib/db";
import { refreshSchedule } from "@/lib/scheduler";
import { requireAuth, setPassword } from "@/lib/auth";

export const runtime = "nodejs";

const SAFE_KEYS = [
  "subnets",
  "nmap_args",
  "nmap_path",
  "schedule_cron",
  "schedule_enabled",
  "mdns_enabled",
  "ntfy_url",
  "ntfy_topic",
  "webhook_url",
  "notify_severity_min",
  "notify_on_new_device",
  "event_retention_days",
] as const;

const schema = z
  .object({
    subnets: z.string().max(2000).optional(),
    nmap_args: z.string().max(500).optional(),
    nmap_path: z.string().max(500).optional(),
    schedule_cron: z.string().max(100).optional(),
    schedule_enabled: z.union([z.boolean(), z.string()]).optional(),
    mdns_enabled: z.union([z.boolean(), z.string()]).optional(),
    ntfy_url: z.string().max(500).optional(),
    ntfy_topic: z.string().max(200).optional(),
    webhook_url: z.string().max(500).optional(),
    notify_severity_min: z
      .enum(["critical", "high", "medium", "low", "info"])
      .optional(),
    notify_on_new_device: z.union([z.boolean(), z.string()]).optional(),
    event_retention_days: z
      .union([z.number(), z.string()])
      .optional()
      .transform((v) =>
        v === undefined ? undefined : String(parseInt(String(v), 10))
      ),
    new_password: z.string().min(0).max(256).optional(),
  })
  .strict();

export async function GET() {
  const auth = requireAuth();
  if (auth) return auth;
  const obj: Record<string, string> = {};
  for (const k of SAFE_KEYS) obj[k] = getSetting(k);
  obj.auth_enabled = getSetting("auth_password_hash", "") ? "true" : "false";
  return NextResponse.json(obj);
}

export async function PUT(req: Request) {
  const auth = requireAuth();
  if (auth) return auth;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const data = parsed.data;

  for (const k of SAFE_KEYS) {
    const v = data[k];
    if (v === undefined) continue;
    setSetting(k, typeof v === "boolean" ? String(v) : String(v));
  }

  if (data.new_password !== undefined) {
    await setPassword(data.new_password);
  }

  refreshSchedule();
  return NextResponse.json({ ok: true });
}
