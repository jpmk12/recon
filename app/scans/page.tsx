import { listScans } from "@/lib/queries";
import ScanNowButton from "@/components/ScanNowButton";
import ScanList from "@/components/ScanList";

export const dynamic = "force-dynamic";

export default function ScansPage() {
  const scans = listScans(100);
  return (
    <div className="p-8 max-w-7xl">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Scans</h1>
          <p className="text-sm text-muted">
            History of every nmap run, scheduled or manual.
          </p>
        </div>
        <ScanNowButton />
      </header>
      <ScanList scans={scans} />
    </div>
  );
}
