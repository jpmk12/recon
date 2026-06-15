import { spawn } from "node:child_process";
import { parseStringPromise } from "xml2js";
import fs from "node:fs";
import path from "node:path";
import { db, getSetting } from "./db";
import { detectIssuesForHost, reconcileStateIssues } from "./detectors";

export type ParsedScript = { id: string; output: string };

export type ParsedHost = {
  ip: string;
  hostname: string | null;
  mac: string | null;
  vendor: string | null;
  os: string | null;
  status: "up" | "down";
  ports: ParsedPort[];
  scripts: ParsedScript[];
};

export type ParsedPort = {
  port: number;
  protocol: string;
  state: string;
  service: string | null;
  product: string | null;
  version: string | null;
  scripts: ParsedScript[];
};

function readScripts(node: { script?: { $: { id: string; output?: string } }[] }): ParsedScript[] {
  return (node.script ?? []).map((s) => ({
    id: s.$.id,
    output: s.$.output ?? "",
  }));
}

export async function parseNmapXml(xml: string): Promise<ParsedHost[]> {
  const data = await parseStringPromise(xml, { explicitArray: true });
  const hosts = data?.nmaprun?.host ?? [];
  const out: ParsedHost[] = [];
  for (const h of hosts) {
    const status = h.status?.[0]?.$?.state === "up" ? "up" : "down";
    const addresses = h.address ?? [];
    let ip = "";
    let mac: string | null = null;
    let vendor: string | null = null;
    for (const a of addresses) {
      const t = a.$.addrtype;
      if (t === "ipv4" || t === "ipv6") ip = a.$.addr;
      if (t === "mac") {
        mac = a.$.addr;
        vendor = a.$.vendor ?? null;
      }
    }
    if (!ip) continue;
    const hostname = h.hostnames?.[0]?.hostname?.[0]?.$?.name ?? null;
    const os = h.os?.[0]?.osmatch?.[0]?.$?.name ?? null;
    const hostScripts: ParsedScript[] = h.hostscript?.[0]
      ? readScripts(h.hostscript[0])
      : [];
    const ports: ParsedPort[] = [];
    const portList = h.ports?.[0]?.port ?? [];
    for (const p of portList) {
      ports.push({
        port: Number(p.$.portid),
        protocol: p.$.protocol,
        state: p.state?.[0]?.$?.state ?? "unknown",
        service: p.service?.[0]?.$?.name ?? null,
        product: p.service?.[0]?.$?.product ?? null,
        version: p.service?.[0]?.$?.version ?? null,
        scripts: readScripts(p),
      });
    }
    out.push({ ip, hostname, mac, vendor, os, status, ports, scripts: hostScripts });
  }
  return out;
}

export async function runNmap(
  target: string,
  argsLine: string
): Promise<{ xml: string; stderr: string }> {
  const nmapPath = getSetting("nmap_path", "nmap");
  const outDir = path.join(process.cwd(), "data", "scans");
  fs.mkdirSync(outDir, { recursive: true });
  const xmlFile = path.join(outDir, `scan-${Date.now()}.xml`);
  const args = [...argsLine.split(/\s+/).filter(Boolean), "-oX", xmlFile, target];
  return new Promise((resolve, reject) => {
    const proc = spawn(nmapPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0 && !fs.existsSync(xmlFile)) {
        return reject(
          new Error(`nmap exited with code ${code}: ${stderr.trim()}`)
        );
      }
      try {
        const xml = fs.readFileSync(xmlFile, "utf8");
        resolve({ xml, stderr });
      } catch (e) {
        reject(e);
      }
    });
  });
}

