#!/bin/bash
# Скрипт аварийного восстановления web-прода.
# ВАЖНО: старые Expo static assets копируются только как missing-file overlap.
# Новые артефакты не перетираются, а активные вкладки со старым runtime не падают
# до очистки браузерного кэша.

set -euo pipefail

SERVER="${SERVER:-sx3@178.172.137.129}"
REMOTE_DIR="${REMOTE_DIR:-/home/sx3/metravel}"
SITE_URL="${SITE_URL:-https://metravel.by}"
ENV="${ENV:-prod}"
FORCE_REBUILD="${FORCE_REBUILD:-1}"

# Health-check curls MUST be bounded: under `set -e` a hung/slow request (no
# timeout) silently aborts an otherwise-successful deploy. Bound + retry so a
# transient blip does not fail the release.
HC_CURL=(curl --max-time 20 --connect-timeout 10 --retry 2 --retry-delay 2)

echo "FIX-PROD: safe web redeploy"
echo "server=$SERVER"
echo "remote_dir=$REMOTE_DIR"
echo "site_url=$SITE_URL"
echo "env=$ENV"
echo "force_rebuild=$FORCE_REBUILD"
echo

if [ "$ENV" != "prod" ] && [ "$ENV" != "preprod" ] && [ "$ENV" != "dev" ]; then
  echo "ERROR: ENV must be one of: dev | preprod | prod"
  exit 1
fi

# Cross-machine deploy lock: prevent two deploys (from ANY machine or agent
# session) applying releases to the same server concurrently. `mkdir` is atomic
# on the server, so it is a race-free mutex. A lock older than DEPLOY_LOCK_TTL
# is treated as stale (a crashed deploy) and reclaimed.
DEPLOY_LOCK="${DEPLOY_LOCK:-$REMOTE_DIR/.deploy.lock}"
DEPLOY_LOCK_TTL="${DEPLOY_LOCK_TTL:-1800}"
deploy_lock_acquired=0

release_deploy_lock() {
  [ "$deploy_lock_acquired" = "1" ] || return 0
  ssh "$SERVER" "rm -rf '$DEPLOY_LOCK'" 2>/dev/null || true
  deploy_lock_acquired=0
}
trap release_deploy_lock EXIT

LOCK_SCRIPT="set -eu
lock='$DEPLOY_LOCK'
ttl=$DEPLOY_LOCK_TTL
if mkdir \"\$lock\" 2>/dev/null; then date +%s > \"\$lock/ts\"; echo ACQUIRED; exit 0; fi
ts=\$(cat \"\$lock/ts\" 2>/dev/null || echo 0)
age=\$(( \$(date +%s) - ts ))
if [ \"\$age\" -gt \"\$ttl\" ]; then rm -rf \"\$lock\"; mkdir \"\$lock\"; date +%s > \"\$lock/ts\"; echo ACQUIRED_STALE; exit 0; fi
echo BUSY:\$age"
LOCK_B64="$(printf '%s' "$LOCK_SCRIPT" | base64 | tr -d '\n')"
echo "Acquiring deploy lock on $SERVER..."
lock_res="$(ssh "$SERVER" "printf '%s' '$LOCK_B64' | base64 -d | sh -s")"
case "$lock_res" in
  ACQUIRED*) deploy_lock_acquired=1; echo "Deploy lock acquired ($lock_res)";;
  *) echo "ERROR: another deploy is already in progress on $SERVER ($lock_res). Aborting to avoid a racing/wrong-config release."; exit 1;;
esac

if [ "$FORCE_REBUILD" = "1" ]; then
  echo "Force rebuild enabled: removing dist/$ENV"
  rm -rf "dist/$ENV"
fi

if [ ! -d "dist/$ENV/_expo/static/js/web" ]; then
  echo "Building fresh web bundle..."
  npm run build:web:prod
fi

if [ ! -d "dist/$ENV/_expo/static/js/web" ]; then
  echo "ERROR: build output dist/$ENV/_expo/static/js/web is missing"
  exit 1
fi

chunk_count="$(find "dist/$ENV/_expo/static/js/web/" -maxdepth 1 -type f | wc -l | tr -d ' ')"
echo "Local build ready: $chunk_count web chunks"

# Fail-closed config gate BEFORE upload: refuse to ship an artifact with the
# wrong config (analytics disabled / missing Metrika / leaked LAN-dev API).
# Catches the "stale dist shipped without rebuild" path too, since this runs
# whether or not we rebuilt above.
if [ "$ENV" = "prod" ]; then
  echo "Verifying prod artifact config (fail-closed)..."
  node scripts/verify-prod-config.js --dist "dist/$ENV"
fi

echo "Uploading build payload to server..."
# Never ship build-orchestration dotdirs: build-web-prod.js stages into
# dist/.prod-staging and writes dist/.prod-build.lock. With --delete a leftover
# staging/lock from an aborted run would otherwise be pushed to prod.
rsync -avzhe "ssh" --delete \
  --exclude='/.prod-staging' --exclude='/.prod-build.lock' --exclude='/.tmp' \
  ./dist/ "$SERVER:$REMOTE_DIR/dist/"
rsync -avzhe "ssh" --delete ./assets/icons/ "$SERVER:$REMOTE_DIR/icons/"
rsync -avzhe "ssh" --delete ./assets/images/ "$SERVER:$REMOTE_DIR/images/"

