import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  isAuthEnabled,
  isValidSessionToken,
} from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  if (!isAuthEnabled()) redirect("/");
  if (isValidSessionToken(cookies().get(SESSION_COOKIE)?.value)) redirect("/");
  return (
    <div className="card p-8 w-full max-w-sm">
      <div className="flex items-center gap-2 mb-6">
        <span className="inline-block w-2 h-2 rounded-full bg-accent2 shadow-[0_0_12px_#34d399]" />
        <span className="font-semibold tracking-wide">recon</span>
      </div>
      <h1 className="text-lg font-semibold mb-1">Sign in</h1>
      <p className="text-xs text-muted mb-5">
        This recon instance has a password set.
      </p>
      <LoginForm />
    </div>
  );
}
