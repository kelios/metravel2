import fs from 'fs';
import os from 'os';
import path from 'path';

const plist = require('@expo/plist').default;
const {
  EXPECTED,
  IOS_PURPOSE_STRINGS,
  LOCALIZED_PURPOSE_STRINGS,
} = require('../../scripts/ios-release-guard-lib');
const {
  distributionSigningMatchesReleaseContract,
  validateIosAppBundle,
} = require('../../scripts/ios-artifact-audit-lib');
const {
  fetchHttpsArtifact,
  validateEasBuildMetadata,
} = require('../../scripts/ios-eas-artifact-download');

const tempRoots: string[] = [];

function createAppBundle(
  mutateInfo: (info: Record<string, unknown>) => void = () => undefined
): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'metravel-ios-artifact-'));
  tempRoots.push(tempRoot);
  const appPath = path.join(tempRoot, 'metravel.app');
  fs.mkdirSync(appPath, { recursive: true });

  const info: Record<string, unknown> = {
    CFBundleIdentifier: EXPECTED.bundleIdentifier,
    CFBundleExecutable: 'metravel',
    CFBundleShortVersionString: EXPECTED.version,
    CFBundleVersion: EXPECTED.buildNumber,
    MinimumOSVersion: EXPECTED.deploymentTarget,
    UIDeviceFamily: [1],
    ITSAppUsesNonExemptEncryption: false,
    ...IOS_PURPOSE_STRINGS,
  };
  mutateInfo(info);
  fs.writeFileSync(path.join(appPath, 'Info.plist'), plist.build(info));
  fs.writeFileSync(path.join(appPath, 'PrivacyInfo.xcprivacy'), plist.build({
    NSPrivacyTracking: false,
  }));
  fs.writeFileSync(
    path.join(appPath, 'main.jsbundle'),
    `compiled production input ${EXPECTED.productionOrigin}`
  );
  fs.writeFileSync(path.join(appPath, 'embedded.mobileprovision'), 'fixture');
  fs.writeFileSync(path.join(appPath, 'metravel'), 'linked CMMotionActivityManager native symbol');

  for (const [locale, strings] of Object.entries(LOCALIZED_PURPOSE_STRINGS)) {
    const localePath = path.join(appPath, `${locale}.lproj`);
    fs.mkdirSync(localePath, { recursive: true });
    fs.writeFileSync(
      path.join(localePath, 'InfoPlist.strings'),
      plist.build(strings)
    );
  }
  return appPath;
}

function distributionSigningFixture() {
  const teamIdentifier = 'TESTTEAM01';
  const applicationIdentifier = `${teamIdentifier}.${EXPECTED.bundleIdentifier}`;
  const entitlements = {
    'application-identifier': applicationIdentifier,
    'beta-reports-active': true,
    'com.apple.developer.applesignin': ['Default'],
    'com.apple.developer.associated-domains': ['applinks:metravel.by'],
    'com.apple.developer.team-identifier': teamIdentifier,
    'get-task-allow': false,
  };
  const profile = {
    Entitlements: {
      'application-identifier': applicationIdentifier,
      'beta-reports-active': true,
      'com.apple.developer.applesignin': ['Default'],
      'com.apple.developer.associated-domains': '*',
      'com.apple.developer.team-identifier': teamIdentifier,
      'get-task-allow': false,
    },
    ExpirationDate: new Date('2030-01-01T00:00:00.000Z'),
    TeamIdentifier: [teamIdentifier],
  };
  return { entitlements, profile };
}

