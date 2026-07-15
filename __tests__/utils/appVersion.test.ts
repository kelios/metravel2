import { createAppVersionInfo } from '@/utils';

describe('appVersion', () => {
  it('formats Android version with versionCode and package', () => {
    const info = createAppVersionInfo(
      {
        expoConfig: {
          version: '1.2.3',
          android: {
            package: 'by.metravel.app',
            versionCode: 42,
          },
        },
      },
      'android',
      false
    );

    expect(info).toEqual({
      appVersion: '1.2.3',
      buildVersion: '42',
      displayVersion: 'Android 1.2.3 · сборка 42 · release',
      packageName: 'by.metravel.app',
      platformLabel: 'Android',
    });
  });

  it('prefers native version values when available', () => {
    const info = createAppVersionInfo(
      {
        nativeAppVersion: '2.0.0',
        nativeBuildVersion: '77',
        expoConfig: {
          version: '1.2.3',
          android: {
            versionCode: 42,
          },
        },
      },
      'android',
      true
    );

    expect(info.displayVersion).toBe('Android 2.0.0 · сборка 77 · dev');
  });

  it('formats web without a native build number', () => {
    const info = createAppVersionInfo(
      {
        expoConfig: {
          version: '1.2.3',
        },
      },
      'web',
      false
    );

    expect(info.displayVersion).toBe('Web 1.2.3 · release');
    expect(info.buildVersion).toBeUndefined();
  });
});
