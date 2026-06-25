#!/usr/bin/env node

/**
 * Скрипт для аудита и точечной замены hardcoded UI-цветов на DESIGN_TOKENS.
 *
 * Аудит намеренно узкий: считаются только реальные UI style props
 * `backgroundColor`, `color`, `borderColor` со значениями `#fff`, `#000`,
 * `#ff9f5a` и их длинными/uppercase вариантами.
 *
 * Не считаются нарушениями:
 * - `transparent` — валидный RN/CSS литерал;
 * - `shadowColor: '#000'` — валидная RN-конвенция для теней;
 * - token-definition files, tests/e2e, PDF print themes, map snapshot/canvas
 *   renderers and generated/build folders.
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

const PROJECT_ROOT = path.join(__dirname, '..');

const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.next',
  '.expo',
  'coverage',
  'test-results',
  'playwright-report',
  '__tests__',
  'e2e',
]);

const EXCLUDED_RELATIVE_PATHS = new Set([
  'constants/designSystem.ts',
  'constants/modernMattePalette.ts',
  'constants/theme.ts',
]);

const EXCLUDED_RELATIVE_PREFIXES = [
  'services/pdf-export/',
  'utils/mapSnapshot/',
];

// Карта замен hardcoded цветов на DESIGN_TOKENS для UI style props.
const COLOR_VALUE_REPLACEMENTS = {
  // Белый
  '#fff': "DESIGN_TOKENS.colors.surface",
  '#ffffff': "DESIGN_TOKENS.colors.surface",
  
  // Черный
  '#000': "DESIGN_TOKENS.colors.text",
  '#000000': "DESIGN_TOKENS.colors.text",
  
  // Старый оранжевый primary
  '#ff9f5a': "DESIGN_TOKENS.colors.primary",
};

const AUDITED_STYLE_PROPS = ['backgroundColor', 'borderColor', 'color'];
const COLOR_VALUE_PATTERN = Object.keys(COLOR_VALUE_REPLACEMENTS)
  .map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');
const STYLE_COLOR_PATTERN = new RegExp(
  `(^|[\\s,{;])(${AUDITED_STYLE_PROPS.join('|')})\\s*:\\s*(['"])(${COLOR_VALUE_PATTERN})\\3`,
  'gim',
);

function toRelativeProjectPath(filePath) {
  return path.relative(PROJECT_ROOT, path.resolve(filePath)).split(path.sep).join('/');
}

function isExcludedPath(filePath) {
  const relativePath = toRelativeProjectPath(filePath);
  return (
    EXCLUDED_RELATIVE_PATHS.has(relativePath) ||
    EXCLUDED_RELATIVE_PREFIXES.some(prefix => (
      relativePath === prefix.replace(/\/$/, '') ||
      relativePath.startsWith(prefix)
    ))
  );
}

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
  
  modified = modified.replace(STYLE_COLOR_PATTERN, (match, prefix, prop, quote, value) => {
    const replacement = COLOR_VALUE_REPLACEMENTS[value.toLowerCase()];
    if (!replacement) return match;
    changeCount++;
    return `${prefix}${prop}: ${replacement}`;
  });
  
  return { modified, changeCount };
}

// Обработать файл
function processFile(filePath, dryRun = false) {
  if (isExcludedPath(filePath)) {
    return { changed: false, changeCount: 0, skipped: true };
  }

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
        if (!EXCLUDED_DIRS.has(item) && !isExcludedPath(fullPath)) {
          walk(fullPath);
        }
      } else if (stat.isFile() && !isExcludedPath(fullPath)) {
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
    filesToProcess = findFiles(PROJECT_ROOT);
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

if (require.main === module) {
  main();
}

module.exports = {
  AUDITED_STYLE_PROPS,
  COLOR_VALUE_REPLACEMENTS,
  EXCLUDED_DIRS,
  EXCLUDED_RELATIVE_PATHS,
  EXCLUDED_RELATIVE_PREFIXES,
  findFiles,
  isExcludedPath,
  processFile,
  replaceColors,
};
