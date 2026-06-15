import { db } from "../lib/db";
import { applyScan, ParsedHost } from "../lib/nmap";

const now = Date.now();
const info = db
  .prepare(
    "INSERT INTO scans (target, args, started_at, finished_at, status, hosts_up, hosts_total, source) VALUES (?, ?, ?, ?, 'ok', 0, 0, 'manual')"
  )
  .run(
    "192.168.1.0/24",
    "-sV -T4 --top-ports 1000 --script default,vulners",
    now - 3600_000,
    now - 3540_000
  );
const scanId = Number(info.lastInsertRowid);

const fake: ParsedHost[] = [
  {
    ip: "192.168.1.1",
    hostname: "gateway.lan",
    mac: "AA:BB:CC:00:00:01",
    vendor: "Ubiquiti",
    os: "Linux 5.x",
    status: "up",
    scripts: [],
    ports: [
      { port: 22, protocol: "tcp", state: "open", service: "ssh", product: "OpenSSH", version: "9.6", scripts: [] },
      { port: 53, protocol: "udp", state: "open", service: "domain", product: "dnsmasq", version: "2.90", scripts: [] },
      {
        port: 443,
        protocol: "tcp",
        state: "open",
        service: "https",
        product: "nginx",
        version: "1.25",
        scripts: [
          {
            id: "ssl-cert",
            output:
              "Subject: CN=gateway.lan\nIssuer: CN=gateway.lan\nNot valid before: 2024-01-01T00:00:00\nNot valid after: 2027-01-01T00:00:00",
          },
          { id: "http-title", output: "UniFi Network" },
        ],
      },
    ],
  },
  {
    ip: "192.168.1.20",
    hostname: "nas.lan",
    mac: "AA:BB:CC:00:00:02",
    vendor: "Synology",
    os: "Linux",
    status: "up",
    scripts: [],
    ports: [
      { port: 80, protocol: "tcp", state: "open", service: "http", product: "nginx", version: "1.22", scripts: [] },
      { port: 445, protocol: "tcp", state: "open", service: "microsoft-ds", product: "Samba", version: "4.19", scripts: [] },
      {
        port: 5001,
        protocol: "tcp",
        state: "open",
        service: "https",
        product: "DSM",
        version: "7.2",
        scripts: [
          {
            id: "ssl-cert",
            output:
              "Subject: CN=nas.lan\nIssuer: CN=Let's Encrypt R3\nNot valid before: 2024-09-01T00:00:00\nNot valid after: 2024-12-01T00:00:00",
          },
          { id: "http-title", output: "Synology DSM" },
        ],
      },
    ],
  },
  {
    ip: "192.168.1.42",
    hostname: "homelab.lan",
    mac: "AA:BB:CC:00:00:03",
    vendor: "Intel",
    os: "Ubuntu 24.04",
    status: "up",
    scripts: [],
    ports: [
      {
        port: 22,
        protocol: "tcp",
        state: "open",
        service: "ssh",
        product: "OpenSSH",
        version: "7.4",
        scripts: [
          {
            id: "vulners",
            output:
              "cpe:/a:openbsd:openssh:7.4:\n  CVE-2020-15778  7.8  https://vulners.com/cve/CVE-2020-15778\n  CVE-2018-15473  5.3  https://vulners.com/cve/CVE-2018-15473\n  CVE-2017-15906  5.3  https://vulners.com/cve/CVE-2017-15906",
          },
        ],
      },
      { port: 23, protocol: "tcp", state: "open", service: "telnet", product: null, version: null, scripts: [] },
      { port: 3000, protocol: "tcp", state: "open", service: "http", product: "Grafana", version: "10.4", scripts: [] },
      { port: 8080, protocol: "tcp", state: "open", service: "http", product: "Traefik", version: "3.0", scripts: [] },
      { port: 9090, protocol: "tcp", state: "open", service: "http", product: "Prometheus", version: "2.51", scripts: [] },
    ],
  },
  {
    ip: "192.168.1.55",
    hostname: "echo-kitchen",
    mac: "AA:BB:CC:00:00:04",
    vendor: "Amazon",
    os: null,
    status: "up",
    scripts: [],
    ports: [
      { port: 4070, protocol: "tcp", state: "open", service: "tripe", product: null, version: null, scripts: [] },
    ],
  },
  {
    ip: "192.168.1.77",
    hostname: "printer",
    mac: "AA:BB:CC:00:00:05",
    vendor: "HP",
    os: "HP LaserJet OS",
    status: "up",
    scripts: [],
    ports: [
      { port: 80, protocol: "tcp", state: "open", service: "http", product: "HP-ChaiSOE", version: "1.0", scripts: [] },
      { port: 631, protocol: "tcp", state: "open", service: "ipp", product: "CUPS", version: "2.x", scripts: [] },
      { port: 9100, protocol: "tcp", state: "open", service: "jetdirect", product: null, version: null, scripts: [] },
    ],
  },
  {
    ip: "192.168.1.101",
    hostname: "laptop-work",
    mac: "AA:BB:CC:00:00:06",
    vendor: "Apple",
    os: "macOS 14",
    status: "up",
    scripts: [],
    ports: [
      { port: 22, protocol: "tcp", state: "open", service: "ssh", product: "OpenSSH", version: "9.6", scripts: [] },
    ],
  },
  {
    ip: "192.168.1.150",
    hostname: null,
    mac: "AA:BB:CC:00:00:07",
    vendor: "TP-Link",
    os: null,
    status: "down",
    scripts: [],
    ports: [],
  },
];

applyScan(scanId, fake);
db.prepare("UPDATE scans SET hosts_up=?, hosts_total=? WHERE id=?").run(
  fake.filter((h) => h.status === "up").length,
  fake.length,
  scanId
);

// Second scan demonstrates change detection: smart plug comes online,
// homelab grows a new HTTPS service.
const scan2 = db
  .prepare(
    "INSERT INTO scans (target, args, started_at, finished_at, status, source) VALUES (?, ?, ?, ?, 'ok', 'scheduled')"
  )
  .run(
    "192.168.1.0/24",
    "-sV -T4 --top-ports 1000 --script default,vulners",
    now - 600_000,
    now - 540_000
  );
const scan2Id = Number(scan2.lastInsertRowid);
const updated: ParsedHost[] = JSON.parse(JSON.stringify(fake));
updated[2].ports.push({
  port: 8443,
  protocol: "tcp",
  state: "open",
  service: "https",
  product: "Caddy",
  version: "2.8",
  scripts: [],
});
updated[6].status = "up";
updated[6].hostname = "smart-plug-garage";
applyScan(scan2Id, updated);
db.prepare("UPDATE scans SET hosts_up=?, hosts_total=? WHERE id=?").run(
  updated.filter((h) => h.status === "up").length,
  updated.length,
  scan2Id
);

console.log("Seeded recon.db with sample data and demo issues.");
