#!/bin/bash
# Скрипт для гарантированного восстановления прода
# Запускать один раз когда прод сломан, потом можно использовать обычный build-prod.sh

set -e

SERVER="sx3@178.172.137.129"
REMOTE_DIR="/home/sx3/metravel"

echo "🔧 FIX-PROD: Гарантированное восстановление продакшена"
echo "=================================================="

# 1. Проверяем что локальный билд существует
if [ ! -d "dist/prod/_expo/static/js/web" ]; then
  echo "📦 Локальный билд не найден, собираю..."
  npm run build:web:prod
fi

CHUNK_COUNT=$(ls dist/prod/_expo/static/js/web/ | wc -l | tr -d ' ')
echo "✅ Локальный билд готов: $CHUNK_COUNT JS chunks"

# 2. Полностью удаляем старый dist на сервере и загружаем новый
echo ""
echo "🚀 Загружаю билд на сервер..."
rsync -avzhe "ssh" --delete \
  ./dist/ \
  $SERVER:$REMOTE_DIR/dist/

echo ""
echo "🔄 Применяю билд на сервере..."
ssh $SERVER "set -e
  cd $REMOTE_DIR
  
  # Сохраняем старые JS chunks для grace period
  rm -rf static/dist.old static/dist.new
  mkdir -p static
  mv dist/prod static/dist.new
  
  # Копируем старые JS chunks в новый билд (для пользователей с закэшированными старыми chunks)
  if [ -d static/dist/_expo/static/js/web ]; then
    mkdir -p static/dist.new/_expo/static/js/web
    cp -n static/dist/_expo/static/js/web/*.js static/dist.new/_expo/static/js/web/ 2>/dev/null || true
  fi
  
  # Заменяем старый билд новым
  mv static/dist static/dist.old 2>/dev/null || true
  mv static/dist.new static/dist
  rm -rf static/dist.old
  
  # Копируем иконки и изображения
  mkdir -p static/dist/assets/icons static/dist/assets/images
  if [ -d icons ]; then cp -R icons/. static/dist/assets/icons/; fi
  if [ -d images ]; then cp -R images/. static/dist/assets/images/; fi
  
  # Перезапускаем nginx
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    docker compose restart nginx
  else
    docker-compose restart nginx
  fi
  
  # Очищаем временные файлы
  rm -rf dist icons images
  
  echo '✅ Сервер обновлён'
"

echo ""
echo "🧪 Проверяю что chunks доступны..."
ENTRY_CHUNK=$(cat dist/prod/index.html | grep -oE 'entry-[a-f0-9]+\.js' | head -1)
STATUS=$(curl -sI "https://metravel.by/_expo/static/js/web/$ENTRY_CHUNK" | head -1 | awk '{print $2}')

if [ "$STATUS" = "200" ]; then
  echo "✅ Entry chunk доступен: $ENTRY_CHUNK"
  echo ""
  echo "🎉 ПРОД ВОССТАНОВЛЕН!"
  echo "   Теперь можно использовать обычный ./build-prod.sh"
else
  echo "❌ Entry chunk недоступен (статус: $STATUS)"
  echo "   Проверь nginx конфигурацию на сервере"
  exit 1
fi
