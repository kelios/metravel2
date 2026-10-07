#!/bin/bash
# Скрипт аварийного восстановления web-прода.
# ВАЖНО: старые Expo static assets копируются только как missing-file overlap.
# Новые артефакты не перетираются, а активные вкладки со старым runtime не падают
# до очистки браузерного кэша.

set -euo pipefail

# Адрес сервера не зашит в скрипт: репозиторий публичный. Реквизиты приходят
# из .env.deploy или окружения — см. scripts/deploy-target.sh.
# shellcheck source=scripts/deploy-target.sh
# Node 22 и GNU rsync в PATH — см. scripts/use-node.sh. На рабочей машине
# `/opt/homebrew/bin/node` симлинкован на node@20, а нужный node@22 стоит
# keg-only и в PATH сам не попадает.
# shellcheck source=scripts/use-node.sh
source "$(dirname "${BASH_SOURCE[0]}")/use-node.sh"

source "$(dirname "${BASH_SOURCE[0]}")/deploy-target.sh"
require_deploy_target

SERVER="${SERVER:-$PROD_SSH_TARGET}"
REMOTE_DIR="${REMOTE_DIR:-$PROD_REMOTE_DIR}"
SITE_URL="${SITE_URL:-https://metravel.by}"
ENV="${ENV:-prod}"
FORCE_REBUILD="${FORCE_REBUILD:-1}"
ALLOW_DIRTY="${ALLOW_DIRTY:-0}"
for arg in "$@"; do
  case "$arg" in
    --allow-dirty) ALLOW_DIRTY=1 ;;
  esac
done
metravel_deploy_defaults
EXPO_OVERLAY_HELPER="scripts/deploy-expo-overlay.sh"
DISK_GUARD_HELPER="scripts/deploy-disk-guard.sh"

# Health-check curls MUST be bounded: under `set -e` a hung/slow request (no
# timeout) silently aborts an otherwise-successful deploy. Bound + retry so a
# transient blip does not fail the release.
HC_CURL=(curl --max-time 20 --connect-timeout 10 --retry 2 --retry-delay 2 --retry-all-errors)

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

echo "source_gate allow_dirty=$ALLOW_DIRTY"
node "$(dirname "${BASH_SOURCE[0]}")/assert-deployable-source.js" --deploy 1 --allow-dirty "$ALLOW_DIRTY" --cwd "$(pwd)"

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

node "$(dirname "${BASH_SOURCE[0]}")/assert-deployable-source.js" \
  --check-marker "dist/$ENV/.build-source.json" --allow-dirty "$ALLOW_DIRTY" --cwd "$(pwd)"

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

# Recovery uploads all three trees, then copies the selected artifact and assets
# into static/dist.new. Reserve BOTH allocations before the first upload byte.
UPLOAD_KIB="$(du -sk ./dist ./assets/icons ./assets/images | awk '{ total += $1 } END { print total }')"
STAGING_KIB="$(du -sk "./dist/$ENV" ./assets/icons ./assets/images | awk '{ total += $1 } END { print total }')"
PAYLOAD_KIB=$((UPLOAD_KIB + STAGING_KIB))
if ! ssh "$SERVER" bash -s -- preflight "$REMOTE_DIR" "$PAYLOAD_KIB" \
  "$DEPLOY_DISK_RESERVE_MB" "$DEPLOY_BACKEND_BUILD_MB" < "$DISK_GUARD_HELPER"; then
  echo "ERROR: disk preflight refused recovery; upload has not started"
  exit 1
fi
EXPO_OVERLAY_HELPER_B64="$(base64 < "$EXPO_OVERLAY_HELPER" | tr -d '\n')"
DISK_GUARD_HELPER_B64="$(base64 < "$DISK_GUARD_HELPER" | tr -d '\n')"
CONTAINER_HELPER_B64="$(metravel_container_remote_snippet | base64 | tr -d '\n')"

echo "Uploading build payload to server..."
# Preserve paired SSG hardlinks; omit build-orchestration dotdirs.
rsync -avzHhe "ssh" --delete \
  --exclude='/.prod-staging' --exclude='/.prod-build.lock' --exclude='/.tmp' \
  ./dist/ "$SERVER:$REMOTE_DIR/dist/"
rsync -avzhe "ssh" --delete ./assets/icons/ "$SERVER:$REMOTE_DIR/icons/"
rsync -avzhe "ssh" --delete ./assets/images/ "$SERVER:$REMOTE_DIR/images/"

