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
    '^lucide-react-native/dist/esm/icons/.*$': '<rootDir>/__mocks__/lucideIconMock.js',
    '\\.(svg|png|jpe?g|gif|webp)$': '<rootDir>/__mocks__/fileMock.js',
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/components/Map',
    '<rootDir>/components/MapPage/',
    '<rootDir>/components/MapUploadComponent',
    '<rootDir>/components/imageUpload/',
    '<rootDir>/components/travel/ImageGalleryComponent',
    '<rootDir>/components/ArticleEditor.web.tsx',
    '<rootDir>/components/export/BookSettingsModal.tsx',
    '<rootDir>/components/export/GalleryLayoutSelector.tsx',
  ],
  transformIgnorePatterns: [
    `node_modules/(?!${allowListedModules})`,
    '/node_modules/react-native-reanimated/plugin/',
  ],
};
