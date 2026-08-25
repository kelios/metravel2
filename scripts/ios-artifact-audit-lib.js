const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const plist = require('@expo/plist').default;

const {
  EXPECTED,
  IOS_IPAD_ORIENTATIONS,
  IOS_PURPOSE_STRINGS,
  LOCALIZED_PURPOSE_STRINGS,
} = require('./ios-release-guard-lib');

const EXPECTED_ENTITLEMENTS = Object.freeze({
  'com.apple.developer.applesignin': ['Default'],
  'com.apple.developer.associated-domains': ['applinks:metravel.by'],
});

const EXPECTED_SIGNED_ENTITLEMENT_KEYS = Object.freeze([
  'application-identifier',
  'beta-reports-active',
  'com.apple.developer.applesignin',
  'com.apple.developer.associated-domains',
  'com.apple.developer.team-identifier',
  'get-task-allow',
].sort());

const SENSITIVE_NATIVE_API_INVENTORY = Object.freeze([
  {
    key: 'NSMotionUsageDescription',
    pattern: /CMMotionActivityManager|CMMotionManager|CMPedometer|CMAltimeter|CMSensorRecorder|CMHeadphoneMotionManager|CMFallDetectionManager|CMWaterSubmersionManager|CMBatchedSensorManager/,
  },
]);

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function parsePlist(plistPath) {
  const output = execFileSync(
    'plutil',
    ['-convert', 'json', '-o', '-', plistPath],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
  );
  return JSON.parse(output);
}

function findFiles(root, basename) {
  const matches = [];
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile() && entry.name === basename) matches.push(target);
    }
  }
  return matches;
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
      };
    }
    offset = chunkEnd;
  }
  return null;
}

function assetCatalogContainsAppIcon(entries) {
  return Array.isArray(entries) && entries.some(entry =>
    entry?.Name === 'AppIcon' &&
    entry?.AssetType === 'Icon Image' &&
    entry?.Idiom === 'phone' &&
    entry?.PixelWidth === 1024 &&
    entry?.PixelHeight === 1024
  );
}

function parseAssetCatalog(assetCatalogPath) {
  try {
    return JSON.parse(execFileSync(
      'xcrun',
      ['assetutil', '--info', assetCatalogPath],
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
    ));
  } catch {
    return null;
  }
}

function parseSignedEntitlements(appPath) {
  const result = spawnSync(
    'codesign',
    ['-d', '--entitlements', ':-', appPath],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
  );
  if (result.status !== 0) return null;
  const combined = `${result.stdout || ''}\n${result.stderr || ''}`;
  const xmlStart = combined.indexOf('<?xml');
  const plistEnd = combined.indexOf('</plist>');
  if (xmlStart === -1 || plistEnd === -1) return null;
  return plist.parse(combined.slice(xmlStart, plistEnd + '</plist>'.length));
}

function parseProvisioningProfile(appPath) {
  const result = spawnSync(
    'security',
    ['cms', '-D', '-i', path.join(appPath, 'embedded.mobileprovision')],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  );
  if (result.status !== 0 || !result.stdout) return null;
  try {
    return plist.parse(result.stdout);
  } catch {
    return null;
  }
}

function findNativeExecutables(appPath, mainExecutablePath) {
  const matches = new Set([mainExecutablePath]);
  const pending = [appPath];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile() && (fs.statSync(target).mode & 0o111) !== 0) matches.add(target);
    }
  }
  return [...matches];
}

