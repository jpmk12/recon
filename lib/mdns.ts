/**
 * mDNS / Bonjour discovery. Runs as a brief second pass after each nmap
 * scan to pick up hostnames and service names that nmap's TCP probes miss
 * (Chromecasts, smart speakers, AirPlay devices, printers, etc.).
 */
import { db } from "./db";

export type MdnsRecord = {
  ip: string;
  hostnames: string[];
  services: { name: string; type: string; port: number }[];
};

type BrowsedService = {
  name?: string;
  type?: string;
  port?: number;
  host?: string;
  addresses?: string[];
};

export async function discoverMdns(timeoutMs = 5000): Promise<MdnsRecord[]> {
  let bonjour: { destroy: () => void; find: (opts: object, cb: (s: BrowsedService) => void) => { stop: () => void } } | null = null;
  try {
    const mod = await import("bonjour-service");
    const Ctor = (mod as { Bonjour?: unknown; default?: unknown }).Bonjour
      ?? (mod as { default?: unknown }).default;
    if (typeof Ctor !== "function") throw new Error("bonjour-service has no Bonjour constructor");
    bonjour = new (Ctor as new () => NonNullable<typeof bonjour>)();
  } catch (e) {
    console.warn(
      `[mdns] discovery skipped: ${e instanceof Error ? e.message : String(e)}`
    );
    return [];
  }

  return new Promise<MdnsRecord[]>((resolve) => {
    const byIp = new Map<string, MdnsRecord>();
    const browser = bonjour!.find({}, (service) => {
      const addrs = service.addresses ?? [];
      for (const ip of addrs) {
        if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip) && !ip.includes(":")) continue;
        const cur = byIp.get(ip) ?? { ip, hostnames: [], services: [] };
        if (service.host) {
          const h = service.host.replace(/\.local\.?$/i, "");
          if (h && !cur.hostnames.includes(h)) cur.hostnames.push(h);
        }
        if (service.name && service.type && typeof service.port === "number") {
          cur.services.push({ name: service.name, type: service.type, port: service.port });
        }
        byIp.set(ip, cur);
      }
    });

    const finish = () => {
      try {
        browser.stop();
      } catch {
        // best effort
      }
      try {
        bonjour!.destroy();
      } catch {
        // best effort
      }
      resolve(Array.from(byIp.values()));
    };

    setTimeout(finish, Math.max(500, Math.min(timeoutMs, 30_000)));
  });
}

/**
 * Merge mDNS findings into the hosts table: fill in missing hostnames
 * and bump last_seen / is_up for IPs we already know about.
 */
export function applyMdns(records: MdnsRecord[]): number {
  if (records.length === 0) return 0;
  const now = Date.now();
  const lookup = db.prepare("SELECT id, hostname FROM hosts WHERE ip = ?");
  const updateHostname = db.prepare(
    "UPDATE hosts SET hostname = ?, last_seen = ?, is_up = 1 WHERE id = ?"
  );
  const touch = db.prepare(
    "UPDATE hosts SET last_seen = ?, is_up = 1 WHERE id = ?"
  );

  let merged = 0;
  const tx = db.transaction((recs: MdnsRecord[]) => {
    for (const r of recs) {
      const row = lookup.get(r.ip) as
        | { id: number; hostname: string | null }
        | undefined;
      if (!row) continue;
      const newName = r.hostnames[0];
      if (newName && !row.hostname) {
        updateHostname.run(newName, now, row.id);
      } else {
        touch.run(now, row.id);
      }
      merged++;
    }
  });
  tx(records);
  return merged;
}
