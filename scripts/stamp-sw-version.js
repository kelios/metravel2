#!/usr/bin/env node

/**
 * Stamps a unique build version into sw.js so that every deploy
 * invalidates the old service worker caches automatically.
 *
 * Usage:
 *   node scripts/stamp-sw-version.js [buildDir]
 *
 * If buildDir is omitted, it defaults to dist/prod.
 * The script rewrites the CACHE_VERSION line in the copied sw.js
 * inside the build output directory.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_BUILD_DIR = path.join(__dirname, '..', 'dist', 'prod');
const buildDirArg = process.argv[2] ? String(process.argv[2]).trim() : '';
const buildDir = buildDirArg ? path.resolve(buildDirArg) : DEFAULT_BUILD_DIR;

const swPath = path.join(buildDir, 'sw.js');

if (!fs.existsSync(swPath)) {
  console.log('ℹ️  sw.js not found in build dir, skipping version stamp.');
  process.exit(0);
}

// Build a version string from the current timestamp (ISO compact).
// Example: "v2026-02-13T2344"
const now = new Date();
const version = `v${now.getTime()}`;

let content = fs.readFileSync(swPath, 'utf8');

const versionRe = /const CACHE_VERSION\s*=\s*['"][^'"]*['"]/;
if (!versionRe.test(content)) {
  console.log('ℹ️  CACHE_VERSION marker not found in sw.js, skipping stamp.');
  process.exit(0);
}

content = content.replace(versionRe, `const CACHE_VERSION = '${version}'`);
fs.writeFileSync(swPath, content);

console.log(`✅ Stamped sw.js CACHE_VERSION = '${version}'`);
