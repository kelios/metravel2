#!/usr/bin/env node

/**
 * Adds anti-cache meta tags to all HTML files in the build directory.
 * This forces browsers to reload HTML even if they have it cached.
 * 
 * The script adds:
 * 1. <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
 * 2. <meta name="build-version" content="v{timestamp}">
 * 
 * Usage:
 *   node scripts/add-cache-bust-meta.js [buildDir]
 * 
 * If buildDir is omitted, it defaults to dist/prod.
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);

const DEFAULT_BUILD_DIR = path.join(__dirname, '..', 'dist', 'prod');
const buildDirArg = process.argv[2] ? String(process.argv[2]).trim() : '';
const buildDir = buildDirArg ? path.resolve(buildDirArg) : DEFAULT_BUILD_DIR;

const BUILD_VERSION = `v${Date.now()}`;

async function processHtmlFile(filePath) {
  try {
    let content = await readFile(filePath, 'utf8');

    const cacheMetaTags = `
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <meta name="build-version" content="${BUILD_VERSION}">`;

    if (content.includes('name="build-version"')) {
      await writeFile(filePath, content, 'utf8');
      return true;
    }

    if (content.includes('</head>')) {
      content = content.replace('</head>', `${cacheMetaTags}\n</head>`);
      await writeFile(filePath, content, 'utf8');
      return true;
    }
    
    return false;
  } catch (err) {
    console.error(`❌ Failed to process ${filePath}:`, err.message);
    return false;
  }
}

async function processDirectory(dir) {
  const entries = await readdir(dir);
  const results = [];
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stats = await stat(fullPath);
    
    if (stats.isDirectory()) {
      const subResults = await processDirectory(fullPath);
      results.push(...subResults);
    } else if (stats.isFile() && entry.endsWith('.html')) {
      const processed = await processHtmlFile(fullPath);
      if (processed) {
        results.push(fullPath);
      }
    }
  }
  
  return results;
}

async function main() {
  if (!fs.existsSync(buildDir)) {
    console.error(`❌ Build directory not found: ${buildDir}`);
    process.exit(1);
  }
  
  console.log(`🔍 Scanning for HTML files in: ${buildDir}`);
  console.log(`📦 Build version: ${BUILD_VERSION}`);
  
  const processedFiles = await processDirectory(buildDir);
  
  console.log(`\n✅ Added cache-bust meta tags to ${processedFiles.length} HTML files`);
  
  if (processedFiles.length > 0 && processedFiles.length <= 10) {
    console.log('\nProcessed files:');
    processedFiles.forEach(f => console.log(`  - ${path.relative(buildDir, f)}`));
  }
}

main().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
