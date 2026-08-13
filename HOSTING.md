# Hosting your Classroom Library at home (usable at school)

This guide shows you how to serve the Classroom Library from a computer in your
home and reach it from school through a **dynamic DNS** (DDNS) address.

> **Read this first — why HTTPS matters.**
> The camera barcode scanner uses your browser's **Barcode Detection API**, and
> browsers **only allow camera access on secure (HTTPS) connections** (or
> `http://localhost`). If students open the site at school over plain `http`,
> the "Type the barcode" box will still work, but **camera scanning will not**.
> So to get full scanning from school, use an **HTTPS** setup — both methods
> below provide that automatically and free.

---

## Option A — Cloudflare Tunnel (easiest, recommended)

**No port forwarding. No router changes. Free automatic HTTPS.** Cloudflare
connects from your home computer *outward* to their edge, so you don't open any
ports on your router — this is the most beginner-friendly and reliable option,
and it works even if your school filters many sites (Cloudflare domains are
usually allowed).

### 1. Start the server
```bash
# from the classroomlib folder
node server.js
```
Confirm it prints `Listening on: 0.0.0.0:8080`.

### 2. Install & set up cloudflared (free)
- **Windows:** download `cloudflared-windows-amd64.exe` from
 https://github.com/cloudflare/cloudflared/releases and save it to a folder.
- **macOS:** `brew install cloudflared`
- **Linux / Raspberry Pi:** `sudo apt install cloudflared` (or download the
 `.deb`/binary from the releases page).

### 3. Create your free domain
1. Create a free Cloudflare account at https://dash.cloudflare.com/sign-up
2. Go to **Zero Trust → Networks → Tunnels → Create a tunnel**.
3. Choose **Cloudflared**, name it (e.g. `library`), and follow the on-screen
 "Install and run a connector" instructions.
4. Under **Public Hostname**, add a hostname such as:
 - Subdomain: `library`, Domain: the one Cloudflare gives you (e.g.
 `yourname-xxxxx.trycloudflare.com` — actually, with a free account you use
 a custom hostname under a domain you own, or a Cloudflare-provided name).
5. **Service:** set `Type = HTTP`, `URL = localhost:8080`.
6. Cloudflare shows you your public URL, e.g. `https://library.you.workers.dev`
 or similar — **that URL is now your site's address, with HTTPS built in.**

### 4. Share it with the school
Give the teacher(s) the public `https://…` URL. Open it at school — camera
scanning works because it's HTTPS.

> The free Tunnel URL already updates automatically if your home IP changes,
> so there's no separate DDNS account to maintain.

---

## Option B — Classic dynamic DNS (DuckDNS / No-IP) + HTTPS

Use this if you prefer your own hostname and are comfortable opening a port on
your home router.

### 1. Pick a DDNS provider & get a hostname
- **DuckDNS** (free, simple): https://www.duckdns.org — create a subdomain like
 `myroomlibrary.duckdns.org`. Install their tiny update client, or set your
 router to auto-update DuckDNS (many routers support it).
- **No-IP** (free hostname, must refresh monthly): https://www.noip.com
- **FreeDNS** (free): https://freedns.afraid.org

Your DDNS hostname (e.g. `myroomlibrary.duckdns.org`) stays the same even though
your home IP changes.

### DuckDNS step-by-step (recommended)

1. **Create your hostname** — go to https://www.duckdns.org and sign in with a
   Google/GitHub/Twitter account. Add a subdomain (e.g. `myroomlibrary`) so your
   address is `myroomlibrary.duckdns.org`. Write down your **token** from the
   DuckDNS dashboard — you'll need it for automatic updates.

