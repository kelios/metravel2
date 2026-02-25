#!/bin/bash
# Скрипт аварийного восстановления web-прода без смешивания старых и новых chunks.
# ВАЖНО: старые chunks НЕ копируются в новый релиз, иначе возможен module/version skew.

set -euo pipefail

SERVER="${SERVER:-sx3@178.172.137.129}"
REMOTE_DIR="${REMOTE_DIR:-/home/sx3/metravel}"
SITE_URL="${SITE_URL:-https://metravel.by}"
ENV="${ENV:-prod}"

echo "FIX-PROD: safe web redeploy"
echo "server=$SERVER"
echo "remote_dir=$REMOTE_DIR"
echo "site_url=$SITE_URL"
echo "env=$ENV"
echo

if [ "$ENV" != "prod" ] && [ "$ENV" != "preprod" ] && [ "$ENV" != "dev" ]; then
  echo "ERROR: ENV must be one of: dev | preprod | prod"
  exit 1
fi

if [ ! -d "dist/$ENV/_expo/static/js/web" ]; then
  echo "Local build not found, running npm run build:web:prod ..."
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
echo "Done: production web assets replaced without old-chunk carryover."
