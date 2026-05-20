export default function PortBadge({ open }: { open: boolean }) {
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
        open
          ? "bg-accent2/10 text-accent2 border border-accent2/40"
          : "bg-bg text-muted border border-border"
      }`}
    >
      {open ? "open" : "closed"}
    </span>
  );
}
