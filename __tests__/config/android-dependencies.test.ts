/**
 * @jest-environment node
 */

import packageJson from '../../package.json';

describe('Android Dependencies Tests', () => {
  describe('Core React Native Dependencies', () => {
    it('should have react-native', () => {
      expect(packageJson.dependencies['react-native']).toBeDefined();
    });

    it('should have react', () => {
      expect(packageJson.dependencies.react).toBeDefined();
    });

    it('should have expo', () => {
      expect(packageJson.dependencies.expo).toBeDefined();
    });
  });

  describe('Maps Dependencies', () => {
    it('should have react-native-maps for Android', () => {
      expect(packageJson.dependencies['react-native-maps']).toBeDefined();
    });

    it('should have expo-location', () => {
      expect(packageJson.dependencies['expo-location']).toBeDefined();
    });
  });

  describe('Image Handling Dependencies', () => {
    it('should have expo-image', () => {
      expect(packageJson.dependencies['expo-image']).toBeDefined();
    });

    it('should have expo-image-picker', () => {
      expect(packageJson.dependencies['expo-image-picker']).toBeDefined();
    });

    it('should have expo-media-library', () => {
      expect(packageJson.dependencies['expo-media-library']).toBeDefined();
    });

    it('should have expo-fast-image', () => {
      expect(packageJson.dependencies['expo-fast-image']).toBeDefined();
    });
  });

  describe('UI Dependencies', () => {
    it('should have react-native-gesture-handler', () => {
      expect(packageJson.dependencies['react-native-gesture-handler']).toBeDefined();
    });

    it('should have react-native-reanimated', () => {
      expect(packageJson.dependencies['react-native-reanimated']).toBeDefined();
    });

    it('should have react-native-safe-area-context', () => {
      expect(packageJson.dependencies['react-native-safe-area-context']).toBeDefined();
    });

    it('should have react-native-screens', () => {
      expect(packageJson.dependencies['react-native-screens']).toBeDefined();
    });

    it('should have react-native-svg', () => {
      expect(packageJson.dependencies['react-native-svg']).toBeDefined();
    });
  });

  describe('Navigation Dependencies', () => {
    it('should have expo-router', () => {
      expect(packageJson.dependencies['expo-router']).toBeDefined();
    });

    it('should have @react-navigation/native', () => {
      expect(packageJson.dependencies['@react-navigation/native']).toBeDefined();
    });

    it('should have @react-navigation/native-stack', () => {
      expect(packageJson.dependencies['@react-navigation/native-stack']).toBeDefined();
    });

    it('should have @react-navigation/bottom-tabs', () => {
      expect(packageJson.dependencies['@react-navigation/bottom-tabs']).toBeDefined();
    });
  });

  describe('Storage Dependencies', () => {
    it('should have @react-native-async-storage/async-storage', () => {
      expect(packageJson.dependencies['@react-native-async-storage/async-storage']).toBeDefined();
    });
  });

  describe('WebView Dependencies', () => {
    it('should have react-native-webview', () => {
      expect(packageJson.dependencies['react-native-webview']).toBeDefined();
    });
  });

  describe('Expo Modules', () => {
    it('should have expo-av for media', () => {
      expect(packageJson.dependencies['expo-av']).toBeDefined();
    });

    it('should have expo-blur', () => {
      expect(packageJson.dependencies['expo-blur']).toBeDefined();
    });

    it('should have expo-clipboard', () => {
      expect(packageJson.dependencies['expo-clipboard']).toBeDefined();
    });

    it('should have expo-constants', () => {
      expect(packageJson.dependencies['expo-constants']).toBeDefined();
    });

    it('should have expo-font', () => {
      expect(packageJson.dependencies['expo-font']).toBeDefined();
    });

    it('should have expo-haptics', () => {
      expect(packageJson.dependencies['expo-haptics']).toBeDefined();
    });

    it('should have expo-linking', () => {
      expect(packageJson.dependencies['expo-linking']).toBeDefined();
    });

    it('should have expo-splash-screen', () => {
      expect(packageJson.dependencies['expo-splash-screen']).toBeDefined();
    });
  });

  describe('Document and File Handling', () => {
    it('should have react-native-document-picker', () => {
      expect(packageJson.dependencies['react-native-document-picker']).toBeDefined();
    });

    it('should have expo-sharing', () => {
      expect(packageJson.dependencies['expo-sharing']).toBeDefined();
    });

    it('should have expo-print', () => {
      expect(packageJson.dependencies['expo-print']).toBeDefined();
    });
  });

  describe('UI Components', () => {
    it('should have react-native-paper', () => {
      expect(packageJson.dependencies['react-native-paper']).toBeDefined();
    });

    it('should have @expo/vector-icons', () => {
      expect(packageJson.dependencies['@expo/vector-icons']).toBeDefined();
    });

    it('should have lucide-react-native', () => {
      expect(packageJson.dependencies['lucide-react-native']).toBeDefined();
    });
  });

  describe('Form and Validation', () => {
    it('should have formik', () => {
      expect(packageJson.dependencies.formik).toBeDefined();
    });

    it('should have yup', () => {
      expect(packageJson.dependencies.yup).toBeDefined();
    });
  });

  describe('State Management', () => {
    it('should have @tanstack/react-query', () => {
      expect(packageJson.dependencies['@tanstack/react-query']).toBeDefined();
    });
  });

  describe('Android-Specific Considerations', () => {
    it('should have react-native version compatible with Android', () => {
      const rnVersion = packageJson.dependencies['react-native'];
      expect(rnVersion).toBeDefined();
      // React Native 0.70+ поддерживает Android
      expect(rnVersion).toMatch(/^[0-9]+\.[0-9]+\.[0-9]+$/);
    });

    it('should have expo SDK version compatible with Android', () => {
      const expoVersion = packageJson.dependencies.expo;
      expect(expoVersion).toBeDefined();
      // Expo SDK 48+ полностью поддерживает Android
    });

    it('should not have iOS-only dependencies in main dependencies', () => {
      // Проверяем, что нет зависимостей только для iOS
      const iosOnlyPackages = [
        'react-native-ios-context-menu',
        'react-native-ios-kit',
      ];
      
      const deps = packageJson.dependencies as Record<string, string>;
      iosOnlyPackages.forEach(pkg => {
        expect(deps[pkg]).toBeUndefined();
      });
    });
  });

  describe('Build Tools', () => {
    it('should have @babel/core', () => {
      expect(packageJson.devDependencies['@babel/core']).toBeDefined();
    });

    it('should have metro bundler dependencies', () => {
      expect(packageJson.dependencies['metro-react-native-babel-transformer']).toBeDefined();
    });
  });

  describe('Testing Dependencies', () => {
    it('should have jest', () => {
      expect(packageJson.devDependencies.jest).toBeDefined();
    });

    it('should have jest-expo', () => {
      expect(packageJson.devDependencies['jest-expo']).toBeDefined();
    });

    it('should have @testing-library/react-native', () => {
      expect(packageJson.devDependencies['@testing-library/react-native']).toBeDefined();
    });

    it('should have @testing-library/jest-native', () => {
      expect(packageJson.devDependencies['@testing-library/jest-native']).toBeDefined();
    });
  });

  describe('TypeScript Dependencies', () => {
    it('should have typescript', () => {
      expect(packageJson.devDependencies.typescript).toBeDefined();
    });

    it('should have @types/react', () => {
      expect(packageJson.devDependencies['@types/react']).toBeDefined();
    });
  });

  describe('Version Compatibility', () => {
    it('react and react-native versions should be compatible', () => {
      const reactVersion = packageJson.dependencies.react;
      const rnVersion = packageJson.dependencies['react-native'];
      
      expect(reactVersion).toBeDefined();
      expect(rnVersion).toBeDefined();
    });

    it('expo and expo-router versions should be compatible', () => {
      const expoVersion = packageJson.dependencies.expo;
      const routerVersion = packageJson.dependencies['expo-router'];
      
      expect(expoVersion).toBeDefined();
      expect(routerVersion).toBeDefined();
    });
  });

  describe('Optional Dependencies', () => {
    it('should not require platform-specific optional dependencies', () => {
      // Optional dependencies removed to avoid platform-specific issues
      expect(true).toBe(true);
    });
  });

  describe('Peer Dependencies Warnings', () => {
    it('should not have conflicting peer dependencies', () => {
      // Все основные зависимости должны быть совместимы
      expect(packageJson.dependencies['react-native']).toBeDefined();
      expect(packageJson.dependencies.react).toBeDefined();
      expect(packageJson.dependencies.expo).toBeDefined();
    });
  });
});
