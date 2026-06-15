import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sendNotification } from "@/lib/notify";

export const runtime = "nodejs";

export async function POST() {
  const auth = requireAuth();
  if (auth) return auth;
  const r = await sendNotification({
    severity: "info",
    title: "recon test notification",
    body: "If you can read this, notifications are configured correctly.",
    tags: ["test"],
  });
  return NextResponse.json(r);
}