2. **Install the DuckDNS update client** so your hostname always points to your
   current home IP. Ready-to-run files are in the `deploy/` folder:
   - **Linux / Raspberry Pi:** `cp deploy/duckdns.conf.example deploy/duckdns.conf`,
     fill in your domain + token, test with `./deploy/duckdns-update.sh`, then add
     this to `crontab -e` (adjust the path):
     ```
     */5 * * * * /home/pi/classroomlib/deploy/duckdns-update.sh >>/home/pi/duckdns.log 2>&1
     ```
   - **Windows:** edit `deploy/duckdns-update.bat` with your domain + token, run
     it once, then create a scheduled task (instructions inside the file). Or
     download the official DuckDNS updater and add it to Startup.
   - **Router-based:** many routers (ASUS, TP-Link, etc.) support DuckDNS
     directly in their DDNS settings — easiest option, no extra software.

3. **Give your computer a static LAN IP** (so port-forwarding never breaks):
   in your router, reserve `192.168.1.50` for your computer's MAC address.

4. **Open a port on your router** — forward **external 443 → 192.168.1.50:443**
   (Caddy listens on the standard HTTPS port). If port 443 is already used on
   that computer, use the `:8443` alternative in `Caddyfile.example` and forward
   external 443 → internal 8443 instead. If your ISP uses carrier-grade NAT you
   won't be able to forward ports — switch to the Cloudflare Tunnel option.

5. **Run Caddy to get free HTTPS** (needed for camera barcode scanning):
   - Install Caddy from https://caddyserver.com/download
   - Rename the included `Caddyfile.example` to `Caddyfile` and put your
     DuckDNS hostname in it (e.g. `myroomlibrary.duckdns.org`).
   - Run `caddy run`. Caddy auto-fetches and renews your Let's Encrypt
     certificate and routes HTTPS to the app on port `8080`.

6. **Start the app** (`node server.js`) and confirm it prints
   `Listening on: 0.0.0.0:8080`. To keep it running automatically, use
   `deploy/classroom-library.service` (Linux/systemd) or
   `deploy/start_library.bat` (Windows) — see below.

7. **Test from outside your home** — on a phone's data (not your Wi-Fi), open
   `https://myroomlibrary.duckdns.org`. If it loads, you're live.

### Port model (the app always listens on 0.0.0.0:8080)

```
Students at school
   |  https://myroomlibrary.duckdns.org
   v
 Caddy (443)   <- router forwards external 443 here (or 8443 alternative)
   |  reverse_proxy localhost:8080
   v
 node server.js (0.0.0.0:8080)
```

- **Primary:** Caddy binds `443`, router forwards `443 → computer:443`.
- **Alternative (443 busy):** use the `:8443` block in `Caddyfile.example`,
  Caddy binds `8443`, router forwards `443 → computer:8443`.

### 2. Find your home IP & set up port forwarding
1. Find your computer's LAN IP:
 - **Windows:** `ipconfig` → "IPv4 Address" (e.g. `192.168.1.50`)
 - **macOS/Linux:** `ipconfig getifaddr en0` / `hostname -I`
2. Log into your home router (usually `192.168.1.1` or `192.168.0.1`).
3. Give your computer a **static/reserved LAN IP** so it never changes.
4. Add a **port forward**:
 - External port `443` → Internal IP `<your-computer>` → Internal port `443`
   (or internal `8443` if you use the `:8443` alternative in `Caddyfile.example`).
 - If you're behind carrier-grade NAT you may not be able to forward ports —
 in that case use **Option A** instead.

### 3. Get HTTPS with Caddy (automatic certificates)
Caddy is a small web server that fetches HTTPS certificates from **Let's Encrypt**
automatically and keeps your DDNS hostname covered.

1. Install Caddy: https://caddyserver.com/download
2. Rename `Caddyfile.example` to `Caddyfile` and put your real hostname in it
   (it already points at the app on `localhost:8080`):
 ```
 myroomlibrary.duckdns.org {
 reverse_proxy localhost:8080
 }
 ```
3. Run `caddy run` (keep it running). Caddy auto-renews the certificate.
4. Point the **port-forward** (external `443`) at the computer running Caddy.