function distributionSigningMatchesReleaseContract(entitlements, profile, now = new Date()) {
  if (!entitlements || !profile || !profile.Entitlements) return false;
  const profileEntitlements = profile.Entitlements;
  const teamIdentifier = entitlements['com.apple.developer.team-identifier'];
  const applicationIdentifier = entitlements['application-identifier'];
  const expirationDate = new Date(profile.ExpirationDate);
  const profileAssociatedDomains = profileEntitlements['com.apple.developer.associated-domains'];
  const profileAllowsAssociatedDomains = profileAssociatedDomains === '*' ||
    (Array.isArray(profileAssociatedDomains) &&
      (profileAssociatedDomains.includes('*') ||
        EXPECTED_ENTITLEMENTS['com.apple.developer.associated-domains'].every(
          domain => profileAssociatedDomains.includes(domain)
        )));
  return jsonEqual(Object.keys(entitlements).sort(), EXPECTED_SIGNED_ENTITLEMENT_KEYS) &&
    typeof teamIdentifier === 'string' &&
    applicationIdentifier === `${teamIdentifier}.${EXPECTED.bundleIdentifier}` &&
    entitlements['get-task-allow'] === false &&
    entitlements['beta-reports-active'] === true &&
    Object.entries(EXPECTED_ENTITLEMENTS).every(
      ([key, value]) => jsonEqual(entitlements[key], value)
    ) &&
    !Array.isArray(profile.ProvisionedDevices) &&
    profile.ProvisionsAllDevices !== true &&
    Number.isFinite(expirationDate.getTime()) &&
    expirationDate > now &&
    jsonEqual(profile.TeamIdentifier, [teamIdentifier]) &&
    profileEntitlements['application-identifier'] === applicationIdentifier &&
    profileEntitlements['com.apple.developer.team-identifier'] === teamIdentifier &&
    profileEntitlements['get-task-allow'] === false &&
    profileEntitlements['beta-reports-active'] === true &&
    jsonEqual(
      profileEntitlements['com.apple.developer.applesignin'],
      EXPECTED_ENTITLEMENTS['com.apple.developer.applesignin']
    ) &&
    profileAllowsAssociatedDomains;
}

