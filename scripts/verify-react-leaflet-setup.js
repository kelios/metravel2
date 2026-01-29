#!/usr/bin/env node

/**
 * Скрипт проверки react-leaflet настройки для Expo
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

const checks = [];

// Проверка 1: react-leaflet в package.json
log.section('1. Проверка зависимостей');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

if (packageJson.dependencies['react-leaflet']) {
  const version = packageJson.dependencies['react-leaflet'];
  if (version.includes('5.0.0') || version.startsWith('5.')) {
    log.pass(`react-leaflet установлен: ${version}`);
    checks.push(true);
  } else {
    log.warn(`react-leaflet версия ${version} (рекомендуется 5.0.0)`);
    checks.push(true);
  }
} else {
  log.fail('react-leaflet НЕ найден в dependencies');
  checks.push(false);
}

if (packageJson.dependencies['leaflet']) {
  const version = packageJson.dependencies['leaflet'];
  log.pass(`leaflet установлен: ${version}`);
  checks.push(true);
} else {
  log.fail('leaflet НЕ найден в dependencies');
  checks.push(false);
}

// Проверка 2: metro.config.js конфигурация
log.section('2. Проверка Metro конфигурации');
const metroConfig = fs.readFileSync(path.join(__dirname, '../metro.config.js'), 'utf8');

const hasReactLeafletConfig = metroConfig.includes("moduleName === 'react-leaflet'") &&
                              metroConfig.includes('unstable_enablePackageExports: false');
if (hasReactLeafletConfig) {
  log.pass('Конфигурация для react-leaflet найдена');
  checks.push(true);
} else {
  log.fail('Конфигурация для react-leaflet НЕ найдена');
  log.info('Необходимо добавить в metro.config.js:');
  console.log(`
  if (isWeb && (moduleName === 'react-leaflet' || moduleName.startsWith('react-leaflet/'))) {
    return context.resolveRequest(
      {
        ...context,
        unstable_enablePackageExports: false,
      },
      moduleName,
      platform,
    );
  }
  `);
  checks.push(false);
}

const hasReactLeafletCoreConfig = metroConfig.includes("moduleName === '@react-leaflet/core'") &&
                                  metroConfig.includes('unstable_enablePackageExports: false');
if (hasReactLeafletCoreConfig) {
  log.pass('Конфигурация для @react-leaflet/core найдена');
  checks.push(true);
} else {
  log.warn('Конфигурация для @react-leaflet/core НЕ найдена (опционально)');
  checks.push(true);
}

// Проверка 3: leafletWebLoader
log.section('3. Проверка leafletWebLoader');
const loaderPath = path.join(__dirname, '../src/utils/leafletWebLoader.ts');
if (fs.existsSync(loaderPath)) {
  const loader = fs.readFileSync(loaderPath, 'utf8');

  if (loader.includes('ensureLeaflet')) {
    log.pass('ensureLeaflet функция найдена');
    checks.push(true);
  } else {
    log.fail('ensureLeaflet функция НЕ найдена');
    checks.push(false);
  }

  if (loader.includes('ensureReactLeaflet')) {
    log.pass('ensureReactLeaflet функция найдена');
    checks.push(true);
  } else {
    log.fail('ensureReactLeaflet функция НЕ найдена');
    checks.push(false);
  }

  if (loader.includes('ensureLeafletAndReactLeaflet')) {
    log.pass('ensureLeafletAndReactLeaflet функция найдена');
    checks.push(true);
  } else {
    log.fail('ensureLeafletAndReactLeaflet функция НЕ найдена');
    checks.push(false);
  }
} else {
  log.fail(`Файл ${loaderPath} НЕ найден`);
  checks.push(false);
}

// Проверка 4: Использование в компонентах
log.section('4. Проверка использования в компонентах');
const mapWebPath = path.join(__dirname, '../components/MapPage/Map.web.tsx');
if (fs.existsSync(mapWebPath)) {
  const mapWeb = fs.readFileSync(mapWebPath, 'utf8');

  if (mapWeb.includes('ensureLeafletAndReactLeaflet')) {
    log.pass('Map.web.tsx использует ensureLeafletAndReactLeaflet');
    checks.push(true);
  } else {
    log.warn('Map.web.tsx НЕ использует ensureLeafletAndReactLeaflet');
    checks.push(true);
  }
} else {
  log.fail(`Файл ${mapWebPath} НЕ найден`);
  checks.push(false);
}

// Проверка 5: TypeScript конфигурация
log.section('5. Проверка TypeScript конфигурации');
const tsconfigPath = path.join(__dirname, '../tsconfig.json');
if (fs.existsSync(tsconfigPath)) {
  try {
    // tsconfig может содержать комментарии, используем простую проверку текста
    const tsconfigText = fs.readFileSync(tsconfigPath, 'utf8');
    if (tsconfigText.includes('compilerOptions')) {
      log.pass('TypeScript конфигурация найдена');
      checks.push(true);
    } else {
      log.warn('TypeScript конфигурация может быть неполной');
      checks.push(true);
    }
  } catch {
    log.warn('Не удалось прочитать TypeScript конфигурацию');
    checks.push(true);
  }
} else {
  log.fail(`Файл ${tsconfigPath} НЕ найден`);
  checks.push(false);
}

// Итоги
log.section('ИТОГИ');
const passed = checks.filter(Boolean).length;
const total = checks.length;
const percentage = Math.round((passed / total) * 100);

if (percentage === 100) {
  log.pass(`Все проверки пройдены! (${passed}/${total})`);
  process.exit(0);
} else if (percentage >= 80) {
  log.warn(`Большинство проверок пройдено (${passed}/${total}, ${percentage}%)`);
  log.info('Рекомендуется устранить предупреждения перед production deploymentом');
  process.exit(0);
} else {
  log.fail(`Не все проверки пройдены (${passed}/${total}, ${percentage}%)`);
  log.info('Обратитесь к docs/REACT_LEAFLET_EXPO_SETUP.md для помощи');
  process.exit(1);
}
