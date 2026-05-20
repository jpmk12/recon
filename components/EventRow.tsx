import Link from "next/link";
import type { Event } from "@/lib/db";

const kindLabel: Record<string, { text: string; color: string }> = {
  host_new: { text: "New host", color: "text-accent2" },
  host_up: { text: "Host up", color: "text-accent2" },
  host_down: { text: "Host down", color: "text-muted" },
  port_open: { text: "Port opened", color: "text-accent" },
  port_closed: { text: "Port closed", color: "text-muted" },
  service_changed: { text: "Service changed", color: "text-warn" },
};

function fmt(ts: number) {
  return new Date(ts).toLocaleString();
}

export default function EventRow({ event }: { event: Event }) {
  const k = kindLabel[event.kind] ?? { text: event.kind, color: "text-muted" };
  return (
    <li className="py-2 flex items-center gap-3 text-sm">
      <span className={`w-32 text-xs uppercase tracking-wider ${k.color}`}>
        {k.text}
      </span>
      <span className="flex-1 truncate">{event.detail}</span>
      <span className="text-xs text-muted whitespace-nowrap">
        {fmt(event.at)}
      </span>
      {event.host_id && (
        <Link
          href={`/devices/${event.host_id}`}
          className="text-xs text-accent hover:underline"
        >
          view
        </Link>
      )}
    </li>
  );
}
