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

  echo "🛠️ NODE_ENV=dev"
  NODE_ENV=dev \
  EXPO_ENV=$ENV \
  EXPO_NO_METRO_LAZY=true \
  EXPO_WEB_BUILD_MINIFY=true \
  EXPO_WEB_BUILD_GENERATE_SOURCE_MAP=false \
    npx expo export --output-dir $DIR -p web -c

}

function deploy_dev() {
  rsync -avzhe "ssh" --delete \
    ./dist/ \
    sergey@192.168.50.36:/home/sergey/metravel/dist/

  rsync -avzhe "ssh" --delete \
    ./assets/icons/ \
    sergey@192.168.50.36:/home/sergey/metravel/icons/

  rsync -avzhe "ssh" --delete \
    ./assets/images/ \
    sergey@192.168.50.36:/home/sergey/metravel/images/

  ssh sergey@192.168.50.36 "set -e
    cd /home/sergey/metravel
    rm -rf static/dist
    mv dist/dev static/dist
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

build_env dev
echo "🔁 Старт деплоя ..."
deploy_dev


echo "🎉 Сборка завершена успешно!"
