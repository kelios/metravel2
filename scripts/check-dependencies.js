#!/usr/bin/env node

/**
 * Скрипт для проверки установленных зависимостей после исправлений
 * Использование: node scripts/check-dependencies.js
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_DEPENDENCIES = {
  'expo-secure-store': {
    required: true,
    description: 'Безопасное хранение токенов на native платформах',
    install: 'npx expo install expo-secure-store'
  },
  '@react-native-community/netinfo': {
    required: true,
    description: 'Отслеживание статуса сети на native платформах',
    install: 'npx expo install @react-native-community/netinfo'
  }
};

function checkDependencies() {
  console.log('🔍 Проверка зависимостей для исправлений...\n');

  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.error('❌ package.json не найден');
    process.exit(1);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };

  let allInstalled = true;
  const missing = [];
  const installed = [];

  for (const [dep, info] of Object.entries(REQUIRED_DEPENDENCIES)) {
    if (allDependencies[dep]) {
      installed.push({ name: dep, version: allDependencies[dep], ...info });
      console.log(`✅ ${dep} - установлен (${allDependencies[dep]})`);
    } else {
      missing.push({ name: dep, ...info });
      console.log(`❌ ${dep} - НЕ установлен`);
      console.log(`   Описание: ${info.description}`);
      console.log(`   Установка: ${info.install}\n`);
      allInstalled = false;
    }
  }

  console.log('\n' + '='.repeat(60));
  
  if (allInstalled) {
    console.log('✅ Все обязательные зависимости установлены!');
    console.log('\n📋 Следующие шаги:');
    console.log('   1. Очистите кеш: npx expo start --clear');
    console.log('   2. Протестируйте приложение (см. TESTING_CHECKLIST.md)');
    console.log('   3. Разверните в production');
    return 0;
  } else {
    console.log('⚠️  Некоторые зависимости отсутствуют');
    console.log('\n📋 Для установки всех зависимостей выполните:');
    console.log('   npx expo install expo-secure-store @react-native-community/netinfo');
    console.log('\n📖 Подробнее см. INSTALLATION_GUIDE.md');
    return 1;
  }
}

// Запуск проверки
const exitCode = checkDependencies();
process.exit(exitCode);

