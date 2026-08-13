#!/usr/bin/env bash
# Automated backup of the Classroom Library data.
#
# Snapshots the real server data to a timestamped file and keeps only the
# newest backup (the previous one is pruned each run). It backs up BOTH files
# needed to fully restore:
#   - library-data.json        (books, students, loans, holds, settings, …)
#   - library-secret.key       (encryption key required to decrypt student
#                               passwords — without it a restore can't recover
#                               them)
# It can also copy the snapshot to a second location (USB drive, network
# mount, iCloud folder, etc.) via LIBRARY_BACKUP_EXTRA_DIR.
#
# USAGE
#   Test once:                    ./deploy/backup.sh
#   macOS daily backup:           run deploy/setup-mac.sh (installs + loads a
#                                 launchd agent that runs this every day).
#   Manual daily backup (Linux):  add a cron line, e.g.
#                                 @daily /path/classroomlib/deploy/backup.sh
#
# CONFIG (environment variables, all optional):
#   LIBRARY_BACKUP_DIR       where snapshots go   (default: <repo>/backups)
#   LIBRARY_BACKUP_KEEP      how many to keep      (default: 1 — only the
#                             newest backup is kept)
#   LIBRARY_BACKUP_EXTRA_DIR a second copy folder  (default: none)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA="$REPO/library-data.json"
KEY="$REPO/library-secret.key"

BACKUP_DIR="${LIBRARY_BACKUP_DIR:-$REPO/backups}"
KEEP="${LIBRARY_BACKUP_KEEP:-1}"
EXTRA_DIR="${LIBRARY_BACKUP_EXTRA_DIR:-}"

LOG="$BACKUP_DIR/backup.log"
STAMP="$(date +%F_%H%M%S)"
DEST="$BACKUP_DIR/library-backup-$STAMP.json"
KEYDEST="$BACKUP_DIR/library-secret-$STAMP.key"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DATA" ]; then
  echo "$(date '+%F %T') SKIP: $DATA not found (has the server run yet?)" >> "$LOG"
  echo "No data to back up yet."
  exit 0
fi

# Snapshot the data and the encryption key.
cp "$DATA" "$DEST"
if [ -f "$KEY" ]; then
  cp "$KEY" "$KEYDEST"
fi

# Optional second copy (e.g. USB drive / network share / iCloud folder).
if [ -n "$EXTRA_DIR" ]; then
  mkdir -p "$EXTRA_DIR"
  cp "$DEST" "$EXTRA_DIR/"
  [ -f "$KEYDEST" ] && cp "$KEYDEST" "$EXTRA_DIR/"
fi

# Prune: keep only the newest $KEEP backups (json) and their matching keys.
COUNT=$(ls -1 "$BACKUP_DIR"/library-backup-*.json 2>/dev/null | wc -l | tr -d ' ')
if [ "$COUNT" -gt "$KEEP" ]; then
  ls -1t "$BACKUP_DIR"/library-backup-*.json 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r f; do
    rm -f "$f"
  done
fi
# Remove any orphaned key snapshots whose matching json backup is gone.
for k in "$BACKUP_DIR"/library-secret-*.key; do
  [ -e "$k" ] || continue
  stamp="${k##*library-secret-}"
  stamp="${stamp%.key}"
  [ -f "$BACKUP_DIR/library-backup-$stamp.json" ] || rm -f "$k"
done

echo "$(date '+%F %T') OK: $DEST" >> "$LOG"
echo "Backup written to $DEST"
if [ -n "$EXTRA_DIR" ]; then echo "Second copy in $EXTRA_DIR"; fi
