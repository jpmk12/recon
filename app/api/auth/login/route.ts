import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthEnabled, rotateSessionToken, SESSION_COOKIE, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

const schema = z.object({ password: z.string().min(1).max(256) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  if (!isAuthEnabled()) {
    return NextResponse.json({ ok: true, message: "auth not enabled" });
  }
  const ok = await verifyPassword(parsed.data.password);
  if (!ok) {
    return NextResponse.json({ error: "invalid password" }, { status: 401 });
  }
  const token = rotateSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    secure: false,
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
