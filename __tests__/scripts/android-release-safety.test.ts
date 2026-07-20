import fs from 'fs';
import path from 'path';

const {
  PROTECTED_TRACKS,
  assertProtectedTracksUnchanged,
  maxVersionCodeFromTracks,
  normalizeTrack,
  parseArgs,
} = require('../../scripts/android-play-release');
const {
  getFacebookBuildConfig,
  readAndroidResource,
} = require('../../scripts/android-gradle-build');

const ROOT = path.resolve(__dirname, '../..');

describe('Android release safety contract', () => {
  it('contains no Android or all-platform EAS commands', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const scripts = Object.values(packageJson.scripts).join('\n');

    expect(scripts).not.toMatch(/eas\s+build[^\n]*--platform\s+android/);
    expect(scripts).not.toMatch(/eas\s+submit[^\n]*--platform\s+android/);
    expect(scripts).not.toMatch(/eas\s+(?:build|submit)[^\n]*--platform\s+all/);
  });

  it('keeps eas.json iOS-only', () => {
    const easConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'eas.json'), 'utf8'));

    expect(JSON.stringify(easConfig)).not.toContain('"android"');
  });

  it('does not allow a caller-selected Play track', () => {
    expect(PROTECTED_TRACKS).toEqual(['alpha', 'internal', 'beta']);
    expect(() => parseArgs(['upload-production', '--track', 'alpha'])).toThrow(
      'unsupported argument: --track'
    );
    expect(() => parseArgs(['upload-production', '--aab'])).toThrow('--aab requires a path');
  });

  it('detects any change to a protected track snapshot', () => {
    const alpha = normalizeTrack({
      track: 'alpha',
      releases: [{ status: 'completed', versionCodes: ['11'] }],
    });
    const emptyInternal = normalizeTrack({ track: 'internal', releases: [] });
    const emptyBeta = normalizeTrack({ track: 'beta', releases: [] });
    const before = { alpha, internal: emptyInternal, beta: emptyBeta };

    expect(() => assertProtectedTracksUnchanged(before, before)).not.toThrow();
    expect(() =>
      assertProtectedTracksUnchanged(before, {
        ...before,
        alpha: normalizeTrack({
          track: 'alpha',
          releases: [{ status: 'completed', versionCodes: ['12'] }],
        }),
      })
    ).toThrow('protected Google Play track changed inside the edit: alpha');
  });

  it('requires a new versionCode instead of reusing the closed-test build', () => {
    expect(
      maxVersionCodeFromTracks([
        { track: 'alpha', releases: [{ status: 'completed', versionCodes: ['11'] }] },
        { track: 'production', releases: [] },
      ])
    ).toBe(11);
  });

  it('never configures the release build with the debug signing key', () => {
    const gradle = fs.readFileSync(path.join(ROOT, 'android/app/build.gradle'), 'utf8');
    const buildTypesStart = gradle.indexOf('buildTypes {');
    const packagingOptionsStart = gradle.indexOf('packagingOptions {', buildTypesStart);
    expect(buildTypesStart).toBeGreaterThan(-1);
    expect(packagingOptionsStart).toBeGreaterThan(buildTypesStart);

    const buildTypesBlock = gradle.slice(buildTypesStart, packagingOptionsStart);
    const releaseBlock = buildTypesBlock.slice(buildTypesBlock.indexOf('release {'));

    expect(releaseBlock).not.toMatch(/signingConfig\s+signingConfigs\.debug/);
    expect(gradle).toContain('METRAVEL_ANDROID_KEYSTORE_PATH');

    const buildScript = fs.readFileSync(path.join(ROOT, 'scripts/android-build.sh'), 'utf8');
    expect(buildScript).toContain('metravel-android-upload-store-password');
    expect(buildScript).not.toMatch(/METRAVEL_ANDROID_KEYSTORE_PASSWORD=["'][^$]/);

    const gradleRunner = fs.readFileSync(
      path.join(ROOT, 'scripts/android-gradle-build.js'),
      'utf8'
    );
    expect(gradleRunner).toContain("NODE_ENV: 'production'");
    expect(gradleRunner).toContain('LOCAL_ENV_PATH');
    expect(gradleRunner).toContain('PROD_ENV_PATH');
    expect(gradleRunner).toContain(
      "[task, '--no-daemon', '--no-parallel', '--max-workers=2']"
    );
    expect(gradleRunner).toContain("[task, '--no-daemon']");
    expect(gradleRunner).toContain('verifyFacebookAndroidResources');
  });

  it('fails closed when native Facebook Login credentials are incomplete', () => {
    expect(() =>
      getFacebookBuildConfig({
        EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED: 'true',
        EXPO_PUBLIC_META_APP_ID: '0',
      })
    ).toThrow('Facebook Login is enabled');

    expect(
      getFacebookBuildConfig({
        EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED: 'true',
        EXPO_PUBLIC_META_APP_ID: '123456789',
        META_FACEBOOK_CLIENT_TOKEN: 'client-token',
      })
    ).toEqual({
      enabled: true,
      appId: '123456789',
      clientToken: 'client-token',
    });
  });

  it('reads generated Android resource values without logging credentials', () => {
    const xml = `
      <resources>
        <string name="facebook_app_id" translatable="false">123456789</string>
        <bool name="facebook_auto_init_enabled">true</bool>
      </resources>
    `;

    expect(readAndroidResource(xml, 'string', 'facebook_app_id')).toBe('123456789');
    expect(readAndroidResource(xml, 'bool', 'facebook_auto_init_enabled')).toBe('true');
    expect(readAndroidResource(xml, 'string', 'missing')).toBe('');
  });
});
