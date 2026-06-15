import type { Severity } from "@/lib/db";

const styles: Record<Severity, string> = {
  critical: "bg-danger/20 text-danger border-danger/50",
  high: "bg-danger/10 text-danger border-danger/40",
  medium: "bg-warn/10 text-warn border-warn/40",
  low: "bg-accent/10 text-accent border-accent/40",
  info: "bg-bg text-muted border-border",
};

export default function SeverityBadge({
  severity,
  count,
}: {
  severity: Severity;
  count?: number;
}) {
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${styles[severity]}`}
    >
      {severity}
      {count !== undefined && ` · ${count}`}
    </span>
  );
}
