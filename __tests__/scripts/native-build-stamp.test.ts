/**
 * Native build stamp (board #2469, family of #679).
 *
 * A dev-client compiled from worklets 0.10.0 and run against the JS of
 * worklets 0.10.1 died with SIGABRT one second after `Running "main"`: the
 * patch release changed a JSI method's arity and the library's own version
 * check compares only major.minor. The "fresh" build that was meant to rule
 * this out was never installed — the emulator kept the byte-identical old APK.
 *
 * Contracts:
 *   1. a stamp records the native package set and the artifact's sha256;
 *   2. `check` fails with the exact drift when the checkout's native set
 *      differs from the stamped one, and passes when it is equal;
 *   3. `check --device` fails when the binary installed on the device is not
 *      the stamped artifact, and passes when it is;
 *   4. a pure-JS package is not part of the native set, so bumping it never
 *      demands a rebuild;
 *   5. a build without a stamp is refused (exit 2) with the rebuild hint.
 */

import fs from 'fs'
import path from 'path'

import { makeTempDir, removeDir, runCli, writeJsonFile, writeTextFile } from './cli-test-utils'

const scriptPath = path.resolve(process.cwd(), 'scripts/native-build-stamp.js')

type Sandbox = { root: string; stubBin: string; artifact: string }

const addPackage = (root: string, name: string, version: string, native: boolean) => {
  const dir = path.join(root, 'node_modules', name)
  writeJsonFile(path.join(dir, 'package.json'), { name, version })
  if (native) writeTextFile(path.join(dir, 'android', 'build.gradle'), 'apply plugin: "com.android.library"\n')
}

const makeSandbox = (): Sandbox => {
  const root = makeTempDir('native-stamp-')
  writeJsonFile(path.join(root, 'app.json'), {
    expo: { android: { package: 'by.metravel.app' }, ios: { bundleIdentifier: 'by.metravel.app' }, plugins: ['expo-font'] },
  })
  addPackage(root, 'react-native', '0.86.3', false)
  addPackage(root, 'react-native-worklets', '0.10.0', true)
  addPackage(root, 'react-native-reanimated', '4.5.0', true)
  addPackage(root, '@scope/native-thing', '1.0.0', true)
  addPackage(root, 'lodash', '4.17.21', false)
  const artifact = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
  writeTextFile(artifact, 'apk-bytes-v1')
  const stubBin = path.join(root, 'stub-bin')
  fs.mkdirSync(stubBin, { recursive: true })
  return { root, stubBin, artifact }
}

/** A fake `adb` that reports an installed base.apk with the given sha256. */
const installAdbStub = (stubBin: string, sha256: string) => {
  const adb = path.join(stubBin, 'adb')
  writeTextFile(
    adb,
    [
      '#!/bin/sh',
      'case "$*" in',
      '  *"pm path by.metravel.app"*) echo "package:/data/app/by.metravel.app-1/base.apk" ;;',
      `  *"sha256sum /data/app/by.metravel.app-1/base.apk"*) echo "${sha256}  /data/app/by.metravel.app-1/base.apk" ;;`,
      '  *) echo "unexpected adb call: $*" >&2; exit 9 ;;',
      'esac',
    ].join('\n') + '\n',
  )
  fs.chmodSync(adb, 0o755)
}

const run = (sandbox: Sandbox, args: string[]) =>
  runCli(process.execPath, [scriptPath, ...args, '--root', sandbox.root], {
    cwd: sandbox.root,
    env: { PATH: `${sandbox.stubBin}:${process.env.PATH ?? ''}` },
  })

const sha256Of = (filePath: string) => require('crypto').createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')

