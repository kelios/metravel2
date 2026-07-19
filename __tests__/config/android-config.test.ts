/**
 * @jest-environment node
 */

export {};

const fs = require('fs');
const path = require('path');

const readAppConfig = () => {
  const raw = fs.readFileSync(path.join(__dirname, '../../app.json'), 'utf8');
  return JSON.parse(raw);
};

const easConfig = require('../../eas.json');

describe('Android Configuration Tests', () => {
  describe('app.json Android Configuration', () => {
    it('should have valid Android configuration', () => {
      const appConfig = readAppConfig();
      expect(appConfig.expo.android).toBeDefined();
    });

    it('should allow Android large-screen orientation and resizing behavior', () => {
      const appConfig = readAppConfig();
      expect(appConfig.expo.orientation).toBe('default');
    });

    it('should have correct package name', () => {
      const appConfig = readAppConfig();
      const packageName = appConfig.expo.android.package;
      expect(packageName).toBeDefined();
      expect(packageName).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
    });

    it('should have versionCode', () => {
      const appConfig = readAppConfig();
      expect(appConfig.expo.android.versionCode).toBeDefined();
      expect(typeof appConfig.expo.android.versionCode).toBe('number');
      expect(appConfig.expo.android.versionCode).toBeGreaterThan(0);
    });

    it('should have adaptive icon configuration', () => {
      const appConfig = readAppConfig();
      expect(appConfig.expo.android.adaptiveIcon).toBeDefined();
      expect(appConfig.expo.android.adaptiveIcon.foregroundImage).toBeDefined();
      expect(appConfig.expo.android.adaptiveIcon.backgroundColor).toBeDefined();
    });

    it('should have required permissions', () => {
      const appConfig = readAppConfig();
      const permissions = appConfig.expo.android.permissions;
      expect(permissions).toBeDefined();
      expect(Array.isArray(permissions)).toBe(true);

      // Проверяем критичные permissions
      expect(permissions).toContain('ACCESS_FINE_LOCATION');
      expect(permissions).toContain('ACCESS_COARSE_LOCATION');
    });

    it('should have Google Maps API configuration', () => {
      const appConfig = readAppConfig();
      expect(appConfig.expo.android?.config?.googleMaps?.apiKey).toBeUndefined();
    });

    it('should have intent filters for deep linking', () => {
      const appConfig = readAppConfig();
      expect(appConfig.expo.android.intentFilters).toBeDefined();
      expect(Array.isArray(appConfig.expo.android.intentFilters)).toBe(true);
      expect(appConfig.expo.android.intentFilters.length).toBeGreaterThan(0);
    });

    it('should have permissions configured', () => {
      const appConfig = readAppConfig();
      expect(appConfig.expo.android.permissions).toBeDefined();
      expect(Array.isArray(appConfig.expo.android.permissions)).toBe(true);
    });
  });

  describe('eas.json Android cloud-build guard', () => {
    it.each(['development', 'preview', 'production'])('%s profile does not enable Android EAS', (profile) => {
      expect(easConfig.build[profile].android).toBeUndefined();
    });

    it('does not enable Android EAS submit', () => {
      expect(easConfig.submit.production.android).toBeUndefined();
    });
  });

  describe('Version Consistency', () => {
    it('should have consistent version across platforms', () => {
      const appConfig = readAppConfig();
      const version = appConfig.expo.version;
      expect(version).toBeDefined();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('Android versionCode should be integer', () => {
      const appConfig = readAppConfig();
      const versionCode = appConfig.expo.android.versionCode;
      expect(Number.isInteger(versionCode)).toBe(true);
    });

    it('Android Gradle versionCode should be sourced from app config', () => {
      const gradle = fs.readFileSync(
        path.join(__dirname, '../../android/app/build.gradle'),
        'utf8'
      );
      expect(gradle).toMatch(
        /def androidVersionCode = appConfig\.expo\.android\.versionCode as Integer/
      );
      expect(gradle).toMatch(/versionCode\s+androidVersionCode/);
    });

    it('iOS buildNumber should exist for comparison', () => {
      const appConfig = readAppConfig();
      expect(appConfig.expo.ios.buildNumber).toBeDefined();
    });
  });

  describe('Package Name Consistency', () => {
    it('package name should match across iOS and Android pattern', () => {
      const appConfig = readAppConfig();
      const androidPackage = appConfig.expo.android.package;
      const iosBundle = appConfig.expo.ios.bundleIdentifier;

      // Оба должны следовать обратной доменной нотации
      expect(androidPackage).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
      expect(iosBundle).toMatch(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/);
    });
  });

  describe('Required Assets', () => {
    it('should reference adaptive icon', () => {
      const appConfig = readAppConfig();
      const adaptiveIcon = appConfig.expo.android.adaptiveIcon.foregroundImage;
      expect(adaptiveIcon).toContain('assets/images/adaptive-icon.png');
    });

    it('should have icon reference', () => {
      const appConfig = readAppConfig();
      expect(appConfig.expo.icon).toBeDefined();
      expect(appConfig.expo.icon).toContain('assets/images/icon.png');
    });

    it('should have splash screen reference (expo-splash-screen plugin, SDK 56 schema)', () => {
      const appConfig = readAppConfig();
      const splashPlugin = appConfig.expo.plugins.find(
        (plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen'
      );
      expect(splashPlugin).toBeDefined();
      expect(splashPlugin[1].image).toContain('assets/images/splash.png');
    });
  });

  describe('Permissions Validation', () => {
    it('should not have unnecessary dangerous permissions', () => {
      const appConfig = readAppConfig();
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

    it('should block unused microphone and advertising ID permissions', () => {
      const appConfig = readAppConfig();
      const blockedPermissions = appConfig.expo.android.blockedPermissions;

      expect(blockedPermissions).toEqual(expect.arrayContaining([
        'android.permission.RECORD_AUDIO',
        'com.google.android.gms.permission.AD_ID',
        'android.permission.ACCESS_ADSERVICES_AD_ID',
      ]));
    });
  });

  describe('Deep Linking Configuration', () => {
    it('should have valid intent filter structure', () => {
      const appConfig = readAppConfig();
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
      const appConfig = readAppConfig();
      const intentFilters = appConfig.expo.android.intentFilters;
      const hasHttps = intentFilters.some((filter: any) =>
        filter.data.some((d: any) => d.scheme === 'https')
      );
      expect(hasHttps).toBe(true);
    });
  });

  describe('Android large-screen manifest compatibility', () => {
    const readManifest = () =>
      fs.readFileSync(
        path.join(__dirname, '../../android/app/src/main/AndroidManifest.xml'),
        'utf8'
      );

    it('does not restrict MainActivity orientation', () => {
      const manifest = readManifest();
      expect(manifest).not.toContain('android:screenOrientation=');
    });

    it('declares MainActivity as resizeable', () => {
      const manifest = readManifest();
      expect(manifest).toContain('android:resizeableActivity="true"');
    });
  });
});
