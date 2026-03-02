#!/usr/bin/env node
// scripts/guard-file-complexity.js
// B3: Warns when feature files exceed 800 LOC threshold.
// Run: node scripts/guard-file-complexity.js [--fail]
// With --fail, exits with code 1 if any file exceeds the threshold (for CI gating).

const fs = require('fs');
const path = require('path');

const MAX_LOC = 800;
const shouldFail = process.argv.includes('--fail');

const SCAN_DIRS = ['api', 'app', 'components', 'hooks', 'stores', 'context', 'screens', 'services'];
const EXTENSIONS = new Set(['.ts', '.tsx']);
const IGNORE_PATTERNS = ['__tests__', 'node_modules', '.expo', 'dist', 'coverage'];

const root = path.resolve(__dirname, '..');

function walk(dir) {
    const results = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const rel = path.relative(root, fullPath);
            if (IGNORE_PATTERNS.some(p => rel.includes(p))) continue;

            if (entry.isDirectory()) {
                results.push(...walk(fullPath));
            } else if (EXTENSIONS.has(path.extname(entry.name))) {
                results.push(fullPath);
            }
        }
    } catch { /* skip unreadable dirs */ }
    return results;
}

function countLines(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').length;
}

const violations = [];

for (const dir of SCAN_DIRS) {
    const dirPath = path.join(root, dir);
    if (!fs.existsSync(dirPath)) continue;
    const files = walk(dirPath);
    for (const file of files) {
        const loc = countLines(file);
        if (loc > MAX_LOC) {
            violations.push({ file: path.relative(root, file), loc });
        }
    }
}

violations.sort((a, b) => b.loc - a.loc);

if (violations.length === 0) {
    console.log(`✅ All feature files are under ${MAX_LOC} LOC.`);
    process.exit(0);
}

console.log(`⚠️  ${violations.length} file(s) exceed ${MAX_LOC} LOC:\n`);
for (const { file, loc } of violations) {
    console.log(`  ${loc.toString().padStart(5)} LOC  ${file}`);
}
console.log('');

if (shouldFail) {
    console.log('❌ Failing due to --fail flag.');
    process.exit(1);
} else {
    console.log('ℹ️  Run with --fail to make this a blocking check.');
    process.exit(0);
}

