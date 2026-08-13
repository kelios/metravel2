import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const { validateIosRelease } = require('../../scripts/ios-release-guard-lib');

const root = path.resolve(__dirname, '../..');
const tempRoots: string[] = [];

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
    'plugins/withAndroidNotifications.js',
    'android/app/src/main/AndroidManifest.xml',
    'android/app/src/main/res/values/colors.xml',
    'assets/images/notification-icon.png',
    'ios/Podfile.properties.json',
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

  it('resolves notification config for Android without synthesizing iOS APNs or Motion access', () => {
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
      'com.apple.developer.associated-domains': ['applinks:metravel.by'],
    });
    expect(ios.infoPlist).not.toHaveProperty('NSMotionUsageDescription');
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

  it('fails closed when a signed preview build bypasses explicit authorization', () => {
    const testRoot = fixture({
      'scripts/ios-build.sh': value => value.replace('preview|production)', 'production)'),
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_SIGNED_PROFILE_AUTHORIZATION' })])
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

  it('fails closed when the location plugin can synthesize unused Motion permission copy', () => {
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

  it('fails closed when the notifications plugin can synthesize an APNs entitlement', () => {
    const testRoot = fixture({
      'app.json': value => {
        const config = JSON.parse(value);
        config.expo.plugins.push([
          'expo-notifications',
          { enableBackgroundRemoteNotifications: false },
        ]);
        return JSON.stringify(config);
      },
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'IOS_APNS_PLUGIN_SCOPE' })])
    );
  });

  it('fails closed when Android notification parity uses the cross-platform plugin', () => {
    const testRoot = fixture({
      'plugins/withAndroidNotifications.js': value => value.replace(
        "require('expo-notifications/plugin/build/withNotificationsAndroid')",
        "require('expo-notifications/plugin/build/withNotifications')"
      ),
    });
    expect(validateIosRelease(testRoot)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'IOS_ANDROID_NOTIFICATION_PLUGIN_SCOPE' }),
      ])
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

  it('fails closed when a capability bypasses the audited entitlement scope', () => {
    const testRoot = fixture({
      'ios/metravel/metravel.entitlements': value => value.replace(
        '    <key>com.apple.developer.associated-domains</key>',
        '    <key>aps-environment</key>\n    <string>production</string>\n    <key>com.apple.developer.associated-domains</key>'
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

  it('fails closed when privacy collection or tracking drifts', () => {
    const testRoot = fixture({
      'ios/metravel/PrivacyInfo.xcprivacy': value => value
        .replace('NSPrivacyCollectedDataTypeCoarseLocation', 'NSPrivacyCollectedDataTypeDeviceID')
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
