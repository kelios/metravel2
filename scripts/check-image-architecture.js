const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const ALLOW_EXPO_IMAGE_FILES = new Set([
  path.join(ROOT, 'components', 'ui', 'OptimizedImage.tsx'),
  path.join(ROOT, 'components', 'ui', 'ImageCardMedia.tsx'),
]);

const ALLOW_OPTIMIZED_IMAGE_IMPORT_FILES = new Set([
  path.join(ROOT, 'components', 'ui', 'ImageCardMedia.tsx'),
]);

const TEXT_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'web-build') continue;
    if (e.name === 'coverage' || e.name === 'coverage-new') continue;
    if (e.name === '.expo') continue;
    if (e.name === 'playwright-report' || e.name === 'test-results') continue;
    if (e.name.startsWith('.')) continue;

    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function isTextFile(file) {
  return TEXT_EXTS.has(path.extname(file));
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function reportError(errors) {
  if (!errors.length) return;
  console.error('\nImage architecture check failed:\n');
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  console.error('\nRules:');
  console.error('- No direct imports of "expo-image" inside components/** except ui/OptimizedImage.tsx and ui/ImageCardMedia.tsx');
  console.error('- No direct imports of ui/OptimizedImage from feature components; use ui/ImageCardMedia instead');
  process.exit(1);
}

function main() {
  const componentsDir = path.join(ROOT, 'components');
  const files = walk(componentsDir).filter(isTextFile);

  const errors = [];

  for (const file of files) {
    const content = read(file);

    // 1) forbid expo-image imports outside allowed low-level files
    if (content.includes("from 'expo-image'") || content.includes('from "expo-image"')) {
      if (!ALLOW_EXPO_IMAGE_FILES.has(file)) {
        errors.push(`${path.relative(ROOT, file)} imports expo-image directly`);
      }
    }

    // 2) forbid direct imports of ui/OptimizedImage outside ImageCardMedia
    if (
      content.includes("from '@/components/ui/OptimizedImage'") ||
      content.includes('from "@/components/ui/OptimizedImage"') ||
      content.includes("from '../ui/OptimizedImage'") ||
      content.includes('from "../ui/OptimizedImage"') ||
      content.includes("from './ui/OptimizedImage'") ||
      content.includes('from "./ui/OptimizedImage"')
    ) {
      if (!ALLOW_OPTIMIZED_IMAGE_IMPORT_FILES.has(file)) {
        errors.push(`${path.relative(ROOT, file)} imports ui/OptimizedImage directly (use ImageCardMedia)`);
      }
    }
  }

  reportError(errors);
  console.log('Image architecture check passed.');
}

main();
