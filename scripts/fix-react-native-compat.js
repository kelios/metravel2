#!/usr/bin/env node

// Compatibility shim for react-native 0.88.x (Expo SDK 58, #2727).
//
// History: under Expo SDK 55 this script also replaced RN codegen entrypoints
// (Modal/Switch/VirtualView native components) and no-op'ed
// @react-native/babel-plugin-codegen, because SDK 55's Babel pipeline could
// not transform RN 0.85 codegen. Under Expo SDK 56+ those hacks are not only
// unnecessary — they break the native (Android/iOS) runtime at startup, since
// the New Architecture requires real codegen. Web never used native codegen,
// which is why the breakage only showed on device.
//
// What is left is the runtime alias `StyleSheet.absoluteFillObject` (removed
// from RN core in 0.85). First-party sources use `StyleSheet.absoluteFill`
// since SDK 58; the alias stays only for third-party code that still reads the
// legacy property at runtime (e.g. @expo/log-box). RN 0.88 ships generated
// typings (`types_generated/`), so the former `.d.ts` shim no longer applies
// and is not attempted.

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

const runtimePatched = patchFile(styleSheetExportsPath, (source) => {
  if (source.includes('absoluteFillObject: absoluteFill')) return source

  return source.replace(
    /\n {2}absoluteFill,\n/,
    '\n  absoluteFill,\n\n  // Compatibility alias retained for libraries/app code not yet migrated away from the legacy API.\n  absoluteFillObject: absoluteFill,\n'
  )
})

if (runtimePatched) {
  console.log('✓ Patched react-native compatibility shims')
}
