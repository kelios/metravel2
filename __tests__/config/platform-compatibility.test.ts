/**
 * @jest-environment node
 */

import appConfig from '../../app.json';
import packageJson from '../../package.json';

describe('Platform Compatibility Tests', () => {
  describe('Multi-Platform Support', () => {
    it('should have configuration for all platforms', () => {
      expect(appConfig.expo.web).toBeDefined();
      expect(appConfig.expo.ios).toBeDefined();
      expect(appConfig.expo.android).toBeDefined();
    });

    it('should have consistent app name across platforms', () => {
      const appName = appConfig.expo.name;
      expect(appName).toBeDefined();
      expect(appName.length).toBeGreaterThan(0);
    });

    it('should have consistent version across platforms', () => {
      const version = appConfig.expo.version;
      expect(version).toBeDefined();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should have consistent slug', () => {
      const slug = appConfig.expo.slug;
      expect(slug).toBeDefined();
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    });
  });

  describe('Required Dependencies', () => {
    it('should have expo SDK', () => {
      expect(packageJson.dependencies.expo).toBeDefined();
    });

    it('should have react-native', () => {
      expect(packageJson.dependencies['react-native']).toBeDefined();
    });

    it('should have react-native-maps for mobile', () => {
      expect(packageJson.dependencies['react-native-maps']).toBeDefined();
    });

    it('should have web maps alternative', () => {
      expect(packageJson.dependencies['@teovilla/react-native-web-maps']).toBeDefined();
    });

    it('should have expo-router for navigation', () => {
      expect(packageJson.dependencies['expo-router']).toBeDefined();
    });

    it('should have platform-specific image handling', () => {
      expect(packageJson.dependencies['expo-image']).toBeDefined();
      expect(packageJson.dependencies['expo-image-picker']).toBeDefined();
    });

    it('should have location services', () => {
      expect(packageJson.dependencies['expo-location']).toBeDefined();
    });
  });

  describe('Platform-Specific Scripts', () => {
    it('should have iOS build scripts', () => {
      expect(packageJson.scripts['ios:build:dev']).toBeDefined();
      expect(packageJson.scripts['ios:build:preview']).toBeDefined();
      expect(packageJson.scripts['ios:build:prod']).toBeDefined();
    });

    it('should have Android build scripts', () => {
      expect(packageJson.scripts['android:build:dev']).toBeDefined();
      expect(packageJson.scripts['android:build:preview']).toBeDefined();
      expect(packageJson.scripts['android:build:prod']).toBeDefined();
    });

    it('should have multi-platform build scripts', () => {
      expect(packageJson.scripts['build:all:dev']).toBeDefined();
      expect(packageJson.scripts['build:all:preview']).toBeDefined();
      expect(packageJson.scripts['build:all:prod']).toBeDefined();
    });

    it('should have web build scripts', () => {
      expect(packageJson.scripts['web']).toBeDefined();
      expect(packageJson.scripts['build:web']).toBeDefined();
    });
  });

  describe('Icon and Splash Configuration', () => {
    it('should have app icon', () => {
      expect(appConfig.expo.icon).toBeDefined();
      expect(appConfig.expo.icon).toContain('.png');
    });

    it('should have splash screen', () => {
      expect(appConfig.expo.splash).toBeDefined();
      expect(appConfig.expo.splash.image).toBeDefined();
      expect(appConfig.expo.splash.resizeMode).toBeDefined();
    });

    it('should have iOS specific icon', () => {
      // iOS использует общую иконку из expo.icon
      expect(appConfig.expo.icon).toBeDefined();
    });

    it('should have Android adaptive icon', () => {
      expect(appConfig.expo.android.adaptiveIcon).toBeDefined();
      expect(appConfig.expo.android.adaptiveIcon.foregroundImage).toBeDefined();
    });

    it('should have web favicon', () => {
      expect(appConfig.expo.web.favicon).toBeDefined();
    });
  });

  describe('Permissions Compatibility', () => {
    it('iOS should have location permissions', () => {
      expect(appConfig.expo.ios.infoPlist).toBeDefined();
      expect(appConfig.expo.ios.infoPlist.NSLocationWhenInUseUsageDescription).toBeDefined();
    });

    it('Android should have location permissions', () => {
      const permissions = appConfig.expo.android.permissions;
      expect(permissions).toContain('ACCESS_FINE_LOCATION');
      expect(permissions).toContain('ACCESS_COARSE_LOCATION');
    });

    it('iOS should have camera permissions', () => {
      expect(appConfig.expo.ios.infoPlist.NSCameraUsageDescription).toBeDefined();
    });

    it('Android should have camera permissions', () => {
      const permissions = appConfig.expo.android.permissions;
      expect(permissions).toContain('CAMERA');
    });

    it('iOS should have photo library permissions', () => {
      expect(appConfig.expo.ios.infoPlist.NSPhotoLibraryUsageDescription).toBeDefined();
    });

    it('Android should have storage permissions', () => {
      const permissions = appConfig.expo.android.permissions;
      const hasStoragePermission = 
        permissions.includes('READ_EXTERNAL_STORAGE') ||
        permissions.includes('READ_MEDIA_IMAGES');
      expect(hasStoragePermission).toBe(true);
    });
  });

  describe('Maps Configuration', () => {
    it('iOS should have Google Maps API key config', () => {
      expect(appConfig.expo.ios.config).toBeDefined();
      expect(appConfig.expo.ios.config.googleMapsApiKey).toBeDefined();
    });

    it('Android should have Google Maps API key config', () => {
      expect(appConfig.expo.android.config).toBeDefined();
      expect(appConfig.expo.android.config.googleMaps).toBeDefined();
      expect(appConfig.expo.android.config.googleMaps.apiKey).toBeDefined();
    });
  });

  describe('Deep Linking Configuration', () => {
    it('should have scheme defined', () => {
      expect(appConfig.expo.scheme).toBeDefined();
    });

    it('iOS should have associated domains', () => {
      expect(appConfig.expo.ios.associatedDomains).toBeDefined();
      expect(Array.isArray(appConfig.expo.ios.associatedDomains)).toBe(true);
    });

    it('Android should have intent filters', () => {
      expect(appConfig.expo.android.intentFilters).toBeDefined();
      expect(Array.isArray(appConfig.expo.android.intentFilters)).toBe(true);
    });
  });

  describe('Build Configuration Consistency', () => {
    it('should have consistent orientation', () => {
      const orientation = appConfig.expo.orientation;
      expect(orientation).toBeDefined();
      expect(['portrait', 'landscape', 'default']).toContain(orientation);
    });

    it('should have user interface style', () => {
      expect(appConfig.expo.userInterfaceStyle).toBeDefined();
    });

    it('should have asset bundle patterns', () => {
      expect(appConfig.expo.assetBundlePatterns).toBeDefined();
      expect(Array.isArray(appConfig.expo.assetBundlePatterns)).toBe(true);
    });
  });

  describe('Plugin Configuration', () => {
    it('should have expo-router plugin', () => {
      const plugins = appConfig.expo.plugins;
      expect(plugins).toContain('expo-router');
    });

    it('should have expo-location plugin with config', () => {
      const plugins = appConfig.expo.plugins;
      const locationPlugin = plugins.find((p: any) => 
        Array.isArray(p) && p[0] === 'expo-location'
      );
      expect(locationPlugin).toBeDefined();
    });
  });

  describe('Runtime Configuration', () => {
    it('should have runtime version policy', () => {
      expect(appConfig.expo.runtimeVersion).toBeDefined();
      expect(appConfig.expo.runtimeVersion.policy).toBeDefined();
    });

    it('should have EAS project ID', () => {
      expect(appConfig.expo.extra).toBeDefined();
      expect(appConfig.expo.extra.eas).toBeDefined();
      expect(appConfig.expo.extra.eas.projectId).toBeDefined();
    });
  });

  describe('Web Specific Configuration', () => {
    it('should have web bundler', () => {
      expect(appConfig.expo.web.bundler).toBeDefined();
    });

    it('should have web output type', () => {
      expect(appConfig.expo.web.output).toBeDefined();
    });

    it('should have web favicon', () => {
      expect(appConfig.expo.web.favicon).toBeDefined();
    });
  });

  describe('TypeScript Configuration', () => {
    it('should have typescript as dev dependency', () => {
      expect(packageJson.devDependencies.typescript).toBeDefined();
    });

    it('should have type definitions', () => {
      expect(packageJson.devDependencies['@types/react']).toBeDefined();
    });
  });

  describe('Testing Configuration', () => {
    it('should have jest configured', () => {
      expect(packageJson.devDependencies.jest).toBeDefined();
      expect(packageJson.devDependencies['jest-expo']).toBeDefined();
    });

    it('should have testing library', () => {
      expect(packageJson.devDependencies['@testing-library/react-native']).toBeDefined();
    });

    it('should have test scripts', () => {
      expect(packageJson.scripts.test).toBeDefined();
      expect(packageJson.scripts['test:coverage']).toBeDefined();
    });
  });
});
