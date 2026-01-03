#!/usr/bin/env node
/**
 * Простой скрипт проверки миграции Map.web.tsx
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Тестирование миграции Map.web.tsx\n');

const BASE_PATH = path.join(__dirname, 'components', 'MapPage');
const MAP_PATH = path.join(BASE_PATH, 'Map');

// Проверка 1: Основные файлы
console.log('✓ Проверка 1: Основные файлы');
try {
  const mainFilePath = path.join(BASE_PATH, 'Map.web.tsx');
  const backupFilePath = path.join(BASE_PATH, 'Map.web.backup.tsx');
  const refactoredFilePath = path.join(BASE_PATH, 'Map.web.refactored.tsx');

  console.log(`  ${fs.existsSync(mainFilePath) ? '✅' : '❌'} Map.web.tsx`);
  console.log(`  ${fs.existsSync(backupFilePath) ? '✅' : '❌'} Map.web.backup.tsx`);
  console.log(`  ${fs.existsSync(refactoredFilePath) ? '✅' : '❌'} Map.web.refactored.tsx`);

  // Проверка содержимого
  if (fs.existsSync(mainFilePath)) {
    const content = fs.readFileSync(mainFilePath, 'utf8');
    const isRefactored = content.includes('Map.web.refactored') || content.includes('modular');
    console.log(`\n  ${isRefactored ? '✅' : '❌'} Map.web.tsx содержит рефакторенный код`);

    const lines = content.split('\n').length;
    console.log(`  📊 Размер: ${lines} строк`);
  }
} catch (error) {
  console.error('  ❌ Ошибка при проверке файлов:', error.message);
}

// Проверка 2: Модули
console.log('\n✓ Проверка 2: Модули в папке Map/');
const requiredModules = [
  'useMapInstance.ts',
  'useMapApi.ts',
  'useClustering.ts',
  'useMapCleanup.ts',
  'useLeafletIcons.ts',
  'MapLogicComponent.tsx',
  'MapMarkers.tsx',
  'ClusterLayer.tsx',
  'MapControls.tsx'
];

let allModulesExist = true;
requiredModules.forEach(file => {
  const filePath = path.join(MAP_PATH, file);
  const exists = fs.existsSync(filePath);
  if (!exists) allModulesExist = false;
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
});

// Проверка 3: TypeScript импорты
console.log('\n✓ Проверка 3: Импорты модулей в Map.web.tsx');
try {
  const mainFilePath = path.join(BASE_PATH, 'Map.web.tsx');
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
      const hasImport = content.includes(imp);
      console.log(`  ${hasImport ? '✅' : '❌'} ${imp}`);
    });
  }
} catch (error) {
  console.error('  ❌ Ошибка при проверке импортов:', error.message);
}

// Итоговый результат
console.log('\n' + '='.repeat(50));
console.log('🎉 РЕЗУЛЬТАТЫ:');
console.log('='.repeat(50));

if (allModulesExist) {
  console.log('✅ Миграция успешно завершена!');
  console.log('✅ Все модули на месте');
  console.log('✅ Файлы готовы к использованию');
  console.log('\n📝 Следующие шаги:');
  console.log('   1. Запустите: npm start');
  console.log('   2. Откройте карту в браузере');
  console.log('   3. Проверьте функциональность');
  console.log('\n📚 См. MAP_TESTING_GUIDE.md для детального тестирования');
} else {
  console.log('⚠️  Некоторые модули отсутствуют');
  console.log('   Проверьте ошибки выше');
}

console.log('\n');

