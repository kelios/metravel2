const expoPreset = require('jest-expo/jest-preset');

const {
  setupFiles = [],
  setupFilesAfterEnv = [],
  moduleNameMapper = {},
  transformIgnorePatterns = [],
} = expoPreset;

/** @type {import('jest').Config} */
module.exports = {
  ...expoPreset,
  setupFiles: ['<rootDir>/jest.expo-globals.js', ...setupFiles],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts', ...setupFilesAfterEnv],
  testMatch: ['**/__tests__/**/*.test.tsx', '**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    ...moduleNameMapper,
    '^@/(.*)$': '<rootDir>/$1',
    '^expo-modules-core(/.*)?$': '<rootDir>/__mocks__/expo-modules-core.js',
    '\\.(svg|png|jpe?g|gif|webp)$': '<rootDir>/__mocks__/fileMock.js',
  },
  transformIgnorePatterns: [
    ...transformIgnorePatterns,
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation/.*|react-navigation|expo(nent)?|expo-.*|@expo(nent)?/.*|expo-modules-core|expo-router|unimodules|@unimodules/.*|sentry-expo|native-base|@sentry/.*|@gorhom/.*|escape-string-regexp|react-native-toast-message|react-native-responsive-screen|react-native-reanimated)/)',
  ],
};