> **Bare-minimum alternative without Caddy:** forward external `443` to
> `8080` and run the Node server behind a self-signed cert — but browsers will
> warn and camera scanning will still be blocked unless you install the cert on
> every school device. **Caddy (or Cloudflare Tunnel) is strongly recommended.**

---

## Running the server automatically (so it's always on)

Keep the server running so students can use it whenever they're at school.

### macOS (MacBook)
Run `bash deploy/setup-mac.sh` once — it installs Node + Caddy (via Homebrew,
if needed), fills in the paths, and loads three **launchd agents** that start
on login and stay running:

| Agent | Runs |
|-------|------|
| `com.classroom-library.server` | `node server.js` (port 8080) |
| `com.classroom-library.duckdns` | DuckDNS IP updater every 5 min |
| `com.classroom-library.caddy` | Caddy free HTTPS (443/8443) |
| `com.classroom-library.caffeinate` | Keeps the Mac awake (`caffeinate -dims`) |

Logs: `/tmp/classroom-library.log`, `/tmp/classroom-library-duckdns.log`,
`/tmp/classroom-library-caddy.log`. The plist templates live in `deploy/`.

### Windows
1. Edit `deploy/start_library.bat` to point `cd /d` at where you cloned the repo.
2. Press `Win + R`, type `shell:startup`, press Enter, and put a shortcut to
   `deploy/start_library.bat` there.
   The server starts automatically when you log in. (For a true service, install
   [NSSM](https://nssm.cc) and run `node server.js` as a Windows service.)

### Linux / Raspberry Pi (systemd)
A ready-to-run unit is included at `deploy/classroom-library.service`. Edit the
paths in it, then:
```bash
sudo cp deploy/classroom-library.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now classroom-library
```
Check status / logs with `systemctl status classroom-library` and
`journalctl -u classroom-library -f`.

---

## LAN access without the internet (backup)
If the internet is down, the site still works **on your home Wi-Fi** at
`http://<your-computer's-LAN-IP>:8080` (e.g. `http://192.168.1.50:8080`).
Note that **camera scanning needs a secure (HTTPS) context**, so over plain
`http://192.168.1.x` only the typed-barcode, search, and mouse workflows work.
For camera scanning you'll use the public HTTPS URL (Option A or B).

---

## Important notes

- **Data is stored per browser (localStorage).** Each computer/browser that
 visits keeps its *own* copy of the library data. If your students always use
 the same classroom device(s) or one shared tablet, that's fine. If each student
 uses their own device and you need everyone to see the same books/loans, you'll
 need a real shared backend — `js/store.js` is the single file to swap out for
 that (see README → "Going to a real backend").
- **Protect the admin account.** Share only the student usernames/passwords.
 The `admin` account (`admin123`) can manage everything, so change it and don't
 print it for students.
- **Keep the computer awake & powered.** Set power settings so the host doesn't
 sleep. On macOS, `setup-mac.sh` loads a `caffeinate -dims` agent that stops
 idle sleep while the Mac is plugged in — keep it plugged in so it stays on.
 For a tunnel (Option A), the machine must stay on and online.
- **School network may block unknown domains.** If Option B's URL is blocked,
 try Option A (Cloudflare) or ask your school's IT to allow the domain.

---

## Quick reference

| Task | Command / Where |
|------|-----------------|
| Start locally | `node server.js` → `http://localhost:8080` |
| Pick a port | `PORT=9090 node server.js` |
| Easiest public HTTPS | Cloudflare Tunnel (Option A) |
| Own hostname + HTTPS | DuckDNS + Caddy (Option B) |
| Auto-start (macOS) | `bash deploy/setup-mac.sh` (launchd agents) |
| Auto-start (Linux) | systemd unit (above) |
| Auto-start (Windows) | Startup folder `.bat` / NSSM |
| Admin login | `admin` / `admin123` |
| Student login | e.g. `alex` / `read123` |

That's it — happy hosting, and happy reading! 
