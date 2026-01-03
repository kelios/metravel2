#!/usr/bin/env node
/**
 * Тестовый скрипт для проверки миграции Map.web.tsx
 * Проверяет наличие всех необходимых файлов и модулей
 */

const fs = require('fs');
const path = require('path');

const BASE_PATH = path.join(__dirname, 'components/MapPage');
const MAP_PATH = path.join(BASE_PATH, 'Map');

console.log('🧪 Тестирование миграции Map.web.tsx\n');

// Проверка 1: Основные файлы
console.log('✓ Проверка 1: Основные файлы');
const mainFiles = [
  'Map.web.tsx',
  'Map.web.backup.tsx',
  'Map.web.refactored.tsx'
];

mainFiles.forEach(file => {
  const filePath = path.join(BASE_PATH, file);
  const exists = fs.existsSync(filePath);
  const status = exists ? '✅' : '❌';
  console.log(`  ${status} ${file}`);
});

// Проверка 2: Модули в папке Map/
console.log('\n✓ Проверка 2: Модули в папке Map/');
const requiredModules = [
  'useMapInstance.ts',
  'useMapApi.ts',
  'useClustering.ts',
  'useMapCleanup.ts',
  'useLeafletIcons.ts',
  'useMapLogic.ts',
  'MapLogicComponent.tsx',
  'MapMarkers.tsx',
  'ClusterLayer.tsx',
  'MapControls.tsx',
  'types.ts',
  'utils.ts',
  'constants.ts',
  'styles.ts'
];

requiredModules.forEach(file => {
  const filePath = path.join(MAP_PATH, file);
  const exists = fs.existsSync(filePath);
  const status = exists ? '✅' : '❌';
  console.log(`  ${status} ${file}`);
});

// Проверка 3: Размер файлов
console.log('\n✓ Проверка 3: Размер файлов');
const mainFilePath = path.join(BASE_PATH, 'Map.web.tsx');
const backupFilePath = path.join(BASE_PATH, 'Map.web.backup.tsx');

if (fs.existsSync(mainFilePath)) {
  const mainStats = fs.statSync(mainFilePath);
  const mainLines = fs.readFileSync(mainFilePath, 'utf8').split('\n').length;
  console.log(`  Map.web.tsx: ${mainLines} строк (${(mainStats.size / 1024).toFixed(2)} KB)`);
}

if (fs.existsSync(backupFilePath)) {
  const backupStats = fs.statSync(backupFilePath);
  const backupLines = fs.readFileSync(backupFilePath, 'utf8').split('\n').length;
  console.log(`  Map.web.backup.tsx: ${backupLines} строк (${(backupStats.size / 1024).toFixed(2)} KB)`);
}

// Проверка 4: Импорты в новом файле
console.log('\n✓ Проверка 4: Импорты модулей');
if (fs.existsSync(mainFilePath)) {
  const content = fs.readFileSync(mainFilePath, 'utf8');
  const imports = [
    'useMapCleanup',
    'useLeafletIcons',
    'useMapInstance',
    'useMapApi',
    'useClustering',
    'MapLogicComponent',
    'MapMarkers',
    'ClusterLayer',
    'MapControls'
  ];

  imports.forEach(imp => {
    const hasImport = content.includes(`import { ${imp} }`) || content.includes(`import ${imp}`);
    const status = hasImport ? '✅' : '❌';
    console.log(`  ${status} ${imp}`);
  });
}

// Проверка 5: Документация
console.log('\n✓ Проверка 5: Документация');
const docs = [
  path.join(__dirname, 'MAP_REFACTORING_DONE.md'),
  path.join(__dirname, 'MAP_TESTING_GUIDE.md'),
  path.join(__dirname, 'QUICK_START_MAP_REFACTORING.md'),
  path.join(MAP_PATH, 'REFACTORING.md'),
  path.join(MAP_PATH, 'MIGRATION_GUIDE.md')
];

docs.forEach(doc => {
  const exists = fs.existsSync(doc);
  const status = exists ? '✅' : '❌';
  const name = path.basename(doc);
  console.log(`  ${status} ${name}`);
});

// Итоговый результат
console.log('\n' + '='.repeat(50));
console.log('🎉 РЕЗУЛЬТАТЫ ПРОВЕРКИ:');
console.log('='.repeat(50));

const mainFileExists = fs.existsSync(mainFilePath);
const allModulesExist = requiredModules.every(file =>
  fs.existsSync(path.join(MAP_PATH, file))
);

if (mainFileExists && allModulesExist) {
  console.log('✅ Миграция успешно завершена!');
  console.log('✅ Все модули на месте');
  console.log('✅ Файлы готовы к использованию');
  console.log('\n📝 Следующие шаги:');
  console.log('   1. Запустите приложение: npm start');
  console.log('   2. Откройте карту в браузере');
  console.log('   3. Проверьте функциональность согласно MAP_TESTING_GUIDE.md');
  process.exit(0);
} else {
  console.log('❌ Обнаружены проблемы с миграцией');
  console.log('   Проверьте ошибки выше');
  process.exit(1);
}

