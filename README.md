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

- **Dashboard** — hosts up, open ports, services breakdown, top vendors, device categories, open issues by severity, recent changes.
- **Devices** — searchable, filterable table (status, category, has-open-issues). Per-device detail page with ports, full NSE script output, history, open issues, and editable notes/label. CSV export.
- **Device classification** — heuristic auto-tag: router / NAS / printer / camera / smart speaker / IoT / phone / server / computer / TV / gaming.
- **Issues** — problems detected from NSE output and service heuristics: known CVEs (via `vulners`), expired/expiring TLS certs, self-signed certs, weak TLS versions/ciphers, weak SSH algorithms, SMBv1, cleartext protocols (telnet, FTP, VNC), generic NSE "VULNERABLE" matches, unknown new devices. State issues auto-resolve when fixed; events (new device) persist until dismissed. Snooze for 1h / 1d / 7d.
- **Notifications** — ntfy.sh push and JSON webhook for newly-opened issues at or above your configured severity, and for unknown new devices. Test button.
- **Scans** — manual "Scan now" + cron-scheduled scans. Concurrency guard prevents overlapping runs. Multi-subnet targets. Per-scan detail page shows that scan's events. Default nmap args run `--script default,vulners` for deep service info. Optional mDNS/Bonjour discovery pass after each scan.
- **Change detection** — every scan diffs against current state and writes events: new hosts, host up/down, ports opening/closing, service version changes.
- **Notes & labels** — annotate devices ("kid's laptop", "IoT — quarantine") so you remember what you're looking at six months from now.
- **Authentication** — optional password protection (bcrypt, server-side session token). Off by default; turn on in Settings.
- **Retention** — events, resolved issues, and finished scans older than N days are purged nightly.

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
| `subnets` | `192.168.1.0/24` | Space, comma, or newline separated — multiple targets supported |
| `nmap_args` | `-sV -T4 --top-ports 1000 --script default,vulners` | `-oX` is appended automatically |
| `nmap_path` | `nmap` | Override if not on `$PATH` (e.g. `C:\Program Files (x86)\Nmap\nmap.exe` on Windows) |
| `schedule_cron` | `0 */6 * * *` | Standard 5-field cron |
| `schedule_enabled` | `false` | Toggle from settings page |
| `mdns_enabled` | `true` | Run a brief Bonjour pass after nmap to pick up Chromecasts, AirPlay, printers |
| `ntfy_url` / `ntfy_topic` | empty | ntfy.sh push target; e.g. `https://ntfy.sh` + a random topic |
| `webhook_url` | empty | JSON POST endpoint for notifications |
| `notify_severity_min` | `high` | Severity threshold for issue notifications |
| `notify_on_new_device` | `true` | Notify when an unknown MAC appears |
| `event_retention_days` | `90` | Older events, resolved issues, and scans are purged nightly |

## Security notes

This app is intended for **trusted home LAN use**. By default it has no
authentication — anyone who can reach the port can see the entire inventory,
issues, and credentials-relevant detail. Set a password in **Settings →
Authentication** for any deployment beyond a fully-trusted network.

Webhook and ntfy URLs are user-configurable and the server fetches them
unauthenticated — when auth is off, anyone on your LAN who reaches the app
can point those at internal endpoints. Set the password.

## Data layout

```
data/
  recon.db        # SQLite (hosts, ports, scans, events, issues, settings)
  scans/          # Raw nmap XML, one file per run
```

Wipe with `rm -rf data/` to start fresh, or use Settings → Danger zone.
