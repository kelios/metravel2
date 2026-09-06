import fs from 'fs';
import path from 'path';

import { makeTempDir, removeDir } from './cli-test-utils';

const {
  ANDROID_PACKAGE,
  CONFIG_FILE_NAME,
  REQUIRED_FIREBASE_RESOURCES,
  assertGoogleServicesConfig,
  findMissingFirebaseGradleWiring,
  resolveGoogleServicesFile,
} = require('../../scripts/android-firebase-config');
const {
  readAndroidResource,
  verifyFirebaseAndroidResources,
} = require('../../scripts/android-gradle-build');

const validConfig = (packageName: string = ANDROID_PACKAGE) => ({
  project_info: { project_number: '123456789012', project_id: 'metravel-app' },
  client: [
    {
      client_info: {
        mobilesdk_app_id: '1:123456789012:android:abcdef',
        android_client_info: { package_name: packageName },
      },
      api_key: [{ current_key: 'AIza-test-key' }],
    },
  ],
});

const writeConfig = (dir: string, contents: unknown, name = CONFIG_FILE_NAME) => {
  const filePath = path.join(dir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    typeof contents === 'string' ? contents : JSON.stringify(contents),
  );
  return filePath;
};

describe('android firebase config resolution', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = makeTempDir('android-firebase-');
  });

  afterEach(() => {
    removeDir(rootDir);
  });

  it('returns null when no config is available, so web builds keep working', () => {
    expect(resolveGoogleServicesFile({ env: {}, rootDir })).toBeNull();
  });

  it('prefers the repository root config over the .secrets copy', () => {
    const rootConfig = writeConfig(rootDir, validConfig());
    writeConfig(path.join(rootDir, '.secrets'), validConfig());

    expect(resolveGoogleServicesFile({ env: {}, rootDir })).toBe(rootConfig);
  });

  it('falls back to the .secrets copy', () => {
    const secretConfig = writeConfig(path.join(rootDir, '.secrets'), validConfig());

    expect(resolveGoogleServicesFile({ env: {}, rootDir })).toBe(secretConfig);
  });

  it('fails loudly when GOOGLE_SERVICES_JSON points at a missing file', () => {
    expect(() =>
      resolveGoogleServicesFile({
        env: { GOOGLE_SERVICES_JSON: 'nowhere/google-services.json' },
        rootDir,
      }),
    ).toThrow(/missing file/);
  });
});

describe('android firebase config validation', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = makeTempDir('android-firebase-');
  });

  afterEach(() => {
    removeDir(rootDir);
  });

  it('accepts a config registered for the shipped package', () => {
    const configPath = writeConfig(rootDir, validConfig());

    expect(assertGoogleServicesConfig(configPath)).toEqual({
      packageName: ANDROID_PACKAGE,
      configPath,
    });
  });

  it('rejects a config downloaded for another Android app', () => {
    const configPath = writeConfig(rootDir, validConfig('by.other.app'));

    expect(() => assertGoogleServicesConfig(configPath)).toThrow(
      new RegExp(`no Android app for package ${ANDROID_PACKAGE}`),
    );
  });

  it('rejects a config whose Android client carries no api key', () => {
    const config = validConfig();
    config.client[0].api_key = [];
    const configPath = writeConfig(rootDir, config);

    expect(() => assertGoogleServicesConfig(configPath)).toThrow(/no api_key/);
  });

  it('rejects a file that is not a Firebase config at all', () => {
    const configPath = writeConfig(rootDir, { hello: 'world' });

    expect(() => assertGoogleServicesConfig(configPath)).toThrow(
      /project_info\.project_number/,
    );
  });
});

describe('android firebase gradle wiring', () => {
  const wiredProject = "dependencies { classpath 'com.google.gms:google-services:4.4.4' }";
  const wiredApp = "apply plugin: 'com.google.gms.google-services'";

  it('reports nothing missing once prebuild applied the plugin', () => {
    expect(
      findMissingFirebaseGradleWiring({
        projectBuildGradle: wiredProject,
        appBuildGradle: wiredApp,
        hasCopiedConfig: true,
      }),
    ).toEqual([]);
  });

  it('catches an android/ generated before googleServicesFile was configured', () => {
    const missing = findMissingFirebaseGradleWiring({
      projectBuildGradle: 'dependencies { classpath("com.android.tools.build:gradle") }',
      appBuildGradle: 'apply plugin: "com.android.application"',
      hasCopiedConfig: false,
    });

    expect(missing).toHaveLength(3);
    expect(missing.join('\n')).toMatch(/com\.google\.gms/);
  });

  it('accepts the double-quoted form of the apply plugin line', () => {
    expect(
      findMissingFirebaseGradleWiring({
        projectBuildGradle: wiredProject,
        appBuildGradle: 'apply plugin: "com.google.gms.google-services"',
        hasCopiedConfig: true,
      }),
    ).toEqual([]);
  });
});

describe('compiled Firebase Android resources', () => {
  let rootDir: string;

  const writeValues = (xml: string) => {
    const valuesPath = path.join(rootDir, 'values.xml');
    fs.writeFileSync(valuesPath, xml);
    return valuesPath;
  };

  const resourcesXml = (value: string) =>
    '<resources>' +
    REQUIRED_FIREBASE_RESOURCES.map(
      (name: string) => `<string name="${name}">${value}</string>`,
    ).join('') +
    '</resources>';

  beforeEach(() => {
    rootDir = makeTempDir('android-firebase-res-');
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    removeDir(rootDir);
  });

  it('reads a packaged string resource by name', () => {
    const xml = '<resources><string name="google_app_id">1:1:android:a</string></resources>';

    expect(readAndroidResource(xml, 'string', 'google_app_id')).toBe('1:1:android:a');
    expect(readAndroidResource(xml, 'string', 'google_api_key')).toBe('');
  });

  it('passes when Gradle packaged every required Firebase resource', () => {
    const valuesPath = writeValues(resourcesXml('present'));

    expect(() => verifyFirebaseAndroidResources('debug', valuesPath)).not.toThrow();
  });

  it('rejects an artifact whose Firebase resources are empty', () => {
    const valuesPath = writeValues(resourcesXml(''));

    expect(() => verifyFirebaseAndroidResources('debug', valuesPath)).toThrow(
      new RegExp(REQUIRED_FIREBASE_RESOURCES.join(', ')),
    );
  });

  it('rejects the shipped 1.0.5 shape: resources absent altogether', () => {
    const valuesPath = writeValues('<resources><string name="app_name">MeTravel</string></resources>');

    expect(() => verifyFirebaseAndroidResources('debug', valuesPath)).toThrow(
      /no Firebase configuration/,
    );
  });

  it('reports a missing compiled configuration instead of passing silently', () => {
    expect(() =>
      verifyFirebaseAndroidResources('debug', path.join(rootDir, 'absent.xml')),
    ).toThrow(/compiled Android Firebase configuration is missing/);
  });

  it('never prints resource values', () => {
    const valuesPath = writeValues(resourcesXml('super-secret-value'));

    verifyFirebaseAndroidResources('debug', valuesPath);

    const printed = (process.stdout.write as jest.Mock).mock.calls
      .map((call) => String(call[0]))
      .join('');
    expect(printed).toContain('values hidden');
    expect(printed).not.toContain('super-secret-value');
  });
});
