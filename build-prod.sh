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

  echo "🚀 Сборка для $ENV → $DIR"
  apply_env $ENV

  echo "🛠️ NODE_ENV=production"
  NODE_ENV=production \
  EXPO_ENV=$ENV \
  EXPO_NO_METRO_LAZY=true \
  EXPO_WEB_BUILD_MINIFY=true \
  EXPO_WEB_BUILD_GENERATE_SOURCE_MAP=false \
    npx expo export --output-dir $DIR -p web -c
}

echo "🔁 Старт полной сборки..."

clean_all

#build_env prod
build_env prod

echo "📂 Общий размер папки dist:"
du -sh dist/

echo "🎉 Сборка завершена успешно!"
