import { NextResponse } from "next/server";
import { getScan } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const s = getScan(Number(params.id));
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(s);
}
