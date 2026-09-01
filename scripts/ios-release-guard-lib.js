const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const plist = require('@expo/plist').default;
const { getConfig } = require('@expo/config');
const xcode = require('xcode');

const EXPECTED = Object.freeze({
  apnsEnvironment: 'production',
  appIconSha256: '86ebbd3444649460bfbc39a172c9d2200ed79f286b67f8e7b3cdc2f5ba4b4a72',
  bundleIdentifier: 'by.metravel.app',
  buildNumber: '5',
  deploymentTarget: '16.4',
  displayName: 'MeTravel',
  easCliVersion: '21.8.0',
  easImage: 'macos-tahoe-26.5-xcode-26.6',
  expoRuntimeVersion: 'exposdk:57.0.0',
  productionOrigin: 'https://metravel.by',
  productName: 'metravel',
  scheme: 'metravel',
  version: '1.0.5',
});

const IOS_PURPOSE_STRINGS = Object.freeze({
  NSCameraUsageDescription:
    'MeTravel uses the camera when you choose to take a photo for your profile, trip, or article.',
  NSFaceIDUsageDescription:
    'MeTravel uses Face ID only when you choose biometric sign-in.',
  NSLocationWhenInUseUsageDescription:
    'MeTravel uses your location to show nearby routes, places, and quest points.',
  NSMotionUsageDescription:
    'MeTravel uses motion data to support location and direction features while you navigate routes and quests.',
  NSPhotoLibraryUsageDescription:
    'MeTravel accesses photos you choose so you can add them to your profile, trips, and articles.',
});

const IOS_IPAD_ORIENTATIONS = Object.freeze([
  'UIInterfaceOrientationPortrait',
  'UIInterfaceOrientationPortraitUpsideDown',
  'UIInterfaceOrientationLandscapeLeft',
  'UIInterfaceOrientationLandscapeRight',
]);

const LOCALIZED_PURPOSE_STRINGS = Object.freeze({
  en: IOS_PURPOSE_STRINGS,
  ru: {
    NSCameraUsageDescription:
      'MeTravel использует камеру, когда вы решаете сделать фото для профиля, путешествия или статьи.',
    NSFaceIDUsageDescription:
      'MeTravel использует Face ID только когда вы выбираете вход по биометрии.',
    NSLocationWhenInUseUsageDescription:
      'MeTravel использует вашу геопозицию, чтобы показывать маршруты, места и точки квестов поблизости.',
    NSMotionUsageDescription:
      'MeTravel использует данные о движении для функций геопозиции и направления во время навигации по маршрутам и квестам.',
    NSPhotoLibraryUsageDescription:
      'MeTravel получает доступ только к выбранным вами фото, чтобы добавить их в профиль, путешествия и статьи.',
  },
  be: {
    NSCameraUsageDescription:
      'MeTravel выкарыстоўвае камеру, калі вы вырашаеце зрабіць фота для профілю, падарожжа або артыкула.',
    NSFaceIDUsageDescription:
      'MeTravel выкарыстоўвае Face ID толькі тады, калі вы выбіраеце ўваход па біяметрыі.',
    NSLocationWhenInUseUsageDescription:
      'MeTravel выкарыстоўвае вашу геапазіцыю, каб паказваць маршруты, месцы і пункты квэстаў паблізу.',
    NSMotionUsageDescription:
      'MeTravel выкарыстоўвае даныя аб руху для функцый геапазіцыі і напрамку падчас навігацыі па маршрутах і квэстах.',
    NSPhotoLibraryUsageDescription:
      'MeTravel атрымлівае доступ толькі да выбраных вамі фота, каб дадаць іх у профіль, падарожжы і артыкулы.',
  },
  uk: {
    NSCameraUsageDescription:
      'MeTravel використовує камеру, коли ви вирішуєте зробити фото для профілю, подорожі або статті.',
    NSFaceIDUsageDescription:
      'MeTravel використовує Face ID лише тоді, коли ви вибираєте вхід за біометрією.',
    NSLocationWhenInUseUsageDescription:
      'MeTravel використовує вашу геопозицію, щоб показувати маршрути, місця та точки квестів поблизу.',
    NSMotionUsageDescription:
      'MeTravel використовує дані про рух для функцій геопозиції та напрямку під час навігації маршрутами й квестами.',
    NSPhotoLibraryUsageDescription:
      'MeTravel отримує доступ лише до вибраних вами фото, щоб додати їх до профілю, подорожей і статей.',
  },
  pl: {
    NSCameraUsageDescription:
      'MeTravel używa aparatu, gdy wybierasz zrobienie zdjęcia do profilu, podróży lub artykułu.',
    NSFaceIDUsageDescription:
      'MeTravel używa Face ID tylko wtedy, gdy wybierasz logowanie biometryczne.',
    NSLocationWhenInUseUsageDescription:
      'MeTravel używa Twojego położenia, aby pokazywać pobliskie trasy, miejsca i punkty questów.',
    NSMotionUsageDescription:
      'MeTravel używa danych o ruchu do obsługi funkcji lokalizacji i kierunku podczas nawigacji po trasach i questach.',
    NSPhotoLibraryUsageDescription:
      'MeTravel uzyskuje dostęp tylko do wybranych przez Ciebie zdjęć, aby dodać je do profilu, podróży i artykułów.',
  },
});

const IOS_PRIVACY_DATA = Object.freeze({
  NSPrivacyCollectedDataTypeName: true,
  NSPrivacyCollectedDataTypeEmailAddress: true,
  NSPrivacyCollectedDataTypeOtherUserContactInfo: true,
  NSPrivacyCollectedDataTypeUserID: true,
  NSPrivacyCollectedDataTypeDeviceID: true,
  NSPrivacyCollectedDataTypePreciseLocation: true,
  NSPrivacyCollectedDataTypeCoarseLocation: true,
  NSPrivacyCollectedDataTypeEmailsOrTextMessages: true,
  NSPrivacyCollectedDataTypePhotosorVideos: true,
  NSPrivacyCollectedDataTypeOtherUserContent: true,
});

