import { execFileSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const {
  IOS_IPAD_ORIENTATIONS,
  validateIosRelease,
} = require('../../scripts/ios-release-guard-lib');

const root = path.resolve(__dirname, '../..');
const tempRoots: string[] = [];

type TestAppConfig = {
  expo: {
    plugins: Array<string | [string, Record<string, unknown>]>;
  };
};

function notificationPlugin(config: TestAppConfig): [string, Record<string, unknown>] {
  const plugin = config.expo.plugins.find(
    (entry): entry is [string, Record<string, unknown>] =>
      Array.isArray(entry) && entry[0] === 'expo-notifications'
  );
  if (!plugin) throw new Error('notification plugin fixture is missing');
  return plugin;
}

function fixture(changes: Record<string, (value: string) => string>): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'metravel-ios-release-'));
  tempRoots.push(tempRoot);
  const requiredFiles = [
    'app.json',
    'app.config.js',
    'eas.json',
    'package.json',
    'yarn.lock',
    'scripts/ios-build.sh',
    'scripts/ios-submit.sh',
    'android/app/src/main/AndroidManifest.xml',
    'android/app/src/main/res/values/colors.xml',
    'assets/images/notification-icon.png',
    'assets/images/icon.png',
    'ios/Podfile.properties.json',
    'ios/Podfile.lock',
    'ios/metravel/AppDelegate.swift',
    'ios/metravel.xcodeproj/project.pbxproj',
    'ios/metravel.xcodeproj/xcshareddata/xcschemes/metravel.xcscheme',
    'ios/metravel/Info.plist',
    'ios/metravel/Supporting/Expo.plist',
    'ios/metravel/metravel.entitlements',
    'ios/metravel/PrivacyInfo.xcprivacy',
    'ios/metravel/en.lproj/InfoPlist.strings',
    'ios/metravel/ru.lproj/InfoPlist.strings',
    'ios/metravel/be.lproj/InfoPlist.strings',
    'ios/metravel/uk.lproj/InfoPlist.strings',
    'ios/metravel/pl.lproj/InfoPlist.strings',
    'ios/metravel/Images.xcassets/AppIcon.appiconset/Contents.json',
    'ios/metravel/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png',
    'ios/metravel/Images.xcassets/SplashScreenLogo.imageset/Contents.json',
    'ios/metravel/Images.xcassets/SplashScreenLogo.imageset/image.png',
    'ios/metravel/Images.xcassets/SplashScreenLogo.imageset/image@2x.png',
    'ios/metravel/Images.xcassets/SplashScreenLogo.imageset/image@3x.png',
    'components/quests/QuestFullMap.tsx',
    'components/quests/QuestFullMap.native.tsx',
  ];
  for (const relativePath of requiredFiles) {
    const target = path.join(tempRoot, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const source = fs.readFileSync(path.join(root, relativePath));
    const rewrite = changes[relativePath];
    fs.writeFileSync(target, rewrite ? rewrite(source.toString()) : source);
  }
  return tempRoot;
}

