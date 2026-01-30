#!/usr/bin/env node

/**
 * Быстрая проверка настройки Leaflet/react-leaflet для Expo Web (без CDN).
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

console.log('\n📋 Проверка Leaflet/react-leaflet (Metro, без CDN)\n');

// 1) dependencies
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const deps = packageJson.dependencies || {};

const hasLeaflet = Boolean(deps.leaflet);
const hasReactLeaflet = Boolean(deps['react-leaflet']);

console.log(`${hasReactLeaflet ? '✓' : '✗'} react-leaflet установлен: ${deps['react-leaflet'] || 'нет'}`);
console.log(`${hasLeaflet ? '✓' : '✗'} leaflet установлен: ${deps.leaflet || 'нет'}`);

// 2) metro.config.js sanity
const metroConfig = fs.readFileSync(path.join(root, 'metro.config.js'), 'utf8');
const hasCssIgnore = metroConfig.includes("moduleName.endsWith('.css')") && metroConfig.includes('metro-stubs/empty.js');
const hasRnMapsStub = metroConfig.includes("moduleName.startsWith('react-native-maps')") && metroConfig.includes('metro-stubs/react-native-maps.js');

console.log(`${hasCssIgnore ? '✓' : '⚠'} Metro: игнор CSS (.css -> empty stub): ${hasCssIgnore ? 'OK' : 'не найдено'}`);
console.log(`${hasRnMapsStub ? '✓' : '⚠'} Metro: react-native-maps stub только для web: ${hasRnMapsStub ? 'OK' : 'не найдено'}`);

// 3) Leaflet CSS import
const layoutWebPath = path.join(root, 'app/_layout.web.tsx');
if (fs.existsSync(layoutWebPath)) {
  const layoutWeb = fs.readFileSync(layoutWebPath, 'utf8');
  const hasLeafletCssImport = layoutWeb.includes("leaflet/dist/leaflet.css");
  console.log(`${hasLeafletCssImport ? '✓' : '✗'} app/_layout.web.tsx импортирует leaflet CSS`);
} else {
  console.log('⚠ app/_layout.web.tsx не найден (пропускаю проверку CSS импорта)');
}

const ok = hasLeaflet && hasReactLeaflet;

console.log('\n' + (ok ? '✅ Базовая настройка выглядит корректно.' : '❌ Не хватает зависимостей (leaflet/react-leaflet).'));
console.log('Запуск: yarn web\n');
process.exit(ok ? 0 : 1);
