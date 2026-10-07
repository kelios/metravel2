'use strict'
/* global require, module, __dirname */

const path = require('node:path')
const rootDir = path.resolve(__dirname, '../../..')
const base = require(path.join(rootDir, 'jest.config.js'))
const moduleNameMapper = {
  ...base.moduleNameMapper,
  '^react-native$': 'react-native-web',
  // The actual production Metro web alias, not an icon mock.
  '^@expo/vector-icons/Feather$': '<rootDir>/metro-stubs/FeatherHydrationSafe.web.tsx',
}
delete moduleNameMapper['^expo-modules-core(/.*)?$']

module.exports = {
  ...base,
  rootDir,
  roots: [__dirname],
  testMatch: ['**/tripsStaticRender/fixture.tsx'],
  setupFiles: [path.join(__dirname, 'setup.cjs'), ...base.setupFiles],
  // Global native-suite setup mocks Head and suppresses console events. This
  // fixture keeps the actual Head/UI and records every console/error event.
  setupFilesAfterEnv: [],
  haste: { defaultPlatform: 'web', platforms: ['web'] },
  moduleFileExtensions: ['web.tsx', 'web.ts', 'web.js', 'ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper,
  resolver: path.join(__dirname, 'resolver.cjs'),
  transform: Object.fromEntries(Object.entries(base.transform).map(([key, value]) => [
    key,
    Array.isArray(value) && value[0] === 'babel-jest'
      ? [value[0], { ...value[1], caller: { ...value[1].caller, platform: 'web' } }]
      : value,
  ])),
}
