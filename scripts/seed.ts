import { db } from "../lib/db";
import { applyScan } from "../lib/nmap";

const now = Date.now();
const info = db
  .prepare(
    "INSERT INTO scans (target, args, started_at, finished_at, status, hosts_up, hosts_total, source) VALUES (?, ?, ?, ?, 'ok', 0, 0, 'manual')"
  )
  .run("192.168.1.0/24", "-sV -T4 --top-ports 1000", now - 3600_000, now - 3540_000);
const scanId = Number(info.lastInsertRowid);

const fake = [
  {
    ip: "192.168.1.1",
    hostname: "gateway.lan",
    mac: "AA:BB:CC:00:00:01",
    vendor: "Ubiquiti",
    os: "Linux 5.x",
    status: "up" as const,
    ports: [
      { port: 22, protocol: "tcp", state: "open", service: "ssh", product: "OpenSSH", version: "9.6" },
      { port: 53, protocol: "udp", state: "open", service: "domain", product: "dnsmasq", version: "2.90" },
      { port: 443, protocol: "tcp", state: "open", service: "https", product: "nginx", version: "1.25" },
    ],
  },
  {
    ip: "192.168.1.20",
    hostname: "nas.lan",
    mac: "AA:BB:CC:00:00:02",
    vendor: "Synology",
    os: "Linux",
    status: "up" as const,
    ports: [
      { port: 80, protocol: "tcp", state: "open", service: "http", product: "nginx", version: "1.22" },
      { port: 445, protocol: "tcp", state: "open", service: "microsoft-ds", product: "Samba", version: "4.19" },
      { port: 5000, protocol: "tcp", state: "open", service: "http", product: "DSM", version: "7.2" },
    ],
  },
  {
    ip: "192.168.1.42",
    hostname: "homelab.lan",
    mac: "AA:BB:CC:00:00:03",
    vendor: "Intel",
    os: "Ubuntu 24.04",
    status: "up" as const,
    ports: [
      { port: 22, protocol: "tcp", state: "open", service: "ssh", product: "OpenSSH", version: "9.6" },
      { port: 3000, protocol: "tcp", state: "open", service: "http", product: "Grafana", version: "10.4" },
      { port: 8080, protocol: "tcp", state: "open", service: "http", product: "Traefik", version: "3.0" },
      { port: 9090, protocol: "tcp", state: "open", service: "http", product: "Prometheus", version: "2.51" },
    ],
  },
  {
    ip: "192.168.1.55",
    hostname: "echo-kitchen",
    mac: "AA:BB:CC:00:00:04",
    vendor: "Amazon",
    os: null,
    status: "up" as const,
    ports: [
      { port: 4070, protocol: "tcp", state: "open", service: "tripe", product: null, version: null },
    ],
  },
  {
    ip: "192.168.1.77",
    hostname: "printer",
    mac: "AA:BB:CC:00:00:05",
    vendor: "HP",
    os: "HP LaserJet OS",
    status: "up" as const,
    ports: [
      { port: 80, protocol: "tcp", state: "open", service: "http", product: "HP-ChaiSOE", version: "1.0" },
      { port: 631, protocol: "tcp", state: "open", service: "ipp", product: "CUPS", version: "2.x" },
      { port: 9100, protocol: "tcp", state: "open", service: "jetdirect", product: null, version: null },
    ],
  },
  {
    ip: "192.168.1.101",
    hostname: "laptop-work",
    mac: "AA:BB:CC:00:00:06",
    vendor: "Apple",
    os: "macOS 14",
    status: "up" as const,
    ports: [
      { port: 22, protocol: "tcp", state: "open", service: "ssh", product: "OpenSSH", version: "9.6" },
    ],
  },
  {
    ip: "192.168.1.150",
    hostname: null,
    mac: "AA:BB:CC:00:00:07",
    vendor: "TP-Link",
    os: null,
    status: "down" as const,
    ports: [],
  },
];

applyScan(scanId, fake);
db.prepare(
  "UPDATE scans SET hosts_up=?, hosts_total=? WHERE id=?"
).run(fake.filter((h) => h.status === "up").length, fake.length, scanId);

// A second scan that "changes" something so we get diff events
const scan2 = db
  .prepare(
    "INSERT INTO scans (target, args, started_at, finished_at, status, source) VALUES (?, ?, ?, ?, 'ok', 'scheduled')"
  )
  .run("192.168.1.0/24", "-sV -T4 --top-ports 1000", now - 600_000, now - 540_000);
const scan2Id = Number(scan2.lastInsertRowid);
const updated = JSON.parse(JSON.stringify(fake)) as typeof fake;
updated[2].ports.push({
  port: 8443,
  protocol: "tcp",
  state: "open",
  service: "https",
  product: "Caddy",
  version: "2.8",
});
updated[6].status = "up";
updated[6].hostname = "smart-plug-garage";
applyScan(scan2Id, updated);
db.prepare(
  "UPDATE scans SET hosts_up=?, hosts_total=? WHERE id=?"
).run(updated.filter((h) => h.status === "up").length, updated.length, scan2Id);

console.log("Seeded recon.db with sample data.");
