import { NextResponse } from "next/server";
import { listScans } from "@/lib/queries";
import { startScan } from "@/lib/scans";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(listScans(50));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = await startScan({
    target: body.target,
    args: body.args,
    source: "manual",
  });
  return NextResponse.json({ id });
}
