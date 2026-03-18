#!/bin/bash

# Строгий режим
set -Eeuo pipefail
IFS=$'\n\t'

function apply_env() {
  local ENV="$1"

  if [ "$ENV" != "dev" ] && [ "$ENV" != "prod" ] && [ "$ENV" != "preprod" ]; then
    echo "❌ Укажи dev, preprod или prod"
    exit 1
  fi

  if [ ! -f ".env.$ENV" ]; then
    echo "❌ Файл .env.$ENV не найден"
    exit 1
  fi

  echo "📦 Применяю .env.$ENV → .env"
  cp ".env.$ENV" .env
}

function clean_all() {
  echo "🧹 Чищу проект..."
  rm -rf node_modules dist || true
  echo "📦 Устанавливаю зависимости..."
  if command -v yarn >/dev/null 2>&1; then
    yarn install --frozen-lockfile || yarn install
  else
    npm install
  fi
}

function build_env() {
  local ENV="$1"
  local DIR="dist/$ENV"
  local EXPORT_LOG
  EXPORT_LOG="$(mktemp "/tmp/expo-export-${ENV}.XXXX.log")"
  trap 'rm -f "${EXPORT_LOG}"' EXIT

  echo "🚀 Сборка для $ENV → $DIR"
  apply_env "$ENV"

  echo "🛠️ NODE_ENV=dev"
  CI=1 \
  EXPO_NO_INTERACTIVE=1 \
  NODE_ENV=dev \
  EXPO_ENV=$ENV \
  EXPO_NO_METRO_LAZY=true \
  EXPO_WEB_BUILD_MINIFY=true \
  EXPO_WEB_BUILD_GENERATE_SOURCE_MAP=false \
    npx expo export --output-dir "$DIR" -p web -c > "$EXPORT_LOG" 2>&1 &

  local EXPO_PID=$!
  local EXPORT_MARKER="Exported: $DIR"

  while kill -0 "$EXPO_PID" 2>/dev/null; do
    if grep -Fq "$EXPORT_MARKER" "$EXPORT_LOG"; then
      echo "⚠️ Expo export завис после завершения, завершаю процесс..."
      kill "$EXPO_PID" 2>/dev/null || true
      break
    fi
    sleep 1
  done

  wait "$EXPO_PID" 2>/dev/null || true
  cat "$EXPORT_LOG" || true

  if [ ! -f "$DIR/index.html" ]; then
    echo "❌ Сборка не завершилась: не найден $DIR/index.html"
    exit 1
  fi

}

function deploy_dev() {
  rsync -avzhe "ssh" --delete \
    ./dist/ \
    "sergey@192.168.50.36:/home/sergey/metravel/dist/"

  ssh sergey@192.168.50.36 "set -e
    cd /home/sergey/metravel
    rm -rf static/dist
    mv dist/dev static/dist
    if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
      docker compose restart app nginx
    else
      docker-compose restart app nginx
    fi
    rm -rf dist
  "
  rm -rf dist
}

DEPLOY="${DEPLOY:-1}"

echo "🔁 Старт полной сборки..."

clean_all

build_env dev
if [ "$DEPLOY" = "1" ]; then
  echo "🔁 Старт деплоя ..."
  deploy_dev
fi


echo "🎉 Сборка завершена успешно!"
