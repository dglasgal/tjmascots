#!/usr/bin/env bash
# restore-stripped-photos.sh — restore photos the BFG rewrite removed.
#
# git filter-repo --strip-blobs-bigger-than 1M removed >1 MB blobs from both
# history AND the current working tree. Anything added since the last
# compression pass (May 16) hadn't been resized yet, so a handful of recent
# photos got nuked off David's Mac entirely. The full pre-rewrite copies
# still exist in the backup folder we made — this script:
#   1. Diffs backup vs current to find what's missing
#   2. For each missing photo: copies from backup, compresses if >900 KB
#      (resize max 1600 px, JPEG quality 85 — same recipe as the May 16
#      compression batch)
#   3. Stages, shows the change, commits, pushes
#
# After it finishes, DigitalOcean redeploys (~3 min) and the broken images
# on /recent disappear.

set -euo pipefail

BACKUP="../site-backup-20260528-181158"

if [ ! -d "$BACKUP/public/photos" ]; then
  echo "ERROR: backup not found at $BACKUP/public/photos"
  echo "Run this from inside the tjmascots/site directory."
  exit 1
fi

# Files in backup but not in current
missing=$(comm -23 \
  <(ls "$BACKUP/public/photos/" | sort) \
  <(ls public/photos/ | sort))

if [ -z "$missing" ]; then
  echo "Nothing missing. Working tree already has every photo in the backup."
  exit 0
fi

echo "Missing photos to restore:"
echo "$missing" | sed 's/^/  - /'
echo ""

restored=0
compressed=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  src="$BACKUP/public/photos/$f"
  dst="public/photos/$f"
  if [ ! -f "$src" ]; then
    echo "  ! skipping $f — not a regular file"
    continue
  fi
  size=$(stat -f%z "$src")
  if [ "$size" -gt 900000 ]; then
    # >900 KB → re-encode and resize so the new commit doesn't reintroduce
    # the same bloat we just stripped. sips ships with macOS, no install.
    sips -Z 1600 -s formatOptions 85 "$src" --out "$dst" >/dev/null 2>&1 || cp "$src" "$dst"
    new_size=$(stat -f%z "$dst" 2>/dev/null || echo 0)
    printf "  + %s : %d KB -> %d KB (compressed)\n" "$f" $((size/1024)) $((new_size/1024))
    compressed=$((compressed + 1))
  else
    cp "$src" "$dst"
    printf "  + %s : %d KB (copied as-is, already small)\n" "$f" $((size/1024))
  fi
  restored=$((restored + 1))
done <<< "$missing"

echo ""
echo "Restored $restored photo(s) (of which $compressed were compressed)."
echo ""

git add public/photos/
echo "About to commit:"
git diff --cached --stat public/photos/ | tail -20
echo ""
echo "Press Enter to commit + push, Ctrl-C to abort."
read

git commit -m "Restore $restored photos stripped by 1MB history rewrite"
git push origin main

echo ""
echo "Done. DigitalOcean should redeploy in ~3 minutes."
echo "Check the deploy at: https://cloud.digitalocean.com/apps/137694ec-77d5-4b76-8411-6efbfb0bc38a/activity"
