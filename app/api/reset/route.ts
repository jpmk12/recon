import { NextResponse } from "next/server";
import { resetAllData } from "@/lib/queries";

export const runtime = "nodejs";

export async function POST() {
  resetAllData();
  return NextResponse.json({ ok: true });
}
