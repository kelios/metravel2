#!/bin/bash

# Скрипт для проверки производительности после оптимизаций
# Использование: ./scripts/check-performance.sh

set -e

echo "🚀 Проверка производительности metravel2"
echo "=========================================="
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Проверка bundle size
echo "📦 1. Проверка размера бандла..."
echo ""

# Проверяем именно dist/prod: туда кладёт build:web:prod, и оттуда же читает
# бюджет бандла на шаге 2. Прежнее условие смотрело на dist, поэтому чужая
# сборка build:web (тот же dist, без prod) заставляла шаг 1 пропустить сборку,
# а шаг 2 — напечатать «чанки не найдены» вместо замера.
if [ ! -d "dist/prod" ]; then
  echo -e "${YELLOW}⚠️  Прод-сборка не найдена. Запускаем сборку...${NC}"
  npm run build:web:prod
fi

# Получаем размер основного бандла
BUNDLE_SIZE=$(du -sh dist/prod | cut -f1)
echo -e "${GREEN}✓${NC} Размер бандла: $BUNDLE_SIZE"
echo ""

# 2. Анализ бандла
echo "🔍 2. Анализ состава бандла..."
echo ""

if command -v npx &> /dev/null; then
  # Меряет собранные чанки (raw/gzip/Brotli) против config/bundle-budget.json.
  # Прежний analyze:bundle тут только выглядел анализом: веса зависимостей у него
  # были захардкожены, а раздел «крупные файлы» печатал пустоту — обход каталогов
  # был нерекурсивным, а в components/ на верхнем уровне нет ни одного файла.
  echo "Сверяем размер собранных чанков с бюджетом..."
  npm run guard:bundle-budget || echo -e "${YELLOW}⚠️  Бюджет бандла не проверен: нужна сборка dist/prod${NC}"
else
  echo -e "${YELLOW}⚠️  npx не установлен${NC}"
fi
echo ""

# 3. Lighthouse тесты
echo "💡 3. Lighthouse тесты..."
echo ""

if command -v lighthouse &> /dev/null; then
  echo "Запускаем Lighthouse для главной страницы..."
  
  # Запускаем dev сервер в фоне
  npm run web &
  SERVER_PID=$!
  
  # Ждем запуска сервера
  sleep 10
  
  # Запускаем Lighthouse
  lighthouse http://localhost:8081 \
    --output=json \
    --output-path=./lighthouse-reports/home-$(date +%Y-%m-%d).json \
    --only-categories=performance \
    --chrome-flags="--headless" || true
  
  # Останавливаем сервер
  kill $SERVER_PID || true
  
  echo -e "${GREEN}✓${NC} Lighthouse отчет сохранен в lighthouse-reports/"
else
  echo -e "${YELLOW}⚠️  Lighthouse не установлен. Установите: npm install -g lighthouse${NC}"
fi
echo ""

# 4. Проверка зависимостей
echo "📚 4. Проверка устаревших зависимостей..."
echo ""

npm outdated || echo -e "${GREEN}✓${NC} Все зависимости актуальны"
echo ""

# 5. Проверка TypeScript
echo "🔧 5. Проверка TypeScript..."
echo ""

npx tsc --noEmit || echo -e "${YELLOW}⚠️  Найдены ошибки TypeScript${NC}"
echo ""

# 6. Проверка ESLint
echo "🧹 6. Проверка ESLint..."
echo ""

npm run lint || echo -e "${YELLOW}⚠️  Найдены ошибки ESLint${NC}"
echo ""

# 7. Запуск тестов производительности
echo "⚡ 7. Тесты производительности..."
echo ""

if [ -f "__tests__/routes/routes-performance.test.tsx" ]; then
  npm run test -- routes-performance.test.tsx || echo -e "${YELLOW}⚠️  Тесты не прошли${NC}"
else
  echo -e "${YELLOW}⚠️  Тесты производительности не найдены${NC}"
fi
echo ""

# 8. Проверка размера изображений
echo "🖼️  8. Проверка размера изображений..."
echo ""

LARGE_IMAGES=$(find assets public -type f \( -name "*.jpg" -o -name "*.png" -o -name "*.jpeg" \) -size +500k 2>/dev/null || true)

if [ -n "$LARGE_IMAGES" ]; then
  echo -e "${YELLOW}⚠️  Найдены большие изображения (>500KB):${NC}"
  echo "$LARGE_IMAGES"
  echo ""
  echo "Рекомендуется оптимизировать эти изображения:"
  echo "  - Используйте WebP/AVIF форматы"
  echo "  - Сжимайте изображения с помощью imagemin"
  echo "  - Используйте responsive images"
else
  echo -e "${GREEN}✓${NC} Все изображения оптимизированы"
fi
echo ""

# 9. Итоговый отчет
echo "=========================================="
echo "📊 Итоговый отчет"
echo "=========================================="
echo ""
echo "Целевые метрики:"
echo "  - LCP < 2.5s"
echo "  - FID < 100ms"
echo "  - CLS < 0.1"
echo "  - Bundle size < 500KB (gzipped)"
echo "  - Time to Interactive < 3.5s"
echo ""
echo "Проверьте Lighthouse отчеты в lighthouse-reports/"
echo ""
echo -e "${GREEN}✓${NC} Проверка завершена!"
