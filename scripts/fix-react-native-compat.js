#!/usr/bin/env node

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

const replaceFile = (filePath, content) => {
  if (!fs.existsSync(filePath)) return false

  const previous = fs.readFileSync(filePath, 'utf8')
  if (previous === content) return false

  fs.writeFileSync(filePath, content, 'utf8')
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

const modalNativeComponentPath = path.join(
  projectRoot,
  'node_modules',
  'react-native',
  'Libraries',
  'Modal',
  'RCTModalHostViewNativeComponent.js'
)

const androidSwitchNativeComponentPath = path.join(
  projectRoot,
  'node_modules',
  'react-native',
  'Libraries',
  'Components',
  'Switch',
  'AndroidSwitchNativeComponent.js'
)

const virtualViewExperimentalNativeComponentPath = path.join(
  projectRoot,
  'node_modules',
  'react-native',
  'src',
  'private',
  'components',
  'virtualview',
  'VirtualViewExperimentalNativeComponent.js'
)

const virtualViewNativeComponentPath = path.join(
  projectRoot,
  'node_modules',
  'react-native',
  'src',
  'private',
  'components',
  'virtualview',
  'VirtualViewNativeComponent.js'
)

const codegenPluginPath = path.join(
  projectRoot,
  'node_modules',
  '@react-native',
  'babel-plugin-codegen',
  'index.js'
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

const modalPatched = replaceFile(
  modalNativeComponentPath,
  `/**
 * Compatibility shim for Expo 55 + React Native 0.85.x.
 * Falls back to requireNativeComponent instead of codegen entrypoints
 * that Expo 55's Babel pipeline cannot currently transform.
 */

'use strict'

import requireNativeComponent from '../ReactNative/requireNativeComponent'

export default requireNativeComponent('RCTModalHostView')
`
)

const switchPatched = replaceFile(
  androidSwitchNativeComponentPath,
  `/**
 * Compatibility shim for Expo 55 + React Native 0.85.x.
 * Falls back to requireNativeComponent instead of codegen entrypoints
 * that Expo 55's Babel pipeline cannot currently transform.
 */

'use strict'

import requireNativeComponent from '../../ReactNative/requireNativeComponent'

export default requireNativeComponent('AndroidSwitch')
`
)

const virtualViewPatched = replaceFile(
  virtualViewExperimentalNativeComponentPath,
  `/**
 * Compatibility shim for Expo 55 + React Native 0.85.x.
 * Falls back to requireNativeComponent instead of codegen entrypoints
 * that Expo 55's Babel pipeline cannot currently transform.
 */

'use strict'

import requireNativeComponent from '../../../../Libraries/ReactNative/requireNativeComponent'

export default requireNativeComponent('VirtualViewExperimental')
`
)

const virtualViewBasePatched = replaceFile(
  virtualViewNativeComponentPath,
  `/**
 * Compatibility shim for Expo 55 + React Native 0.85.x.
 * Falls back to requireNativeComponent instead of codegen entrypoints
 * that Expo 55's Babel pipeline cannot currently transform.
 */

'use strict'

import requireNativeComponent from '../../../../Libraries/ReactNative/requireNativeComponent'

export default requireNativeComponent('VirtualView')
`
)

const codegenPluginPatched = replaceFile(
  codegenPluginPath,
  `/**
 * Compatibility shim for Expo 55 + React Native 0.85.x.
 * Expo 55's Babel pipeline cannot safely run RN 0.85 codegen transforms,
 * so we intentionally disable the transform until the Expo/RN upgrade wave.
 */

'use strict'

const reactNativeCodegenCompatPlugin = () => ({
  name: '@react-native/babel-plugin-codegen-compat-noop',
  visitor: {},
})

module.exports = reactNativeCodegenCompatPlugin
module.exports.default = reactNativeCodegenCompatPlugin
`
)

if (
  runtimePatched ||
  typesPatched ||
  modalPatched ||
  switchPatched ||
  virtualViewPatched ||
  virtualViewBasePatched ||
  codegenPluginPatched
) {
  console.log('✓ Patched react-native compatibility shims')
}





