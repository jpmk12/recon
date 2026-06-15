import { NextResponse } from "next/server";
import { clearSessionToken, requireAuth, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const auth = requireAuth();
  if (auth) return auth;
  clearSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
