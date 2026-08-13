import fs from 'fs';
import os from 'os';
import path from 'path';

const {
  concreteIphoneDestinations,
  isIosRuntime,
  runtimeVersionForSdk,
  validateIosEnvironmentEvidence,
  validatePodsEnvironment,
} = require('../../scripts/ios-environment-preflight-lib');

const healthyEvidence = {
  sdkVersion: '26.5',
  runtimes: {
    runtimes: [
      {
        platform: 'iOS',
        version: '26.5',
        buildversion: '23F77',
        isAvailable: true,
      },
    ],
  },
  destinations: `
    Available destinations for the "metravel" scheme:
      { platform:iOS Simulator, id:placeholder, name:Any iOS Simulator Device }
      { platform:iOS Simulator, arch:arm64, id:simulator-id, OS:26.5, name:iPhone 17 Pro }
  `,
};

function podsFixture(changes: Record<string, string> = {}): string {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'metravel-ios-env-'));
  const files: Record<string, string> = {
    'ios/Podfile': '',
    'ios/Podfile.lock': 'PODS:\n',
    'ios/Podfile.properties.json': '{}',
    'ios/metravel.xcworkspace/contents.xcworkspacedata': '<Workspace/>',
    'ios/Pods/Manifest.lock': 'PODS:\n',
    'ios/Pods/Pods.xcodeproj/project.pbxproj': '',
    'ios/Pods/Target Support Files/Pods-metravel/Pods-metravel.debug.xcconfig': '',
    'ios/Pods/Target Support Files/Pods-metravel/Pods-metravel.release.xcconfig': '',
    'ios/Pods/Target Support Files/Pods-metravel/ExpoModulesProvider.swift': '',
    ...changes,
  };
  for (const [relativePath, value] of Object.entries(files)) {
    const target = path.join(tempRoot, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, value);
  }
  return tempRoot;
}

describe('iOS environment preflight', () => {
  it('matches an SDK patch version to its major/minor simulator runtime', () => {
    expect(runtimeVersionForSdk('26.5.1')).toBe('26.5');
    expect(validateIosEnvironmentEvidence({ ...healthyEvidence, sdkVersion: '26.5.1' }).errors).toEqual([]);
  });

  it('recognizes iOS runtimes across simctl JSON schema variants', () => {
    expect(isIosRuntime({ platform: 'iOS' })).toBe(true);
    expect(isIosRuntime({ identifier: 'com.apple.CoreSimulator.SimRuntime.iOS-26-5' })).toBe(true);
    expect(isIosRuntime({ name: 'iOS 26.5' })).toBe(false);
    expect(isIosRuntime({ name: 'visionOS 26.5' })).toBe(false);
  });

  it('accepts only concrete iPhone simulator destinations', () => {
    expect(concreteIphoneDestinations(healthyEvidence.destinations, '26.5')).toHaveLength(1);
  });

  it('rejects concrete iPhones reported only as ineligible', () => {
    const destinations = `
      Available destinations for the "metravel" scheme:
        { platform:iOS Simulator, id:placeholder, name:Any iOS Simulator Device }
      Ineligible destinations for the "metravel" scheme:
        { platform:iOS Simulator, id:ineligible-id, OS:26.5, name:iPhone 17 Pro, error:iOS 26.5 is not installed }
    `;
    expect(concreteIphoneDestinations(destinations, '26.5')).toEqual([]);
  });

  it('fails when Xcode SDK and installed simulator runtimes drift', () => {
    const result = validateIosEnvironmentEvidence({
      ...healthyEvidence,
      runtimes: {
        runtimes: [
          { platform: 'iOS', version: '26.4', isAvailable: true },
          { platform: 'iOS', version: '26.5', isAvailable: false },
        ],
      },
    });
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'IOS_ENV_RUNTIME_SDK_MISMATCH' }),
      ])
    );
  });

  it('fails when showdestinations exposes only a generic simulator', () => {
    const result = validateIosEnvironmentEvidence({
      ...healthyEvidence,
      destinations: '{ platform:iOS Simulator, id:placeholder, name:Any iOS Simulator Device }',
    });
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'IOS_ENV_ELIGIBLE_IPHONE_DESTINATION' }),
      ])
    );
  });

  it('fails when concrete iPhones exist only for another runtime', () => {
    const result = validateIosEnvironmentEvidence({
      ...healthyEvidence,
      destinations: '{ platform:iOS Simulator, id:other-runtime, OS:26.4, name:iPhone 17 Pro }',
    });
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'IOS_ENV_ELIGIBLE_IPHONE_DESTINATION' }),
      ])
    );
  });

  it('does not partially match a different runtime version', () => {
    const destinations =
      '{ platform:iOS Simulator, id:other-runtime, OS:26.50, name:iPhone 17 Pro }';
    expect(concreteIphoneDestinations(destinations, '26.5')).toEqual([]);
  });

  it('fails closed when CocoaPods support files are missing', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'metravel-ios-env-'));
    try {
      expect(validatePodsEnvironment(tempRoot)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'IOS_ENV_PODS_SUPPORT' }),
          expect.objectContaining({ code: 'IOS_ENV_PODS_LOCK' }),
        ])
      );
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('accepts a synchronized CocoaPods workspace', () => {
    const tempRoot = podsFixture();
    try {
      expect(validatePodsEnvironment(tempRoot)).toEqual([]);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('fails closed when the CocoaPods sandbox lock has drifted', () => {
    const tempRoot = podsFixture({ 'ios/Pods/Manifest.lock': 'PODS:\n  drift\n' });
    try {
      expect(validatePodsEnvironment(tempRoot)).toEqual([
        expect.objectContaining({ code: 'IOS_ENV_PODS_LOCK' }),
      ]);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('fails closed on a stale react-native-google-maps Pod entry', () => {
    const tempRoot = podsFixture({ 'ios/Podfile': "pod 'react-native-google-maps'" });
    try {
      expect(validatePodsEnvironment(tempRoot)).toEqual([
        expect.objectContaining({ code: 'IOS_ENV_STALE_GOOGLE_MAPS_POD' }),
      ]);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