describe('iOS signed artifact audit', () => {
  afterEach(() => {
    for (const tempRoot of tempRoots.splice(0)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('accepts an artifact whose compiled Info.plist matches the release contract', () => {
    expect(validateIosAppBundle(createAppBundle(), { verifySignature: false })).toEqual([]);
  });

  it('catches the exact missing Motion purpose string rejected by Apple', () => {
    const appPath = createAppBundle(info => {
      delete info.NSMotionUsageDescription;
    });
    expect(validateIosAppBundle(appPath, { verifySignature: false })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'IOS_ARTIFACT_PURPOSE_STRINGS' }),
        expect.objectContaining({ code: 'IOS_ARTIFACT_SENSITIVE_API_INVENTORY' }),
      ])
    );
  });

  it('catches the Apple-rejected macOS minimum-system key in the compiled artifact', () => {
    const appPath = createAppBundle(info => {
      info.LSMinimumSystemVersion = EXPECTED.deploymentTarget;
    });
    expect(validateIosAppBundle(appPath, { verifySignature: false })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'IOS_ARTIFACT_MINIMUM_OS' }),
      ])
    );
  });

  it('scans executable native frameworks as well as the main app binary', () => {
    const appPath = createAppBundle(info => {
      delete info.NSMotionUsageDescription;
    });
    fs.writeFileSync(path.join(appPath, 'metravel'), 'main app without protected symbols');
    const frameworkPath = path.join(appPath, 'Frameworks', 'MotionKit.framework');
    fs.mkdirSync(frameworkPath, { recursive: true });
    const frameworkExecutable = path.join(frameworkPath, 'MotionKit');
    fs.writeFileSync(frameworkExecutable, 'linked CMHeadphoneMotionManager native symbol');
    fs.chmodSync(frameworkExecutable, 0o755);

    expect(validateIosAppBundle(appPath, { verifySignature: false })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'IOS_ARTIFACT_SENSITIVE_API_INVENTORY' }),
      ])
    );
  });

  it('fails closed when a bundled purpose localization is stale', () => {
    const appPath = createAppBundle();
    fs.writeFileSync(
      path.join(appPath, 'pl.lproj', 'InfoPlist.strings'),
      plist.build({
        ...LOCALIZED_PURPOSE_STRINGS.pl,
        NSCameraUsageDescription: 'Stale camera copy',
      })
    );
    expect(validateIosAppBundle(appPath, { verifySignature: false })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'IOS_ARTIFACT_PURPOSE_LOCALIZATION' }),
      ])
    );
  });

  it('accepts only an unexpired App Store profile whose identity matches the exact signed entitlements', () => {
    const { entitlements, profile } = distributionSigningFixture();
    expect(distributionSigningMatchesReleaseContract(
      entitlements,
      profile,
      new Date('2029-01-01T00:00:00.000Z')
    )).toBe(true);

    expect(distributionSigningMatchesReleaseContract(
      entitlements,
      { ...profile, ProvisionedDevices: ['test-device'] },
      new Date('2029-01-01T00:00:00.000Z')
    )).toBe(false);
    expect(distributionSigningMatchesReleaseContract(
      { ...entitlements, 'aps-environment': 'production' },
      profile,
      new Date('2029-01-01T00:00:00.000Z')
    )).toBe(false);
    expect(distributionSigningMatchesReleaseContract(
      entitlements,
      {
        ...profile,
        Entitlements: {
          ...profile.Entitlements,
          'com.apple.developer.associated-domains': undefined,
        },
      },
      new Date('2029-01-01T00:00:00.000Z')
    )).toBe(false);
    expect(distributionSigningMatchesReleaseContract(
      entitlements,
      profile,
      new Date('2031-01-01T00:00:00.000Z')
    )).toBe(false);
  });
});

describe('iOS EAS artifact identity', () => {
  const buildId = '11111111-1111-4111-8111-111111111111';
  const revision = '0123456789abcdef0123456789abcdef01234567';
  const metadata = {
    appBuildVersion: EXPECTED.buildNumber,
    appVersion: EXPECTED.version,
    artifacts: { buildUrl: 'https://expo.dev/artifacts/eas/protected.ipa' },
    buildProfile: 'production',
    distribution: 'STORE',
    gitCommitHash: revision,
    id: buildId,
    platform: 'IOS',
    status: 'FINISHED',
  };

  it('accepts only the exact finished production build from the current revision', () => {
    expect(validateEasBuildMetadata(metadata, buildId, revision)).toBe(
      'https://expo.dev/artifacts/eas/protected.ipa'
    );
    expect(() => validateEasBuildMetadata(
      { ...metadata, gitCommitHash: 'different-revision' },
      buildId,
      revision
    )).toThrow('exact current production release candidate');
    expect(() => validateEasBuildMetadata(
      { ...metadata, status: 'IN_PROGRESS' },
      buildId,
      revision
    )).toThrow('exact current production release candidate');
  });

  it('rejects option-like build identifiers and non-HTTPS artifact URLs', () => {
    expect(() => validateEasBuildMetadata(metadata, '--latest', revision)).toThrow(
      'exact current production release candidate'
    );
    expect(() => validateEasBuildMetadata(
      { ...metadata, artifacts: { buildUrl: 'http://example.test/candidate.ipa' } },
      buildId,
      revision
    )).toThrow('protected HTTPS IPA artifact URL');
  });

  it('refuses an HTTPS artifact redirect before following it to HTTP', async () => {
    const cancel = jest.fn().mockResolvedValue(undefined);
    const fetchImplementation = jest.fn().mockResolvedValue({
      body: { cancel },
      headers: new Headers({ location: 'http://example.test/candidate.ipa' }),
      status: 302,
    });

    await expect(fetchHttpsArtifact(
      'https://expo.dev/artifacts/eas/protected.ipa',
      fetchImplementation
    )).rejects.toThrow('must remain on HTTPS');
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
