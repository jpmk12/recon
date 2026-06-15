import { NextResponse } from "next/server";
import { listOpenIssues } from "@/lib/issues";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const auth = requireAuth();
  if (auth) return auth;
  return NextResponse.json(listOpenIssues());
}
