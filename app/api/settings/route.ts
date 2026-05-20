import { NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db";
import { refreshSchedule } from "@/lib/scheduler";
import { z } from "zod";

export const runtime = "nodejs";

const KEYS = [
  "subnets",
  "nmap_args",
  "nmap_path",
  "schedule_cron",
  "schedule_enabled",
] as const;

export async function GET() {
  return NextResponse.json(
    Object.fromEntries(KEYS.map((k) => [k, getSetting(k)]))
  );
}

const schema = z.object({
  subnets: z.string().min(1).optional(),
  nmap_args: z.string().optional(),
  nmap_path: z.string().min(1).optional(),
  schedule_cron: z.string().min(1).optional(),
  schedule_enabled: z.union([z.boolean(), z.string()]).optional(),
});

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === undefined) continue;
    setSetting(k, typeof v === "boolean" ? String(v) : String(v));
  }
  refreshSchedule();
  return NextResponse.json({ ok: true });
}
