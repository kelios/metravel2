const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_PROJECT = Object.freeze({
  workspace: 'ios/metravel.xcworkspace',
  scheme: 'metravel',
});

function commandResult(command, args, options = {}) {
  const result = (options.spawn || spawnSync)(command, args, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
    env: options.env || process.env,
  });
  if (result.error) {
    throw new Error(`${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim();
    throw new Error(`${command} exited ${result.status}${detail ? `: ${detail}` : ''}`);
  }
  return String(result.stdout || '');
}

function runtimeVersionForSdk(sdkVersion) {
  const match = String(sdkVersion).trim().match(/^(\d+\.\d+)/);
  return match ? match[1] : null;
}

function availableDestinationsOutput(output) {
  return String(output).split(/^\s*Ineligible destinations\b/im, 1)[0];
}

function isIosRuntime(runtime) {
  return runtime?.platform === 'iOS' ||
    /\.SimRuntime\.iOS-/.test(String(runtime?.identifier || ''));
}

function concreteIphoneDestinations(output, expectedRuntime = null) {
  return (availableDestinationsOutput(output).match(/\{[^}]+\}/g) || []).filter(destination =>
    /platform:\s*iOS Simulator/.test(destination) &&
    /name:\s*iPhone\b/.test(destination) &&
    !/placeholder/i.test(destination) &&
    !/\berror:/i.test(destination) &&
    (!expectedRuntime || destination.match(/\bOS:\s*([^,}\s]+)/)?.[1] === expectedRuntime)
  );
}

function validatePodsEnvironment(root) {
  const errors = [];
  const requiredPaths = [
    'ios/Podfile',
    'ios/Podfile.lock',
    'ios/Podfile.properties.json',
    'ios/metravel.xcworkspace/contents.xcworkspacedata',
    'ios/Pods/Manifest.lock',
    'ios/Pods/Pods.xcodeproj/project.pbxproj',
    'ios/Pods/Target Support Files/Pods-metravel/Pods-metravel.debug.xcconfig',
    'ios/Pods/Target Support Files/Pods-metravel/Pods-metravel.release.xcconfig',
    'ios/Pods/Target Support Files/Pods-metravel/ExpoModulesProvider.swift',
  ];
  const missingPaths = requiredPaths.filter(relativePath =>
    !fs.existsSync(path.join(root, relativePath))
  );
  if (missingPaths.length > 0) {
    errors.push({
      code: 'IOS_ENV_PODS_SUPPORT',
      detail: `missing CocoaPods workspace/support files: ${missingPaths.join(', ')}`,
    });
  }

  const lockPath = path.join(root, 'ios/Podfile.lock');
  const manifestPath = path.join(root, 'ios/Pods/Manifest.lock');
  if (!fs.existsSync(lockPath) || !fs.existsSync(manifestPath)) {
    errors.push({
      code: 'IOS_ENV_PODS_LOCK',
      detail: 'ios/Podfile.lock and ios/Pods/Manifest.lock must both exist',
    });
  } else if (!fs.readFileSync(lockPath).equals(fs.readFileSync(manifestPath))) {
    errors.push({
      code: 'IOS_ENV_PODS_LOCK',
      detail: 'CocoaPods sandbox is not synchronized with ios/Podfile.lock',
    });
  }

  const stalePodNeedle = 'react-native-google-maps';
  const podMetadataPaths = [
    'ios/Podfile',
    'ios/Podfile.lock',
    'ios/Pods/Manifest.lock',
    'ios/Pods/Pods.xcodeproj/project.pbxproj',
  ];
  const stalePaths = podMetadataPaths.filter(relativePath => {
    const absolutePath = path.join(root, relativePath);
    return fs.existsSync(absolutePath) &&
      fs.readFileSync(absolutePath, 'utf8').includes(stalePodNeedle);
  });
  if (stalePaths.length > 0) {
    errors.push({
      code: 'IOS_ENV_STALE_GOOGLE_MAPS_POD',
      detail: `stale ${stalePodNeedle} entry found in: ${stalePaths.join(', ')}`,
    });
  }

  return errors;
}

function validateIosEnvironmentEvidence(evidence, options = {}) {
  const errors = [];
  const expectedRuntime = runtimeVersionForSdk(evidence.sdkVersion);
  if (!expectedRuntime) {
    errors.push({
      code: 'IOS_ENV_SDK_VERSION',
      detail: `unrecognized iOS SDK version: ${String(evidence.sdkVersion)}`,
    });
  }

  const runtimes = Array.isArray(evidence.runtimes?.runtimes)
    ? evidence.runtimes.runtimes
    : [];
  const matchingRuntimes = expectedRuntime
    ? runtimes.filter(runtime =>
        isIosRuntime(runtime) &&
        runtime?.isAvailable === true &&
        runtimeVersionForSdk(runtime?.version) === expectedRuntime
      )
    : [];
  if (expectedRuntime && matchingRuntimes.length === 0) {
    const installed = runtimes
      .filter(runtime => isIosRuntime(runtime) && runtime?.isAvailable === true)
      .map(runtime => runtime.version)
      .filter(Boolean)
      .join(', ');
    errors.push({
      code: 'IOS_ENV_RUNTIME_SDK_MISMATCH',
      detail: `iOS SDK ${expectedRuntime} needs an available ${expectedRuntime} simulator runtime; installed: ${installed || 'none'}`,
    });
  }

  const destinations = concreteIphoneDestinations(evidence.destinations, expectedRuntime);
  if (destinations.length === 0) {
    errors.push({
      code: 'IOS_ENV_ELIGIBLE_IPHONE_DESTINATION',
      detail: 'Xcode exposes no concrete eligible iPhone simulator destination',
    });
  }

  if (options.root) {
    errors.push(...validatePodsEnvironment(options.root));
  }

  return {
    errors,
    expectedRuntime,
    matchingRuntimes,
    destinations,
  };
}

function inspectIosEnvironment(options = {}) {
  const cwd = options.cwd || process.cwd();
  const workspace = options.workspace || DEFAULT_PROJECT.workspace;
  const scheme = options.scheme || DEFAULT_PROJECT.scheme;
  const exec = (command, args) => commandResult(command, args, { ...options, cwd });

  try {
    const developerDir = exec('xcode-select', ['-p']).trim();
    exec('xcodebuild', ['-checkFirstLaunchStatus']);
    const xcodeVersion = exec('xcodebuild', ['-version']).trim();
    const sdkVersion = exec('xcrun', ['--sdk', 'iphoneos', '--show-sdk-version']).trim();
    const runtimes = JSON.parse(exec('xcrun', ['simctl', 'list', '-j', 'runtimes']));
    const destinations = exec('xcodebuild', [
      '-workspace',
      workspace,
      '-scheme',
      scheme,
      '-showdestinations',
    ]);
    const validation = validateIosEnvironmentEvidence(
      { sdkVersion, runtimes, destinations },
      { root: cwd }
    );
    return {
      ...validation,
      developerDir,
      xcodeVersion,
      sdkVersion,
      workspace,
      scheme,
    };
  } catch (error) {
    return {
      errors: [{ code: 'IOS_ENV_COMMAND', detail: error.message }],
      destinations: [],
      matchingRuntimes: [],
      workspace,
      scheme,
    };
  }
}

module.exports = {
  DEFAULT_PROJECT,
  concreteIphoneDestinations,
  inspectIosEnvironment,
  isIosRuntime,
  runtimeVersionForSdk,
  validatePodsEnvironment,
  validateIosEnvironmentEvidence,
};
