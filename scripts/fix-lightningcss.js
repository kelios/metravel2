#!/usr/bin/env node

/**
 * Fix for lightningcss x64/arm64 compatibility issue on macOS
 * This script patches the lightningcss module to use arm64 binary when x64 is requested
 */

const fs = require('fs');
const path = require('path');

// Проверяем несколько возможных путей
const possiblePaths = [
  path.join(__dirname, '..', 'node_modules', '@expo', 'metro-config', 'node_modules', 'lightningcss', 'node', 'index.js'),
  path.join(__dirname, '..', 'node_modules', 'expo', 'node_modules', 'lightningcss', 'node', 'index.js'),
  path.join(__dirname, '..', 'node_modules', 'lightningcss', 'node', 'index.js'),
];

let lightningcssPath = null;
for (const possiblePath of possiblePaths) {
  if (fs.existsSync(possiblePath)) {
    lightningcssPath = possiblePath;
    break;
  }
}

if (!lightningcssPath) {
  console.log('lightningcss not found in any expected location, skipping fix');
  process.exit(0);
}

const lightningcssDir = path.dirname(lightningcssPath);
const arm64BinaryPath = path.join(lightningcssDir, '..', '..', 'lightningcss-darwin-arm64', 'lightningcss.darwin-arm64.node');
const x64BinaryPath = path.join(lightningcssDir, 'lightningcss.darwin-x64.node');

// Уже проверено выше

// Copy arm64 binary to x64 location if it doesn't exist
if (fs.existsSync(arm64BinaryPath) && !fs.existsSync(x64BinaryPath)) {
  try {
    fs.copyFileSync(arm64BinaryPath, x64BinaryPath);
    console.log('✓ Copied arm64 binary to x64 location');
  } catch (err) {
    console.warn('Warning: Could not copy binary:', err.message);
  }
}

// Read the current file
let content = fs.readFileSync(lightningcssPath, 'utf8');

// Check if already patched
if (content.includes('On macOS, always prefer ARM64 if available')) {
  console.log('✓ lightningcss already patched');
  process.exit(0);
}

// Apply the patch - replace the loading logic section
const originalCode = `if (process.env.CSS_TRANSFORMER_WASM) {
  module.exports = require(\`../pkg\`);
} else {
  try {
    module.exports = require(\`lightningcss-\${parts.join('-')}\`);
  } catch (err) {
    module.exports = require(\`../lightningcss.\${parts.join('-')}.node\`);
  }
}`;

const patchedCode = `// On macOS, always prefer ARM64 if available (works on both ARM64 and x64 via Rosetta)
if (process.platform === 'darwin') {
  // Try ARM64 first (works on both native ARM64 and x64 via Rosetta)
  try {
    module.exports = require(\`lightningcss-darwin-arm64\`);
  } catch (arm64PkgErr) {
    try {
      module.exports = require(\`../lightningcss.darwin-arm64.node\`);
    } catch (arm64Err) {
      // Fall back to detected architecture
      try {
        module.exports = require(\`lightningcss-\${parts.join('-')}\`);
      } catch (err) {
        module.exports = require(\`../lightningcss.\${parts.join('-')}.node\`);
      }
    }
  }
} else if (process.env.CSS_TRANSFORMER_WASM) {
  module.exports = require(\`../pkg\`);
} else {
  try {
    module.exports = require(\`lightningcss-\${parts.join('-')}\`);
  } catch (err) {
    module.exports = require(\`../lightningcss.\${parts.join('-')}.node\`);
  }
}`;

if (content.includes(originalCode)) {
  content = content.replace(originalCode, patchedCode);
  fs.writeFileSync(lightningcssPath, content, 'utf8');
  console.log('✓ Patched lightningcss for macOS ARM64 compatibility');
} else if (content.includes('On macOS, always prefer ARM64 if available')) {
  console.log('✓ lightningcss already patched');
} else {
  console.log('⚠ Could not find expected code pattern, file may already be patched or modified');
}

