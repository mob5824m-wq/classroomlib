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
   current home IP:
   - **Windows:** download the DuckDNS updater, put your token in its config,
     and run it (or add it to Startup). Or use a scheduled task:
     `https://www.duckdns.org/update?domains=myroomlibrary&token=YOURTOKEN&ip=`
   - **Linux / Raspberry Pi:** the one-liner below (add it to `cron` so it runs
     every 5 minutes).
     ```bash
     echo url="https://www.duckdns.org/update?domains=myroomlibrary&token=YOURTOKEN&ip=" | curl -k -o ~/duck.log -K -
     ```
     Add to `crontab -e`:
     ```
     */5 * * * * echo url="https://www.duckdns.org/update?domains=myroomlibrary&token=YOURTOKEN&ip=" | curl -k -o ~/duck.log -K -
     ```
   - **Router-based:** many routers (ASUS, TP-Link, etc.) support DuckDNS
     directly in their DDNS settings — easiest option, no extra software.

3. **Give your computer a static LAN IP** (so port-forwarding never breaks):
   in your router, reserve `192.168.1.50` for your computer's MAC address.

4. **Open a port on your router** — forward **external 443 → 192.168.1.50:8443**
   (Caddy will serve HTTPS on 8443). If your ISP uses carrier-grade NAT you
   won't be able to forward ports — switch to the Cloudflare Tunnel option.

5. **Run Caddy to get free HTTPS** (needed for camera barcode scanning):
   - Install Caddy from https://caddyserver.com/download
   - Rename the included `Caddyfile.example` to `Caddyfile` and put your
     DuckDNS hostname in it (e.g. `myroomlibrary.duckdns.org`).
   - Run `caddy run`. Caddy auto-fetches and renews your Let's Encrypt
     certificate. (It routes HTTPS to the app on port `8080`.)

6. **Start the app** (`node server.js`) and confirm it prints
   `Listening on: 0.0.0.0:8080`.

7. **Test from outside your home** — on a phone's data (not your Wi-Fi), open
   `https://myroomlibrary.duckdns.org`. If it loads, you're live.

### 2. Find your home IP & set up port forwarding
1. Find your computer's LAN IP:
 - **Windows:** `ipconfig` → "IPv4 Address" (e.g. `192.168.1.50`)
 - **macOS/Linux:** `ipconfig getifaddr en0` / `hostname -I`
2. Log into your home router (usually `192.168.1.1` or `192.168.0.1`).
3. Give your computer a **static/reserved LAN IP** so it never changes.
4. Add a **port forward**:
 - External port `443` → Internal IP `<your-computer>` → Internal port `8443`
 - (See Method B2 below — you'll point a HTTPS reverse proxy at `8443`.)
 - If you're behind carrier-grade NAT you may not be able to forward ports —
 in that case use **Option A** instead.

### 3. Get HTTPS with Caddy (automatic certificates)
Caddy is a small web server that fetches HTTPS certificates from **Let's Encrypt**
automatically and keeps your DDNS hostname covered.

1. Install Caddy: https://caddyserver.com/download
2. Create a `Caddyfile`:
 ```
 myroomlibrary.duckdns.org {
 reverse_proxy localhost:8443
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

### Windows
1. Press `Win + R`, type `shell:startup`, press Enter.
2. Create `start_library.bat` there:
 ```bat
 @echo off
 cd C:\path\to\classroomlib
 node server.js
 ```
 The server starts automatically when you log in. (For a true service, install
 [NSSM](https://nssm.cc) and run `node server.js` as a Windows service.)

### Linux / Raspberry Pi (systemd)
```bash
sudo nano /etc/systemd/system/classroom-library.service
```
```ini
[Unit]
Description=Classroom Library
After=network.target

[Service]
WorkingDirectory=/home/pi/classroomlib
ExecStart=/usr/bin/node server.js
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl enable --now classroom-library
```

### macOS
Use `launchd`, or simply add the `node server.js` command to Login Items.

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
 sleep. For a tunnel (Option A), the machine must stay on and online.
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
| Auto-start (Linux) | systemd unit (above) |
| Auto-start (Windows) | Startup folder `.bat` / NSSM |
| Admin login | `admin` / `admin123` |
| Student login | e.g. `alex` / `read123` |

That's it — happy hosting, and happy reading! 
