type AccentKey = "accent" | "accent2" | "warn" | "danger" | "muted";

const accentClass: Record<AccentKey, string> = {
  accent: "text-accent",
  accent2: "text-accent2",
  warn: "text-warn",
  danger: "text-danger",
  muted: "text-muted",
};

export default function StatCard({
  label,
  value,
  sub,
  accent = "accent",
  children,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: AccentKey;
  children?: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className={`text-3xl font-semibold mt-1 ${accentClass[accent]}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
      {children}
    </div>
  );
}
