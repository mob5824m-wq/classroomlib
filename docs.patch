#!/usr/bin/env bash
# One-time setup for hosting the Classroom Library on a MacBook (DuckDNS + Caddy).
#
# What it does:
#   1. Checks you have node + caddy (installs via Homebrew if missing).
#   2. Checks your DuckDNS config and Caddyfile are set up.
#   3. Installs five launchd agents that start everything automatically when
#      you log in and keep it running:
#        - com.classroom-library.server      (node server.js, port 8080)
#        - com.classroom-library.duckdns     (update your DuckDNS IP every 5 min)
#        - com.classroom-library.caddy       (free HTTPS on 443/8443)
#        - com.classroom-library.caffeinate  (keep the Mac awake while powered)
#        - com.classroom-library.backup      (daily snapshot of the data)
#
# Run it from the repo folder:
#     bash deploy/setup-mac.sh
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LA="$HOME/Library/LaunchAgents"
mkdir -p "$LA"

echo "Classroom Library setup — repo: $REPO"
echo

# --- Node -----------------------------------------------------------------
NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then
  echo "node not found. Installing via Homebrew..."
  command -v brew >/dev/null 2>&1 || { echo "Homebrew not installed. Install it first: https://brew.sh"; exit 1; }
  brew install node
  NODE="$(command -v node)"
fi
echo "node: $NODE"

# --- Caddy ----------------------------------------------------------------
CADDY="$(command -v caddy || true)"
if [ -z "$CADDY" ]; then
  echo "caddy not found. Installing via Homebrew..."
  command -v brew >/dev/null 2>&1 || { echo "Homebrew not installed. Install it first: https://brew.sh"; exit 1; }
  brew install caddy
  CADDY="$(command -v caddy)"
fi
echo "caddy: $CADDY"

# --- Pre-flight checks -----------------------------------------------------
[ -f "$REPO/deploy/duckdns.conf" ] \
  || echo "WARNING: no deploy/duckdns.conf — run: cp deploy/duckdns.conf.example deploy/duckdns.conf (then edit it)"
[ -f "$REPO/Caddyfile" ] \
  || echo "WARNING: no Caddyfile — run: cp Caddyfile.example Caddyfile (then put your DuckDNS hostname in it)"

# --- Install LaunchAgents --------------------------------------------------
echo
echo "Installing launchd agents into $LA ..."
for name in server duckdns caddy caffeinate backup; do
  src="$REPO/deploy/com.classroom-library.$name.plist"
  dst="$LA/com.classroom-library.$name.plist"
  sed -e "s|__REPO__|$REPO|g" \
      -e "s|__NODE__|$NODE|g" \
      -e "s|__CADDY__|$CADDY|g" "$src" > "$dst"
  echo "  wrote $dst"
done

# --- Load them ------------------------------------------------------------
echo
echo "Loading agents (they will start now and on every login)..."
for name in server duckdns caddy caffeinate backup; do
  dst="$LA/com.classroom-library.$name.plist"
  if launchctl bootstrap gui/"$(id -u)" "$dst" 2>/dev/null; then
    echo "  loaded $name"
  else
    # fall back to the older loading command
    launchctl load "$dst" 2>/dev/null && echo "  loaded $name" || echo "  note: $name may already be loaded"
  fi
done

echo
echo "Done. Check the logs:"
echo "  server : tail -f /tmp/classroom-library.log"
echo "  duckdns: cat /tmp/classroom-library-duckdns.log"
echo "  caddy  : tail -f /tmp/classroom-library-caddy.log"
echo "  backup : cat $REPO/backups/backup.log   (first snapshot runs now)"
echo
echo "Then test from your phone's mobile data: https://YOURSUB.duckdns.org"