describe('iOS release configuration', () => {
  afterEach(() => {
    for (const tempRoot of tempRoots.splice(0)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('keeps Expo, EAS, Xcode, plist, privacy, entitlement, and assets in parity', () => {
    expect(validateIosRelease(root)).toEqual([]);
  });

  it('resolves production APNs without background delivery and preserves Android notification metadata', () => {
    const output = execFileSync(
      process.execPath,
      [path.join(root, 'node_modules/expo/bin/cli'), 'config', '--type', 'introspect', '--json'],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED: 'false',
          EXPO_PUBLIC_META_APP_ID: '',
          META_FACEBOOK_CLIENT_TOKEN: '',
        },
      }
    );
    const config = JSON.parse(output);
    const ios = config._internal.modResults.ios;
    const android = config._internal.modResults.android;
    const notificationMetadata = android.manifest.manifest.application[0]['meta-data'];

    expect(ios.entitlements).toEqual({
      'aps-environment': 'production',
      'com.apple.developer.applesignin': ['Default'],
      'com.apple.developer.associated-domains': ['applinks:metravel.by'],
    });
    expect(ios.infoPlist.UIBackgroundModes).toBeUndefined();
    expect(ios.infoPlist.NSMotionUsageDescription).toBe(
      'MeTravel uses motion data to support location and direction features while you navigate routes and quests.'
    );
    expect(ios.infoPlist.UIRequiresFullScreen).toBe(false);
    expect(ios.infoPlist['UISupportedInterfaceOrientations~ipad']).toEqual(
      IOS_IPAD_ORIENTATIONS
    );
    expect(notificationMetadata).toEqual(expect.arrayContaining([
      expect.objectContaining({
        $: expect.objectContaining({
          'android:name': 'com.google.firebase.messaging.default_notification_channel_id',
          'android:value': 'updates',
        }),
      }),
      expect.objectContaining({
        $: expect.objectContaining({
          'android:name': 'expo.modules.notifications.default_notification_icon',
          'android:resource': '@drawable/notification_icon',
        }),
      }),
      expect.objectContaining({
        $: expect.objectContaining({
          'android:name': 'expo.modules.notifications.default_notification_color',
          'android:resource': '@color/notification_icon_color',
        }),
      }),
    ]));
    expect(android.colors.resources.color).toEqual(expect.arrayContaining([
      expect.objectContaining({
        _: '#7a9d8f',
        $: expect.objectContaining({ name: 'notification_icon_color' }),
      }),
    ]));
  });

  it('fails closed on native identity drift', () => {
    const testRoot = fixture({
      'ios/metravel.xcodeproj/project.pbxproj': value =>
        value.replace('PRODUCT_BUNDLE_IDENTIFIER = by.metravel.app;', 'PRODUCT_BUNDLE_IDENTIFIER = by.metravel.drift;'),
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_BUNDLE_ID_XCODE' })])
    );
  });

  it('rejects the development alternate mode from distribution release inputs', () => {
    const alternateModeEntry = '\n        "applinks:metravel.by?mode=developer"';
    const expoRoot = fixture({
      'app.json': value => value.replace(
        '"applinks:metravel.by"',
        `"applinks:metravel.by",${alternateModeEntry}`
      ),
    });
    const nativeRoot = fixture({
      'ios/metravel/metravel.entitlements': value => value.replace(
        '<string>applinks:metravel.by</string>',
        '<string>applinks:metravel.by</string>\n      <string>applinks:metravel.by?mode=developer</string>'
      ),
    });

    expect(validateIosRelease(expoRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_ASSOCIATED_DOMAIN_EXPO' })])
    );
    expect(validateIosRelease(nativeRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_ENTITLEMENT_SCOPE' })])
    );
  });

  it('fails closed when universal iPhone and iPad support drifts', () => {
    const expoRoot = fixture({
      'app.json': value => value.replace('"supportsTablet": true', '"supportsTablet": false'),
    });
    const expoWindowRoot = fixture({
      'app.json': value => value.replace('"requireFullScreen": false', '"requireFullScreen": true'),
    });
    const expoPortraitRoot = fixture({
      'app.json': value => value.replace('"orientation": "default"', '"orientation": "portrait"'),
    });
    const xcodeRoot = fixture({
      'ios/metravel.xcodeproj/project.pbxproj': value =>
        value.replaceAll('TARGETED_DEVICE_FAMILY = "1,2";', 'TARGETED_DEVICE_FAMILY = 1;'),
    });
    const plistRoot = fixture({
      'ios/metravel/Info.plist': value => value.replace(
        /\n\t<key>UISupportedInterfaceOrientations~ipad<\/key>[\s\S]*?\n\t<\/array>/,
        ''
      ),
    });
    const fixedWindowPlistRoot = fixture({
      'ios/metravel/Info.plist': value => value.replace(
        /(<key>UIRequiresFullScreen<\/key>\s*)<false\/>/,
        '$1<true/>'
      ),
    });

    expect(validateIosRelease(expoRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_DEVICE_FAMILY_EXPO' })])
    );
    expect(validateIosRelease(expoWindowRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_IPAD_WINDOWING_EXPO' })])
    );
    expect(validateIosRelease(expoPortraitRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_IPAD_WINDOWING_EXPO' })])
    );
    expect(validateIosRelease(xcodeRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_DEVICE_FAMILY_XCODE' })])
    );
    expect(validateIosRelease(plistRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_IPAD_PLIST' })])
    );
    expect(validateIosRelease(fixedWindowPlistRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_IPAD_PLIST' })])
    );
  });

  it('fails closed when the native AppIcon no longer matches the audited bird artwork', () => {
    const testRoot = fixture({});
    const iconPath = path.join(
      testRoot,
      'ios/metravel/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png'
    );
    const changedIcon = Buffer.from(fs.readFileSync(iconPath));
    changedIcon[changedIcon.length - 1] ^= 0xff;
    fs.writeFileSync(iconPath, changedIcon);

    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_APP_ICON_BRAND' })])
    );
  });

  it('returns a brand finding instead of throwing when the Expo icon path is missing', () => {
    const testRoot = fixture({
      'app.json': value => value.replace('    "icon": "./assets/images/icon.png",\n', ''),
    });

    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_APP_ICON_BRAND' })])
    );
  });

  it('fails closed if the Apple-rejected manual LSMinimumSystemVersion key returns', () => {
    const testRoot = fixture({
      'ios/metravel/Info.plist': value => value.replace(
        '\t<key>LSRequiresIPhoneOS</key>',
        '\t<key>LSMinimumSystemVersion</key>\n\t<string>16.4</string>\n\t<key>LSRequiresIPhoneOS</key>'
      ),
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_MANUAL_MINIMUM_OS_PLIST' })])
    );
  });

  it('fails closed on a legacy native app delegate', () => {
    const testRoot = fixture({
      'ios/metravel/AppDelegate.swift': () => `
        #import <RCTAppDelegate.h>
        @interface AppDelegate : EXAppDelegateWrapper
        @end
      `,
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_APP_DELEGATE_TEMPLATE' })])
    );
  });

  it('fails closed on duplicate AppDelegate source references', () => {
    const testRoot = fixture({
      'ios/metravel.xcodeproj/project.pbxproj': value => value.replace(
        '/* AppDelegate.swift in Sources */',
        '/* AppDelegate.swift in Sources */\n/* AppDelegate.swift in Sources */'
      ),
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_APP_DELEGATE_TEMPLATE' })])
    );
  });

  it('fails closed when the official platform guard is removed', () => {
    const testRoot = fixture({
      'ios/metravel/AppDelegate.swift': value => value
        .replace('#if os(iOS) || os(tvOS)\n', '')
        .replace('#endif\n\n    return super.application', '\n    return super.application'),
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_APP_DELEGATE_TEMPLATE' })])
    );
  });

  it('fails closed when a deleted legacy entrypoint returns', () => {
    const testRoot = fixture({});
    fs.writeFileSync(path.join(testRoot, 'ios/metravel/main.m'), 'int main() { return 0; }');
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_APP_DELEGATE_TEMPLATE' })])
    );
  });

  it('fails closed when the managed submit credential lookup targets another bundle', () => {
    const testRoot = fixture({
      'eas.json': value => value.replace(
        '"bundleIdentifier": "by.metravel.app"',
        '"bundleIdentifier": "by.metravel.other"'
      ),
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_SUBMIT_BUNDLE_ID' })])
    );
  });

  it('fails closed on placeholder store identifiers and development origins', () => {
    const testRoot = fixture({
      'eas.json': value => value.replace(
        '"bundleIdentifier": "by.metravel.app"',
        '"ascAppId": "METRAVEL_APP_ID", "bundleIdentifier": "by.metravel.app", "note": "http://192.168.1.10"'
      ),
    });
    const codes = validateIosRelease(testRoot).map((error: { code: string }) => error.code);
    expect(codes).toEqual(expect.arrayContaining(['IOS_TRACKED_STORE_ID', 'IOS_PLACEHOLDER_STORE_ID', 'IOS_DEV_ORIGIN']));
  });

  it('fails closed when upload can select the latest build or prompt for credentials', () => {
    const testRoot = fixture({
      'scripts/ios-submit.sh': value => value
        .replace('--id "$BUILD_ID"', '--latest')
        .replace(' --non-interactive', ''),
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_SUBMIT_CREDENTIAL_ROUTE' })])
    );
  });

  it('injects the protected ASC app id only into a temporary submit config', () => {
    const exactBuildId = '11111111-1111-4111-8111-111111111111';
    const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'metravel-ios-submit-bin-'));
    tempRoots.push(fakeBin);
    const fakeNode = path.join(fakeBin, 'node');
    fs.writeFileSync(fakeNode, `#!/bin/sh
case "$1" in
  *ios-eas-artifact-download.js|*ios-artifact-audit.js) exit 0 ;;
esac
exec "$REAL_NODE" "$@"
`);
    fs.chmodSync(fakeNode, 0o755);
    const fakeGit = path.join(fakeBin, 'git');
    fs.writeFileSync(fakeGit, `#!/bin/sh
if [ "$1" = "-C" ]; then shift 2; fi
if [ "$1" = "branch" ]; then printf 'main\\n'; fi
if [ "$1" = "rev-parse" ]; then printf 'test-revision\\n'; fi
exit 0
`);
    fs.chmodSync(fakeGit, 0o755);
    const fakeNpx = path.join(fakeBin, 'npx');
    fs.writeFileSync(fakeNpx, `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
if (process.env.IOS_ASC_APP_ID) process.exit(25);
if (process.argv.includes('build:view')) {
  process.stdout.write('{}');
  process.exit(0);
}
const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'eas.json'), 'utf8'));
if (!process.cwd().includes('/.codex-temp/ios-submit-runtime.')) process.exit(20);
if (config.submit?.production?.ios?.ascAppId !== process.env.EXPECTED_ASC_APP_ID) process.exit(21);
if (!process.argv.includes('--id') || !process.argv.includes('${exactBuildId}')) process.exit(22);
if (!process.argv.includes('--non-interactive') || process.argv.includes('--latest')) process.exit(23);
for (const directory of ['node_modules', 'plugins', 'assets', 'ios']) {
  if (!fs.lstatSync(path.join(process.cwd(), directory)).isSymbolicLink()) process.exit(24);
}
`);
    fs.chmodSync(fakeNpx, 0o755);

    const trackedConfigBefore = fs.readFileSync(path.join(root, 'eas.json'), 'utf8');
    const runtimeDirectoriesBefore = fs.readdirSync(path.join(root, '.codex-temp'))
      .filter(name => name.startsWith('ios-submit-runtime.'))
      .sort();
    execFileSync('bash', [path.join(root, 'scripts/ios-submit.sh'), exactBuildId], {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
        IOS_UPLOAD_AUTHORIZATION: '1',
        IOS_ASC_APP_ID: '1234567890',
        EXPECTED_ASC_APP_ID: '1234567890',
        REAL_NODE: process.execPath,
      },
    });

    expect(fs.readFileSync(path.join(root, 'eas.json'), 'utf8')).toBe(trackedConfigBefore);
    expect(
      fs.readdirSync(path.join(root, '.codex-temp'))
        .filter(name => name.startsWith('ios-submit-runtime.'))
        .sort()
    ).toEqual(runtimeDirectoriesBefore);
  });

  it('refuses upload when the protected ASC app id is missing', () => {
    expect(() => execFileSync(
      'bash',
      [path.join(root, 'scripts/ios-submit.sh'), '11111111-1111-4111-8111-111111111111'],
      {
        cwd: root,
        env: {
          ...process.env,
          IOS_UPLOAD_AUTHORIZATION: '1',
          IOS_ASC_APP_ID: '',
        },
        stdio: 'pipe',
      }
    )).toThrow();
  });

  it('fails closed when a signed preview build bypasses explicit authorization', () => {
    const testRoot = fixture({
      'scripts/ios-build.sh': value => value.replace('preview|production)', 'production)'),
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_SIGNED_PROFILE_AUTHORIZATION' })])
    );
  });

  it('fails closed when build or upload can run from a non-canonical source state', () => {
    const testRoot = fixture({
      'scripts/ios-build.sh': value => value
        .replace(
          'git -C "$PROJECT_ROOT" branch --show-current',
          'git -C "$PROJECT_ROOT" branch --show-current-disabled'
        )
        .replace(
          'git -C "$PROJECT_ROOT" status --porcelain --untracked-files=normal',
          'git -C "$PROJECT_ROOT" status --short'
        ),
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_CANONICAL_SOURCE_STATE' })])
    );
  });

  it('fails closed when background or Always location returns', () => {
    const testRoot = fixture({
      'app.json': value => {
        const config = JSON.parse(value);
        const location = config.expo.plugins.find(
          (plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-location'
        );
        location[1].locationAlwaysAndWhenInUsePermission = 'Allow background location';
        location[1].isIosBackgroundLocationEnabled = true;
        config.expo.ios.infoPlist.UIBackgroundModes = ['location'];
        return JSON.stringify(config);
      },
    });
    const codes = validateIosRelease(testRoot).map((error: { code: string }) => error.code);
    expect(codes).toEqual(expect.arrayContaining([
      'IOS_BACKGROUND_MODES_EXPO',
      'IOS_LOCATION_PLUGIN_SCOPE',
    ]));
  });

  it('fails closed when the location plugin can omit the Motion purpose required by linked CoreMotion code', () => {
    const testRoot = fixture({
      'app.json': value => {
        const config = JSON.parse(value);
        const location = config.expo.plugins.find(
          (plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-location'
        );
        delete location[1].motionUsagePermission;
        return JSON.stringify(config);
      },
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_LOCATION_PLUGIN_SCOPE' })])
    );
  });

  it.each([
    ['is missing', (config: TestAppConfig) => {
      config.expo.plugins = config.expo.plugins.filter(
        (plugin: unknown) => !Array.isArray(plugin) || plugin[0] !== 'expo-notifications'
      );
    }],
    ['uses development APNs', (config: TestAppConfig) => {
      const plugin = notificationPlugin(config);
      plugin[1].mode = 'development';
    }],
    ['enables background remote notifications', (config: TestAppConfig) => {
      const plugin = notificationPlugin(config);
      plugin[1].enableBackgroundRemoteNotifications = true;
    }],
    ['drops Android metadata parity', (config: TestAppConfig) => {
      const plugin = notificationPlugin(config);
      delete plugin[1].defaultChannel;
    }],
  ])('fails closed when the notifications plugin %s', (_label, mutate) => {
    const testRoot = fixture({
      'app.json': value => {
        const config = JSON.parse(value) as TestAppConfig;
        mutate(config);
        return JSON.stringify(config);
      },
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_APNS_PLUGIN_SCOPE' })])
    );
  });

  it('fails closed when image picker microphone access returns', () => {
    const testRoot = fixture({
      'app.json': value => {
        const config = JSON.parse(value);
        const imagePicker = config.expo.plugins.find(
          (plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-image-picker'
        );
        imagePicker[1].microphonePermission = 'Allow microphone access';
        config.expo.ios.infoPlist.NSMicrophoneUsageDescription = 'Allow microphone access';
        return JSON.stringify(config);
      },
    });
    const codes = validateIosRelease(testRoot).map((error: { code: string }) => error.code);
    expect(codes).toEqual(expect.arrayContaining([
      'IOS_PURPOSE_STRINGS_EXPO',
      'IOS_IMAGE_PICKER_PLUGIN_SCOPE',
    ]));
  });

  it('fails closed when a native purpose string is reintroduced without launch value', () => {
    const testRoot = fixture({
      'ios/metravel/Info.plist': value => value.replace(
        '\n</dict>\n</plist>',
        '\n\t<key>NSPhotoLibraryAddUsageDescription</key>\n\t<string>Save photos</string>\n</dict>\n</plist>'
      ),
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_PURPOSE_STRINGS_NATIVE' })])
    );
  });

  it('fails closed when media-library write access returns', () => {
    const testRoot = fixture({
      'app.json': value => {
        const config = JSON.parse(value);
        const mediaLibrary = config.expo.plugins.find(
          (plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-media-library'
        );
        mediaLibrary[1].savePhotosPermission = 'Allow photo-library writes';
        return JSON.stringify(config);
      },
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_MEDIA_LIBRARY_PLUGIN_SCOPE' })])
    );
  });

  it('fails closed when a localized permission purpose is missing', () => {
    const testRoot = fixture({
      'ios/metravel/pl.lproj/InfoPlist.strings': value => value
        .split('\n')
        .filter(line => !line.includes('NSFaceIDUsageDescription'))
        .join('\n'),
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_PURPOSE_STRINGS_LOCALE' })])
    );
  });

  it.each([
    ['drops APNs', (value: string) => value.replace(
      '    <key>aps-environment</key>\n    <string>production</string>\n',
      ''
    )],
    ['uses development APNs', (value: string) => value.replace(
      '<string>production</string>',
      '<string>development</string>'
    )],
  ])('fails closed when source entitlements %s', (_label, mutate) => {
    const testRoot = fixture({
      'ios/metravel/metravel.entitlements': mutate,
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_ENTITLEMENT_SCOPE' })])
    );
  });

  it('fails closed when native Info.plist enables background remote notifications', () => {
    const testRoot = fixture({
      'ios/metravel/Info.plist': value => value.replace(
        '\n</dict>\n</plist>',
        '\n\t<key>UIBackgroundModes</key>\n\t<array>\n\t\t<string>remote-notification</string>\n\t</array>\n</dict>\n</plist>'
      ),
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_BACKGROUND_MODES_NATIVE' })])
    );
  });

  it('fails closed when Sign in with Apple is turned off while social login ships', () => {
    // Guideline 4.8: сторонний соцвход в сборке делает Apple-вход обязательным (#1415).
    const testRoot = fixture({
      'app.json': value => value.replace('"usesAppleSignIn": true', '"usesAppleSignIn": false'),
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_APPLE_SIGN_IN_SCOPE' })])
    );
  });

  it('fails closed when the Apple authentication package leaves runtime dependencies', () => {
    const testRoot = fixture({
      'package.json': value => value.replace(/\n\s*"expo-apple-authentication": "[^"]+",/, ''),
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_APPLE_SIGN_IN_SCOPE' })])
    );
  });

  it('fails closed when the Apple sign-in entitlement is dropped from the native target', () => {
    const testRoot = fixture({
      'ios/metravel/metravel.entitlements': value => value.replace(
        '    <key>com.apple.developer.applesignin</key>\n    <array>\n      <string>Default</string>\n    </array>\n',
        ''
      ),
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_ENTITLEMENT_SCOPE' })])
    );
  });

  it('fails closed when native localization fallback is not Russian', () => {
    const testRoot = fixture({
      'ios/metravel.xcodeproj/project.pbxproj': value => value.replace(
        'developmentRegion = ru;',
        'developmentRegion = en;'
      ),
      'ios/metravel/Info.plist': value => value.replace(
        '<key>CFBundleDevelopmentRegion</key>\n\t<string>ru</string>',
        '<key>CFBundleDevelopmentRegion</key>\n\t<string>en</string>'
      ),
    });
    const codes = validateIosRelease(testRoot).map((error: { code: string }) => error.code);
    expect(codes).toEqual(expect.arrayContaining([
      'IOS_DEVELOPMENT_LANGUAGE_PLIST',
      'IOS_PURPOSE_STRINGS_XCODE',
    ]));
  });

  it('fails closed when a localization file is not a child of the Xcode variant group', () => {
    const testRoot = fixture({
      'ios/metravel.xcodeproj/project.pbxproj': value => value.replace(
        '\t\t\t\t1416A0071416A0071416A007 /* pl */,\n',
        ''
      ),
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_PURPOSE_STRINGS_XCODE' })])
    );
  });

  it('fails closed when the tracked Podfile.lock is behind node_modules', () => {
    // Источник истины для подов — autolinking по node_modules, а не сам lock:
    // отставший lock роняет фазу `[CP] Check Pods Manifest.lock` уже на сборке (#1504).
    const testRoot = fixture({
      'ios/Podfile.lock': value => value
        .split('\n')
        .filter(line => !line.includes('../node_modules/expo-apple-authentication'))
        .join('\n'),
    });
    const podspecDirectory = path.join(testRoot, 'node_modules/expo-apple-authentication/ios');
    fs.mkdirSync(podspecDirectory, { recursive: true });
    fs.writeFileSync(path.join(podspecDirectory, 'ExpoAppleAuthentication.podspec'), '');
    // detail проверяется прицельно: фикстура задевает и обратную ветку тоже,
    // а изолировать надо именно «пакет есть, записи в lock нет».
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({
        code: 'IOS_PODFILE_LOCK_STALE',
        detail: expect.stringContaining('missing from lock: expo-apple-authentication'),
      })])
    );
  });

  it('fails closed when Podfile.lock keeps a pod whose package left node_modules', () => {
    // Обратное направление того же расхождения: пакет выпилили из зависимостей,
    // а запись в lock осталась — `pod install` снова разъедет sandbox (#1504).
    const testRoot = fixture({});
    fs.mkdirSync(path.join(testRoot, 'node_modules'), { recursive: true });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({
        code: 'IOS_PODFILE_LOCK_STALE',
        detail: expect.stringContaining('locked but absent from node_modules: '),
      })])
    );
  });

  it('fails closed when the Hermes podspec embeds one checkout path', () => {
    const testRoot = fixture({});
    const podspecPath = path.join(
      testRoot,
      'node_modules/react-native/sdks/hermes-engine/hermes-engine.podspec'
    );
    fs.mkdirSync(path.dirname(podspecPath), { recursive: true });
    fs.writeFileSync(
      podspecPath,
      `spec.user_target_xcconfig = {
        'HERMES_CLI_PATH' => "#{hermes_compiler_path}/hermesc/osx-bin/hermesc"
      }`
    );
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({
        code: 'IOS_PODFILE_LOCK_STALE',
        detail: 'hermes-engine podspec must keep HERMES_CLI_PATH relative to PODS_ROOT',
      })])
    );
  });

  it.each([
    [
      'does not request a nonzero exit code',
      (value: string) => value.replace(' --error-on-fail', ''),
    ],
    [
      'swallows a patch-package failure',
      (value: string) => value.replace(
        'node ./node_modules/patch-package/dist/index.js --error-on-fail',
        '(node ./node_modules/patch-package/dist/index.js --error-on-fail || true)'
      ),
    ],
  ])('fails closed when postinstall %s', (_label, rewritePostinstall) => {
    const testRoot = fixture({
      'package.json': rewritePostinstall,
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({
        code: 'IOS_POSTINSTALL_PATCH',
        detail: 'postinstall must run patch-package exactly once as its final fail-closed command',
      })])
    );
  });

  it.each([
    ['an absolute path', '/tmp/one-checkout/node_modules/hermes-compiler/hermesc'],
    [
      'another checkout behind PODS_ROOT',
      '$(PODS_ROOT)/../../../tmp/one-checkout/node_modules/hermes-compiler/hermesc',
    ],
  ])('fails closed when the generated Hermes podspec keeps %s', (_label, hermesCliPath) => {
    const localPodspec = `${JSON.stringify({
      user_target_xcconfig: {
        HERMES_CLI_PATH: hermesCliPath,
      },
    }, null, 2)}\n`;
    const checksum = crypto.createHash('sha1').update(localPodspec).digest('hex');
    const testRoot = fixture({
      'ios/Podfile.lock': value => value.replace(
        /^ {2}hermes-engine: [a-f0-9]{40}$/m,
        `  hermes-engine: ${checksum}`
      ),
    });
    const localPodspecPath = path.join(
      testRoot,
      'ios/Pods/Local Podspecs/hermes-engine.podspec.json'
    );
    fs.mkdirSync(path.dirname(localPodspecPath), { recursive: true });
    fs.writeFileSync(localPodspecPath, localPodspec);
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({
        code: 'IOS_PODFILE_LOCK_STALE',
        detail: 'generated hermes-engine podspec stores a checkout-specific HERMES_CLI_PATH',
      })])
    );
  });

  it('fails closed when the Hermes lock checksum differs from the generated podspec', () => {
    const testRoot = fixture({});
    const localPodspecPath = path.join(
      testRoot,
      'ios/Pods/Local Podspecs/hermes-engine.podspec.json'
    );
    fs.mkdirSync(path.dirname(localPodspecPath), { recursive: true });
    fs.writeFileSync(
      localPodspecPath,
      `${JSON.stringify({
        user_target_xcconfig: {
          HERMES_CLI_PATH:
            '$(PODS_ROOT)/../../node_modules/hermes-compiler/hermesc/osx-bin/hermesc',
        },
      }, null, 2)}\n`
    );
    const hermesErrors = validateIosRelease(testRoot).filter(
      (error: { code: string }) => error.code === 'IOS_PODFILE_LOCK_STALE'
    );
    expect(hermesErrors).toEqual([
      expect.objectContaining({
        code: 'IOS_PODFILE_LOCK_STALE',
        detail: expect.stringContaining('hermes-engine lock checksum differs'),
      }),
    ]);
  });

  it('fails closed when privacy collection or tracking drifts', () => {
    const testRoot = fixture({
      'ios/metravel/PrivacyInfo.xcprivacy': value => value
        .replace(
          '<string>NSPrivacyCollectedDataTypeDeviceID</string>\n\t\t\t<key>NSPrivacyCollectedDataTypeLinked</key>\n\t\t\t<true/>',
          '<string>NSPrivacyCollectedDataTypeDeviceID</string>\n\t\t\t<key>NSPrivacyCollectedDataTypeLinked</key>\n\t\t\t<false/>'
        )
        .replace('<key>NSPrivacyTracking</key>\n\t<false/>', '<key>NSPrivacyTracking</key>\n\t<true/>'),
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_PRIVACY_DATA' })])
    );
  });

  it('fails closed when unavailable quest PNG export requests library access', () => {
    const testRoot = fixture({
      'components/quests/QuestFullMap.tsx': value => value.replace(
        '            Alert.alert(i18nT(',
        "            require('expo-media-library').requestPermissionsAsync();\n            Alert.alert(i18nT("
      ),
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_PHOTO_LIBRARY_ADD_SCOPE' })])
    );
  });

  it('fails closed when the native quest PNG export requests library access', () => {
    const testRoot = fixture({
      'components/quests/QuestFullMap.native.tsx': value => value.replace(
        '        if (isExportingPng) return;',
        "        require('expo-media-library').requestPermissionsAsync();\n        if (isExportingPng) return;"
      ),
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_PHOTO_LIBRARY_ADD_SCOPE' })])
    );
  });

  it('fails closed when an active SDK privacy resource is not copied', () => {
    const testRoot = fixture({
      'ios/metravel.xcodeproj/project.pbxproj': value => value.replace(
        'ExpoFileSystem_privacy.bundle',
        'ExpoFileSystem_missing.bundle'
      ),
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_PRIVACY_RESOURCES' })])
    );
  });

  it('reports a deterministic error when a required release file is unreadable', () => {
    const testRoot = fixture({});
    fs.rmSync(path.join(testRoot, 'ios/metravel/PrivacyInfo.xcprivacy'));
    expect(validateIosRelease(testRoot)).toEqual([
      expect.objectContaining({ code: 'IOS_RELEASE_CONFIG_READ' }),
    ]);
  });
});
