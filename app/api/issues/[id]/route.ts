import { NextResponse } from "next/server";
import { dismissIssue } from "@/lib/issues";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth();
  if (auth) return auth;
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  dismissIssue(id);
  return NextResponse.json({ ok: true });
}
