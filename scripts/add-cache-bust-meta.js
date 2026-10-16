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
const { normalizeHeadCharset } = require('./lib/htmlCharset');

const DEFAULT_BUILD_DIR = path.join(__dirname, '..', 'dist', 'prod');
const buildDirArg = process.argv[2] ? String(process.argv[2]).trim() : '';
const buildDir = buildDirArg ? path.resolve(buildDirArg) : DEFAULT_BUILD_DIR;

const BUILD_VERSION = `v${Date.now()}`;

function processHtmlFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');

    // #2088: last full pass over every dist/prod/**/*.html file before the
    // build swaps into place — move <meta charset> to be the first child of
    // <head> so the browser's 1024-byte encoding prescan always finds it.
    content = normalizeHeadCharset(content);

    const cacheMetaTags = `
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <meta name="build-version" content="${BUILD_VERSION}">`;

    if (content.includes('name="build-version"')) {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }

    if (content.includes('</head>')) {
      content = content.replace('</head>', `${cacheMetaTags}\n</head>`);
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }
    
    return false;
  } catch (err) {
    console.error(`❌ Failed to process ${filePath}:`, err.message);
    return false;
  }
}

function processDirectory(dir, processedInodes = new Set()) {
  const entries = fs.readdirSync(dir);
  const results = [];
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    let stats;
    try {
      stats = fs.statSync(fullPath, { bigint: true });
    } catch (err) {
      // Skip entries that readdir lists but stat cannot resolve (dangling
      // symlink / vanished file / flat-vs-dir name collision for a slug).
      // One anomalous entry must not abort the whole build.
      console.warn(`⚠️  Skipping unreadable entry: ${fullPath} (${err.code || err.message})`);
      continue;
    }

    if (stats.isDirectory()) {
      const subResults = processDirectory(fullPath, processedInodes);
      results.push(...subResults);
    } else if (stats.isFile() && entry.endsWith('.html')) {
      // SSG writes flat and directory-index routes as hardlinks. Mutate their
      // shared bytes once, while still reporting every successful route path.
      // Keep failed attempts uncached so another alias retains its old retry.
      const inode = `${stats.dev}:${stats.ino}`;
      const processed = processedInodes.has(inode) || processHtmlFile(fullPath);
      if (processed) {
        processedInodes.add(inode);
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
  
  const processedFiles = processDirectory(buildDir);
  
  console.log(`\n✅ Added cache-bust meta tags to ${processedFiles.length} HTML files`);
  
  if (processedFiles.length > 0 && processedFiles.length <= 10) {
    console.log('\nProcessed files:');
    processedFiles.forEach(f => console.log(`  - ${path.relative(buildDir, f)}`));
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });
}

module.exports = { processDirectory };
