#!/usr/bin/env node

/**
 * Design System Import Migration Script
 * 
 * Автоматически заменяет импорты из устаревших дизайн-систем
 * на импорты из единой системы @/constants/designSystem
 * 
 * Usage:
 *   node scripts/migrate-design-imports.js [--dry-run] [--path=<path>]
 * 
 * Options:
 *   --dry-run   Показать изменения без применения
 *   --path      Путь к файлу или директории (default: components/)
 */

const fs = require('fs');
const path = require('path');

// Конфигурация миграции
const DEPRECATED_IMPORTS = {
  designTokens: {
    from: /@\/constants\/designTokens/g,
    to: '@/constants/designSystem',
    mappings: {
      'designTokens.colors': 'DESIGN_TOKENS.colors',
      'designTokens.spacing': 'DESIGN_TOKENS.spacing',
      'designTokens.typography': 'DESIGN_TOKENS.typography',
      'designTokens.radius': 'DESIGN_TOKENS.radii',
      'designTokens.borderRadius': 'DESIGN_TOKENS.radii',
      'designTokens.shadows': 'DESIGN_TOKENS.shadows',
    }
  },
  modernRedesign: {
    from: /@\/styles\/modernRedesign/g,
    to: '@/constants/designSystem',
    mappings: {
      'MODERN_COLORS': 'DESIGN_TOKENS.colors',
      'MODERN_SPACING': 'DESIGN_TOKENS.spacing',
      'MODERN_RADII': 'DESIGN_TOKENS.radii',
      'MODERN_SHADOWS': 'DESIGN_TOKENS.shadows',
      'MODERN_TYPOGRAPHY': 'DESIGN_TOKENS.typography',
    }
  },
  airyColors: {
    from: /@\/constants\/airyColors/g,
    to: '@/constants/designSystem',
    mappings: {
      'AIRY_COLORS': 'DESIGN_TOKENS.colors',
      'AIRY_SHADOWS': 'DESIGN_TOKENS.shadowsNative',
    }
  },
  Colors: {
    from: /@\/constants\/Colors/g,
    to: '@/constants/designSystem',
    mappings: {
      'Colors.light': 'DESIGN_TOKENS.colors',
      'Colors.dark': 'DESIGN_TOKENS.colors',
    }
  }
};

// Статистика
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  importsReplaced: 0,
  usagesReplaced: 0,
  errors: 0,
};

function migrateFile(filePath, dryRun = false) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let modified = content;
    let fileModified = false;

    // Шаг 1: Заменить импорты
    Object.entries(DEPRECATED_IMPORTS).forEach(([name, config]) => {
      if (config.from.test(content)) {
        console.log(`  📦 Found ${name} import`);
        modified = modified.replace(config.from, config.to);
        fileModified = true;
        stats.importsReplaced++;
      }
    });

    // Шаг 2: Заменить использования
    Object.entries(DEPRECATED_IMPORTS).forEach(([, config]) => {
      Object.entries(config.mappings).forEach(([oldUsage, newUsage]) => {
        const oldPattern = new RegExp(oldUsage.replace(/\./g, '\\.'), 'g');
        if (oldPattern.test(modified)) {
          const matches = modified.match(oldPattern);
          if (matches) {
            console.log(`    🔄 Replacing ${matches.length}x: ${oldUsage} → ${newUsage}`);
            modified = modified.replace(oldPattern, newUsage);
            stats.usagesReplaced += matches.length;
            fileModified = true;
          }
        }
      });
    });

    // Применить изменения
    if (fileModified) {
      stats.filesModified++;
      if (!dryRun) {
        fs.writeFileSync(filePath, modified, 'utf8');
        console.log(`  ✅ Updated: ${filePath}`);
      } else {
        console.log(`  🔍 Would update: ${filePath}`);
      }
    }

    stats.filesProcessed++;
  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error.message);
    stats.errors++;
  }
}

function walkDirectory(dir, callback, extensions = ['.tsx', '.ts']) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Пропустить node_modules, dist, build и т.д.
      if (!['node_modules', 'dist', 'build', '.next', '.expo'].includes(file)) {
        walkDirectory(filePath, callback, extensions);
      }
    } else if (stat.isFile()) {
      const ext = path.extname(file);
      if (extensions.includes(ext)) {
        callback(filePath);
      }
    }
  });
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const pathArg = args.find(arg => arg.startsWith('--path='));
  const targetPath = pathArg 
    ? pathArg.split('=')[1] 
    : path.join(__dirname, '../components');

  console.log('🚀 Design System Migration Tool\n');
  console.log(`Target: ${targetPath}`);
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN' : '✍️  WRITE'}\n`);

  const startTime = Date.now();

  if (fs.statSync(targetPath).isDirectory()) {
    walkDirectory(targetPath, (filePath) => {
      console.log(`\n📄 Processing: ${path.relative(process.cwd(), filePath)}`);
      migrateFile(filePath, dryRun);
    });
  } else {
    console.log(`\n📄 Processing: ${path.relative(process.cwd(), targetPath)}`);
    migrateFile(targetPath, dryRun);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary');
  console.log('='.repeat(60));
  console.log(`Files processed:     ${stats.filesProcessed}`);
  console.log(`Files modified:      ${stats.filesModified}`);
  console.log(`Imports replaced:    ${stats.importsReplaced}`);
  console.log(`Usages replaced:     ${stats.usagesReplaced}`);
  console.log(`Errors:              ${stats.errors}`);
  console.log(`Duration:            ${duration}s`);
  console.log('='.repeat(60));

  if (dryRun) {
    console.log('\n💡 This was a dry run. Run without --dry-run to apply changes.');
  } else {
    console.log('\n✅ Migration complete! Run tests to verify changes.');
    console.log('   npm run test:run');
    console.log('   npm run lint');
  }
}

if (require.main === module) {
  main();
}

module.exports = { migrateFile, walkDirectory };