echo "Applying release atomically on server..."
# The shared overlay needs host Bash/Perl/cpio, verified by disk preflight.
# Create only the fresh staging tree for the host uid, then rsync/overlay there, preserving SSG links on every host.
# The final rename stays inside the app container that owns static/.
REMOTE_DONE_MARKER="MT_FIX_PROD_OK:$(date +%s).$$.$RANDOM"
if ! REMOTE_OUTPUT=$(ssh "$SERVER" bash -s -- "$ENV" "$REMOTE_DIR" "$CONTAINER_HELPER_B64" \
  "$EXPO_OVERLAY_HELPER_B64" "$EXPO_OVERLAY_RETENTION_DAYS" "$EXPO_OVERLAY_MAX_MB" \
  "$DISK_GUARD_HELPER_B64" "$DEPLOY_BACKEND_BUILD_MB" "$REMOTE_DONE_MARKER" <<'REMOTE_FIX_SCRIPT'
set -euo pipefail
ENV="$1"
REMOTE_DIR="$2"
CONTAINER_HELPER_B64="$3"
EXPO_OVERLAY_HELPER_B64="$4"
EXPO_OVERLAY_RETENTION_DAYS="$5"
EXPO_OVERLAY_MAX_MB="$6"
DISK_GUARD_HELPER_B64="$7"
DEPLOY_BACKEND_BUILD_MB="$8"
DEPLOY_SUCCESS_MARKER="$9"
test -n "$DEPLOY_SUCCESS_MARKER"
cd "$REMOTE_DIR"
test -d "dist/$ENV"
eval "$(printf '%s' "$CONTAINER_HELPER_B64" | base64 -d)"
app_ctr="$(metravel_resolve_container app)"
nginx_ctr="$(metravel_resolve_container nginx)"
# Retain existing top-level ownership normalization; the new permission change
# applies only to dist.new. Host writes never rely on tools in the app image.
docker exec -u 0 "$app_ctr" sh -c '
  set -eu
  chown 1984:1000 /app/static
  chmod 2775 /app/static
  rm -rf /app/static/dist.new /app/static/dist.old
  mkdir /app/static/dist.new
  chown "$1:$2" /app/static/dist.new
' sh "$(id -u)" "$(id -g)" </dev/null
rsync -aH "dist/$ENV/" static/dist.new/
find static/dist.new/_expo/static/js/web -type f -name '*.js' >/dev/null
mkdir -p static/dist.new/assets/icons static/dist.new/assets/images
cp -R icons/. static/dist.new/assets/icons/
cp -R images/. static/dist.new/assets/images/
# Also stamp cached fresh chunks on a first release; the helper handles an
# absent previous tree after assigning the new generation's publication time.
printf '%s' "$EXPO_OVERLAY_HELPER_B64" | base64 -d | bash -s -- \
  static/dist.new/_expo/static static/dist/_expo/static \
  "$EXPO_OVERLAY_RETENTION_DAYS" "$EXPO_OVERLAY_MAX_MB"
# No copy/link/write failure above can reach the swap; an absent first release
# is allowed explicitly, while rename failures restore the previous tree.
docker exec "$app_ctr" sh -c '
  set -eu
  cd /app
  if [ -d static/dist ]; then mv static/dist static/dist.old; fi
  if ! mv static/dist.new static/dist; then
    if [ ! -e static/dist ] && [ -d static/dist.old ]; then mv static/dist.old static/dist; fi
    exit 1
  fi
' </dev/null
# Preserve the recovery activation order: validate then gracefully reload.
docker exec "$nginx_ctr" /etc/nginx/sbin/nginx -t -c /etc/nginx/conf/nginx.conf </dev/null
docker exec "$nginx_ctr" /etc/nginx/sbin/nginx -s reload -c /etc/nginx/conf/nginx.conf </dev/null
docker exec -u 0 "$app_ctr" sh -c 'rm -rf /app/static/dist.old' </dev/null
rm -rf dist icons images
rm -f /tmp/dist-prod-upload.tar.gz dist-prod-upload.tar.gz
if ! printf '%s' "$DISK_GUARD_HELPER_B64" | base64 -d | bash -s -- \
  report "$REMOTE_DIR" "$REMOTE_DIR/static/dist" "$DEPLOY_BACKEND_BUILD_MB"; then
  echo "WARN: disk report failed; recovery is already published"
fi
printf '\n%s\n' "$DEPLOY_SUCCESS_MARKER"
REMOTE_FIX_SCRIPT
); then
  printf '%s\n' "$REMOTE_OUTPUT"
  echo "ERROR: recovery publication failed"
  exit 1
fi
printf '%s\n' "$REMOTE_OUTPUT"
if ! printf '%s\n' "$REMOTE_OUTPUT" | grep -qxF -- "$REMOTE_DONE_MARKER"; then
  echo "ERROR: recovery program did not reach its final success marker"
  exit 1
fi

echo "Validating deployed entry chunk..."
entry_chunk="$(grep -oE 'entry-[a-f0-9]+\.js' "dist/$ENV/index.html" | head -1 || true)"
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
served_index_chunk="$(grep -oE '_expo/static/js/web/index-[a-f0-9]+\.js' "$tmp_html" | head -1 || true)"
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
served_header_chunk="$(grep -oE '_expo/static/js/web/[A-Za-z]*Header[A-Za-z]*-[a-f0-9]+\.js' "$tmp_index" | head -1 || true)"
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
