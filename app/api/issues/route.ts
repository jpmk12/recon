import { NextResponse } from "next/server";
import { listOpenIssues } from "@/lib/issues";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(listOpenIssues());
}
