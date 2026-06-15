import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import "@/lib/scheduler";
import { ensureAuth, isAuthEnabled } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Recon — Network Inventory",
  description: "Track devices and services on your home network",
};

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/devices", label: "Devices" },
  { href: "/issues", label: "Issues" },
  { href: "/scans", label: "Scans" },
  { href: "/settings", label: "Settings" },
];

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = headers().get("x-pathname") ?? "/";
  const isLogin = pathname === "/login";
  if (!isLogin) {
    await ensureAuth();
  }
  const authOn = isAuthEnabled();

  return (
    <html lang="en">
      <body>
        {isLogin ? (
          <div className="min-h-screen flex items-center justify-center">
            {children}
          </div>
        ) : (
          <div className="min-h-screen flex">
            <aside className="w-56 border-r border-border bg-panel flex flex-col">
              <div className="px-5 py-6 border-b border-border">
                <Link href="/" className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-accent2 shadow-[0_0_12px_#34d399]" />
                  <span className="font-semibold tracking-wide">recon</span>
                </Link>
                <p className="text-xs text-muted mt-1">network inventory</p>
              </div>
              <nav className="flex-1 px-2 py-4 space-y-1">
                {nav.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="block px-3 py-2 rounded-md text-sm text-muted hover:bg-bg hover:text-white"
                  >
                    {n.label}
                  </Link>
                ))}
              </nav>
              <div className="p-3 text-[11px] text-muted border-t border-border space-y-1">
                <div>
                  <span className="kbd">/</span> focuses search
                </div>
                {authOn && <div className="text-accent2">auth enabled</div>}
              </div>
            </aside>
            <main className="flex-1 min-w-0">{children}</main>
          </div>
        )}
      </body>
    </html>
  );
}
