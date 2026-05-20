"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HostMetaEditor({
  id,
  label,
  notes,
}: {
  id: number;
  label: string;
  notes: string;
}) {
  const router = useRouter();
  const [l, setL] = useState(label);
  const [n, setN] = useState(notes);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "err">(
    "idle"
  );

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
    </div>
  );
}
