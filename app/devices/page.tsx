import { searchHosts } from "@/lib/queries";
import DeviceTable from "@/components/DeviceTable";
import SearchBox from "@/components/SearchBox";

export const dynamic = "force-dynamic";

export default function DevicesPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = searchParams.q ?? "";
  const hosts = searchHosts(q);
  return (
    <div className="p-8 max-w-7xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Devices</h1>
        <p className="text-sm text-muted">
          Search by IP, hostname, MAC, vendor, OS, label, port number, or service.
        </p>
      </header>
      <div className="mb-4">
        <SearchBox defaultValue={q} />
      </div>
      <DeviceTable hosts={hosts} />
    </div>
  );
}
