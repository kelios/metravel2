#!/usr/bin/env node

// Compatibility shims for react-native 0.85.x.
//
// History: under Expo SDK 55 this script also replaced RN codegen entrypoints
// (Modal/Switch/VirtualView native components) and no-op'ed
// @react-native/babel-plugin-codegen, because SDK 55's Babel pipeline could
// not transform RN 0.85 codegen. Under Expo SDK 56 those hacks are not only
// unnecessary — they break the native (Android/iOS) runtime at startup, since
// the New Architecture requires real codegen. Web never used native codegen,
// which is why the breakage only showed on device. Only the harmless
// StyleSheet.absoluteFillObject alias (removed in RN 0.85) is kept.

const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')

const patchFile = (filePath, transform) => {
  if (!fs.existsSync(filePath)) return false

  const previous = fs.readFileSync(filePath, 'utf8')
  const next = transform(previous)

  if (!next || next === previous) return false

  fs.writeFileSync(filePath, next, 'utf8')
  return true
}

const styleSheetExportsPath = path.join(
  projectRoot,
  'node_modules',
  'react-native',
  'Libraries',
  'StyleSheet',
  'StyleSheetExports.js'
)

const styleSheetTypesPath = path.join(
  projectRoot,
  'node_modules',
  'react-native',
  'Libraries',
  'StyleSheet',
  'StyleSheet.d.ts'
)

const runtimePatched = patchFile(styleSheetExportsPath, (source) => {
  if (source.includes('absoluteFillObject: absoluteFill')) return source

  return source.replace(
    /\n {2}absoluteFill,\n/,
    '\n  absoluteFill,\n\n  // Compatibility alias retained for libraries/app code not yet migrated away from the legacy API.\n  absoluteFillObject: absoluteFill,\n'
  )
})

const typesPatched = patchFile(styleSheetTypesPath, (source) => {
  if (source.includes('export const absoluteFillObject: AbsoluteFillStyle;')) return source

  return source.replace(
    /\n {2}export const absoluteFill: AbsoluteFillStyle;\n/,
    '\n  export const absoluteFill: AbsoluteFillStyle;\n\n  /** Compatibility alias retained for existing app code that still references the legacy property. */\n  export const absoluteFillObject: AbsoluteFillStyle;\n'
  )
})

if (runtimePatched || typesPatched) {
  console.log('✓ Patched react-native compatibility shims')
}
