import { Category } from "@/lib/db";
import { CATEGORY_LABELS } from "@/lib/classify";

const styles: Record<Category, string> = {
  router: "bg-accent/10 text-accent border-accent/40",
  nas: "bg-accent2/10 text-accent2 border-accent2/40",
  printer: "bg-warn/10 text-warn border-warn/40",
  camera: "bg-danger/10 text-danger border-danger/40",
  voice: "bg-accent/10 text-accent border-accent/40",
  iot: "bg-warn/10 text-warn border-warn/40",
  phone: "bg-accent2/10 text-accent2 border-accent2/40",
  server: "bg-accent/10 text-accent border-accent/40",
  laptop: "bg-bg text-muted border-border",
  tv: "bg-accent/10 text-accent border-accent/40",
  gaming: "bg-accent/10 text-accent border-accent/40",
  unknown: "bg-bg text-muted border-border",
};

export default function CategoryBadge({
  category,
}: {
  category: Category | null;
}) {
  const c = category ?? "unknown";
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${styles[c]}`}
    >
      {CATEGORY_LABELS[c]}
    </span>
  );
}
