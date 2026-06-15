import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSetting, setSetting } from "./db";

export const SESSION_COOKIE = "recon_session";

export function isAuthEnabled(): boolean {
  return getSetting("auth_password_hash", "") !== "";
}

export async function setPassword(plain: string) {
  if (!plain) {
    setSetting("auth_password_hash", "");
    setSetting("auth_session_token", "");
    return;
  }
  const hash = await bcrypt.hash(plain, 10);
  setSetting("auth_password_hash", hash);
  setSetting("auth_session_token", "");
}

export async function verifyPassword(plain: string): Promise<boolean> {
  const hash = getSetting("auth_password_hash", "");
  if (!hash) return true;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export function rotateSessionToken(): string {
  const token = crypto.randomBytes(32).toString("hex");
  setSetting("auth_session_token", token);
  return token;
}

export function clearSessionToken() {
  setSetting("auth_session_token", "");
}

function timingSafeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function isValidSessionToken(cookieValue: string | undefined): boolean {
  if (!isAuthEnabled()) return true;
  if (!cookieValue) return false;
  const expected = getSetting("auth_session_token", "");
  if (!expected) return false;
  return timingSafeEqualString(cookieValue, expected);
}

export function currentSessionToken(): string | undefined {
  return cookies().get(SESSION_COOKIE)?.value;
}

export async function ensureAuth() {
  if (!isAuthEnabled()) return;
  if (!isValidSessionToken(currentSessionToken())) redirect("/login");
}

export function requireAuth(): Response | null {
  if (!isAuthEnabled()) return null;
  if (isValidSessionToken(currentSessionToken())) return null;
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
