#!/usr/bin/env node

/**
 * Скрипт для автоматической замены hardcoded spacing на DESIGN_TOKENS.spacing
 * 
 * Использование:
 * node scripts/fix-spacing.js [--dry-run] [--file=path/to/file.tsx]
 * 
 * Флаги:
 * --dry-run - показать изменения без применения
 * --file - обработать конкретный файл
 * --dir - обработать конкретную директорию
 */

const fs = require('fs');
const path = require('path');

// Карта замен spacing на DESIGN_TOKENS.spacing
// Шкала: xxs(2), xs(6), sm(10), md(14), lg(18), xl(24), xxl(32)
const SPACING_REPLACEMENTS = {
  // Точные совпадения
  'padding: 2': 'padding: DESIGN_TOKENS.spacing.xxs',
  'margin: 2': 'margin: DESIGN_TOKENS.spacing.xxs',
  'gap: 2': 'gap: DESIGN_TOKENS.spacing.xxs',
  
  'padding: 6': 'padding: DESIGN_TOKENS.spacing.xs',
  'margin: 6': 'margin: DESIGN_TOKENS.spacing.xs',
  'gap: 6': 'gap: DESIGN_TOKENS.spacing.xs',
  
  'padding: 10': 'padding: DESIGN_TOKENS.spacing.sm',
  'margin: 10': 'margin: DESIGN_TOKENS.spacing.sm',
  'gap: 10': 'gap: DESIGN_TOKENS.spacing.sm',
  
  'padding: 14': 'padding: DESIGN_TOKENS.spacing.md',
  'margin: 14': 'margin: DESIGN_TOKENS.spacing.md',
  'gap: 14': 'gap: DESIGN_TOKENS.spacing.md',
  
  'padding: 18': 'padding: DESIGN_TOKENS.spacing.lg',
  'margin: 18': 'margin: DESIGN_TOKENS.spacing.lg',
  'gap: 18': 'gap: DESIGN_TOKENS.spacing.lg',
  
  'padding: 24': 'padding: DESIGN_TOKENS.spacing.xl',
  'margin: 24': 'margin: DESIGN_TOKENS.spacing.xl',
  'gap: 24': 'gap: DESIGN_TOKENS.spacing.xl',
  
  'padding: 32': 'padding: DESIGN_TOKENS.spacing.xxl',
  'margin: 32': 'margin: DESIGN_TOKENS.spacing.xxl',
  'gap: 32': 'gap: DESIGN_TOKENS.spacing.xxl',
  
  // Округление к ближайшему
  'padding: 4': 'padding: DESIGN_TOKENS.spacing.xs',
  'margin: 4': 'margin: DESIGN_TOKENS.spacing.xs',
  'gap: 4': 'gap: DESIGN_TOKENS.spacing.xs',
  
  'padding: 8': 'padding: DESIGN_TOKENS.spacing.sm',
  'margin: 8': 'margin: DESIGN_TOKENS.spacing.sm',
  'gap: 8': 'gap: DESIGN_TOKENS.spacing.sm',
  
  'padding: 12': 'padding: DESIGN_TOKENS.spacing.md',
  'margin: 12': 'margin: DESIGN_TOKENS.spacing.md',
  'gap: 12': 'gap: DESIGN_TOKENS.spacing.md',
  
  'padding: 16': 'padding: DESIGN_TOKENS.spacing.lg',
  'margin: 16': 'margin: DESIGN_TOKENS.spacing.lg',
  'gap: 16': 'gap: DESIGN_TOKENS.spacing.lg',
  
  'padding: 20': 'padding: DESIGN_TOKENS.spacing.xl',
  'margin: 20': 'margin: DESIGN_TOKENS.spacing.xl',
  'gap: 20': 'gap: DESIGN_TOKENS.spacing.xl',
  
  'padding: 28': 'padding: DESIGN_TOKENS.spacing.xxl',
  'margin: 28': 'margin: DESIGN_TOKENS.spacing.xxl',
  'gap: 28': 'gap: DESIGN_TOKENS.spacing.xxl',
  
  // Directional spacing
  'paddingTop: 2': 'paddingTop: DESIGN_TOKENS.spacing.xxs',
  'paddingBottom: 2': 'paddingBottom: DESIGN_TOKENS.spacing.xxs',
  'paddingLeft: 2': 'paddingLeft: DESIGN_TOKENS.spacing.xxs',
  'paddingRight: 2': 'paddingRight: DESIGN_TOKENS.spacing.xxs',
  'paddingHorizontal: 2': 'paddingHorizontal: DESIGN_TOKENS.spacing.xxs',
  'paddingVertical: 2': 'paddingVertical: DESIGN_TOKENS.spacing.xxs',
  
  'marginTop: 2': 'marginTop: DESIGN_TOKENS.spacing.xxs',
  'marginBottom: 2': 'marginBottom: DESIGN_TOKENS.spacing.xxs',
  'marginLeft: 2': 'marginLeft: DESIGN_TOKENS.spacing.xxs',
  'marginRight: 2': 'marginRight: DESIGN_TOKENS.spacing.xxs',
  'marginHorizontal: 2': 'marginHorizontal: DESIGN_TOKENS.spacing.xxs',
  'marginVertical: 2': 'marginVertical: DESIGN_TOKENS.spacing.xxs',
  
  'paddingTop: 6': 'paddingTop: DESIGN_TOKENS.spacing.xs',
  'paddingBottom: 6': 'paddingBottom: DESIGN_TOKENS.spacing.xs',
  'paddingLeft: 6': 'paddingLeft: DESIGN_TOKENS.spacing.xs',
  'paddingRight: 6': 'paddingRight: DESIGN_TOKENS.spacing.xs',
  'paddingHorizontal: 6': 'paddingHorizontal: DESIGN_TOKENS.spacing.xs',
  'paddingVertical: 6': 'paddingVertical: DESIGN_TOKENS.spacing.xs',
  
  'marginTop: 6': 'marginTop: DESIGN_TOKENS.spacing.xs',
  'marginBottom: 6': 'marginBottom: DESIGN_TOKENS.spacing.xs',
  'marginLeft: 6': 'marginLeft: DESIGN_TOKENS.spacing.xs',
  'marginRight: 6': 'marginRight: DESIGN_TOKENS.spacing.xs',
  'marginHorizontal: 6': 'marginHorizontal: DESIGN_TOKENS.spacing.xs',
  'marginVertical: 6': 'marginVertical: DESIGN_TOKENS.spacing.xs',
  
  'paddingTop: 10': 'paddingTop: DESIGN_TOKENS.spacing.sm',
  'paddingBottom: 10': 'paddingBottom: DESIGN_TOKENS.spacing.sm',
  'paddingLeft: 10': 'paddingLeft: DESIGN_TOKENS.spacing.sm',
  'paddingRight: 10': 'paddingRight: DESIGN_TOKENS.spacing.sm',
  'paddingHorizontal: 10': 'paddingHorizontal: DESIGN_TOKENS.spacing.sm',
  'paddingVertical: 10': 'paddingVertical: DESIGN_TOKENS.spacing.sm',
  
  'marginTop: 10': 'marginTop: DESIGN_TOKENS.spacing.sm',
  'marginBottom: 10': 'marginBottom: DESIGN_TOKENS.spacing.sm',
  'marginLeft: 10': 'marginLeft: DESIGN_TOKENS.spacing.sm',
  'marginRight: 10': 'marginRight: DESIGN_TOKENS.spacing.sm',
  'marginHorizontal: 10': 'marginHorizontal: DESIGN_TOKENS.spacing.sm',
  'marginVertical: 10': 'marginVertical: DESIGN_TOKENS.spacing.sm',
  
  'paddingTop: 16': 'paddingTop: DESIGN_TOKENS.spacing.lg',
  'paddingBottom: 16': 'paddingBottom: DESIGN_TOKENS.spacing.lg',
  'paddingLeft: 16': 'paddingLeft: DESIGN_TOKENS.spacing.lg',
  'paddingRight: 16': 'paddingRight: DESIGN_TOKENS.spacing.lg',
  'paddingHorizontal: 16': 'paddingHorizontal: DESIGN_TOKENS.spacing.lg',
  'paddingVertical: 16': 'paddingVertical: DESIGN_TOKENS.spacing.lg',
  
  'marginTop: 16': 'marginTop: DESIGN_TOKENS.spacing.lg',
  'marginBottom: 16': 'marginBottom: DESIGN_TOKENS.spacing.lg',
  'marginLeft: 16': 'marginLeft: DESIGN_TOKENS.spacing.lg',
  'marginRight: 16': 'marginRight: DESIGN_TOKENS.spacing.lg',
  'marginHorizontal: 16': 'marginHorizontal: DESIGN_TOKENS.spacing.lg',
  'marginVertical: 16': 'marginVertical: DESIGN_TOKENS.spacing.lg',
  
  'paddingTop: 24': 'paddingTop: DESIGN_TOKENS.spacing.xl',
  'paddingBottom: 24': 'paddingBottom: DESIGN_TOKENS.spacing.xl',
  'paddingLeft: 24': 'paddingLeft: DESIGN_TOKENS.spacing.xl',
  'paddingRight: 24': 'paddingRight: DESIGN_TOKENS.spacing.xl',
  'paddingHorizontal: 24': 'paddingHorizontal: DESIGN_TOKENS.spacing.xl',
  'paddingVertical: 24': 'paddingVertical: DESIGN_TOKENS.spacing.xl',
  
  'marginTop: 24': 'marginTop: DESIGN_TOKENS.spacing.xl',
  'marginBottom: 24': 'marginBottom: DESIGN_TOKENS.spacing.xl',
  'marginLeft: 24': 'marginLeft: DESIGN_TOKENS.spacing.xl',
  'marginRight: 24': 'marginRight: DESIGN_TOKENS.spacing.xl',
  'marginHorizontal: 24': 'marginHorizontal: DESIGN_TOKENS.spacing.xl',
  'marginVertical: 24': 'marginVertical: DESIGN_TOKENS.spacing.xl',
};

