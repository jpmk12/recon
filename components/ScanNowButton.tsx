"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ScanNowButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function trigger() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!r.ok) throw new Error(await r.text());
      const { id } = await r.json();
      poll(id);
    } catch (e) {
      setBusy(false);
      setErr(e instanceof Error ? e.message : "scan failed");
    }
  }

  function poll(id: number) {
    const t = setInterval(async () => {
      const r = await fetch(`/api/scans/${id}`);
      if (!r.ok) return;
      const s = await r.json();
      if (s.status !== "running") {
        clearInterval(t);
        setBusy(false);
        if (s.status === "error") setErr(s.error ?? "scan failed");
        router.refresh();
      }
    }, 1500);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={trigger} disabled={busy} className="btn btn-primary">
        {busy ? "Scanning…" : "Scan now"}
      </button>
      {err && <span className="text-xs text-danger max-w-xs truncate">{err}</span>}
    </div>
  );
}
