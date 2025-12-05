#!/usr/bin/env node

/**
 * Скрипт для автоматической замены hardcoded font sizes на DESIGN_TOKENS.typography.sizes
 * 
 * Использование:
 * node scripts/fix-font-sizes.js [--dry-run] [--file=path/to/file.tsx]
 * 
 * Флаги:
 * --dry-run - показать изменения без применения
 * --file - обработать конкретный файл
 * --dir - обработать конкретную директорию
 */

const fs = require('fs');
const path = require('path');

// Карта замен font sizes на DESIGN_TOKENS.typography.sizes
// Используем ближайшее значение из шкалы: xs(12), sm(14), md(16), lg(20), xl(24)
const FONT_SIZE_REPLACEMENTS = {
  // Точные совпадения
  'fontSize: 12': 'fontSize: DESIGN_TOKENS.typography.sizes.xs',
  'fontSize: 14': 'fontSize: DESIGN_TOKENS.typography.sizes.sm',
  'fontSize: 16': 'fontSize: DESIGN_TOKENS.typography.sizes.md',
  'fontSize: 20': 'fontSize: DESIGN_TOKENS.typography.sizes.lg',
  'fontSize: 24': 'fontSize: DESIGN_TOKENS.typography.sizes.xl',
  
  // Округление к ближайшему
  'fontSize: 11': 'fontSize: DESIGN_TOKENS.typography.sizes.xs', // 11 → 12
  'fontSize: 13': 'fontSize: DESIGN_TOKENS.typography.sizes.sm', // 13 → 14
  'fontSize: 15': 'fontSize: DESIGN_TOKENS.typography.sizes.md', // 15 → 16
  'fontSize: 17': 'fontSize: DESIGN_TOKENS.typography.sizes.md', // 17 → 16
  'fontSize: 18': 'fontSize: DESIGN_TOKENS.typography.sizes.lg', // 18 → 20
  'fontSize: 19': 'fontSize: DESIGN_TOKENS.typography.sizes.lg', // 19 → 20
  'fontSize: 21': 'fontSize: DESIGN_TOKENS.typography.sizes.lg', // 21 → 20
  'fontSize: 22': 'fontSize: DESIGN_TOKENS.typography.sizes.xl', // 22 → 24
  'fontSize: 23': 'fontSize: DESIGN_TOKENS.typography.sizes.xl', // 23 → 24
  'fontSize: 25': 'fontSize: DESIGN_TOKENS.typography.sizes.xl', // 25 → 24
  'fontSize: 26': 'fontSize: DESIGN_TOKENS.typography.sizes.xl', // 26 → 24
  'fontSize: 28': 'fontSize: DESIGN_TOKENS.typography.sizes.xl', // 28 → 24
  'fontSize: 30': 'fontSize: DESIGN_TOKENS.typography.sizes.xl', // 30 → 24
  'fontSize: 32': 'fontSize: DESIGN_TOKENS.typography.sizes.xl', // 32 → 24
  'fontSize: 36': 'fontSize: DESIGN_TOKENS.typography.sizes.xl', // 36 → 24
};

// Паттерн для inline стилей: style={{ fontSize: 16 }}
const INLINE_FONT_SIZE_PATTERN = /fontSize:\s*(\d+)/g;

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

// Получить ближайший размер из шкалы
function getNearestSize(size) {
  const sizeNum = parseInt(size);
  const sizes = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
  };
  
  // Найти ближайший размер
  let nearest = 'md';
  let minDiff = Infinity;
  
  for (const [key, value] of Object.entries(sizes)) {
    const diff = Math.abs(value - sizeNum);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = key;
    }
  }
  
  return `DESIGN_TOKENS.typography.sizes.${nearest}`;
}

// Заменить font sizes в файле
function replaceFontSizes(content) {
  let modified = content;
  let changeCount = 0;
  
  // Заменяем простые случаи из карты
  for (const [oldSize, newSize] of Object.entries(FONT_SIZE_REPLACEMENTS)) {
    const regex = new RegExp(oldSize.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = modified.match(regex);
    if (matches) {
      changeCount += matches.length;
      modified = modified.replace(regex, newSize);
    }
  }
  
  // Заменяем inline стили
  modified = modified.replace(INLINE_FONT_SIZE_PATTERN, (match, size) => {
    // Проверяем, не заменили ли уже
    if (match.includes('DESIGN_TOKENS')) {
      return match;
    }
    
    const replacement = FONT_SIZE_REPLACEMENTS[`fontSize: ${size}`];
    if (replacement) {
      changeCount++;
      return replacement.replace('fontSize: ', 'fontSize: ');
    }
    
    // Если нет в карте, используем ближайший
    changeCount++;
    return `fontSize: ${getNearestSize(size)}`;
  });
  
  return { modified, changeCount };
}

// Обработать файл
function processFile(filePath, dryRun = false) {
  const content = fs.readFileSync(filePath, 'utf8');
  const { modified, changeCount } = replaceFontSizes(content);
  
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