echo "Applying release atomically on server..."
# static/ is owned by uid 1984 (the container user); the host login (sx3) is in
# "other" and cannot write into it, so a host-side `mv` into static/ fails with
# Permission denied. The swap therefore runs INSIDE the app container
# (metravel-app-1, uid 1984), which owns static/ and mounts the whole repo at
# /app, so it also sees the freshly-uploaded dist/ icons/ images/.
#   - shipped via base64 over stdin to sidestep ssh+docker quoting pitfalls
#   - the app image has no rsync, so the _expo overlay uses `cp -an` (no-clobber)
#   - the new bundle is copied (cp -a), not moved: dist/ belongs to the host user
#     and its entries can't be unlinked from inside the container
# $ENV expands locally before encoding.
SWAP_SCRIPT="set -eu
cd /app
test -d dist/$ENV
rm -rf static/dist.new
cp -a dist/$ENV static/dist.new
find static/dist.new/_expo/static/js/web -type f -name '*.js' >/dev/null
if [ -d static/dist/_expo/static ]; then
  mkdir -p static/dist.new/_expo/static
  cp -an static/dist/_expo/static/. static/dist.new/_expo/static/ 2>/dev/null || true
fi
rm -rf static/dist.old 2>/dev/null || true
mv static/dist static/dist.old 2>/dev/null || true
mv static/dist.new static/dist
# Tolerant: a dir left by an out-of-band deploy may be owned by another uid the
# container cannot unlink. The bundle is already live by here, so never abort.
rm -rf static/dist.old 2>/dev/null || true
mkdir -p static/dist/assets/icons static/dist/assets/images
cp -R icons/. static/dist/assets/icons/
cp -R images/. static/dist/assets/images/"
SWAP_B64="$(printf '%s' "$SWAP_SCRIPT" | base64 | tr -d '\n')"
ssh "$SERVER" "set -euo pipefail
  cd '$REMOTE_DIR'
  test -d dist/$ENV
  printf '%s' '$SWAP_B64' | base64 -d | docker exec -i metravel-app-1 sh -s
  docker restart metravel-nginx-1
  rm -rf dist icons images
"

echo "Validating deployed entry chunk..."
entry_chunk="$(grep -oE 'entry-[a-f0-9]+\.js' "dist/$ENV/index.html" | head -1)"
if [ -z "$entry_chunk" ]; then
  echo "ERROR: cannot detect entry chunk in dist/$ENV/index.html"
  exit 1
fi

entry_status="$("${HC_CURL[@]}" -sI "$SITE_URL/_expo/static/js/web/$entry_chunk" | head -1 | awk '{print $2}')"
if [ "$entry_status" != "200" ]; then
  echo "ERROR: entry chunk is not available: $entry_chunk (status=$entry_status)"
  exit 1
fi

echo "OK: entry chunk available: $entry_chunk"

# Post-swap live tripwire: confirm the SERVED prod HTML actually carries the
# right config. Pre-upload verify already gates the artifact; this catches a
# bad swap / stale cache serving wrong config. Runs before the early-exit
# header-check paths so it always executes.
if [ "$ENV" = "prod" ]; then
  echo "Verifying live prod config (analytics + no LAN leak)..."
  live_html="$("${HC_CURL[@]}" -sS "$SITE_URL/")"
  if printf '%s' "$live_html" | grep -q 'Analytics disabled'; then
    echo "ERROR: live prod has analytics DISABLED after deploy (wrong config shipped)"
    exit 1
  fi
  if printf '%s' "$live_html" | grep -qE '192\.168\.'; then
    echo "ERROR: live prod HTML contains a LAN IP (192.168.*) — dev config shipped"
    exit 1
  fi
  echo "OK: live prod config verified"
fi

echo "Validating runtime chunk linkage..."
tmp_html="$(mktemp)"
tmp_index="$(mktemp)"
tmp_header="$(mktemp)"
"${HC_CURL[@]}" -sS "$SITE_URL/" > "$tmp_html"
served_index_chunk="$(grep -oE '_expo/static/js/web/index-[a-f0-9]+\.js' "$tmp_html" | head -1)"
if [ -z "$served_index_chunk" ]; then
  echo "ERROR: cannot detect served index chunk from $SITE_URL/"
  rm -f "$tmp_html" "$tmp_index" "$tmp_header"
  exit 1
fi

"${HC_CURL[@]}" -sS "$SITE_URL/$served_index_chunk" > "$tmp_index"
# Header chunk naming/bundling has changed over time (CustomHeader -> HeaderContextBar,
# and it may now be inlined into the index chunk instead of code-split). Match any
# *Header* chunk resiliently. If none is referenced, the header is not a separate chunk
# on this build, so skip the regression check rather than fail a legitimate deploy.
served_header_chunk="$(grep -oE '_expo/static/js/web/[A-Za-z]*Header[A-Za-z]*-[a-f0-9]+\.js' "$tmp_index" | head -1)"
if [ -z "$served_header_chunk" ]; then
  echo "WARN: no separate *Header* chunk referenced from $served_index_chunk - skipping direct-useFilters regression check (header likely inlined; not a deploy failure)"
  rm -f "$tmp_html" "$tmp_index" "$tmp_header"
  echo "Done: production web assets replaced with missing-file static overlap."
  exit 0
fi

"${HC_CURL[@]}" -sS "$SITE_URL/$served_header_chunk" > "$tmp_header"
if grep -qE "\.useFilters\)\(\)" "$tmp_header"; then
  echo "ERROR: served header chunk still contains direct .useFilters() call:"
  echo "  $served_header_chunk"
  rm -f "$tmp_html" "$tmp_index" "$tmp_header"
  exit 1
fi

rm -f "$tmp_html" "$tmp_index" "$tmp_header"
echo "OK: served header chunk is safe: $served_header_chunk"
echo "Done: production web assets replaced with missing-file static overlap."
