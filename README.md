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

- **Dashboard** — hosts up, open ports, services breakdown, top vendors, open issues by severity, recent changes.
- **Devices** — searchable table (IP, hostname, MAC, vendor, OS, label, service, port). Per-device detail page with ports, full history, open issues, and editable notes/label.
- **Issues** — problems detected from nmap NSE script output and service heuristics: known CVEs (via `vulners`), expired/expiring TLS certs, self-signed certs, cleartext protocols (telnet, FTP, VNC), unknown new devices. State issues auto-resolve when fixed; one-shot events (new device) stay until dismissed.
- **Scans** — manual "Scan now" + cron-scheduled scans. History with status, duration, and host counts. Live status polling while a scan is running. Default nmap args run `--script default,vulners` for deep service info.
- **Change detection** — every scan diffs against current state and writes events: new hosts, host up/down, ports opening/closing, service version changes.
- **Notes & labels** — annotate devices ("kid's laptop", "IoT — quarantine") so you remember what you're looking at six months from now.

## Running

### Windows (one-click)

1. Download or clone this repo.
2. Double-click **`install.bat`**. It uses winget to install Node.js LTS and
   Nmap (which bundles Npcap), then runs `npm install` and builds the app.
   You'll be asked once whether to load sample data.
3. Double-click **`start.bat`**. It launches the production server on
   <http://localhost:3000> and opens your browser. Leave the window open;
   close it (or Ctrl+C) to stop.

Notes for Windows:

- Requires Windows 10 1709+ or Windows 11 (for `winget`). If winget is
  missing, install **App Installer** from the Microsoft Store.
- Nmap's installer will prompt you to accept the **Npcap** license the
  first time — click through it. Npcap is what lets nmap see raw packets
  on Windows; without it you only get TCP-connect-style scans.
- Some nmap features (SYN scans, MAC vendor detection, OS fingerprinting)
  need Administrator. Right-click `start.bat` → *Run as administrator* if
  you want those.
- If `better-sqlite3` fails to install with a native-build error, install
  Visual Studio's C++ Build Tools (the installer will tell you the exact
  command) and re-run `install.bat`.
- To run on boot as a background service, wrap `npm run start` with
  [NSSM](https://nssm.cc/) — set the working directory to this folder.

### macOS / Linux

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
| `nmap_path` | `nmap` | Override if not on `$PATH` (e.g. `C:\Program Files (x86)\Nmap\nmap.exe` on Windows) |
| `schedule_cron` | `0 */6 * * *` | Standard 5-field cron |
| `schedule_enabled` | `false` | Toggle from settings page |

## Data layout

```
data/
  recon.db        # SQLite (hosts, ports, scans, events, settings)
  scans/          # Raw nmap XML, one file per run
```

Wipe with `rm -rf data/` to start fresh.
