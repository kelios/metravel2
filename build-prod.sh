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

clean_all() {
  echo "🧹 Чищу проект..."
  rm -rf node_modules package-lock.json dist
  echo "📦 Устанавливаю зависимости..."
  yarn install --frozen-lockfile || yarn install
}

build_env() {
  ENV="$1"
  DIR="dist/$ENV"

  echo "🚀 Сборка для $ENV → $DIR"
  apply_env "$ENV"

  NODE_ENV=production \
  EXPO_ENV="$ENV" \
  EXPO_NO_METRO_LAZY=true \
  EXPO_WEB_BUILD_MINIFY=true \
  EXPO_WEB_BUILD_GENERATE_SOURCE_MAP=false \
    npx expo export --output-dir "$DIR" -p web -c
}

deploy_prod() {
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
    mv dist/prod static/dist.new
    mv static/dist static/dist.old || true
    mv static/dist.new static/dist
    rm -rf static/dist.old
    mkdir -p static/dist/assets/icons static/dist/assets/images
    cp -R icons/. static/dist/assets/icons/
    cp -R images/. static/dist/assets/images/
    docker-compose restart app nginx
    rm -rf dist icons images
  "

  rm -rf dist
}

echo "🔁 Старт полной сборки..."
clean_all

build_env prod

echo "🔍 Генерация SEO-страниц..."
node scripts/generate-seo-pages.js --dist dist/prod --api https://metravel.by || {
  echo "⚠️  SEO-генерация не удалась, продолжаю деплой без неё..."
}

echo "� Постобработка билда..."
node scripts/postprocess-rnw-styles.js dist/prod
node scripts/stamp-sw-version.js dist/prod

echo "�🔁 Старт деплоя ..."
deploy_prod

echo "🎉 Сборка завершена успешно!"