// Проверка, нужно ли добавить импорт DESIGN_TOKENS
function needsDesignTokensImport(content) {
  return !content.includes('DESIGN_TOKENS') && 
         !content.includes('@/constants/designSystem');
}

// Добавить импорт DESIGN_TOKENS
function addDesignTokensImport(content) {
  const importLines = content.split('\n');
  let lastImportIndex = -1;
  
  for (let i = 0; i < importLines.length; i++) {
    if (importLines[i].trim().startsWith('import ')) {
      lastImportIndex = i;
    }
  }
  
  if (lastImportIndex === -1) {
    return "import { DESIGN_TOKENS } from '@/constants/designSystem';\n\n" + content;
  }
  
  importLines.splice(
    lastImportIndex + 1,
    0,
    "import { DESIGN_TOKENS } from '@/constants/designSystem';"
  );
  
  return importLines.join('\n');
}

// Заменить spacing в файле
function replaceSpacing(content) {
  let modified = content;
  let changeCount = 0;
  
  for (const [oldSpacing, newSpacing] of Object.entries(SPACING_REPLACEMENTS)) {
    const regex = new RegExp(oldSpacing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = modified.match(regex);
    if (matches) {
      changeCount += matches.length;
      modified = modified.replace(regex, newSpacing);
    }
  }
  
  return { modified, changeCount };
}

// Обработать файл
function processFile(filePath, dryRun = false) {
  const content = fs.readFileSync(filePath, 'utf8');
  const { modified, changeCount } = replaceSpacing(content);
  
  if (changeCount === 0) {
    return { changed: false, changeCount: 0 };
  }
  
  let finalContent = modified;
  
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
    const filePath = fileArg.split('=')[1];
    filesToProcess = [filePath];
  } else if (dirArg) {
    const dirPath = dirArg.split('=')[1];
    filesToProcess = findFiles(dirPath);
  } else {
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