describe('native build stamp (#2469)', () => {
  let sandbox: Sandbox

  beforeEach(() => {
    sandbox = makeSandbox()
  })

  afterEach(() => {
    removeDir(sandbox.root)
  })

  it('records the native package set, app config and artifact sha256 next to the artifact', () => {
    const result = run(sandbox, ['stamp', sandbox.artifact])
    expect(result.status).toBe(0)
    const stamp = JSON.parse(fs.readFileSync(`${sandbox.artifact}.native-stamp.json`, 'utf8'))
    expect(stamp.platform).toBe('android')
    expect(stamp.artifact.sha256).toBe(sha256Of(sandbox.artifact))
    expect(stamp.manifest.packages).toEqual({
      '@scope/native-thing': '1.0.0',
      'react-native': '0.86.3',
      'react-native-reanimated': '4.5.0',
      'react-native-worklets': '0.10.0',
    })
    expect(stamp.manifest.packages.lodash).toBeUndefined()
    expect(typeof stamp.manifest.appConfigHash).toBe('string')
  })

  it('passes when the checkout still has the stamped native set', () => {
    expect(run(sandbox, ['stamp', sandbox.artifact]).status).toBe(0)
    const result = run(sandbox, ['check'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('native set matches the checkout')
  })

  it('fails with the exact drift when a native package was bumped after the build', () => {
    expect(run(sandbox, ['stamp', sandbox.artifact]).status).toBe(0)
    addPackage(sandbox.root, 'react-native-worklets', '0.10.1', true)
    addPackage(sandbox.root, 'react-native-reanimated', '4.5.1', true)
    const result = run(sandbox, ['check', '--json'])
    expect(result.status).toBe(1)
    const report = JSON.parse(result.stdout)
    expect(report.ok).toBe(false)
    expect(report.drift).toEqual([
      { kind: 'package', name: 'react-native-reanimated', built: '4.5.0', current: '4.5.1' },
      { kind: 'package', name: 'react-native-worklets', built: '0.10.0', current: '0.10.1' },
    ])
    expect(result.stderr).toContain('react-native-worklets: built with 0.10.0, checkout has 0.10.1')
    expect(result.stderr).toContain('Rebuild the native app')
  })

  it('treats a new or removed native package and a changed app.json native section as drift', () => {
    expect(run(sandbox, ['stamp', sandbox.artifact]).status).toBe(0)
    addPackage(sandbox.root, 'react-native-new-module', '1.2.3', true)
    fs.rmSync(path.join(sandbox.root, 'node_modules', '@scope'), { recursive: true })
    writeJsonFile(path.join(sandbox.root, 'app.json'), {
      expo: { android: { package: 'by.metravel.app' }, ios: { bundleIdentifier: 'by.metravel.app' }, plugins: ['expo-font', 'expo-camera'] },
    })
    const report = JSON.parse(run(sandbox, ['check', '--json']).stdout)
    expect(report.drift.map((entry: { name: string; built: string | null; current: string | null }) => [entry.name, entry.built, entry.current])).toEqual([
      ['@scope/native-thing', '1.0.0', null],
      ['react-native-new-module', null, '1.2.3'],
      ['app.json (android/ios/plugins/runtimeVersion)', expect.any(String), expect.any(String)],
    ])
  })

  it('ignores a pure-JS package bump', () => {
    expect(run(sandbox, ['stamp', sandbox.artifact]).status).toBe(0)
    addPackage(sandbox.root, 'lodash', '4.17.22', false)
    expect(run(sandbox, ['check']).status).toBe(0)
  })

  it('refuses the device when the installed binary is not the stamped build', () => {
    expect(run(sandbox, ['stamp', sandbox.artifact]).status).toBe(0)
    installAdbStub(sandbox.stubBin, 'a'.repeat(64))
    const result = run(sandbox, ['check', '--device'])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('installed by.metravel.app is not the stamped build')
    expect(result.stderr).toContain('Install the artifact you built')
  })

  it('accepts the device when the installed binary is the stamped build', () => {
    expect(run(sandbox, ['stamp', sandbox.artifact]).status).toBe(0)
    installAdbStub(sandbox.stubBin, sha256Of(sandbox.artifact))
    const result = run(sandbox, ['check', '--device'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('installed by.metravel.app: is the stamped build')
  })

  it('refuses --device for an AAB: only an APK can be compared with the installed base.apk', () => {
    const aab = path.join(sandbox.root, 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab')
    writeTextFile(aab, 'aab-bytes')
    expect(run(sandbox, ['stamp', aab]).status).toBe(0)
    expect(run(sandbox, ['check', '--artifact', aab]).status).toBe(0)
    const result = run(sandbox, ['check', '--artifact', aab, '--device'])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('device check needs the installed APK')
  })

  it('refuses a build without a stamp instead of guessing', () => {
    const result = run(sandbox, ['check'])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('has no .native-stamp.json')
    expect(result.stderr).toContain('npm run android:build:dev')
  })

  it('refuses a stamp left next to an artifact rebuilt without restamping', () => {
    // `./gradlew :app:installDebug` rebuilds app-debug.apk but keeps the previous stamp:
    // its native set and sha256 belong to another binary.
    expect(run(sandbox, ['stamp', sandbox.artifact]).status).toBe(0)
    writeTextFile(sandbox.artifact, 'apk-bytes-v2')
    installAdbStub(sandbox.stubBin, sha256Of(sandbox.artifact))
    const result = run(sandbox, ['check', '--device'])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('describes another build')
    expect(result.stderr).toContain('rebuilt without restamping')
  })

  it('rejects an unknown flag instead of silently skipping the device check', () => {
    expect(run(sandbox, ['stamp', sandbox.artifact]).status).toBe(0)
    const result = run(sandbox, ['check', '--devcie'])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('--devcie')
    expect(result.stdout).not.toContain('native set matches the checkout')
  })

  it('reports a corrupt stamp as a tooling error (exit 2), not as drift', () => {
    writeTextFile(`${sandbox.artifact}.native-stamp.json`, '{not json')
    const result = run(sandbox, ['check'])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('[native-stamp]')
  })
})

describe('android-release-agent writes the native stamp', () => {
  it('stamps every verified artifact', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'scripts/android-release-agent.js'), 'utf8')
    expect(source).toContain("require('./native-build-stamp')")
    expect(source).toMatch(/function verifyArtifact[\s\S]*writeStamp\(ROOT_DIR, artifact, 'android'\)/)
  })
})
