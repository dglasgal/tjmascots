#!/usr/bin/env bash
# shrink-git.sh — one-time .git history rewrite to purge old/replaced photo blobs
#
# Why this exists:
#   On 2026-05-16 we compressed 267 photos in working-tree (281 MB -> 82 MB),
#   but every old PRE-compression version is still sitting in .git history.
#   That bloats clones to ~900 MB and times out DigitalOcean's build step.
#
# What this script does, in order:
#   1. Bails out if working tree is dirty
#   2. Removes any stale .git/*.lock files
#   3. Makes a SAFETY BACKUP tag (pre-bfg-backup) + a full directory copy
#   4. Installs git-filter-repo via brew if it's not already there
#   5. Reports current .git size
#   6. Strips every blob in history bigger than 1 MB
#       (current working tree is <1 MB per file after last week's compression,
#        so anything >1 MB in history is by definition an old replaced version)
#   7. Runs aggressive GC + reflog expire to actually reclaim space
#   8. Reports the new .git size
#
# This script does NOT push. After it finishes, verify a `npm run build` still
# works locally, then I'll give you the exact force-push command.

set -euo pipefail

# --- 1. Pre-flight checks --------------------------------------------------
if [ ! -d .git ]; then
  echo "ERROR: not in a git repo. cd into your tjmascots/site folder first."
  exit 1
fi

echo "==> Pre-flight: checking working tree…"
# Allow tsconfig.tsbuildinfo to be dirty (it always is), bail on anything else.
DIRTY="$(git status --porcelain | grep -v 'tsconfig.tsbuildinfo' || true)"
if [ -n "$DIRTY" ]; then
  echo "ERROR: you have uncommitted changes besides tsconfig.tsbuildinfo:"
  echo "$DIRTY"
  echo "Commit or stash them first, then re-run this script."
  exit 1
fi

# --- 2. Remove stale lock files (sandbox sometimes leaves these behind) ---
rm -f .git/index.lock .git/HEAD.lock .git/refs/heads/main.lock 2>/dev/null || true

# --- 3. Safety backup ------------------------------------------------------
echo "==> Tagging current state as pre-bfg-backup (recoverable locally)…"
git tag -f pre-bfg-backup HEAD

REPO_ROOT="$(pwd)"
BACKUP_DIR="${REPO_ROOT}-backup-$(date +%Y%m%d-%H%M%S)"
echo "==> Making full directory copy at:"
echo "    $BACKUP_DIR"
echo "    (delete this once you've confirmed the live site still works)"
cp -a "$REPO_ROOT" "$BACKUP_DIR"

# --- 4. Install git-filter-repo if missing --------------------------------
if ! command -v git-filter-repo >/dev/null 2>&1; then
  echo "==> git-filter-repo not found. Installing via Homebrew…"
  if ! command -v brew >/dev/null 2>&1; then
    echo "ERROR: brew not installed. Install Homebrew first: https://brew.sh"
    exit 1
  fi
  brew install git-filter-repo
fi

# --- 5. Report current size -----------------------------------------------
SIZE_BEFORE="$(du -sh .git | cut -f1)"
echo "==> .git size BEFORE: $SIZE_BEFORE"

# --- 6. Rewrite history ---------------------------------------------------
echo "==> Stripping blobs > 1 MB from history…"
echo "    (This rewrites every commit hash. That's why we tagged + backed up.)"
git filter-repo --strip-blobs-bigger-than 1M --force

# --- 7. Aggressive GC -----------------------------------------------------
echo "==> Expiring reflogs and running aggressive GC…"
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# --- 8. Report new size ---------------------------------------------------
SIZE_AFTER="$(du -sh .git | cut -f1)"
echo ""
echo "================================================================"
echo "  .git size BEFORE: $SIZE_BEFORE"
echo "  .git size AFTER:  $SIZE_AFTER"
echo "================================================================"
echo ""
echo "NEXT STEPS (do NOT force-push yet):"
echo "  1. Run \`npm run build\` in this folder to confirm the site still"
echo "     builds correctly from the rewritten history."
echo "  2. Tell Claude the new .git size and that the build passed."
echo "  3. Claude will give you the exact \`git push --force\` command."
echo ""
echo "If something looks wrong, your safe restore options are:"
echo "  - Local rollback:  git reset --hard pre-bfg-backup"
echo "  - Full restore:    rm -rf \"$REPO_ROOT\" && mv \"$BACKUP_DIR\" \"$REPO_ROOT\""
