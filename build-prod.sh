#!/bin/bash
set -e

apply_env() {
  ENV="$1"

  if [[ "$ENV" != "dev" && "$ENV" != "prod" && "$ENV" != "preprod" ]]; then
    echo "❌ Укажи dev, preprod или prod"
    exit 1
  fi

  if [[ ! -f ".env.$ENV" ]]; then
    echo "❌ Файл .env.$ENV не найден"
    exit 1
  fi

  echo "📦 Применяю .env.$ENV → .env"
  cp ".env.$ENV" .env
}

install_deps() {
  if [[ "${CLEAN:-0}" == "1" ]]; then
    echo "🧹 Чищу зависимости..."
    rm -rf node_modules package-lock.json
  fi
  echo "📦 Устанавливаю зависимости..."
  yarn install --frozen-lockfile || yarn install
}

build_env() {
  ENV="$1"
  DIR="dist/$ENV"
  EXPORT_LOG="/tmp/expo-export-$ENV.log"

  echo "🚀 Сборка для $ENV → $DIR"
  apply_env "$ENV"

  rm -rf "$DIR"

  rm -f "$EXPORT_LOG"
  CI=1 \
  EXPO_NO_INTERACTIVE=1 \
  NODE_ENV=production \
  EXPO_ENV="$ENV" \
  EXPO_NO_METRO_LAZY=true \
  EXPO_WEB_BUILD_MINIFY=true \
  EXPO_WEB_BUILD_GENERATE_SOURCE_MAP=false \
    npx expo export --output-dir "$DIR" -p web -c > "$EXPORT_LOG" 2>&1 &

  EXPO_PID=$!
  EXPORT_MARKER="Exported: $DIR"

  while kill -0 "$EXPO_PID" 2>/dev/null; do
    if grep -Fq "$EXPORT_MARKER" "$EXPORT_LOG"; then
      echo "⚠️ Expo export завис после завершения, завершаю процесс..."
      kill "$EXPO_PID" 2>/dev/null || true
      break
    fi
    sleep 1
  done

  wait "$EXPO_PID" 2>/dev/null || true
  cat "$EXPORT_LOG"

  if [[ ! -f "$DIR/index.html" ]]; then
    echo "❌ Сборка не завершилась: не найден $DIR/index.html"
    exit 1
  fi
}

deploy_prod() {
  ENV="$1"
  rsync -avzhe "ssh" --delete \
    ./dist/ \
    sx3@178.172.137.129:/home/sx3/metravel/dist/

  ssh sx3@178.172.137.129 "set -e
    cd /home/sx3/metravel
    mkdir -p static
    rm -rf static/dist.new
    mv dist/$ENV static/dist.new
    mv static/dist static/dist.old || true
    # Keep previous hashed Expo static assets for a short overlap window.
    # This prevents "Requiring unknown module" crashes for active browser tabs
    # that still execute older runtime chunks during a fresh deploy.
    if [ -d static/dist.old/_expo/static ]; then
      mkdir -p static/dist.new/_expo/static
      # IMPORTANT: never overwrite new build artifacts with old ones.
      # We only backfill files that are missing in the new build so existing
      # tabs can finish loading legacy chunks while fresh navigations keep
      # using the current release.
      rsync -a --ignore-existing static/dist.old/_expo/static/ static/dist.new/_expo/static/
    fi
    # HTML shell still switches atomically to the new build below.
    mv static/dist.new static/dist
    rm -rf static/dist.old
    if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
      docker compose restart app nginx
    else
      docker-compose restart app nginx
    fi
    rm -rf dist
  "

  rm -rf dist
}

ENV="${1:-prod}"
DEPLOY="${DEPLOY:-1}"

echo "🔁 Старт сборки..."
install_deps

build_env "$ENV"

echo "Генерация SEO-страниц..."
node scripts/generate-seo-pages.js --dist "dist/$ENV" --api https://metravel.by || {
  echo "⚠️  SEO-генерация не удалась, продолжаю деплой без неё..."
}

echo "Постобработка билда..."
node scripts/copy-public-files.js "dist/$ENV"

# Ensure required web icon URLs exist in dist even if some files are missing in public/assets/icons.
mkdir -p "dist/$ENV/assets/icons"
for icon in logo_yellow.png logo_yellow_60x60.png logo_yellow_192x192.png logo_yellow_512x512.png apple-touch-icon-180x180.png; do
  if [[ -f "assets/icons/$icon" ]]; then
    cp -f "assets/icons/$icon" "dist/$ENV/assets/icons/$icon"
  fi
done

node scripts/add-cache-bust-meta.js "dist/$ENV"

if [[ "$DEPLOY" == "1" ]]; then
  echo "старт деплоя ..."
  deploy_prod "$ENV"
fi

echo "🎉 Сборка завершена успешно!"
