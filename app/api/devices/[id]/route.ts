import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteHost, updateHostMeta } from "@/lib/queries";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";

const patchSchema = z.object({
  label: z.string().max(64).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth();
  if (auth) return auth;
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  updateHostMeta(id, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth();
  if (auth) return auth;
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  deleteHost(id);
  return NextResponse.json({ ok: true });
}
