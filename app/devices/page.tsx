import { ensureAuth } from "@/lib/auth";
import { searchHosts } from "@/lib/queries";
import { Category } from "@/lib/db";
import DeviceTable from "@/components/DeviceTable";
import SearchBox from "@/components/SearchBox";
import DeviceFilters from "@/components/DeviceFilters";

export const dynamic = "force-dynamic";

const CATEGORY_VALUES = [
  "router","nas","printer","camera","voice","iot","phone","server","laptop","tv","gaming","unknown",
] as const;

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; category?: string; issues?: string };
}) {
  await ensureAuth();
  const q = searchParams.q ?? "";
  const status =
    searchParams.status === "up" || searchParams.status === "down"
      ? (searchParams.status as "up" | "down")
      : undefined;
  const category =
    searchParams.category && (CATEGORY_VALUES as readonly string[]).includes(searchParams.category)
      ? (searchParams.category as Category)
      : undefined;
  const hasIssues = searchParams.issues === "1";
  const hosts = searchHosts({ q, status, category, hasIssues });
  return (
    <div className="p-8 max-w-7xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Devices</h1>
        <p className="text-sm text-muted">
          Search by IP, hostname, MAC, vendor, OS, label, category, port, or service.
        </p>
      </header>
      <div className="mb-4">
        <SearchBox defaultValue={q} />
      </div>
      <DeviceFilters />
      <DeviceTable hosts={hosts} />
    </div>
  );
}
