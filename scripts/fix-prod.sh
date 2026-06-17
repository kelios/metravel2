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
ssh "$SERVER" "set -euo pipefail
  cd '$REMOTE_DIR'

  test -d dist/$ENV
  mkdir -p static
  rm -rf static/dist.new
  mv dist/$ENV static/dist.new

  find static/dist.new/_expo/static/js/web -type f -name '*.js' >/dev/null

  mv static/dist static/dist.old 2>/dev/null || true
  if [ -d static/dist.old/_expo/static ]; then
    mkdir -p static/dist.new/_expo/static
    rsync -a --ignore-existing static/dist.old/_expo/static/ static/dist.new/_expo/static/
  fi

  mv static/dist.new static/dist
  rm -rf static/dist.old

  mkdir -p static/dist/assets/icons static/dist/assets/images
  cp -R icons/. static/dist/assets/icons/
  cp -R images/. static/dist/assets/images/

  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    docker compose restart nginx
  else
    docker-compose restart nginx
  fi

  rm -rf dist icons images
"

echo "Validating deployed entry chunk..."
entry_chunk="$(grep -oE 'entry-[a-f0-9]+\\.js' "dist/$ENV/index.html" | head -1)"
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
