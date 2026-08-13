# Deploy files — DuckDNS + Caddy (free HTTPS)

Everything in this folder is optional and only for the **host it at home**
(DuckDNS + Caddy) setup described in the repo's [HOSTING.md](../HOSTING.md).
You do not need any of it to run the site locally.

## What's here

| File | What it does | Platform |
|------|--------------|----------|
| `duckdns-update.sh` | Keeps your DuckDNS hostname pointed at your home IP (run every 5 min via cron). | Linux / Raspberry Pi |
| `duckdns.conf.example` | Your DuckDNS domain + token, read by the update script. Rename to `duckdns.conf`. | Linux / Raspberry Pi |
| `duckdns-update.bat` | Same auto-update, as a Windows scheduled task. Edit the domain/token inside. | Windows |
| `classroom-library.service` | Runs `node server.js` automatically and restarts it on crash/reboot. | Linux (systemd) |
| `start_library.bat` | Starts the server on Windows. Put a shortcut in the Startup folder. | Windows |
| `com.classroom-library.server.plist` | LaunchAgent: auto-starts `node server.js` and keeps it running. | macOS (launchd) |
| `com.classroom-library.duckdns.plist` | LaunchAgent: updates your DuckDNS IP every 5 minutes. | macOS (launchd) |
| `com.classroom-library.caddy.plist` | LaunchAgent: runs Caddy (free HTTPS) automatically. | macOS (launchd) |
| `com.classroom-library.caffeinate.plist` | LaunchAgent: keeps the system awake (`caffeinate -ims`) while letting the screen sleep. | macOS (launchd) |
| `backup.sh` | Daily snapshot of the real data (`library-data.json` + the encryption key) to timestamped files; keeps the last 30 and can copy to a USB drive/network share. | All |
| `com.classroom-library.backup.plist` | LaunchAgent: runs `backup.sh` every day at 03:00. | macOS (launchd) |
| `setup-mac.sh` | One command: checks/installs node + caddy, installs and loads the macOS agents. | macOS |
| `../Caddyfile.example` | The only config Caddy needs — free HTTPS, routes to the app on port 8080. | All |

## The 30-second mental model

```
Students at school
        |
        |  https://myroomlibrary.duckdns.org   (HTTPS, free cert)
        v
     Caddy (port 443)   <-- router forwards external 443 here
        |
        |  reverse_proxy localhost:8080
        v
   node server.js  (0.0.0.0:8080, shared data + sessions)
```

## Quick start — macOS (Apple Silicon or Intel)

If you're hosting on a **MacBook**, this is the whole setup:

```bash
# 1. From inside the repo folder, install Homebrew if you don't have it:
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Create your DuckDNS hostname + token at https://www.duckdns.org, then:
cp deploy/duckdns.conf.example deploy/duckdns.conf   # edit in your domain + token
cp Caddyfile.example Caddyfile                        # put your real hostname in it

# 3. One command — installs node + caddy, configures Caddyfile, and loads the
#    five launchd agents (server, DuckDNS updater, Caddy HTTPS, keep-awake,
#    daily backup):
bash deploy/setup-mac.sh
```

Then **one time on your router**: reserve a static LAN IP for the MacBook and
forward **external 443 → that MacBook → 443** (or → 8443 if you use the `:8443`
alternative in `Caddyfile.example`). Everything auto-starts on login and stays
running.

Logs (if something isn't working):
```bash
tail -f /tmp/classroom-library.log          # node server
cat  /tmp/classroom-library-duckdns.log     # DuckDNS updater
tail -f /tmp/classroom-library-caddy.log    # Caddy
cat  backups/backup.log                     # daily data backup
```

## Backups (important)

All your books, students, loans and holds live in `library-data.json` on the
hosting computer. `setup-mac.sh` loads a **daily backup** agent that snapshots
it (plus the encryption key needed to restore student passwords) at 03:00.

- Snapshots go to `<repo>/backups/` as `library-backup-<date>.json`
  (keeps the last 30 automatically).
- **Copy them somewhere else too** — a USB drive, a network share, an iCloud
  folder, or a second computer. Set it once in the backup agent by exporting
  `LIBRARY_BACKUP_EXTRA_DIR=/Volumes/USB/library-backups` before running
  `setup-mac.sh` (or run `deploy/backup.sh` manually with that env var).
- To test: `bash deploy/backup.sh`, then check `backups/`.
- To restore later, point the server at the snapshot (or use it as
  `library-data.json`) and keep its matching `library-secret-*.key`.

> Note: the in-browser **Download backup (JSON)** button in the Admin console
> only captures what the browser can see (student passwords are hidden there),
> so the server-side `backup.sh` snapshot is the reliable one for full restores.

## Quick start — Linux / Windows

1. **DuckDNS hostname** — create one at https://www.duckdns.org, note the token.
2. **DuckDNS auto-update** — Linux: `cp duckdns.conf.example duckdns.conf`, fill
   it in, `./duckdns-update.sh`, add the cron line. Windows: edit + run the `.bat`,
   then create the scheduled task (instructions inside each file).
3. **Router** — reserve a static LAN IP for the hosting computer, then forward
   **external 443 → that computer → 443** (or → 8443 if you use the alternative
   Caddy block — see `../Caddyfile.example`).
4. **Caddy** — rename `../Caddyfile.example` to `Caddyfile`, put your real
   hostname in it, install Caddy, run `caddy run`.
5. **App** — start the server (`node server.js`, or the systemd/service files
   above). Confirm it prints `Listening on: 0.0.0.0:8080`.
6. **Test** — on your phone's mobile data (not home Wi-Fi) open
   `https://myroomlibrary.duckdns.org`.

Camera barcode scanning works because the site is served over HTTPS.
