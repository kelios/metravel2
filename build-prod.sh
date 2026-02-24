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

  echo "🚀 Сборка для $ENV → $DIR"
  apply_env "$ENV"

  rm -rf "$DIR"

  NODE_ENV=production \
  EXPO_ENV="$ENV" \
  EXPO_NO_METRO_LAZY=true \
  EXPO_WEB_BUILD_MINIFY=true \
  EXPO_WEB_BUILD_GENERATE_SOURCE_MAP=false \
    npx expo export --output-dir "$DIR" -p web -c
}

deploy_prod() {
  ENV="$1"
  rsync -avzhe "ssh" --delete \
    ./dist/ \
    sx3@178.172.137.129:/home/sx3/metravel/dist/

  rsync -avzhe "ssh" --delete \
    ./assets/icons/ \
    sx3@178.172.137.129:/home/sx3/metravel/icons/

  rsync -avzhe "ssh" --delete \
    ./assets/images/ \
    sx3@178.172.137.129:/home/sx3/metravel/images/

  ssh sx3@178.172.137.129 "set -e
    cd /home/sx3/metravel
    mkdir -p static
    rm -rf static/dist.new
    mv dist/$ENV static/dist.new
    mv static/dist static/dist.old || true
    # IMPORTANT: Do NOT copy old chunks to new build.
    # Old rsync --ignore-existing caused stale chunk issues where browser disk cache
    # held old _layout chunk referencing non-existent CustomHeader chunk.
    # Each deploy should be self-contained with only its own chunks.
    # Old chunks are intentionally NOT preserved to avoid version conflicts.
    mv static/dist.new static/dist
    rm -rf static/dist.old
    mkdir -p static/dist/assets/icons static/dist/assets/images
    cp -R icons/. static/dist/assets/icons/
    cp -R images/. static/dist/assets/images/
    if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
      docker compose restart app nginx
    else
      docker-compose restart app nginx
    fi
    rm -rf dist icons images
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
node scripts/stamp-sw-version.js "dist/$ENV"

if [[ "$DEPLOY" == "1" ]]; then
  echo "старт деплоя ..."
  deploy_prod "$ENV"
fi

echo "🎉 Сборка завершена успешно!"
