import { NextResponse } from "next/server";
import { listScans } from "@/lib/queries";
import { startScan } from "@/lib/scans";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const auth = requireAuth();
  if (auth) return auth;
  return NextResponse.json(listScans(50));
}

export async function POST() {
  const auth = requireAuth();
  if (auth) return auth;
  // Target and args always come from settings — never from the request
  // body — so a network-reachable client can't redirect the scanner at
  // arbitrary hosts even when auth is disabled.
  const r = await startScan({ source: "manual" });
  if (r.alreadyRunning) {
    return NextResponse.json(
      { id: r.id, error: "a scan is already running" },
      { status: 409 }
    );
  }
  return NextResponse.json({ id: r.id });
}
