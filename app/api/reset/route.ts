import { NextResponse } from "next/server";
import { resetAllData } from "@/lib/queries";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const auth = requireAuth();
  if (auth) return auth;
  resetAllData();
  return NextResponse.json({ ok: true });
}
