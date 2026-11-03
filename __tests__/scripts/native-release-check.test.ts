/** @jest-environment node */
const { selectTests } = require('../../scripts/native-release-check')

const shared = [
  'config/native-compat-governance.test.ts',
  'components/travel/UpsertTravel.createEditFlow.test.tsx',
  'components/MapPage/Map/nativeTileBridge.network.test.ts',
  'services/pdf-export/bookGolden.native.test.ts',
  'i18n/localeFormatting.test.ts',
]
const android = [
  'config/android-config.test.ts',
  'config/android-native-compat-governance.test.ts',
  'components/UpsertTravel.androidBackgroundSave.native.test.tsx',
]
const ios = ['config/ios-release-config.test.ts', 'components/auth/AppleSignInButton.native.test.tsx']
const outside = [
  'services/pdf-export/bookRendererWorker.test.ts',
  'components/Map.web.test.tsx',
  'scripts/metro-cache-inputs.test.ts',
  'i18n/ssrRequestLocale.test.ts',
  'i18n/webBootCatalogSubset.test.ts',
]
const files = [...shared, ...android, ...ios, ...outside]

it.each([['android', android], ['ios', ios]])('selects shared native and %s suites', (platform, target) => {
  expect(selectTests(files, platform)).toEqual([...shared, ...target].sort())
})
