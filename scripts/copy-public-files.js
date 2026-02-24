#!/usr/bin/env node

/**
 * Ensures critical public files (manifest.json, robots.txt, sw.js, etc.)
 * are copied to the build output directory.
 * 
 * Expo should auto-copy /public files, but this script provides a safety net
 * for production deployments.
 * 
 * Usage:
 *   node scripts/copy-public-files.js [buildDir]
 * 
 * If buildDir is omitted, it defaults to dist/prod.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_BUILD_DIR = path.join(__dirname, '..', 'dist', 'prod');
const buildDirArg = process.argv[2] ? String(process.argv[2]).trim() : '';
const buildDir = buildDirArg ? path.resolve(buildDirArg) : DEFAULT_BUILD_DIR;
const publicDir = path.join(__dirname, '..', 'public');

const filesToCopy = [
  'manifest.json',
  'robots.txt',
  'sw.js',
  'icon.svg',
];

if (!fs.existsSync(buildDir)) {
  console.error(`❌ Build directory not found: ${buildDir}`);
  process.exit(1);
}

if (!fs.existsSync(publicDir)) {
  console.error(`❌ Public directory not found: ${publicDir}`);
  process.exit(1);
}

let copiedCount = 0;
let skippedCount = 0;

for (const file of filesToCopy) {
  const srcPath = path.join(publicDir, file);
  const destPath = path.join(buildDir, file);
  
  if (!fs.existsSync(srcPath)) {
    console.log(`⚠️  Source file not found, skipping: ${file}`);
    skippedCount++;
    continue;
  }
  
  try {
    fs.copyFileSync(srcPath, destPath);
    console.log(`✅ Copied: ${file}`);
    copiedCount++;
  } catch (err) {
    console.error(`❌ Failed to copy ${file}:`, err.message);
  }
}

console.log(`\n📦 Public files copy complete: ${copiedCount} copied, ${skippedCount} skipped`);
