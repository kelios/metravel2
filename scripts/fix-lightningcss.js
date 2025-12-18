#!/usr/bin/env node

/**
 * Fix for lightningcss x64/arm64 compatibility issue on macOS
 * This script patches the lightningcss module to use arm64 binary when x64 is requested
 * Only runs on macOS - skips on Linux (EAS Build servers)
 */

const fs = require('fs');
const path = require('path');

// Skip on non-macOS platforms (e.g., EAS Build Linux servers)
if (process.platform !== 'darwin') {
  console.log('✓ Skipping lightningcss fix on non-macOS platform');
  process.exit(0);
}

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
  // Continue: this script also applies other postinstall patches.
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

const patchIfPresent = (filePath, transform) => {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    const prev = fs.readFileSync(filePath, 'utf8');
    const next = transform(prev);
    if (next && next !== prev) {
      fs.writeFileSync(filePath, next, 'utf8');
      return true;
    }
    return false;
  } catch (_err) {
    return false;
  }
};

const rnSvgModulePreparePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-svg',
  'lib',
  'module',
  'web',
  'utils',
  'prepare.js'
);

const rnSvgCommonjsPreparePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-svg',
  'lib',
  'commonjs',
  'web',
  'utils',
  'prepare.js'
);

const rnSvgModuleWebShapePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-svg',
  'lib',
  'module',
  'web',
  'WebShape.js'
);

const rnSvgCommonjsWebShapePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-svg',
  'lib',
  'commonjs',
  'web',
  'WebShape.js'
);

const patchPrepareEsm = (src) => {
  if (src.includes('const hasTouchableProperty = typeof _hasTouchableProperty')) {
    return src;
  }
  const fallback =
    "const hasTouchableProperty = typeof _hasTouchableProperty === 'function' ? _hasTouchableProperty : (props => props.onPress || props.onPressIn || props.onPressOut || props.onLongPress);";
  const rewritten = src
    .replace(
      /import\s+\{\s*hasTouchableProperty\s*,\s*parseTransformProp\s*\}\s+from\s+['\"]\.['\"];?/,
      "import { hasTouchableProperty as _hasTouchableProperty, parseTransformProp } from '.';"
    )
    .replace(
      /import\s+\{\s*parseTransformProp\s*,\s*hasTouchableProperty\s*\}\s+from\s+['\"]\.['\"];?/,
      "import { parseTransformProp, hasTouchableProperty as _hasTouchableProperty } from '.';"
    );

  // IMPORTANT: never insert non-import code between imports in ESM.
  // Insert the fallback *after* the last import statement.
  const lastImportIdx = rewritten.lastIndexOf('import ');
  if (lastImportIdx === -1) {
    return rewritten;
  }
  const lastImportLineEnd = rewritten.indexOf('\n', lastImportIdx);
  if (lastImportLineEnd === -1) {
    return rewritten + "\n" + fallback + "\n";
  }
  const before = rewritten.slice(0, lastImportLineEnd + 1);
  const after = rewritten.slice(lastImportLineEnd + 1);
  return before + fallback + "\n" + after;
};

const patchPrepareCjs = (src) => {
  if (src.includes("const _hasTouchableProperty = typeof _.hasTouchableProperty")) {
    return src;
  }
  const requireLine = "var _ = require(\".\");";
  let next = src;
  if (next.includes(requireLine)) {
    next = next.replace(
      requireLine,
      requireLine +
        "\nconst _hasTouchableProperty = typeof _.hasTouchableProperty === 'function' ? _.hasTouchableProperty : (props => props.onPress || props.onPressIn || props.onPressOut || props.onLongPress);"
    );
  }
  next = next.replace(/\(0, _\.hasTouchableProperty\)\(props\)/g, '(0, _hasTouchableProperty)(props)');
  return next;
};

const patchWebShapeEsm = (src) => {
  if (src.includes('const hasTouchableProperty = typeof _hasTouchableProperty')) {
    return src;
  }
  const fallback =
    "const hasTouchableProperty = typeof _hasTouchableProperty === 'function' ? _hasTouchableProperty : (props => props.onPress || props.onPressIn || props.onPressOut || props.onLongPress);";
  const rewritten = src
    .replace(
      /import\s+\{\s*camelCaseToDashed\s*,\s*hasTouchableProperty\s*,\s*remeasure\s*\}\s+from\s+['\"]\.\/utils['\"];?/,
      "import { camelCaseToDashed, hasTouchableProperty as _hasTouchableProperty, remeasure } from './utils';"
    )
    .replace(
      /import\s+\{\s*hasTouchableProperty\s*,\s*camelCaseToDashed\s*,\s*remeasure\s*\}\s+from\s+['\"]\.\/utils['\"];?/,
      "import { hasTouchableProperty as _hasTouchableProperty, camelCaseToDashed, remeasure } from './utils';"
    );

  const lastImportIdx = rewritten.lastIndexOf('import ');
  if (lastImportIdx === -1) {
    return rewritten;
  }
  const lastImportLineEnd = rewritten.indexOf('\n', lastImportIdx);
  if (lastImportLineEnd === -1) {
    return rewritten + "\n" + fallback + "\n";
  }
  const before = rewritten.slice(0, lastImportLineEnd + 1);
  const after = rewritten.slice(lastImportLineEnd + 1);
  return before + fallback + "\n" + after;
};

const patchWebShapeCjs = (src) => {
  if (src.includes('var _hasTouchableProperty =')) {
    return src;
  }
  const from = "var _utils = require(\"./utils\");";
  if (!src.includes(from)) {
    return src;
  }
  let next = src.replace(
    from,
    from +
      "\nvar _hasTouchableProperty = typeof _utils.hasTouchableProperty === 'function' ? _utils.hasTouchableProperty : function (props) { return props.onPress || props.onPressIn || props.onPressOut || props.onLongPress; };"
  );
  next = next.replace(/\(0, _utils\.hasTouchableProperty\)\(props\)/g, '(0, _hasTouchableProperty)(props)');
  return next;
};

const svgPatched = [
  patchIfPresent(rnSvgModulePreparePath, patchPrepareEsm),
  patchIfPresent(rnSvgCommonjsPreparePath, patchPrepareCjs),
  patchIfPresent(rnSvgModuleWebShapePath, patchWebShapeEsm),
  patchIfPresent(rnSvgCommonjsWebShapePath, patchWebShapeCjs),
].some(Boolean);

if (svgPatched) {
  console.log('✓ Patched react-native-svg web touchable helpers');
}