function validateIosAppBundle(appPath, options = {}) {
  const errors = [];
  const fail = (code, detail) => errors.push({ code, detail });
  const verifySignature = options.verifySignature !== false;
  let info;

  try {
    info = parsePlist(path.join(appPath, 'Info.plist'));
  } catch (error) {
    return [{ code: 'IOS_ARTIFACT_INFO_PLIST', detail: error.message }];
  }

  if (info.CFBundleIdentifier !== EXPECTED.bundleIdentifier) {
    fail('IOS_ARTIFACT_BUNDLE_ID', 'archive bundle identifier does not match the release contract');
  }
  if (info.CFBundleShortVersionString !== EXPECTED.version) {
    fail('IOS_ARTIFACT_VERSION', 'archive marketing version does not match the release contract');
  }
  if (info.CFBundleVersion !== EXPECTED.buildNumber) {
    fail('IOS_ARTIFACT_BUILD_NUMBER', 'archive build number does not match the release contract');
  }
  if (info.MinimumOSVersion !== EXPECTED.deploymentTarget ||
      Object.prototype.hasOwnProperty.call(info, 'LSMinimumSystemVersion')) {
    fail(
      'IOS_ARTIFACT_MINIMUM_OS',
      'archive must contain the Xcode-derived iOS MinimumOSVersion and no macOS LSMinimumSystemVersion'
    );
  }
  if (info.UIRequiresFullScreen !== false ||
      !jsonEqual(info.UIDeviceFamily, [1, 2]) ||
      !jsonEqual(info['UISupportedInterfaceOrientations~ipad'], IOS_IPAD_ORIENTATIONS)) {
    fail(
      'IOS_ARTIFACT_DEVICE_FAMILY',
      'archive must support iPhone and iPad with adaptive portrait and landscape windows'
    );
  }
  if (info.ITSAppUsesNonExemptEncryption !== false) {
    fail('IOS_ARTIFACT_ENCRYPTION', 'archive encryption declaration must match the release contract');
  }

  const primaryIcon = info.CFBundleIcons?.CFBundlePrimaryIcon;
  const compiledIconPath = path.join(appPath, 'AppIcon60x60@2x.png');
  const assetCatalogPath = path.join(appPath, 'Assets.car');
  const compiledIcon = fs.existsSync(compiledIconPath)
    ? pngDimensions(fs.readFileSync(compiledIconPath))
    : null;
  if (primaryIcon?.CFBundleIconName !== 'AppIcon' ||
      !Array.isArray(primaryIcon?.CFBundleIconFiles) ||
      !primaryIcon.CFBundleIconFiles.includes('AppIcon60x60')) {
    fail(
      'IOS_ARTIFACT_APP_ICON_METADATA',
      'archive Info.plist must identify the compiled AppIcon asset catalog'
    );
  }
  const assetCatalogEntries = options.assetCatalogEntries ??
    (fs.existsSync(assetCatalogPath) ? parseAssetCatalog(assetCatalogPath) : null);
  if (compiledIcon?.width !== 120 || compiledIcon?.height !== 120 ||
      !assetCatalogContainsAppIcon(assetCatalogEntries)) {
    fail(
      'IOS_ARTIFACT_APP_ICON',
      'archive must contain the compiled 120x120 iPhone icon and 1024x1024 AppIcon catalog rendition'
    );
  }

  const executablePath = typeof info.CFBundleExecutable === 'string'
    ? path.join(appPath, info.CFBundleExecutable)
    : '';
  if (!executablePath || !fs.existsSync(executablePath)) {
    fail('IOS_ARTIFACT_EXECUTABLE', 'archive app executable is missing');
  } else {
    try {
      const missingKeys = new Set();
      for (const nativeExecutable of findNativeExecutables(appPath, executablePath)) {
        const nativeStrings = execFileSync('strings', [nativeExecutable], {
          encoding: 'utf8',
          maxBuffer: 128 * 1024 * 1024,
        });
        for (const requirement of SENSITIVE_NATIVE_API_INVENTORY) {
          if (requirement.pattern.test(nativeStrings) &&
              (typeof info[requirement.key] !== 'string' || info[requirement.key].trim().length < 20)) {
            missingKeys.add(requirement.key);
          }
        }
      }
      for (const key of missingKeys) {
        fail(
          'IOS_ARTIFACT_SENSITIVE_API_INVENTORY',
          `linked native APIs require ${key} in the compiled Info.plist`
        );
      }
    } catch {
      fail('IOS_ARTIFACT_EXECUTABLE_SCAN', 'unable to inspect linked native API references');
    }
  }

  const usageKeys = Object.keys(info).filter(key => /^NS.+UsageDescription$/.test(key)).sort();
  if (!jsonEqual(usageKeys, Object.keys(IOS_PURPOSE_STRINGS).sort()) ||
      Object.entries(IOS_PURPOSE_STRINGS).some(([key, value]) => info[key] !== value)) {
    fail(
      'IOS_ARTIFACT_PURPOSE_STRINGS',
      'archive Info.plist purpose strings do not match the audited sensitive-API inventory'
    );
  }

  for (const [locale, expectedStrings] of Object.entries(LOCALIZED_PURPOSE_STRINGS)) {
    const stringsPath = path.join(appPath, `${locale}.lproj`, 'InfoPlist.strings');
    try {
      const strings = parsePlist(stringsPath);
      const keys = Object.keys(strings).filter(key => /^NS.+UsageDescription$/.test(key)).sort();
      if (!jsonEqual(keys, Object.keys(expectedStrings).sort()) ||
          Object.entries(expectedStrings).some(([key, value]) => strings[key] !== value)) {
        fail('IOS_ARTIFACT_PURPOSE_LOCALIZATION', `${locale} purpose strings do not match the release contract`);
      }
    } catch {
      fail('IOS_ARTIFACT_PURPOSE_LOCALIZATION', `${locale} InfoPlist.strings is not bundled`);
    }
  }

  const privacyManifests = findFiles(appPath, 'PrivacyInfo.xcprivacy');
  const appPrivacyPath = privacyManifests.find(file => path.dirname(file) === appPath);
  if (privacyManifests.length === 0 || !appPrivacyPath) {
    fail('IOS_ARTIFACT_PRIVACY_MANIFEST', 'app-owned PrivacyInfo.xcprivacy is not bundled');
  } else if (options.expectedPrivacyConfig) {
    try {
      const bundledPrivacy = parsePlist(appPrivacyPath);
      if (!jsonEqual(canonicalize(bundledPrivacy), canonicalize(options.expectedPrivacyConfig))) {
        fail('IOS_ARTIFACT_PRIVACY_MANIFEST', 'bundled app privacy manifest differs from the audited source contract');
      }
    } catch {
      fail('IOS_ARTIFACT_PRIVACY_MANIFEST', 'bundled app privacy manifest is invalid');
    }
  }

  const jsBundles = findFiles(appPath, 'main.jsbundle');
  if (jsBundles.length !== 1) {
    fail('IOS_ARTIFACT_JS_BUNDLE', 'archive must contain exactly one embedded main.jsbundle');
  } else {
    const bundle = fs.readFileSync(jsBundles[0], 'utf8');
    // Third-party bundles contain documentation/example localhost strings, so
    // the archive-level invariant is the compiled production origin. Source
    // config is separately scanned for actual dev-origin inputs by the guard.
    if (!bundle.includes(EXPECTED.productionOrigin)) {
      fail('IOS_ARTIFACT_PRODUCTION_ORIGIN', 'embedded JS bundle is missing the production API origin');
    }
  }

  const provisioningPath = path.join(appPath, 'embedded.mobileprovision');
  if (!fs.existsSync(provisioningPath)) {
    fail('IOS_ARTIFACT_PROVISIONING', 'App Store provisioning profile is not embedded');
  }

  if (verifySignature) {
    const signature = spawnSync(
      'codesign',
      ['--verify', '--deep', '--strict', appPath],
      { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
    );
    if (signature.status !== 0) {
      fail('IOS_ARTIFACT_SIGNATURE', 'archive code signature verification failed');
    }
    const entitlements = parseSignedEntitlements(appPath);
    const provisioningProfile = fs.existsSync(provisioningPath)
      ? parseProvisioningProfile(appPath)
      : null;
    if (!provisioningProfile) {
      fail('IOS_ARTIFACT_PROVISIONING', 'embedded App Store provisioning profile is invalid');
    }
    if (!distributionSigningMatchesReleaseContract(entitlements, provisioningProfile)) {
      fail('IOS_ARTIFACT_ENTITLEMENTS', 'signed archive entitlements do not match the launch scope');
    }
  }

  return errors;
}

function validateArchiveEntries(entries) {
  return entries.every(entry =>
    entry.length > 0 &&
    !path.posix.isAbsolute(entry) &&
    !entry.split('/').includes('..')
  );
}

function auditIosIpa(projectRoot, ipaPath, options = {}) {
  const absoluteIpaPath = path.resolve(ipaPath);
  if (!fs.existsSync(absoluteIpaPath) || !fs.statSync(absoluteIpaPath).isFile()) {
    return [{ code: 'IOS_ARTIFACT_IPA', detail: 'IPA file is missing' }];
  }

  fs.mkdirSync(path.join(projectRoot, '.codex-temp'), { recursive: true });
  const tempRoot = fs.mkdtempSync(path.join(projectRoot, '.codex-temp', 'ios-artifact-audit.'));
  try {
    const listing = execFileSync('unzip', ['-Z1', absoluteIpaPath], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    }).split('\n').filter(Boolean);
    if (!validateArchiveEntries(listing)) {
      return [{ code: 'IOS_ARTIFACT_IPA_LAYOUT', detail: 'IPA contains an unsafe archive path' }];
    }
    execFileSync('unzip', ['-qq', absoluteIpaPath, '-d', tempRoot]);
    const payloadPath = path.join(tempRoot, 'Payload');
    const appBundles = fs.existsSync(payloadPath)
      ? fs.readdirSync(payloadPath, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && entry.name.endsWith('.app'))
      : [];
    if (appBundles.length !== 1) {
      return [{ code: 'IOS_ARTIFACT_IPA_LAYOUT', detail: 'IPA must contain exactly one Payload app bundle' }];
    }
    const expectedPrivacyConfig = parsePlist(
      path.join(projectRoot, 'ios/metravel/PrivacyInfo.xcprivacy')
    );
    return validateIosAppBundle(path.join(payloadPath, appBundles[0].name), {
      ...options,
      expectedPrivacyConfig,
    });
  } catch (error) {
    return [{ code: 'IOS_ARTIFACT_IPA_READ', detail: error.message }];
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

module.exports = {
  assetCatalogContainsAppIcon,
  auditIosIpa,
  distributionSigningMatchesReleaseContract,
  validateIosAppBundle,
};
