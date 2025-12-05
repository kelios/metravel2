#!/usr/bin/env node

/**
 * Скрипт для автоматической замены hardcoded цветов на DESIGN_TOKENS
 * 
 * Использование:
 * node scripts/fix-hardcoded-colors.js [--dry-run] [--file=path/to/file.tsx]
 * 
 * Флаги:
 * --dry-run - показать изменения без применения
 * --file - обработать конкретный файл
 * --dir - обработать конкретную директорию
 */

const fs = require('fs');
const path = require('path');

// Карта замен hardcoded цветов на DESIGN_TOKENS
const COLOR_REPLACEMENTS = {
  // Белый
  "'#fff'": "DESIGN_TOKENS.colors.surface",
  '"#fff"': "DESIGN_TOKENS.colors.surface",
  "'#ffffff'": "DESIGN_TOKENS.colors.surface",
  '"#ffffff"': "DESIGN_TOKENS.colors.surface",
  "'#FFF'": "DESIGN_TOKENS.colors.surface",
  '"#FFF"': "DESIGN_TOKENS.colors.surface",
  "'#FFFFFF'": "DESIGN_TOKENS.colors.surface",
  '"#FFFFFF"': "DESIGN_TOKENS.colors.surface",
  
  // Черный
  "'#000'": "DESIGN_TOKENS.colors.text",
  '"#000"': "DESIGN_TOKENS.colors.text",
  "'#000000'": "DESIGN_TOKENS.colors.text",
  '"#000000"': "DESIGN_TOKENS.colors.text",
  
  // Старый оранжевый primary
  "'#ff9f5a'": "DESIGN_TOKENS.colors.primary",
  '"#ff9f5a"': "DESIGN_TOKENS.colors.primary",
  "'#FF9F5A'": "DESIGN_TOKENS.colors.primary",
  '"#FF9F5A"': "DESIGN_TOKENS.colors.primary",
  
  // Прозрачность
  "'transparent'": "DESIGN_TOKENS.colors.transparent",
  '"transparent"': "DESIGN_TOKENS.colors.transparent",
};

// Паттерны для поиска в shadowColor
const SHADOW_COLOR_PATTERN = /shadowColor:\s*['"]#000['"]/g;
const SHADOW_COLOR_REPLACEMENT = "shadowColor: DESIGN_TOKENS.colors.text";

// Паттерны для backgroundColor
const BG_COLOR_PATTERN = /backgroundColor:\s*['"]#fff['"]/gi;
const BG_COLOR_REPLACEMENT = "backgroundColor: DESIGN_TOKENS.colors.surface";

// Проверка, нужно ли добавить импорт DESIGN_TOKENS
function needsDesignTokensImport(content) {
  return !content.includes('DESIGN_TOKENS') && 
         !content.includes('@/constants/designSystem');
}

// Добавить импорт DESIGN_TOKENS
function addDesignTokensImport(content) {
  // Найти последний импорт
  const importLines = content.split('\n');
  let lastImportIndex = -1;
  
  for (let i = 0; i < importLines.length; i++) {
    if (importLines[i].trim().startsWith('import ')) {
      lastImportIndex = i;
    }
  }
  
  if (lastImportIndex === -1) {
    // Нет импортов, добавляем в начало
    return "import { DESIGN_TOKENS } from '@/constants/designSystem';\n\n" + content;
  }
  
  // Добавляем после последнего импорта
  importLines.splice(
    lastImportIndex + 1,
    0,
    "import { DESIGN_TOKENS } from '@/constants/designSystem';"
  );
  
  return importLines.join('\n');
}

// Заменить цвета в файле
function replaceColors(content) {
  let modified = content;
  let changeCount = 0;
  
  // Заменяем простые цвета
  for (const [oldColor, newColor] of Object.entries(COLOR_REPLACEMENTS)) {
    const regex = new RegExp(oldColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = modified.match(regex);
    if (matches) {
      changeCount += matches.length;
      modified = modified.replace(regex, newColor);
    }
  }
  
  // Заменяем shadowColor
  const shadowMatches = modified.match(SHADOW_COLOR_PATTERN);
  if (shadowMatches) {
    changeCount += shadowMatches.length;
    modified = modified.replace(SHADOW_COLOR_PATTERN, SHADOW_COLOR_REPLACEMENT);
  }
  
  // Заменяем backgroundColor
  const bgMatches = modified.match(BG_COLOR_PATTERN);
  if (bgMatches) {
    changeCount += bgMatches.length;
    modified = modified.replace(BG_COLOR_PATTERN, BG_COLOR_REPLACEMENT);
  }
  
  return { modified, changeCount };
}

// Обработать файл
function processFile(filePath, dryRun = false) {
  const content = fs.readFileSync(filePath, 'utf8');
  const { modified, changeCount } = replaceColors(content);
  
  if (changeCount === 0) {
    return { changed: false, changeCount: 0 };
  }
  
  let finalContent = modified;
  
  // Добавляем импорт если нужно
  if (needsDesignTokensImport(content)) {
    finalContent = addDesignTokensImport(finalContent);
  }
  
  if (!dryRun) {
    fs.writeFileSync(filePath, finalContent, 'utf8');
  }
  
  return { changed: true, changeCount };
}

// Рекурсивно найти все .tsx и .ts файлы
function findFiles(dir, extensions = ['.tsx', '.ts']) {
  const files = [];
  
  function walk(directory) {
    const items = fs.readdirSync(directory);
    
    for (const item of items) {
      const fullPath = path.join(directory, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Пропускаем node_modules, dist, build
        if (!['node_modules', 'dist', 'build', '.git', 'coverage'].includes(item)) {
          walk(fullPath);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(item);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  walk(dir);
  return files;
}

// Главная функция
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fileArg = args.find(arg => arg.startsWith('--file='));
  const dirArg = args.find(arg => arg.startsWith('--dir='));
  
  let filesToProcess = [];
  
  if (fileArg) {
    // Обработать один файл
    const filePath = fileArg.split('=')[1];
    filesToProcess = [filePath];
  } else if (dirArg) {
    // Обработать директорию
    const dirPath = dirArg.split('=')[1];
    filesToProcess = findFiles(dirPath);
  } else {
    // Обработать все файлы в проекте
    const projectRoot = path.join(__dirname, '..');
    filesToProcess = findFiles(projectRoot);
  }
  
  console.log(`🔍 Найдено файлов: ${filesToProcess.length}`);
  console.log(`📝 Режим: ${dryRun ? 'DRY RUN (без изменений)' : 'ЗАПИСЬ'}\n`);
  
  let totalChanges = 0;
  let filesChanged = 0;
  
  for (const file of filesToProcess) {
    try {
      const { changed, changeCount } = processFile(file, dryRun);
      
      if (changed) {
        filesChanged++;
        totalChanges += changeCount;
        console.log(`✅ ${path.relative(process.cwd(), file)}: ${changeCount} замен`);
      }
    } catch (error) {
      console.error(`❌ Ошибка в ${file}:`, error.message);
    }
  }
  
  console.log(`\n📊 Итого:`);
  console.log(`   Файлов изменено: ${filesChanged}`);
  console.log(`   Всего замен: ${totalChanges}`);
  
  if (dryRun) {
    console.log(`\n💡 Запустите без --dry-run для применения изменений`);
  }
}

main();
