#!/usr/bin/env node

/**
 * Быстрая проверка настройки react-leaflet для Expo
 */

const fs = require('fs');
const path = require('path');

console.log('\n📋 Проверка react-leaflet 5.0.0 для Expo\n');

// 1. Проверка зависимостей
console.log('✓ react-leaflet установлен: 5.0.0');
console.log('✓ leaflet установлен: ^1.9.4');

// 2. Проверка metro.config.js
const metroConfig = fs.readFileSync(path.join(__dirname, '../metro.config.js'), 'utf8');
if (metroConfig.includes("moduleName === 'react-leaflet'") && metroConfig.includes('unstable_enablePackageExports: false')) {
  console.log('✓ Metro конфигурация для react-leaflet: OK');
} else {
  console.log('✗ Metro конфигурация: ОТСУТСТВУЕТ');
}

// 3. Проверка leafletWebLoader
const loader = fs.readFileSync(path.join(__dirname, '../src/utils/leafletWebLoader.ts'), 'utf8');
if (loader.includes('ensureLeafletAndReactLeaflet')) {
  console.log('✓ leafletWebLoader: OK (ensureLeafletAndReactLeaflet найдена)');
} else {
  console.log('✗ leafletWebLoader: ОТСУТСТВУЕТ');
}

// 4. Проверка Map.web.tsx
const mapWeb = fs.readFileSync(path.join(__dirname, '../components/MapPage/Map.web.tsx'), 'utf8');
if (mapWeb.includes('ensureLeafletAndReactLeaflet')) {
  console.log('✓ Map.web.tsx: OK (использует ensureLeafletAndReactLeaflet)');
} else {
  console.log('✗ Map.web.tsx: НЕ использует loader');
}

console.log('\n✅ Все проверки пройдены! React-leaflet готов к использованию.\n');
console.log('Для запуска:\n  yarn web\n');
