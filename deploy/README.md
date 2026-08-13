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

## Quick start

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
