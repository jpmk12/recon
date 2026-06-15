import { NextResponse } from "next/server";
import { dismissIssue } from "@/lib/issues";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  dismissIssue(Number(params.id));
  return NextResponse.json({ ok: true });
}
