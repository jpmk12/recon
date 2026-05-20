# recon

Modern home-network inventory: nmap-driven discovery with a searchable web UI,
scan history, change detection, and per-device notes.

## Stack

- **Next.js 14** (App Router) — single deployable Node app
- **SQLite** via `better-sqlite3` — zero-config persistent storage at `data/recon.db`
- **Tailwind CSS** — dark, dense UI
- **node-cron** — scheduled scans on top of on-demand triggers
- **recharts** — dashboard visualizations

## Features

- **Dashboard** — hosts up, open ports, services breakdown, top vendors, recent changes.
- **Devices** — searchable table (IP, hostname, MAC, vendor, OS, label, service, port). Per-device detail page with ports, full history, and editable notes/label.
- **Scans** — manual "Scan now" + cron-scheduled scans. History with status, duration, and host counts. Live status polling while a scan is running.
- **Change detection** — every scan diffs against current state and writes events: new hosts, host up/down, ports opening/closing, service version changes.
- **Notes & labels** — annotate devices ("kid's laptop", "IoT — quarantine") so you remember what you're looking at six months from now.

## Running

```bash
npm install
npm run seed    # optional: populates sample devices so you can review the UI without nmap
npm run dev
```

Open <http://localhost:3000>.

Nmap must be installed on the host running this app for real scans
(`sudo apt install nmap` / `brew install nmap`). For SYN scans (`-sS`), MAC
detection, and OS fingerprinting, nmap needs root — run the dev server as
root, or use `setcap`, or stick to `-sT -sV --top-ports 1000` (the default,
which is unprivileged-friendly).

## Configuration

Settings live in SQLite and are editable from `/settings`:

| Key | Default | Notes |
|-----|---------|-------|
| `subnets` | `192.168.1.0/24` | Any nmap target spec |
| `nmap_args` | `-sV -T4 --top-ports 1000` | `-oX` is appended automatically |
| `nmap_path` | `nmap` | Override if not on `$PATH` |
| `schedule_cron` | `0 */6 * * *` | Standard 5-field cron |
| `schedule_enabled` | `false` | Toggle from settings page |

## Data layout

```
data/
  recon.db        # SQLite (hosts, ports, scans, events, settings)
  scans/          # Raw nmap XML, one file per run
```

Wipe with `rm -rf data/` to start fresh.