const IOS_REQUIRED_REASON_APIS = Object.freeze({
  NSPrivacyAccessedAPICategoryFileTimestamp: ['C617.1', '0A2A.1', '3B52.1'],
  NSPrivacyAccessedAPICategoryUserDefaults: ['CA92.1', 'C56D.1'],
  NSPrivacyAccessedAPICategoryDiskSpace: ['E174.1', '85F4.1'],
  NSPrivacyAccessedAPICategorySystemBootTime: ['35F9.1'],
});

const PORTABLE_HERMES_CLI_PATH =
  '$(PODS_ROOT)/../../node_modules/hermes-compiler/hermesc/osx-bin/hermesc';
const PATCH_PACKAGE_COMMAND =
  'node ./node_modules/patch-package/dist/index.js --error-on-fail';

function read(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readJson(root, relativePath) {
  return JSON.parse(read(root, relativePath));
}

function count(source, pattern) {
  return (source.match(pattern) || []).length;
}

function findPlugin(app, name) {
  return (app.plugins || []).find(entry => entry === name || (Array.isArray(entry) && entry[0] === name));
}

function findPlugins(app, name) {
  return (app.plugins || []).filter(
    entry => entry === name || (Array.isArray(entry) && entry[0] === name)
  );
}

function pluginOptions(plugin) {
  return Array.isArray(plugin) ? plugin[1] || {} : {};
}

function hasIosPodspec(packageRoot) {
  return ['.', 'ios'].some(segment => {
    try {
      return fs.readdirSync(path.join(packageRoot, segment))
        .some(entry => entry.endsWith('.podspec'));
    } catch {
      return false;
    }
  });
}

function parseInfoPlistStrings(source) {
  const entries = {};
  const linePattern = /^\s*"([^"]+)"\s*=\s*"([^"]*)";\s*$/gm;
  let match;
  while ((match = linePattern.exec(source)) !== null) entries[match[1]] = match[2];
  const meaningfulLines = source.split(/\r?\n/).filter(line => line.trim() !== '');
  return Object.keys(entries).length === meaningfulLines.length ? entries : null;
}

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function pngDimensions(buffer) {
  if (buffer.length < 33 || buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
    return null;
  }
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const chunkLength = buffer.readUInt32BE(offset);
    const chunkType = buffer.toString('ascii', offset + 4, offset + 8);
    const chunkEnd = offset + 12 + chunkLength;
    if (chunkEnd > buffer.length) return null;
    if (chunkType === 'IHDR' && chunkLength >= 13) {
      return {
        width: buffer.readUInt32BE(offset + 8),
        height: buffer.readUInt32BE(offset + 12),
        colorType: buffer[offset + 17],
      };
    }
    offset = chunkEnd;
  }
  return null;
}

