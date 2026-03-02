#!/bin/bash

set -e

function apply_env() {
  ENV=$1

  if [ "$ENV" != "dev" ] && [ "$ENV" != "prod" ] && [ "$ENV" != "preprod" ]; then
    echo "❌ Укажи dev, preprod или prod"
    exit 1
  fi

  echo "📦 Применяю .env.$ENV → .env"
  cp .env.$ENV .env
}

function clean_all() {
  echo "🧹 Чищу проект..."
  rm -rf node_modules yarn.lock package-lock.json dist
  echo "📦 Устанавливаю зависимости..."
  yarn install
}

function build_env() {
  ENV=$1
  DIR="dist/$ENV"
  ARCHIVE="dist/$ENV.tar.gz"
  EXPORT_LOG="/tmp/expo-export-$ENV.log"

  echo "🚀 Сборка для $ENV → $DIR"
  apply_env $ENV

  echo "🛠️ NODE_ENV=production"
  rm -f "$EXPORT_LOG"
  CI=1 \
  EXPO_NO_INTERACTIVE=1 \
  NODE_ENV=production \
  EXPO_ENV=$ENV \
  EXPO_NO_METRO_LAZY=true \
  EXPO_WEB_BUILD_MINIFY=true \
  EXPO_WEB_BUILD_GENERATE_SOURCE_MAP=false \
    npx expo export --output-dir $DIR -p web -c > "$EXPORT_LOG" 2>&1 &

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

  if [ ! -f "$DIR/index.html" ]; then
    echo "❌ Сборка не завершилась: не найден $DIR/index.html"
    exit 1
  fi

  echo "📦 Архивирую $DIR → $ARCHIVE"
  tar -czf "$ARCHIVE" -C dist "$ENV"

  echo "🗑️ Удаляю $DIR"
  rm -rf "$DIR"

  echo "📏 Размер архива:"
  du -sh "$ARCHIVE"
}

echo "🔁 Старт полной сборки..."

clean_all

build_env dev
#build_env preprod
build_env prod

echo "📂 Общий размер папки dist:"
du -sh dist/

echo "🎉 Сборка завершена успешно!"
