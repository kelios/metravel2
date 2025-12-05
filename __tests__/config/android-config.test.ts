/**
 * @jest-environment node
 */

import appConfig from '../../app.json';
import easConfig from '../../eas.json';

describe('Android Configuration Tests', () => {
  describe('app.json Android Configuration', () => {
    it('should have valid Android configuration', () => {
      expect(appConfig.expo.android).toBeDefined();
    });

    it('should have correct package name', () => {
      const packageName = appConfig.expo.android.package;
      expect(packageName).toBeDefined();
      expect(packageName).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
    });

    it('should have versionCode', () => {
      expect(appConfig.expo.android.versionCode).toBeDefined();
      expect(typeof appConfig.expo.android.versionCode).toBe('number');
      expect(appConfig.expo.android.versionCode).toBeGreaterThan(0);
    });

    it('should have adaptive icon configuration', () => {
      expect(appConfig.expo.android.adaptiveIcon).toBeDefined();
      expect(appConfig.expo.android.adaptiveIcon.foregroundImage).toBeDefined();
      expect(appConfig.expo.android.adaptiveIcon.backgroundColor).toBeDefined();
    });

    it('should have required permissions', () => {
      const permissions = appConfig.expo.android.permissions;
      expect(permissions).toBeDefined();
      expect(Array.isArray(permissions)).toBe(true);
      
      // Проверяем критичные permissions
      expect(permissions).toContain('ACCESS_FINE_LOCATION');
      expect(permissions).toContain('ACCESS_COARSE_LOCATION');
    });

    it('should have Google Maps API configuration', () => {
      expect(appConfig.expo.android.config).toBeDefined();
      expect(appConfig.expo.android.config.googleMaps).toBeDefined();
      expect(appConfig.expo.android.config.googleMaps.apiKey).toBeDefined();
    });

    it('should have intent filters for deep linking', () => {
      expect(appConfig.expo.android.intentFilters).toBeDefined();
      expect(Array.isArray(appConfig.expo.android.intentFilters)).toBe(true);
      expect(appConfig.expo.android.intentFilters.length).toBeGreaterThan(0);
    });

    it('should have google services file path', () => {
      expect(appConfig.expo.android.googleServicesFile).toBeDefined();
      expect(appConfig.expo.android.googleServicesFile).toContain('google-services.json');
    });
  });

  describe('eas.json Android Build Configuration', () => {
    it('should have Android build profiles', () => {
      expect(easConfig.build.development.android).toBeDefined();
      expect(easConfig.build.preview.android).toBeDefined();
      expect(easConfig.build.production.android).toBeDefined();
    });

    it('development profile should build APK', () => {
      expect(easConfig.build.development.android.buildType).toBe('apk');
    });

    it('preview profile should build APK', () => {
      expect(easConfig.build.preview.android.buildType).toBe('apk');
    });

    it('production profile should build AAB', () => {
      expect(easConfig.build.production.android.buildType).toBe('app-bundle');
    });

    it('production profile should have autoIncrement', () => {
      expect(easConfig.build.production.android.autoIncrement).toBe(true);
    });

    it('should have Android submit configuration', () => {
      expect(easConfig.submit.production.android).toBeDefined();
      expect(easConfig.submit.production.android.serviceAccountKeyPath).toBeDefined();
      expect(easConfig.submit.production.android.track).toBeDefined();
    });
  });

  describe('Version Consistency', () => {
    it('should have consistent version across platforms', () => {
      const version = appConfig.expo.version;
      expect(version).toBeDefined();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('Android versionCode should be integer', () => {
      const versionCode = appConfig.expo.android.versionCode;
      expect(Number.isInteger(versionCode)).toBe(true);
    });

    it('iOS buildNumber should exist for comparison', () => {
      expect(appConfig.expo.ios.buildNumber).toBeDefined();
    });
  });

  describe('Package Name Consistency', () => {
    it('package name should match across iOS and Android pattern', () => {
      const androidPackage = appConfig.expo.android.package;
      const iosBundle = appConfig.expo.ios.bundleIdentifier;
      
      // Оба должны следовать обратной доменной нотации
      expect(androidPackage).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
      expect(iosBundle).toMatch(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/);
    });
  });

  describe('Required Assets', () => {
    it('should reference adaptive icon', () => {
      const adaptiveIcon = appConfig.expo.android.adaptiveIcon.foregroundImage;
      expect(adaptiveIcon).toContain('assets/images/adaptive-icon.png');
    });

    it('should have icon reference', () => {
      expect(appConfig.expo.icon).toBeDefined();
      expect(appConfig.expo.icon).toContain('assets/images/icon.png');
    });

    it('should have splash screen reference', () => {
      expect(appConfig.expo.splash).toBeDefined();
      expect(appConfig.expo.splash.image).toContain('assets/images/splash.png');
    });
  });

  describe('Permissions Validation', () => {
    it('should not have unnecessary dangerous permissions', () => {
      const permissions = appConfig.expo.android.permissions;
      
      // Проверяем, что нет лишних опасных разрешений
      const dangerousPermissions = [
        'READ_CONTACTS',
        'WRITE_CONTACTS',
        'READ_CALL_LOG',
        'WRITE_CALL_LOG',
        'READ_SMS',
        'SEND_SMS',
      ];
      
      dangerousPermissions.forEach(permission => {
        expect(permissions).not.toContain(permission);
      });
    });

    it('should have blocked permissions if specified', () => {
      if (appConfig.expo.android.blockedPermissions) {
        expect(Array.isArray(appConfig.expo.android.blockedPermissions)).toBe(true);
      }
    });
  });

  describe('Deep Linking Configuration', () => {
    it('should have valid intent filter structure', () => {
      const intentFilters = appConfig.expo.android.intentFilters;
      
      intentFilters.forEach((filter: any) => {
        expect(filter.action).toBeDefined();
        expect(filter.data).toBeDefined();
        expect(Array.isArray(filter.data)).toBe(true);
        expect(filter.category).toBeDefined();
        expect(Array.isArray(filter.category)).toBe(true);
      });
    });

    it('should have HTTPS scheme for deep links', () => {
      const intentFilters = appConfig.expo.android.intentFilters;
      const hasHttps = intentFilters.some((filter: any) => 
        filter.data.some((d: any) => d.scheme === 'https')
      );
      expect(hasHttps).toBe(true);
    });
  });
});
