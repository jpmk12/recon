import { NextResponse } from "next/server";
import { updateHostMeta } from "@/lib/queries";
import { z } from "zod";

export const runtime = "nodejs";

const patchSchema = z.object({
  label: z.string().max(64).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  updateHostMeta(Number(params.id), parsed.data);
  return NextResponse.json({ ok: true });
}
