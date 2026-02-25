#!/bin/bash
# Скрипт аварийного восстановления web-прода без смешивания старых и новых chunks.
# ВАЖНО: старые chunks НЕ копируются в новый релиз, иначе возможен module/version skew.

set -euo pipefail

SERVER="${SERVER:-sx3@178.172.137.129}"
REMOTE_DIR="${REMOTE_DIR:-/home/sx3/metravel}"
SITE_URL="${SITE_URL:-https://metravel.by}"
ENV="${ENV:-prod}"
FORCE_REBUILD="${FORCE_REBUILD:-1}"

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

chunk_count="$(ls "dist/$ENV/_expo/static/js/web/" | wc -l | tr -d ' ')"
echo "Local build ready: $chunk_count web chunks"

echo "Uploading build payload to server..."
rsync -avzhe "ssh" --delete ./dist/ "$SERVER:$REMOTE_DIR/dist/"
rsync -avzhe "ssh" --delete ./assets/icons/ "$SERVER:$REMOTE_DIR/icons/"
rsync -avzhe "ssh" --delete ./assets/images/ "$SERVER:$REMOTE_DIR/images/"

echo "Applying release atomically on server..."
ssh "$SERVER" "set -euo pipefail
  cd '$REMOTE_DIR'

  test -d dist/$ENV
  mkdir -p static
  rm -rf static/dist.new
  mv dist/$ENV static/dist.new

  # Strict: never mix old/new JS chunks.
  rm -rf static/dist.new/_expo/static/js/web.old
  find static/dist.new/_expo/static/js/web -type f -name '*.js' >/dev/null

  mv static/dist static/dist.old 2>/dev/null || true
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

entry_status="$(curl -sI "$SITE_URL/_expo/static/js/web/$entry_chunk" | head -1 | awk '{print $2}')"
if [ "$entry_status" != "200" ]; then
  echo "ERROR: entry chunk is not available: $entry_chunk (status=$entry_status)"
  exit 1
fi

echo "OK: entry chunk available: $entry_chunk"

echo "Validating runtime chunk linkage..."
tmp_html="$(mktemp)"
tmp_index="$(mktemp)"
tmp_header="$(mktemp)"
curl -sS "$SITE_URL/" > "$tmp_html"
served_index_chunk="$(grep -oE '_expo/static/js/web/index-[a-f0-9]+\\.js' "$tmp_html" | head -1)"
if [ -z "$served_index_chunk" ]; then
  echo "ERROR: cannot detect served index chunk from $SITE_URL/"
  rm -f "$tmp_html" "$tmp_index" "$tmp_header"
  exit 1
fi

curl -sS "$SITE_URL/$served_index_chunk" > "$tmp_index"
served_custom_header_chunk="$(grep -oE '_expo/static/js/web/CustomHeader-[a-f0-9]+\\.js' "$tmp_index" | head -1)"
if [ -z "$served_custom_header_chunk" ]; then
  echo "ERROR: cannot detect served CustomHeader chunk from $served_index_chunk"
  rm -f "$tmp_html" "$tmp_index" "$tmp_header"
  exit 1
fi

curl -sS "$SITE_URL/$served_custom_header_chunk" > "$tmp_header"
if grep -qE "\\.useFilters\\)\\(\\)" "$tmp_header"; then
  echo "ERROR: served CustomHeader chunk still contains direct .useFilters() call:"
  echo "  $served_custom_header_chunk"
  rm -f "$tmp_html" "$tmp_index" "$tmp_header"
  exit 1
fi

rm -f "$tmp_html" "$tmp_index" "$tmp_header"
echo "OK: served CustomHeader chunk is safe: $served_custom_header_chunk"
echo "Done: production web assets replaced without old-chunk carryover."
