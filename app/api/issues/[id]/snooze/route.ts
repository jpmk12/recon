import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { snoozeIssue } from "@/lib/issues";

export const runtime = "nodejs";

const DURATIONS: Record<string, number> = {
  "1h": 3600 * 1000,
  "24h": 86_400 * 1000,
  "7d": 7 * 86_400 * 1000,
  "30d": 30 * 86_400 * 1000,
};

const schema = z.object({
  duration: z.enum(["1h", "24h", "7d", "30d"]),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth();
  if (auth) return auth;
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid duration" }, { status: 400 });
  }
  snoozeIssue(id, DURATIONS[parsed.data.duration]);
  return NextResponse.json({ ok: true });
}
