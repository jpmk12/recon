"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HostMetaEditor({
  id,
  ip,
  label,
  notes,
}: {
  id: number;
  ip: string;
  label: string;
  notes: string;
}) {
  const router = useRouter();
  const [l, setL] = useState(label);
  const [n, setN] = useState(notes);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "err">(
    "idle"
  );
  const [deleting, setDeleting] = useState(false);

  async function save() {
    setState("saving");
    const r = await fetch(`/api/devices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: l || null, notes: n || null }),
    });
    if (r.ok) {
      setState("saved");
      router.refresh();
      setTimeout(() => setState("idle"), 1200);
    } else {
      setState("err");
    }
  }

  async function remove() {
    const ok = window.confirm(
      `Delete ${ip}? This removes the host plus all of its ports, scripts, history, and issues. It will reappear next scan if still online.`
    );
    if (!ok) return;
    setDeleting(true);
    const r = await fetch(`/api/devices/${id}`, { method: "DELETE" });
    if (r.ok) {
      router.push("/devices");
      router.refresh();
    } else {
      setDeleting(false);
      alert("Delete failed");
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs uppercase tracking-wider text-muted">
          Label
        </label>
        <input
          className="input mt-1"
          value={l}
          maxLength={64}
          onChange={(e) => setL(e.target.value)}
          placeholder='e.g. "Kid laptop", "IoT"'
        />
      </div>
      <div>
        <label className="text-xs uppercase tracking-wider text-muted">
          Notes
        </label>
        <textarea
          className="input mt-1 min-h-[120px] font-mono text-xs"
          value={n}
          maxLength={2000}
          onChange={(e) => setN(e.target.value)}
          placeholder="MAC reservation, VLAN, owner, anything…"
        />
      </div>
      <button onClick={save} className="btn btn-primary w-full">
        {state === "saving"
          ? "Saving…"
          : state === "saved"
          ? "Saved ✓"
          : state === "err"
          ? "Failed"
          : "Save"}
      </button>

      <div className="pt-3 mt-3 border-t border-border">
        <div className="text-xs uppercase tracking-wider text-muted mb-2">
          Danger zone
        </div>
        <button
          onClick={remove}
          disabled={deleting}
          className="btn w-full border-danger/40 text-danger hover:border-danger hover:text-danger"
        >
          {deleting ? "Deleting…" : "Delete this device"}
        </button>
        <p className="text-xs text-muted mt-2">
          Removes the host record. If the device is still online it will be
          re-discovered on the next scan.
        </p>
      </div>
    </div>
  );
}
