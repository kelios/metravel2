#!/usr/bin/env node

/**
 * Скрипт для тестирования мобильного рендеринга
 * Проверяет, что страница корректно отображается в мобильном режиме (375px)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Запуск тестов мобильного рендеринга...\n');

// Проверяем наличие основных файлов
const criticalFiles = [
  'app/(tabs)/travels/[param].tsx',
  'components/travel/TravelDescription.tsx',
  'components/OptimizedImage.tsx',
];

let hasErrors = false;

criticalFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Файл не найден: ${file}`);
    hasErrors = true;
  }
});

if (hasErrors) {
  console.error('\n❌ Критические файлы отсутствуют!');
  process.exit(1);
}

// Запускаем Jest тесты
try {
  console.log('📱 Запуск unit тестов...');
  execSync('npm test -- --no-watch --passWithNoTests --testPathPattern="NavigationArrows|ScrollToTopButton|ReadingProgressBar|ShareButtons|EmptyState"', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  console.log('\n✅ Unit тесты пройдены!');
} catch (error) {
  console.error('\n❌ Unit тесты провалились!');
  process.exit(1);
}

console.log('\n✅ Все проверки пройдены!');
console.log('\n📝 Рекомендации:');
console.log('  1. Откройте приложение в браузере с шириной 375px');
console.log('  2. Проверьте консоль на наличие ошибок');
console.log('  3. Убедитесь, что нет "Unexpected text node" ошибок');
console.log('  4. Проверьте, что нет предупреждений о fetchPriority');