function validateIosRelease(root = process.cwd()) {
  const errors = [];
  const fail = (code, detail) => errors.push({ code, detail });
  let app;
  let eas;
  let pods;

  try {
    app = readJson(root, 'app.json').expo;
    eas = readJson(root, 'eas.json');
    pods = readJson(root, 'ios/Podfile.properties.json');
  } catch (error) {
    return [{ code: 'IOS_RELEASE_CONFIG_PARSE', detail: error.message }];
  }

  try {
    const resolved = getConfig(root, {
      skipPlugins: true,
      skipSDKVersionRequirement: true,
    }).exp;
    if (resolved.name !== app.name || resolved.version !== app.version ||
        resolved.ios?.bundleIdentifier !== app.ios?.bundleIdentifier ||
        resolved.ios?.buildNumber !== app.ios?.buildNumber ||
        resolved.ios?.supportsTablet !== app.ios?.supportsTablet ||
        resolved.ios?.requireFullScreen !== app.ios?.requireFullScreen) {
      fail('IOS_RESOLVED_EXPO_CONFIG', 'resolved Expo config differs from the committed static contract');
    }
  } catch (error) {
    fail('IOS_RESOLVED_EXPO_CONFIG', error.message);
  }

  let project;
  let info;
  let infoConfig = {};
  let expoPlist;
  let entitlements;
  let entitlementsConfig = {};
  let privacy;
  let privacyConfig = {};
  let localizedPurposeSources;
  let scheme;
  let packageJson;
  let yarnLock;
  let podfileLock;
  let buildScript;
  let submitScript;
  let appIconContents;
  let splashContents;
  let appDelegate;
  let questFullMap;
  let questFullMapNative;
  let androidManifest;
  let androidColors;
  try {
    project = read(root, 'ios/metravel.xcodeproj/project.pbxproj');
    info = read(root, 'ios/metravel/Info.plist');
    expoPlist = read(root, 'ios/metravel/Supporting/Expo.plist');
    entitlements = read(root, 'ios/metravel/metravel.entitlements');
    privacy = read(root, 'ios/metravel/PrivacyInfo.xcprivacy');
    localizedPurposeSources = Object.fromEntries(
      Object.keys(LOCALIZED_PURPOSE_STRINGS).map(locale => [
        locale,
        read(root, `ios/metravel/${locale}.lproj/InfoPlist.strings`),
      ])
    );
    scheme = read(root, 'ios/metravel.xcodeproj/xcshareddata/xcschemes/metravel.xcscheme');
    packageJson = readJson(root, 'package.json');
    yarnLock = read(root, 'yarn.lock');
    podfileLock = read(root, 'ios/Podfile.lock');
    buildScript = read(root, 'scripts/ios-build.sh');
    submitScript = read(root, 'scripts/ios-submit.sh');
    appDelegate = read(root, 'ios/metravel/AppDelegate.swift');
    questFullMap = read(root, 'components/quests/QuestFullMap.tsx');
    questFullMapNative = read(root, 'components/quests/QuestFullMap.native.tsx');
    androidManifest = read(root, 'android/app/src/main/AndroidManifest.xml');
    androidColors = read(root, 'android/app/src/main/res/values/colors.xml');
    appIconContents = readJson(
      root,
      'ios/metravel/Images.xcassets/AppIcon.appiconset/Contents.json'
    );
    splashContents = readJson(
      root,
      'ios/metravel/Images.xcassets/SplashScreenLogo.imageset/Contents.json'
    );
  } catch (error) {
    return [{ code: 'IOS_RELEASE_CONFIG_READ', detail: error.message }];
  }
  try {
    infoConfig = plist.parse(info);
    plist.parse(expoPlist);
    entitlementsConfig = plist.parse(entitlements);
    privacyConfig = plist.parse(privacy);
  } catch (error) {
    fail('IOS_PLIST_PARSE', error.message);
  }

  if (app.name !== EXPECTED.displayName) fail('IOS_DISPLAY_NAME_EXPO', String(app.name));
  if (app.version !== EXPECTED.version) fail('IOS_VERSION_EXPO', String(app.version));
  if (app.scheme !== EXPECTED.scheme) fail('IOS_SCHEME_EXPO', String(app.scheme));
  if (app.newArchEnabled !== true) fail('IOS_NEW_ARCH_EXPO', String(app.newArchEnabled));
  if (app.ios?.supportsTablet !== true) fail('IOS_DEVICE_FAMILY_EXPO', String(app.ios?.supportsTablet));
  if (app.ios?.requireFullScreen !== false || app.orientation !== 'default') {
    fail(
      'IOS_IPAD_WINDOWING_EXPO',
      `requireFullScreen=${String(app.ios?.requireFullScreen)}, orientation=${String(app.orientation)}`
    );
  }
  if (app.ios?.bundleIdentifier !== EXPECTED.bundleIdentifier) {
    fail('IOS_BUNDLE_ID_EXPO', String(app.ios?.bundleIdentifier));
  }
  if (app.ios?.buildNumber !== EXPECTED.buildNumber) {
    fail('IOS_BUILD_NUMBER_EXPO', String(app.ios?.buildNumber));
  }
  const buildProperties = (app.plugins || []).find(
    entry => Array.isArray(entry) && entry[0] === 'expo-build-properties'
  );
  if (buildProperties?.[1]?.ios?.deploymentTarget !== EXPECTED.deploymentTarget) {
    fail('IOS_DEPLOYMENT_TARGET_EXPO', String(buildProperties?.[1]?.ios?.deploymentTarget));
  }

  const expoInfo = app.ios?.infoPlist || {};
  const expoUsageKeys = Object.keys(expoInfo).filter(key => /^NS.+UsageDescription$/.test(key));
  if (!jsonEqual(expoUsageKeys.sort(), Object.keys(IOS_PURPOSE_STRINGS).sort()) ||
      Object.entries(IOS_PURPOSE_STRINGS).some(([key, value]) => expoInfo[key] !== value)) {
    fail('IOS_PURPOSE_STRINGS_EXPO', 'Expo config must contain only the audited launch permission copy');
  }
  if (expoInfo.ITSAppUsesNonExemptEncryption !== false) {
    fail('IOS_ENCRYPTION_EXPO', String(expoInfo.ITSAppUsesNonExemptEncryption));
  }
  if (Object.prototype.hasOwnProperty.call(expoInfo, 'UIBackgroundModes')) {
    fail('IOS_BACKGROUND_MODES_EXPO', JSON.stringify(expoInfo.UIBackgroundModes));
  }

  const locationPlugins = findPlugins(app, 'expo-location');
  const locationOptions = pluginOptions(locationPlugins[0]);
  if (locationPlugins.length !== 1 ||
      locationOptions.locationAlwaysAndWhenInUsePermission !== false ||
      locationOptions.locationAlwaysPermission !== false ||
      locationOptions.locationWhenInUsePermission !== IOS_PURPOSE_STRINGS.NSLocationWhenInUseUsageDescription ||
      locationOptions.isIosBackgroundLocationEnabled !== false ||
      locationOptions.motionUsagePermission !== IOS_PURPOSE_STRINGS.NSMotionUsageDescription) {
    fail(
      'IOS_LOCATION_PLUGIN_SCOPE',
      'expo-location must remain foreground-only and keep the audited Motion permission required by its linked CoreMotion code'
    );
  }
  const imagePickerPlugins = findPlugins(app, 'expo-image-picker');
  const imagePickerOptions = pluginOptions(imagePickerPlugins[0]);
  if (imagePickerPlugins.length !== 1 ||
      imagePickerOptions.photosPermission !== IOS_PURPOSE_STRINGS.NSPhotoLibraryUsageDescription ||
      imagePickerOptions.cameraPermission !== IOS_PURPOSE_STRINGS.NSCameraUsageDescription ||
      imagePickerOptions.microphonePermission !== false) {
    fail('IOS_IMAGE_PICKER_PLUGIN_SCOPE', 'image picker must not declare unused microphone access');
  }
  const mediaLibraryPlugins = findPlugins(app, 'expo-media-library');
  const mediaLibraryOptions = pluginOptions(mediaLibraryPlugins[0]);
  if (mediaLibraryPlugins.length !== 1 ||
      mediaLibraryOptions.photosPermission !== IOS_PURPOSE_STRINGS.NSPhotoLibraryUsageDescription ||
      mediaLibraryOptions.savePhotosPermission !== false ||
      mediaLibraryOptions.isAccessMediaLocationEnabled !== false ||
      mediaLibraryOptions.preventAutomaticLimitedAccessAlert !== false ||
      !jsonEqual(mediaLibraryOptions.granularPermissions, [])) {
    fail('IOS_MEDIA_LIBRARY_PLUGIN_SCOPE', 'media library must not declare unused write or metadata access');
  }
  const localAuthenticationPlugins = findPlugins(app, 'expo-local-authentication');
  const localAuthenticationOptions = pluginOptions(localAuthenticationPlugins[0]);
  if (localAuthenticationPlugins.length !== 1 ||
      localAuthenticationOptions.faceIDPermission !== IOS_PURPOSE_STRINGS.NSFaceIDUsageDescription) {
    fail('IOS_FACE_ID_PLUGIN_SCOPE', 'Face ID permission copy must match the opt-in biometric flow');
  }
  const notificationPlugins = findPlugins(app, 'expo-notifications');
  const notificationOptions = pluginOptions(notificationPlugins[0]);
  const expectedNotificationOptions = {
    icon: './assets/images/notification-icon.png',
    color: '#7a9d8f',
    defaultChannel: 'updates',
    mode: EXPECTED.apnsEnvironment,
    enableBackgroundRemoteNotifications: false,
  };
  const androidNotificationMetadata = [
    'android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="updates"',
    'android:name="com.google.firebase.messaging.default_notification_color" android:resource="@color/notification_icon_color"',
    'android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/notification_icon"',
    'android:name="expo.modules.notifications.default_notification_color" android:resource="@color/notification_icon_color"',
    'android:name="expo.modules.notifications.default_notification_icon" android:resource="@drawable/notification_icon"',
  ];
  if (notificationPlugins.length !== 1 ||
      !jsonEqual(notificationOptions, expectedNotificationOptions) ||
      androidNotificationMetadata.some(metadata => !androidManifest.includes(metadata)) ||
      !androidColors.includes('<color name="notification_icon_color">#7a9d8f</color>') ||
      !fs.existsSync(path.join(root, 'assets/images/notification-icon.png'))) {
    fail(
      'IOS_APNS_PLUGIN_SCOPE',
      'the official notifications plugin must keep production APNs, foreground-only delivery, and Android icon/color/channel parity'
    );
  }
  if (packageJson.dependencies?.['expo-task-manager'] || packageJson.devDependencies?.['expo-task-manager']) {
    fail('IOS_BACKGROUND_LOCATION_SCOPE', 'expo-task-manager requires a new background-location capability audit');
  }
  // #1415 открыл owner gate для Sign in with Apple: пока в сборке есть сторонний
  // соцвход (Google/Facebook), App Review Guideline 4.8 делает Apple-вход
  // обязательным. Гейт теперь пиннит включённое состояние, а не выключенное.
  if (app.ios?.usesAppleSignIn !== true) {
    fail('IOS_APPLE_SIGN_IN_SCOPE', 'Sign in with Apple must stay enabled while third-party social login ships (Guideline 4.8)');
  }
  if (!packageJson.dependencies?.['expo-apple-authentication']) {
    fail('IOS_APPLE_SIGN_IN_SCOPE', 'expo-apple-authentication must remain a runtime dependency of the Apple sign-in flow');
  }
  if (!jsonEqual(app.ios?.associatedDomains, ['applinks:metravel.by'])) {
    fail('IOS_ASSOCIATED_DOMAIN_EXPO', JSON.stringify(app.ios?.associatedDomains));
  }
  if (app.icon !== './assets/images/icon.png' ||
      pluginOptions(findPlugin(app, 'expo-splash-screen')).image !== './assets/images/splash.png') {
    fail('IOS_BRAND_ASSETS_EXPO', 'Expo icon and splash must use the audited release assets');
  }

  if (eas.cli?.version !== EXPECTED.easCliVersion) fail('IOS_EAS_CLI_VERSION', String(eas.cli?.version));
  if (eas.cli?.appVersionSource !== 'local') {
    fail('IOS_APP_VERSION_SOURCE', String(eas.cli?.appVersionSource));
  }
  for (const profileName of ['development', 'preview', 'production']) {
    const profile = eas.build?.[profileName];
    if (profile?.node !== '22.13.1') {
      fail('IOS_EAS_NODE_VERSION', `${profileName}:${profile?.node}`);
    }
    if (profile?.ios?.image !== EXPECTED.easImage) {
      fail('IOS_EAS_IMAGE', `${profileName}:${profile?.ios?.image}`);
    }
    if (profile?.ios?.scheme !== EXPECTED.scheme) {
      fail('IOS_EAS_SCHEME', `${profileName}:${profile?.ios?.scheme}`);
    }
  }
  if (eas.build?.production?.env?.EXPO_PUBLIC_API_URL !== EXPECTED.productionOrigin ||
      eas.build?.production?.env?.PROD_API_URL !== EXPECTED.productionOrigin) {
    fail('IOS_PRODUCTION_ORIGIN', 'production EAS API origins must be canonical HTTPS');
  }
  if (eas.build?.production?.environment !== 'production') {
    fail('IOS_EAS_ENVIRONMENT', String(eas.build?.production?.environment));
  }
  if (eas.build?.production?.autoIncrement !== false) {
    fail('IOS_BUILD_NUMBER_SOURCE', 'production autoIncrement must be false for deterministic local parity');
  }
  if (JSON.stringify(eas.submit || {}).match(/appleId|ascAppId|appleTeamId|ascApiKey/i)) {
    fail('IOS_TRACKED_STORE_ID', 'store credentials/identifiers must come from protected execution inputs');
  }
  if (eas.submit?.production?.ios?.bundleIdentifier !== EXPECTED.bundleIdentifier) {
    fail('IOS_SUBMIT_BUNDLE_ID', String(eas.submit?.production?.ios?.bundleIdentifier));
  }
  if (packageJson.dependencies?.['expo-build-properties'] !== '~57.0.3') {
    fail('IOS_BUILD_PROPERTIES_PIN', String(packageJson.dependencies?.['expo-build-properties']));
  }
  if (!yarnLock.includes('expo-build-properties@~57.0.3:') ||
      !yarnLock.includes('version "57.0.3"')) {
    fail('IOS_BUILD_PROPERTIES_LOCK', 'expo-build-properties 57.0.3 must be locked');
  }
  const expectedScripts = {
    'ios:artifact:audit': 'node scripts/ios-artifact-audit.js',
    'ios:build:dev': './scripts/ios-build.sh development',
    'ios:build:preview': './scripts/ios-build.sh preview',
    'ios:build:prod': './scripts/ios-build.sh production',
    'ios:submit': './scripts/ios-submit.sh',
  };
  for (const [name, command] of Object.entries(expectedScripts)) {
    if (packageJson.scripts?.[name] !== command) fail('IOS_PACKAGE_SCRIPT', `${name}:${packageJson.scripts?.[name]}`);
  }
  const postinstall = packageJson.scripts?.postinstall;
  if (typeof postinstall !== 'string' ||
      postinstall.split(PATCH_PACKAGE_COMMAND).length !== 2 ||
      !postinstall.trimEnd().endsWith(`&& ${PATCH_PACKAGE_COMMAND}`)) {
    fail(
      'IOS_POSTINSTALL_PATCH',
      'postinstall must run patch-package exactly once as its final fail-closed command'
    );
  }
  if (!buildScript.includes(`EAS_CLI_VERSION='${EXPECTED.easCliVersion}'`) ||
      !submitScript.includes(`EAS_CLI_VERSION='${EXPECTED.easCliVersion}'`) ||
      !buildScript.includes('eas-cli@${EAS_CLI_VERSION}') ||
      !submitScript.includes('eas-cli@${EAS_CLI_VERSION}')) {
    fail('IOS_EAS_WRAPPER_PIN', 'build and upload wrappers must use the pinned EAS CLI');
  }
  if (buildScript.includes('--auto-submit') || submitScript.includes('--auto-submit')) {
    fail('IOS_AUTO_SUBMIT_FORBIDDEN', 'build and upload must remain separate operations');
  }
  if (!buildScript.includes('IOS_SIGNED_BUILD_AUTHORIZATION') ||
      !submitScript.includes('IOS_UPLOAD_AUTHORIZATION')) {
    fail('IOS_RELEASE_AUTHORIZATION_GATE', 'explicit build and upload authorization gates are required');
  }
  if (!buildScript.includes('git -C "$PROJECT_ROOT" branch --show-current') ||
      !submitScript.includes('git -C "$PROJECT_ROOT" branch --show-current') ||
      !buildScript.includes('git -C "$PROJECT_ROOT" status --porcelain --untracked-files=normal') ||
      !submitScript.includes('git -C "$PROJECT_ROOT" status --porcelain --untracked-files=normal')) {
    fail('IOS_CANONICAL_SOURCE_STATE', 'build and upload wrappers must require a clean canonical main source state');
  }
  if (!buildScript.includes('preview|production)')) {
    fail(
      'IOS_SIGNED_PROFILE_AUTHORIZATION',
      'preview and production device builds must share the explicit signed-build gate'
    );
  }
  if (!submitScript.includes('--id "$BUILD_ID"') ||
      !submitScript.includes('--non-interactive') ||
      !submitScript.includes('build:view "$BUILD_ID" --json') ||
      !submitScript.includes('IOS_ASC_APP_ID') ||
      !submitScript.includes('ios-submit-runtime.') ||
      !submitScript.includes('ios-eas-artifact-download.js') ||
      !submitScript.includes('ios-artifact-audit.js') ||
      submitScript.includes('--latest') ||
      /EXPO_ASC_(?:API_KEY_PATH|KEY_ID|ISSUER_ID)/.test(submitScript)) {
    fail(
      'IOS_SUBMIT_CREDENTIAL_ROUTE',
      'upload must target and audit an exact artifact, then inject the protected ASC app id only into an ignored runtime config'
    );
  }

  if (pods.newArchEnabled !== 'true') fail('IOS_NEW_ARCH_PODS', String(pods.newArchEnabled));
  const projectPairs = [
    ['IOS_BUNDLE_ID_XCODE', /PRODUCT_BUNDLE_IDENTIFIER = by\.metravel\.app;/g, /PRODUCT_BUNDLE_IDENTIFIER = /g, 2],
    ['IOS_BUILD_NUMBER_XCODE', /CURRENT_PROJECT_VERSION = 5;/g, /CURRENT_PROJECT_VERSION = /g, 2],
    ['IOS_VERSION_XCODE', /MARKETING_VERSION = 1\.0\.5;/g, /MARKETING_VERSION = /g, 2],
    ['IOS_DEVICE_FAMILY_XCODE', /TARGETED_DEVICE_FAMILY = "1,2";/g, /TARGETED_DEVICE_FAMILY = /g, 2],
    ['IOS_DEPLOYMENT_TARGET_XCODE', /IPHONEOS_DEPLOYMENT_TARGET = 16\.4;/g, /IPHONEOS_DEPLOYMENT_TARGET = /g, 4],
    ['IOS_PRODUCT_NAME_XCODE', /PRODUCT_NAME = metravel;/g, /PRODUCT_NAME = /g, 2],
  ];
  for (const [code, expectedPattern, assignmentPattern, expectedCount] of projectPairs) {
    if (count(project, expectedPattern) !== expectedCount ||
        count(project, assignmentPattern) !== expectedCount) {
      fail(code, 'all committed Xcode settings must agree exactly');
    }
  }
  if (!scheme.includes('BlueprintName = "metravel"') || !scheme.includes('BuildableName = "metravel.app"')) {
    fail('IOS_XCODE_SCHEME', 'shared metravel scheme must target metravel.app');
  }
  const legacyAppDelegatePaths = [
    'ios/metravel/AppDelegate.h',
    'ios/metravel/AppDelegate.mm',
    'ios/metravel/main.m',
    'ios/metravel/noop-file.swift',
  ];
  if (count(project, /\/\* AppDelegate\.swift in Sources \*\//g) !== 2 ||
      count(project, /path = metravel\/AppDelegate\.swift;/g) !== 1 ||
      /AppDelegate\.(?:h|mm)|main\.m|noop-file\.swift/.test(project) ||
      legacyAppDelegatePaths.some(relativePath => fs.existsSync(path.join(root, relativePath))) ||
      !/@main\s+class AppDelegate:\s*ExpoAppDelegate/.test(appDelegate) ||
      !appDelegate.includes('ExpoReactNativeFactory(delegate: delegate)') ||
      !/#if os\(iOS\) \|\| os\(tvOS\)[\s\S]*factory\.startReactNative\([\s\S]*#endif/.test(appDelegate) ||
      !appDelegate.includes('Bundle.main.url(forResource: "main", withExtension: "jsbundle")') ||
      /EXAppDelegateWrapper|#import\s+<RCTAppDelegate\.h>/.test(appDelegate)) {
    fail(
      'IOS_APP_DELEGATE_TEMPLATE',
      'native entrypoint must use the Expo SDK 57 Swift AppDelegate and embedded release bundle'
    );
  }

  const plistPairs = [
    ['IOS_DEVELOPMENT_LANGUAGE_PLIST', /<key>CFBundleDevelopmentRegion<\/key>\s*<string>ru<\/string>/],
    ['IOS_DISPLAY_NAME_PLIST', /<key>CFBundleDisplayName<\/key>\s*<string>MeTravel<\/string>/],
    ['IOS_VERSION_PLIST', /<key>CFBundleShortVersionString<\/key>\s*<string>\$\(MARKETING_VERSION\)<\/string>/],
    ['IOS_BUILD_NUMBER_PLIST', /<key>CFBundleVersion<\/key>\s*<string>\$\(CURRENT_PROJECT_VERSION\)<\/string>/],
    ['IOS_SCHEME_PLIST', /<string>metravel<\/string>/],
    ['IOS_NEW_ARCH_PLIST', /<key>RCTNewArchEnabled<\/key>\s*<true\/>/],
    ['IOS_ENCRYPTION_PLIST', /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/],
  ];
  for (const [code, pattern] of plistPairs) if (!pattern.test(info)) fail(code, 'required plist value missing');
  const manuallyDeclaredMinimumOsKeys = ['LSMinimumSystemVersion', 'MinimumOSVersion']
    .filter(key => Object.prototype.hasOwnProperty.call(infoConfig, key));
  if (manuallyDeclaredMinimumOsKeys.length > 0) {
    fail(
      'IOS_MANUAL_MINIMUM_OS_PLIST',
      `Xcode must derive MinimumOSVersion from the deployment target: ${manuallyDeclaredMinimumOsKeys.join(', ')}`
    );
  }
  if (infoConfig.UIRequiresFullScreen !== false ||
      !jsonEqual(infoConfig['UISupportedInterfaceOrientations~ipad'], IOS_IPAD_ORIENTATIONS)) {
    fail(
      'IOS_IPAD_PLIST',
      'iPad must allow resizable windows and support portrait and landscape orientations'
    );
  }
  if (!expoPlist.includes(`<string>${EXPECTED.expoRuntimeVersion}</string>`)) {
    fail('IOS_EXPO_RUNTIME_VERSION', EXPECTED.expoRuntimeVersion);
  }
  if (!/<key>EXUpdatesEnabled<\/key>\s*<false\/>/.test(expoPlist)) {
    fail('IOS_RELEASE_BUNDLE_MODE', 'release must launch the embedded bundle without a development server');
  }

  const nativeUsageKeys = Object.keys(infoConfig).filter(key => /^NS.+UsageDescription$/.test(key));
  if (!jsonEqual(nativeUsageKeys.sort(), Object.keys(IOS_PURPOSE_STRINGS).sort()) ||
      Object.entries(IOS_PURPOSE_STRINGS).some(([key, value]) => infoConfig[key] !== value)) {
    fail('IOS_PURPOSE_STRINGS_NATIVE', 'native Info.plist must contain only the audited launch permission copy');
  }
  if (Object.prototype.hasOwnProperty.call(infoConfig, 'UIBackgroundModes')) {
    fail('IOS_BACKGROUND_MODES_NATIVE', JSON.stringify(infoConfig.UIBackgroundModes));
  }

  const entitlementKeys = Object.keys(entitlementsConfig).sort();
  if (!jsonEqual(entitlementKeys, ['aps-environment', 'com.apple.developer.applesignin', 'com.apple.developer.associated-domains']) ||
      entitlementsConfig['aps-environment'] !== EXPECTED.apnsEnvironment ||
      !jsonEqual(entitlementsConfig['com.apple.developer.associated-domains'], ['applinks:metravel.by']) ||
      !jsonEqual(entitlementsConfig['com.apple.developer.applesignin'], ['Default'])) {
    fail(
      'IOS_ENTITLEMENT_SCOPE',
      'source entitlements must enable production APNs plus the audited Associated Domain and Sign in with Apple capabilities'
    );
  }

  const purposeLocales = Object.keys(LOCALIZED_PURPOSE_STRINGS);
  try {
    const parsedProject = xcode.project(
      path.join(root, 'ios/metravel.xcodeproj/project.pbxproj')
    );
    parsedProject.parseSync();
    const objects = parsedProject.hash.project.objects;
    const entries = section => Object.entries(objects[section] || {})
      .filter(([id]) => !id.endsWith('_comment'));
    const projects = entries('PBXProject');
    const projectConfig = projects.length === 1 ? projects[0][1] : null;
    const knownRegions = Array.isArray(projectConfig?.knownRegions)
      ? projectConfig.knownRegions
      : [];
    const variantGroups = entries('PBXVariantGroup').filter(
      ([id, group]) => group.name === 'InfoPlist.strings' ||
        objects.PBXVariantGroup?.[`${id}_comment`] === 'InfoPlist.strings'
    );
    const [variantGroupId, variantGroup] = variantGroups.length === 1
      ? variantGroups[0]
      : [];
    const children = Array.isArray(variantGroup?.children) ? variantGroup.children : [];
    const childIds = children.map(child => child.value);
    const fileReferences = objects.PBXFileReference || {};
    const localesValid = childIds.length === purposeLocales.length &&
      new Set(childIds).size === purposeLocales.length &&
      purposeLocales.every(locale => {
        const matchingChildren = children.filter(child => {
          const reference = fileReferences[child.value];
          return child.comment === locale &&
            reference?.name === locale &&
            reference?.path === `metravel/${locale}.lproj/InfoPlist.strings` &&
            reference?.lastKnownFileType === 'text.plist.strings';
        });
        return matchingChildren.length === 1;
      });
    const buildFiles = entries('PBXBuildFile').filter(
      ([, buildFile]) => buildFile.fileRef === variantGroupId
    );
    const variantBuildFileId = buildFiles.length === 1 ? buildFiles[0][0] : null;
    const resourceReferences = entries('PBXResourcesBuildPhase').flatMap(
      ([, phase]) => Array.isArray(phase.files) ? phase.files.map(file => file.value) : []
    );
    const groupReferences = entries('PBXGroup').flatMap(
      ([, group]) => Array.isArray(group.children) ? group.children.map(child => child.value) : []
    );
    const localizationValid = projectConfig?.developmentRegion === 'ru' &&
      purposeLocales.every(locale => knownRegions.includes(locale)) &&
      variantGroups.length === 1 &&
      localesValid &&
      buildFiles.length === 1 &&
      resourceReferences.filter(id => id === variantBuildFileId).length === 1 &&
      groupReferences.filter(id => id === variantGroupId).length === 1;
    if (!localizationValid) {
      fail(
        'IOS_PURPOSE_STRINGS_XCODE',
        'RU fallback and the five-locale InfoPlist.strings variant group must be linked once in Resources'
      );
    }
  } catch (error) {
    fail('IOS_XCODE_PROJECT_PARSE', error.message);
  }

  // `pod install` пере-сериализует канонический Xcode-проект целиком, поэтому
  // отставший tracked `ios/Podfile.lock` виден только в момент сборки — на EAS
  // поды доустанавливаются по autolinking, а локальная фаза
  // `[CP] Check Pods Manifest.lock` падает. Гейт ловит расхождение раньше (#1504).
  // Только закавыченные пути из EXTERNAL SOURCES: свободный поиск по строке
  // ловит ещё и хвосты вида «expo`)» из секции DEPENDENCIES.
  const lockedNodeModules = new Set(
    Array.from(
      podfileLock.matchAll(/:(?:path|podspec): "\.\.\/node_modules\/([^"]+)"/g),
      match => {
        const segments = match[1].split('/');
        return segments[0].startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
      }
    )
  );
  const nodeModulesRoot = path.join(root, 'node_modules');
  if (fs.existsSync(nodeModulesRoot)) {
    const unlockedPods = Object.keys(packageJson.dependencies || {}).filter(
      name => !lockedNodeModules.has(name) && hasIosPodspec(path.join(nodeModulesRoot, name))
    );
    const orphanedPods = Array.from(lockedNodeModules).filter(
      name => !fs.existsSync(path.join(nodeModulesRoot, name))
    );
    if (unlockedPods.length > 0 || orphanedPods.length > 0) {
      const detail = [
        unlockedPods.length > 0 && `missing from lock: ${unlockedPods.sort().join(', ')}`,
        orphanedPods.length > 0 && `locked but absent from node_modules: ${orphanedPods.sort().join(', ')}`,
      ].filter(Boolean).join('; ');
      fail('IOS_PODFILE_LOCK_STALE', `ios/Podfile.lock is out of sync with node_modules — ${detail}`);
    }

    // React Native 0.86.0 serializes the absolute checkout path to hermesc into
    // the generated local podspec. CocoaPods hashes that JSON into Podfile.lock,
    // so identical installs in two worktrees otherwise produce different
    // hermes-engine checksums (#1504). Keep the upstream relative-path backport
    // applied until the pinned React Native release includes it.
    const hermesPodspecPath = path.join(
      nodeModulesRoot,
      'react-native/sdks/hermes-engine/hermes-engine.podspec'
    );
    if (fs.existsSync(hermesPodspecPath)) {
      const hermesPodspec = fs.readFileSync(hermesPodspecPath, 'utf8');
      const portableHermesPath = hermesPodspec.includes('require "pathname"') &&
        hermesPodspec.includes('Pathname.new(hermesc_path).relative_path_from(pods_root)') &&
        hermesPodspec.includes(`'HERMES_CLI_PATH' => "$(PODS_ROOT)/#{relative_hermesc}"`);
      if (!portableHermesPath) {
        fail(
          'IOS_PODFILE_LOCK_STALE',
          'hermes-engine podspec must keep HERMES_CLI_PATH relative to PODS_ROOT'
        );
      }
    }
  }

  const localHermesPodspecPath = path.join(
    root,
    'ios/Pods/Local Podspecs/hermes-engine.podspec.json'
  );
  if (fs.existsSync(localHermesPodspecPath)) {
    const localHermesPodspec = fs.readFileSync(localHermesPodspecPath, 'utf8');
    let localHermesConfig;
    try {
      localHermesConfig = JSON.parse(localHermesPodspec).user_target_xcconfig || {};
    } catch (error) {
      fail('IOS_PODFILE_LOCK_STALE', `generated hermes-engine podspec is invalid JSON — ${error.message}`);
    }
    const hermesCliPath = localHermesConfig?.HERMES_CLI_PATH;
    if (hermesCliPath !== PORTABLE_HERMES_CLI_PATH) {
      fail(
        'IOS_PODFILE_LOCK_STALE',
        'generated hermes-engine podspec stores a checkout-specific HERMES_CLI_PATH'
      );
    }

    const lockedHermesChecksum = podfileLock.match(/^ {2}hermes-engine: ([a-f0-9]{40})$/m)?.[1];
    const localHermesChecksum = crypto
      .createHash('sha1')
      .update(localHermesPodspec)
      .digest('hex');
    if (!lockedHermesChecksum || lockedHermesChecksum !== localHermesChecksum) {
      fail(
        'IOS_PODFILE_LOCK_STALE',
        `hermes-engine lock checksum differs from the generated local podspec (${lockedHermesChecksum || 'missing'} != ${localHermesChecksum})`
      );
    }
  }
  for (const [locale, expectedStrings] of Object.entries(LOCALIZED_PURPOSE_STRINGS)) {
    const parsedStrings = parseInfoPlistStrings(localizedPurposeSources[locale]);
    if (!parsedStrings ||
        !jsonEqual(Object.keys(parsedStrings).sort(), Object.keys(expectedStrings).sort()) ||
        Object.entries(expectedStrings).some(([key, value]) => parsedStrings[key] !== value)) {
      fail('IOS_PURPOSE_STRINGS_LOCALE', `${locale}: permission copy is incomplete or stale`);
    }
  }

  const collectedData = Array.isArray(privacyConfig.NSPrivacyCollectedDataTypes)
    ? privacyConfig.NSPrivacyCollectedDataTypes
    : [];
  const collectedDataByType = Object.fromEntries(
    collectedData.map(entry => [entry.NSPrivacyCollectedDataType, entry])
  );
  const privacyDataValid = collectedData.length === Object.keys(IOS_PRIVACY_DATA).length &&
    Object.entries(IOS_PRIVACY_DATA).every(([type, linked]) => {
      const entry = collectedDataByType[type];
      return entry &&
        entry.NSPrivacyCollectedDataTypeLinked === linked &&
        entry.NSPrivacyCollectedDataTypeTracking === false &&
        jsonEqual(
          entry.NSPrivacyCollectedDataTypePurposes,
          ['NSPrivacyCollectedDataTypePurposeAppFunctionality']
        );
    });
  if (!privacyDataValid || privacyConfig.NSPrivacyTracking !== false ||
      !jsonEqual(privacyConfig.NSPrivacyTrackingDomains, [])) {
    fail('IOS_PRIVACY_DATA', 'app-owned collection must match the audited no-tracking launch contract');
  }
  const accessedApis = Array.isArray(privacyConfig.NSPrivacyAccessedAPITypes)
    ? privacyConfig.NSPrivacyAccessedAPITypes
    : [];
  const accessedApisByType = Object.fromEntries(
    accessedApis.map(entry => [entry.NSPrivacyAccessedAPIType, entry.NSPrivacyAccessedAPITypeReasons])
  );
  if (accessedApis.length !== Object.keys(IOS_REQUIRED_REASON_APIS).length ||
      Object.entries(IOS_REQUIRED_REASON_APIS).some(
        ([type, reasons]) => !jsonEqual(accessedApisByType[type], reasons)
      )) {
    fail('IOS_PRIVACY_REQUIRED_REASONS', 'required-reason API declarations must match the audited native inventory');
  }
  const privacyBundles = [
    'ExpoApplication_privacy.bundle',
    'ExpoConstants_privacy.bundle',
    'ExpoFileSystem_privacy.bundle',
    'ExpoLocalization_privacy.bundle',
    'ExpoMediaLibrary_privacy.bundle',
    'ExpoNotifications_privacy.bundle',
    'RNCAsyncStorage_resources.bundle',
    'React-Core_privacy.bundle',
    'React-cxxreact_privacy.bundle',
    'React-timing_privacy.bundle',
    'RNImagePickerPrivacyInfo.bundle',
  ];
  if (privacyBundles.some(bundle => count(project, new RegExp(bundle.replace('.', '\\.'), 'g')) !== 2) ||
      count(project, /PrivacyInfo\.xcprivacy in Resources/g) !== 2) {
    fail('IOS_PRIVACY_RESOURCES', 'app and active SDK privacy resources must be bundled by Xcode');
  }
  const questPngExports = [questFullMap, questFullMapNative].map(source => source.match(
    /const shareAsPNG[\s\S]*?const resolveRoutedTrackForExport/
  )?.[0] || '');
  if (questPngExports.some(source => /expo-media-library|requestPermissionsAsync/.test(source))) {
    fail('IOS_PHOTO_LIBRARY_ADD_SCOPE', 'unavailable quest PNG export must not request photo-library access');
  }

  const iconEntry = appIconContents.images?.find(item => item.filename && item.size === '1024x1024');
  const splashFiles = splashContents.images?.map(item => item.filename).filter(Boolean) || [];
  if (!iconEntry) fail('IOS_APP_ICON_CATALOG', '1024x1024 icon entry missing');
  else {
    const iconPath = path.join(root, 'ios/metravel/Images.xcassets/AppIcon.appiconset', iconEntry.filename);
    const expoIconPath = typeof app.icon === 'string' && app.icon.length > 0
      ? path.join(root, app.icon)
      : null;
    const iconBuffer = fs.existsSync(iconPath) ? fs.readFileSync(iconPath) : null;
    const expoIconBuffer = expoIconPath && fs.existsSync(expoIconPath)
      ? fs.readFileSync(expoIconPath)
      : null;
    const dimensions = iconBuffer ? pngDimensions(iconBuffer) : null;
    if (dimensions?.width !== 1024 || dimensions?.height !== 1024 ||
        [4, 6].includes(dimensions?.colorType)) {
      fail('IOS_APP_ICON_ASSET', 'App Store icon must be an opaque 1024x1024 PNG');
    }
    const iconHash = iconBuffer
      ? crypto.createHash('sha256').update(iconBuffer).digest('hex')
      : null;
    const expoIconHash = expoIconBuffer
      ? crypto.createHash('sha256').update(expoIconBuffer).digest('hex')
      : null;
    if (iconHash !== EXPECTED.appIconSha256 || expoIconHash !== EXPECTED.appIconSha256) {
      fail(
        'IOS_APP_ICON_BRAND',
        'Expo and native AppIcon assets must both use the audited MeTravel bird artwork'
      );
    }
  }
  if (splashFiles.length !== 3 || splashFiles.some(file => !fs.existsSync(path.join(
    root,
    'ios/metravel/Images.xcassets/SplashScreenLogo.imageset',
    file
  )))) fail('IOS_SPLASH_ASSETS', '1x/2x/3x splash assets are required');

  const scanned = [JSON.stringify(app), JSON.stringify(eas), project, info, expoPlist, entitlements];
  const forbidden = [
    ['IOS_PLACEHOLDER_BUNDLE_ID', /com\.yourcompany/i],
    ['IOS_PLACEHOLDER_STORE_ID', /METRAVEL_[A-Z0-9_]*_ID/],
    ['IOS_DEV_ORIGIN', /https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)/i],
    ['IOS_TRACKED_SECRET', /(?:BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|-----BEGIN PRIVATE KEY-----)/],
  ];
  for (const [code, pattern] of forbidden) {
    if (scanned.some(source => pattern.test(source))) fail(code, 'forbidden release value found');
  }

  return errors;
}

module.exports = {
  EXPECTED,
  IOS_IPAD_ORIENTATIONS,
  IOS_PURPOSE_STRINGS,
  LOCALIZED_PURPOSE_STRINGS,
  validateIosRelease,
};
