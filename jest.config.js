const expoPreset = require('jest-expo/jest-preset');

const { setupFiles = [], setupFilesAfterEnv = [], moduleNameMapper = {} } = expoPreset;

const allowListedModules =
  '((jest-)?react-native|@react-native(-community)?|@react-navigation/.*|react-navigation|expo(nent)?|expo-.*|@expo(nent)?/.*|@expo-google-fonts/.*|expo-modules-core|expo-router|standard-navigation|unimodules|@unimodules/.*|sentry-expo|native-base|@sentry/.*|@gorhom/.*|escape-string-regexp|react-native-toast-message|react-native-responsive-screen|react-native-reanimated|yaml|sanitize-html|htmlparser2|domutils|dom-serializer|domhandler|domelementtype|entities)';

/** @type {import('jest').Config} */
module.exports = {
  ...expoPreset,
  testEnvironment: 'jsdom',
  // reanimated 4.7 / worklets 0.13 требуют свой резолвер (web-варианты модулей под Jest);
  // scripts/jest-resolver.js цепляет его к резолверу RN-пресета.
  resolver: '<rootDir>/scripts/jest-resolver.js',
  globalSetup: '<rootDir>/scripts/jest-quality-gate-setup.js',
  globalTeardown: '<rootDir>/scripts/jest-quality-gate-teardown.js',
  setupFiles: ['<rootDir>/jest.expo-globals.js', ...setupFiles],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts', ...setupFilesAfterEnv],
  testMatch: ['**/__tests__/**/*.test.tsx', '**/__tests__/**/*.test.ts'],
  // Пресет трансформирует только `.[jt]sx?`, поэтому ESM-модули проекта с расширением `.mjs`
  // (например `scripts/lib/boardTaskContract.mjs`, общий для аудита борда и PreToolUse-гейта)
  // не грузились в тестах: `SyntaxError: Unexpected token 'export'`. Переиспользуем те же
  // опции babel-jest, что и пресет, чтобы поведение трансформации не разошлось.
  transform: {
    ...expoPreset.transform,
    '\\.mjs$': expoPreset.transform['\\.[jt]sx?$'],
  },
  moduleNameMapper: {
    '^@/components/KeyboardShortcutsHelp$': '<rootDir>/__mocks__/KeyboardShortcutsHelp.tsx',
    ...moduleNameMapper,
    '^@/(.*)$': '<rootDir>/$1',
    // expo-router 58 экспортирует только `./build/*`; vendor-копия react-helmet-async, которую
    // читают SSR-тесты заголовков, доступна лишь абсолютным путём.
    '^expo-router/vendor/(.*)$': '<rootDir>/node_modules/expo-router/vendor/$1',
    '^expo-modules-core(/.*)?$': '<rootDir>/__mocks__/expo-modules-core.js',
    '\\.(svg|png|jpe?g|gif|webp)$': '<rootDir>/__mocks__/fileMock.js',
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
  },
  modulePathIgnorePatterns: [
    '<rootDir>/.claude/',
    '<rootDir>/.codex-temp/',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.claude/',
    '<rootDir>/.codex-temp/',
  ],
  watchPathIgnorePatterns: [
    '<rootDir>/.claude/',
    '<rootDir>/.codex-temp/',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
  ],
  transformIgnorePatterns: [
    `node_modules/(?!${allowListedModules})`,
    '/node_modules/react-native-reanimated/plugin/',
  ],
};
