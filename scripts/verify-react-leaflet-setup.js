#!/usr/bin/env node

/**
 * Скрипт проверки настройки Leaflet/react-leaflet для Expo Web (без CDN).
 *
 * Использование:
 *   node scripts/verify-react-leaflet-setup.js
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

const log = {
  pass: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  fail: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.blue}${msg}${colors.reset}`),
};

const root = path.join(__dirname, '..');
const checks = [];

log.section('1. Проверка зависимостей');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

if (packageJson.dependencies?.['react-leaflet']) {
  log.pass(`react-leaflet установлен: ${packageJson.dependencies['react-leaflet']}`);
  checks.push(true);
} else {
  log.fail('react-leaflet НЕ найден в dependencies');
  checks.push(false);
}

if (packageJson.dependencies?.leaflet) {
  log.pass(`leaflet установлен: ${packageJson.dependencies.leaflet}`);
  checks.push(true);
} else {
  log.fail('leaflet НЕ найден в dependencies');
  checks.push(false);
}

log.section('2. Проверка Metro конфигурации');
const metroConfig = fs.readFileSync(path.join(root, 'metro.config.js'), 'utf8');

// В актуальной схеме: css игнорируем, react-native-maps stub только на web.
const hasCssIgnore = metroConfig.includes("moduleName.endsWith('.css')") && metroConfig.includes('metro-stubs/empty.js');
if (hasCssIgnore) {
  log.pass('CSS игнорируется через metro-stubs/empty.js (OK)');
  checks.push(true);
} else {
  log.warn('Не найдено правило игнора CSS (может сломать leaflet.css импорты, если Metro будет пытаться их грузить)');
  checks.push(true);
}

const hasRnMapsStub = metroConfig.includes("moduleName.startsWith('react-native-maps')") && metroConfig.includes('metro-stubs/react-native-maps.js');
if (hasRnMapsStub) {
  log.pass('react-native-maps застаблен на web (OK)');
  checks.push(true);
} else {
  log.warn('Не найден web-stub для react-native-maps (может ломать web сборку)');
  checks.push(true);
}

// Старые "metro-хаки" должны отсутствовать.
const forbidden = [
  'unstable_enablePackageExports',
  'unstable_conditionNames',
  'experimentalImportSupport',
];
const presentForbidden = forbidden.filter((s) => metroConfig.includes(s));
if (presentForbidden.length === 0) {
  log.pass('Старые unstable/experimental Metro настройки не используются');
  checks.push(true);
} else {
  log.warn(`В metro.config.js найдены спорные настройки: ${presentForbidden.join(', ')}`);
  checks.push(true);
}

log.section('3. Проверка импорта Leaflet CSS');
const layoutWebPath = path.join(root, 'app/_layout.web.tsx');
if (fs.existsSync(layoutWebPath)) {
  const layoutWeb = fs.readFileSync(layoutWebPath, 'utf8');
  if (layoutWeb.includes("leaflet/dist/leaflet.css")) {
    log.pass('app/_layout.web.tsx импортирует leaflet/dist/leaflet.css');
    checks.push(true);
  } else {
    log.fail('app/_layout.web.tsx НЕ импортирует leaflet/dist/leaflet.css');
    checks.push(false);
  }
} else {
  log.warn('app/_layout.web.tsx не найден (пропускаю)');
  checks.push(true);
}

log.section('4. Проверка отсутствия старых stub-ов для leaflet/react-leaflet');
const stubPaths = [
  path.join(root, 'metro-stubs/leaflet.js'),
  path.join(root, 'metro-stubs/react-leaflet.js'),
];
const existingStubs = stubPaths.filter((p) => fs.existsSync(p));
if (existingStubs.length === 0) {
  log.pass('Stub-файлы leaflet/react-leaflet отсутствуют (OK)');
  checks.push(true);
} else {
  log.warn(`Stub-файлы ещё существуют (можно удалить): ${existingStubs.map((p) => path.relative(root, p)).join(', ')}`);
  checks.push(true);
}

log.section('ИТОГИ');
const passed = checks.filter(Boolean).length;
const total = checks.length;
const percentage = Math.round((passed / total) * 100);

if (percentage === 100) {
  log.pass(`Все проверки пройдены! (${passed}/${total})`);
  process.exit(0);
}

if (percentage >= 80) {
  log.warn(`Большинство проверок пройдено (${passed}/${total}, ${percentage}%)`);
  log.info('Рекомендуется устранить предупреждения перед production deployment-ом');
  process.exit(0);
}

log.fail(`Не все проверки пройдены (${passed}/${total}, ${percentage}%)`);
process.exit(1);
