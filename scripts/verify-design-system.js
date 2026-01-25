#!/usr/bin/env node

/**
 * Design System Verification Script
 * 
 * Проверяет что все компоненты используют единую дизайн-систему
 * и выявляет оставшиеся использования устаревших систем
 * 
 * Usage:
 *   node scripts/verify-design-system.js
 */

const fs = require('fs');
const path = require('path');

// Паттерны для поиска устаревших импортов
const DEPRECATED_PATTERNS = [
  {
    name: 'designTokens',
    pattern: /@\/constants\/designTokens/,
    severity: 'warning',
    message: 'Use @/constants/designSystem instead'
  },
  {
    name: 'modernRedesign',
    pattern: /@\/styles\/modernRedesign/,
    severity: 'warning',
    message: 'Use @/constants/designSystem instead'
  },
  {
    name: 'airyColors',
    pattern: /@\/constants\/airyColors/,
    severity: 'warning',
    message: 'Use @/constants/designSystem instead'
  },
  {
    name: 'Colors (old)',
    pattern: /from\s+['"]@\/constants\/Colors['"]/,
    severity: 'warning',
    message: 'Use @/constants/designSystem instead'
  },
  {
    name: 'modernMattePalette (direct)',
    pattern: /@\/constants\/modernMattePalette/,
    severity: 'info',
    message: 'Should only be imported by designSystem.ts'
  }
];

// Паттерны для правильного использования
const issues = [];
const stats = {
  filesScanned: 0,
  filesWithIssues: 0,
  totalIssues: 0,
  warnings: 0,
  errors: 0,
  info: 0,
};

function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileIssues = [];

    // Проверить на устаревшие импорты
    DEPRECATED_PATTERNS.forEach(({ name, pattern, severity, message }) => {
      const matches = content.match(pattern);
      if (matches) {
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (pattern.test(line)) {
            fileIssues.push({
              file: filePath,
              line: index + 1,
              severity,
              pattern: name,
              message,
              code: line.trim()
            });
            stats[severity]++;
          }
        });
      }
    });

    if (fileIssues.length > 0) {
      issues.push(...fileIssues);
      stats.filesWithIssues++;
      stats.totalIssues += fileIssues.length;
    }

    stats.filesScanned++;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
  }
}

function walkDirectory(dir, extensions = ['.tsx', '.ts']) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Пропустить node_modules, dist и т.д.
      if (!['node_modules', 'dist', 'build', '.next', '.expo', '__tests__'].includes(file)) {
        walkDirectory(filePath, extensions);
      }
    } else if (stat.isFile()) {
      const ext = path.extname(file);
      if (extensions.includes(ext)) {
        checkFile(filePath);
      }
    }
  });
}

function formatIssue(issue) {
  const severityIcons = {
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const icon = severityIcons[issue.severity] || '•';
  const relPath = path.relative(process.cwd(), issue.file);
  
  return `${icon} ${relPath}:${issue.line}
   Pattern: ${issue.pattern}
   Message: ${issue.message}
   Code: ${issue.code}`;
}

function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 Design System Verification Report');
  console.log('='.repeat(80));

  if (issues.length === 0) {
    console.log('\n✅ No deprecated design system usage found!');
    console.log(`   Scanned ${stats.filesScanned} files.`);
  } else {
    console.log(`\n📊 Summary:`);
    console.log(`   Files scanned:      ${stats.filesScanned}`);
    console.log(`   Files with issues:  ${stats.filesWithIssues}`);
    console.log(`   Total issues:       ${stats.totalIssues}`);
    console.log(`   - Errors:           ${stats.errors}`);
    console.log(`   - Warnings:         ${stats.warnings}`);
    console.log(`   - Info:             ${stats.info}`);

    // Группировать по файлам
    const issuesByFile = {};
    issues.forEach(issue => {
      if (!issuesByFile[issue.file]) {
        issuesByFile[issue.file] = [];
      }
      issuesByFile[issue.file].push(issue);
    });

    console.log('\n📋 Issues by file:\n');
    Object.entries(issuesByFile).forEach(([file, fileIssues]) => {
      console.log(`\n${path.relative(process.cwd(), file)} (${fileIssues.length} issues):`);
      fileIssues.forEach(issue => {
        console.log(`  ${formatIssue(issue)}\n`);
      });
    });

    console.log('\n💡 Recommended action:');
    console.log('   Run: node scripts/migrate-design-imports.js --dry-run');
    console.log('   Then: node scripts/migrate-design-imports.js');
  }

  console.log('\n' + '='.repeat(80));

  // Exit code для CI/CD
  const hasErrors = stats.errors > 0;
  if (hasErrors) {
    console.log('\n❌ Verification failed: Errors found');
    process.exit(1);
  } else if (stats.warnings > 0) {
    console.log('\n⚠️  Verification passed with warnings');
    process.exit(0);
  } else {
    console.log('\n✅ Verification passed');
    process.exit(0);
  }
}

function main() {
  console.log('🔍 Scanning for deprecated design system usage...\n');

  const componentsDir = path.join(__dirname, '../components');
  const appDir = path.join(__dirname, '../app');
  const hooksDir = path.join(__dirname, '../hooks');

  walkDirectory(componentsDir);
  walkDirectory(appDir);
  walkDirectory(hooksDir);

  generateReport();
}

if (require.main === module) {
  main();
}

module.exports = { checkFile, walkDirectory };