export function applyScan(
  scanId: number,
  hosts: ParsedHost[]
): { up: number; total: number } {
  const now = Date.now();
  const upsertHost = db.prepare(`
    INSERT INTO hosts (ip, hostname, mac, vendor, os, first_seen, last_seen, is_up)
    VALUES (@ip, @hostname, @mac, @vendor, @os, @now, @now, @is_up)
    ON CONFLICT(ip) DO UPDATE SET
      hostname = COALESCE(excluded.hostname, hosts.hostname),
      mac      = COALESCE(excluded.mac, hosts.mac),
      vendor   = COALESCE(excluded.vendor, hosts.vendor),
      os       = COALESCE(excluded.os, hosts.os),
      last_seen= excluded.last_seen,
      is_up    = excluded.is_up
  `);
  const getHost = db.prepare("SELECT id, is_up FROM hosts WHERE ip = ?");
  const getPort = db.prepare(
    "SELECT id, state, service, product, version, is_open FROM ports WHERE host_id = ? AND port = ? AND protocol = ?"
  );
  const insertPort = db.prepare(`
    INSERT INTO ports (host_id, port, protocol, state, service, product, version, first_seen, last_seen, is_open)
    VALUES (@host_id, @port, @protocol, @state, @service, @product, @version, @now, @now, @is_open)
  `);
  const updatePort = db.prepare(`
    UPDATE ports SET state=@state, service=@service, product=@product, version=@version,
      last_seen=@now, is_open=@is_open WHERE id=@id
  `);
  const upsertPortScript = db.prepare(`
    INSERT INTO port_scripts (port_id, script_id, output, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(port_id, script_id) DO UPDATE SET output=excluded.output, updated_at=excluded.updated_at
  `);
  const upsertHostScript = db.prepare(`
    INSERT INTO host_scripts (host_id, script_id, output, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(host_id, script_id) DO UPDATE SET output=excluded.output, updated_at=excluded.updated_at
  `);
  const closeMissingPorts = db.prepare(`
    UPDATE ports SET is_open=0, state='closed', last_seen=? WHERE host_id=? AND is_open=1 AND id NOT IN (SELECT value FROM json_each(?))
  `);
  const insertEvent = db.prepare(
    "INSERT INTO events (scan_id, host_id, kind, detail, at) VALUES (?, ?, ?, ?, ?)"
  );
  const insertNewDeviceIssue = db.prepare(`
    INSERT OR IGNORE INTO issues (host_id, port_id, code, severity, title, detail, kind, first_seen, last_seen)
    VALUES (?, 0, 'device.new', 'medium', 'Unknown device detected', ?, 'event', ?, ?)
  `);

  let up = 0;
  const tx = db.transaction((hostList: ParsedHost[]) => {
    for (const h of hostList) {
      const is_up = h.status === "up" ? 1 : 0;
      if (is_up) up++;
      const prev = getHost.get(h.ip) as
        | { id: number; is_up: number }
        | undefined;
      upsertHost.run({
        ip: h.ip,
        hostname: h.hostname,
        mac: h.mac,
        vendor: h.vendor,
        os: h.os,
        now,
        is_up,
      });
      const hostRow = getHost.get(h.ip) as { id: number; is_up: number };
      const host_id = hostRow.id;
      if (!prev) {
        insertEvent.run(scanId, host_id, "host_new", `IP ${h.ip} discovered`, now);
        insertNewDeviceIssue.run(
          host_id,
          `${h.ip}${h.hostname ? " (" + h.hostname + ")" : ""}${h.vendor ? " · " + h.vendor : ""}`,
          now,
          now
        );
      } else if (prev.is_up !== is_up) {
        insertEvent.run(
          scanId,
          host_id,
          is_up ? "host_up" : "host_down",
          `IP ${h.ip} ${is_up ? "came online" : "went offline"}`,
          now
        );
      }

      for (const s of h.scripts) {
        upsertHostScript.run(host_id, s.id, s.output, now);
      }

      const seenPortIds: number[] = [];
      for (const p of h.ports) {
        const is_open = p.state === "open" ? 1 : 0;
        const prevPort = getPort.get(host_id, p.port, p.protocol) as
          | {
              id: number;
              state: string;
              service: string | null;
              product: string | null;
              version: string | null;
              is_open: number;
            }
          | undefined;
        let portId: number;
        if (!prevPort) {
          insertPort.run({
            host_id,
            port: p.port,
            protocol: p.protocol,
            state: p.state,
            service: p.service,
            product: p.product,
            version: p.version,
            now,
            is_open,
          });
          const row = getPort.get(host_id, p.port, p.protocol) as { id: number };
          portId = row.id;
          if (is_open) {
            insertEvent.run(
              scanId,
              host_id,
              "port_open",
              `${p.port}/${p.protocol} ${p.service ?? ""}`.trim(),
              now
            );
          }
        } else {
          updatePort.run({
            id: prevPort.id,
            state: p.state,
            service: p.service ?? prevPort.service,
            product: p.product ?? prevPort.product,
            version: p.version ?? prevPort.version,
            now,
            is_open,
          });
          portId = prevPort.id;
          if (prevPort.is_open !== is_open) {
            insertEvent.run(
              scanId,
              host_id,
              is_open ? "port_open" : "port_closed",
              `${p.port}/${p.protocol} ${p.service ?? ""}`.trim(),
              now
            );
          }
          const versionChanged =
            (p.product ?? "") !== (prevPort.product ?? "") ||
            (p.version ?? "") !== (prevPort.version ?? "");
          if (is_open && prevPort.is_open && versionChanged) {
            insertEvent.run(
              scanId,
              host_id,
              "service_changed",
              `${p.port}/${p.protocol}: ${prevPort.product ?? ""} ${
                prevPort.version ?? ""
              } → ${p.product ?? ""} ${p.version ?? ""}`.trim(),
              now
            );
          }
        }
        seenPortIds.push(portId);
        for (const s of p.scripts) {
          upsertPortScript.run(portId, s.id, s.output, now);
        }
      }
      closeMissingPorts.run(now, host_id, JSON.stringify(seenPortIds));

      const detected = detectIssuesForHost(host_id);
      reconcileStateIssues(host_id, detected, now);
    }
  });
  tx(hosts);
  return { up, total: hosts.length };
}
