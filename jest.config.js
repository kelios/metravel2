const expoPreset = require('jest-expo/jest-preset');

const { setupFiles = [], setupFilesAfterEnv = [], moduleNameMapper = {} } = expoPreset;

const allowListedModules =
  '((jest-)?react-native|@react-native(-community)?|@react-navigation/.*|react-navigation|expo(nent)?|expo-.*|@expo(nent)?/.*|@expo-google-fonts/.*|expo-modules-core|expo-router|unimodules|@unimodules/.*|sentry-expo|native-base|@sentry/.*|@gorhom/.*|escape-string-regexp|react-native-toast-message|react-native-responsive-screen|react-native-reanimated)';

/** @type {import('jest').Config} */
module.exports = {
  ...expoPreset,
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/jest.expo-globals.js', ...setupFiles],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts', ...setupFilesAfterEnv],
  testMatch: ['**/__tests__/**/*.test.tsx', '**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    ...moduleNameMapper,
    '^@/(.*)$': '<rootDir>/$1',
    '^expo-modules-core(/.*)?$': '<rootDir>/__mocks__/expo-modules-core.js',
    '\\.(svg|png|jpe?g|gif|webp)$': '<rootDir>/__mocks__/fileMock.js',
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
  },
  transformIgnorePatterns: [
    `node_modules/(?!${allowListedModules})`,
    '/node_modules/react-native-reanimated/plugin/',
  ],
};

