#!/usr/bin/env node
/**
 * Native build stamp — board #2469 (family of #679).
 *
 * A dev-client / simulator build compiles the native half of every native
 * dependency (react-native-worklets, reanimated, expo modules…) into the
 * binary, while Metro serves the JS half from the checkout. When the two
 * drift, the failure is not a readable error: worklets 0.10.0 (binary of
 * 15.10) against worklets 0.10.1 (JS of main) changed the arity of
 * `createSerializableNonWorkletFunction` inside a patch release, its own
 * version check compares only major.minor, and the app died with SIGABRT in
 * libworklets one second after `Running "main"`. The build of 18.10 that was
 * supposed to prove "a fresh binary crashes too" was never installed: the
 * emulator still held the byte-identical APK of 15.10.
 *
 * Two contracts close that family mechanically:
 *   1. `stamp <artifact>` — every local native build records next to the
 *      artifact (`<artifact>.native-stamp.json`) the versions of all native
 *      packages it was compiled from and the sha256 of the binary.
 *   2. `check` — before native QA: the stamp's package set must equal the
 *      current node_modules (otherwise: rebuild, with the exact drift listed),
 *      and with `--device` the binary installed on the emulator/simulator must
 *      be the stamped one (otherwise: install the artifact you built).
 *
 * Only top-level packages that ship native code are tracked; a pure-JS bump
 * does not demand a rebuild.
 */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { parseArgs } = require('util')

const STAMP_SUFFIX = '.native-stamp.json'
const STAMP_SCHEMA = 1
// Packages whose native half lives outside the usual markers. The Hermes
// runtime is pinned by react-native itself (sdks/hermes-engine), so a Hermes
// change always shows up as a react-native change.
const ALWAYS_TRACKED = new Set(['react-native', 'expo'])
const NATIVE_MARKERS = [
  'android',
  'ios',
  'apple',
  'expo-module.config.json',
  'react-native.config.js',
  'RNReanimated.podspec',
]

function fail(message, code = 1) {
  process.stderr.write(`[native-stamp] ${message}\n`)
  process.exit(code)
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

function sha256Text(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function hasNativeCode(packageDir) {
  if (NATIVE_MARKERS.some((marker) => fs.existsSync(path.join(packageDir, marker)))) return true
  try {
    return fs.readdirSync(packageDir).some((entry) => entry.endsWith('.podspec'))
  } catch {
    return false
  }
}

function listPackageDirs(nodeModulesDir) {
  const result = []
  let entries = []
  try {
    entries = fs.readdirSync(nodeModulesDir, { withFileTypes: true })
  } catch {
    return result
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const entryPath = path.join(nodeModulesDir, entry.name)
    if (entry.name.startsWith('@')) {
      let scoped = []
      try {
        scoped = fs.readdirSync(entryPath, { withFileTypes: true })
      } catch {
        continue
      }
      for (const inner of scoped) {
        if (inner.name.startsWith('.')) continue
        result.push({ name: `${entry.name}/${inner.name}`, dir: path.join(entryPath, inner.name) })
      }
      continue
    }
    result.push({ name: entry.name, dir: entryPath })
  }
  return result
}

/**
 * The native dependency set of a checkout: top-level node_modules packages
 * that ship native code (plus the always-tracked runtime packages), the
 * native sections of app.json and the patch-package patches.
 */
function collectNativeManifest(rootDir) {
  const packages = {}
  for (const { name, dir } of listPackageDirs(path.join(rootDir, 'node_modules'))) {
    const packageJsonPath = path.join(dir, 'package.json')
    if (!fs.existsSync(packageJsonPath)) continue
    if (!ALWAYS_TRACKED.has(name) && !hasNativeCode(dir)) continue
    let version
    try {
      version = readJson(packageJsonPath).version
    } catch {
      continue
    }
    if (typeof version !== 'string') continue
    packages[name] = version
  }

  let appConfig = {}
  const appJsonPath = path.join(rootDir, 'app.json')
  if (fs.existsSync(appJsonPath)) {
    const expo = readJson(appJsonPath).expo || {}
    appConfig = {
      android: expo.android ?? null,
      ios: expo.ios ?? null,
      plugins: expo.plugins ?? null,
      runtimeVersion: expo.runtimeVersion ?? null,
    }
  }

  const patches = {}
  const patchesDir = path.join(rootDir, 'patches')
  if (fs.existsSync(patchesDir)) {
    for (const name of fs.readdirSync(patchesDir).filter((entry) => entry.endsWith('.patch')).sort()) {
      patches[name] = sha256File(path.join(patchesDir, name))
    }
  }

  const sortedPackages = Object.fromEntries(Object.keys(packages).sort().map((name) => [name, packages[name]]))
  const manifest = {
    schema: STAMP_SCHEMA,
    packages: sortedPackages,
    appConfigHash: sha256Text(JSON.stringify(appConfig)),
    patches,
  }
  manifest.hash = sha256Text(JSON.stringify({ p: sortedPackages, a: manifest.appConfigHash, h: patches }))
  return manifest
}

function diffManifests(built, current) {
  const drift = []
  const names = new Set([...Object.keys(built.packages || {}), ...Object.keys(current.packages || {})])
  for (const name of [...names].sort()) {
    const was = built.packages?.[name] ?? null
    const now = current.packages?.[name] ?? null
    if (was !== now) drift.push({ kind: 'package', name, built: was, current: now })
  }
  if (built.appConfigHash !== current.appConfigHash) {
    drift.push({ kind: 'app-config', name: 'app.json (android/ios/plugins/runtimeVersion)', built: built.appConfigHash, current: current.appConfigHash })
  }
  const patchNames = new Set([...Object.keys(built.patches || {}), ...Object.keys(current.patches || {})])
  for (const name of [...patchNames].sort()) {
    const was = built.patches?.[name] ?? null
    const now = current.patches?.[name] ?? null
    if (was !== now) drift.push({ kind: 'patch', name: `patches/${name}`, built: was, current: now })
  }
  return drift
}

/** The file whose sha256 identifies an artifact: the APK/AAB itself, or the executable of an .app bundle. */
function artifactBinary(artifactPath) {
  const stat = fs.statSync(artifactPath)
  if (!stat.isDirectory()) return artifactPath
  const infoPlist = path.join(artifactPath, 'Info.plist')
  let executable = path.basename(artifactPath).replace(/\.app$/, '')
  if (fs.existsSync(infoPlist)) {
    const plist = spawnSync('plutil', ['-extract', 'CFBundleExecutable', 'raw', '-o', '-', infoPlist], { encoding: 'utf8' })
    if (plist.status === 0 && plist.stdout.trim()) executable = plist.stdout.trim()
  }
  const binary = path.join(artifactPath, executable)
  if (!fs.existsSync(binary)) throw new Error(`Executable ${executable} not found inside ${artifactPath}`)
  return binary
}

function stampPathFor(artifactPath) {
  return `${artifactPath.replace(/[\\/]+$/, '')}${STAMP_SUFFIX}`
}

function gitSha(rootDir) {
  const result = spawnSync('git', ['-C', rootDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : null
}

function writeStamp(rootDir, artifactPath, platform) {
  const binary = artifactBinary(artifactPath)
  const stamp = {
    schema: STAMP_SCHEMA,
    generatedAt: new Date().toISOString(),
    gitSha: gitSha(rootDir),
    platform,
    artifact: {
      path: path.relative(rootDir, artifactPath) || path.basename(artifactPath),
      binary: path.relative(rootDir, binary),
      sha256: sha256File(binary),
      size: fs.statSync(binary).size,
    },
    manifest: collectNativeManifest(rootDir),
  }
  const stampPath = stampPathFor(artifactPath)
  fs.writeFileSync(stampPath, `${JSON.stringify(stamp, null, 2)}\n`)
  return { stamp, stampPath }
}

function readStamp(artifactPath) {
  const stampPath = stampPathFor(artifactPath)
  if (!fs.existsSync(stampPath)) return null
  const stamp = readJson(stampPath)
  if (stamp.schema !== STAMP_SCHEMA) throw new Error(`${stampPath}: unsupported stamp schema ${stamp.schema}`)
  return stamp
}

function appIdentifiers(rootDir) {
  const appJsonPath = path.join(rootDir, 'app.json')
  if (!fs.existsSync(appJsonPath)) return {}
  const expo = readJson(appJsonPath).expo || {}
  return { android: expo.android?.package, ios: expo.ios?.bundleIdentifier }
}

function runTool(command, args, env) {
  const result = spawnSync(command, args, { encoding: 'utf8', env })
  if (result.error) throw new Error(`${command} ${args.join(' ')}: ${result.error.message}`)
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited ${result.status}: ${(result.stderr || result.stdout || '').trim()}`)
  }
  return result.stdout
}

/** sha256 of the app binary installed on the Android device/emulator (`adb`). */
function installedAndroidSha256(packageName, env, serial) {
  const adb = ['adb', ...(serial ? ['-s', serial] : [])]
  const pmPath = runTool(adb[0], [...adb.slice(1), 'shell', 'pm', 'path', packageName], env)
  const base = pmPath
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith('package:') && line.endsWith('/base.apk'))
  if (!base) throw new Error(`${packageName} is not installed on the device (pm path returned: ${pmPath.trim() || 'nothing'})`)
  const apkPath = base.slice('package:'.length)
  const sum = runTool(adb[0], [...adb.slice(1), 'shell', 'sha256sum', apkPath], env)
  const digest = sum.trim().split(/\s+/)[0]
  if (!/^[0-9a-f]{64}$/.test(digest)) throw new Error(`sha256sum returned no digest: ${sum.trim()}`)
  return { sha256: digest, location: apkPath }
}

/** sha256 of the app executable installed in the iOS simulator (`xcrun simctl`). */
function installedIosSha256(bundleId, env, udid) {
  const container = runTool('xcrun', ['simctl', 'get_app_container', udid || 'booted', bundleId], env).trim()
  if (!container) throw new Error(`${bundleId} is not installed in the simulator`)
  const binary = artifactBinary(container)
  return { sha256: sha256File(binary), location: binary }
}

// Strict: a mistyped flag (`--devcie`) must not silently skip the device check.
const CLI_OPTIONS = {
  artifact: { type: 'string' },
  device: { type: 'boolean' },
  ios: { type: 'boolean' },
  json: { type: 'boolean' },
  package: { type: 'string' },
  platform: { type: 'string' },
  root: { type: 'string' },
  serial: { type: 'string' },
  udid: { type: 'string' },
}

function parseCli(argv) {
  const { values, positionals } = parseArgs({ args: argv, options: CLI_OPTIONS, allowPositionals: true, strict: true })
  return { ...values, _: positionals }
}

function defaultArtifact(rootDir, platform) {
  if (platform === 'ios') return null
  return path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
}

function formatDrift(drift) {
  return drift
    .map((entry) => `  - ${entry.name}: built with ${entry.built ?? '—'}, checkout has ${entry.current ?? '—'}`)
    .join('\n')
}

function check(rootDir, options, env = process.env) {
  const platform = options.ios ? 'ios' : 'android'
  const artifactPath = options.artifact ? path.resolve(rootDir, String(options.artifact)) : defaultArtifact(rootDir, platform)
  if (!artifactPath) fail('iOS check needs --artifact <path/to/metravel.app>', 2)
  if (!fs.existsSync(artifactPath)) {
    fail(`artifact not found: ${artifactPath}\n  Build it first (Android: npm run android:build:dev).`, 2)
  }
  const stamp = readStamp(artifactPath)
  if (!stamp) {
    fail(
      `${artifactPath} has no ${STAMP_SUFFIX}: it was built before the stamp existed or outside the build script.\n` +
        '  Rebuild it (Android: npm run android:build:dev) or stamp a build you know is current: node scripts/native-build-stamp.js stamp <artifact>.',
      2,
    )
  }
  // A rebuild outside the stamping script (`./gradlew :app:installDebug`, `expo run:*`)
  // leaves the previous stamp next to a new binary: its native set and sha256 describe
  // another build, so neither the drift nor the device verdict would be about this artifact.
  const artifactSha256 = sha256File(artifactBinary(artifactPath))
  if (artifactSha256 !== stamp.artifact?.sha256) {
    fail(
      `${stampPathFor(artifactPath)} describes another build: artifact sha256 ${artifactSha256.slice(0, 12)}… vs stamped ${String(stamp.artifact?.sha256).slice(0, 12)}…\n` +
        '  The artifact was rebuilt without restamping. Rebuild it (Android: npm run android:build:dev) or, if it was built from this checkout, stamp it: npm run native:stamp -- <artifact>.',
      2,
    )
  }

  const current = collectNativeManifest(rootDir)
  const drift = diffManifests(stamp.manifest, current)
  const report = {
    artifact: artifactPath,
    builtAt: stamp.generatedAt,
    gitSha: stamp.gitSha,
    drift,
    device: null,
  }

  const problems = []
  if (drift.length > 0) {
    problems.push(
      `native dependency drift: the binary was compiled from a different native set than this checkout serves via Metro.\n${formatDrift(drift)}\n  Rebuild the native app before QA — a stale binary dies in native code without a readable error (#2469).`,
    )
  }

  if (options.device) {
    if (/\.aab$/i.test(artifactPath)) {
      fail(
        'device check needs the installed APK: an AAB is split into APKs by bundletool/Play, so its sha256 never matches base.apk.\n' +
          '  An AAB is verified for native drift only (run check without --device), or check the debug APK that was built from the same checkout.',
        2,
      )
    }
    const identifiers = appIdentifiers(rootDir)
    const appId = options.package || (platform === 'ios' ? identifiers.ios : identifiers.android)
    if (!appId) fail('cannot determine the app identifier: pass --package <id>', 2)
    let installed
    try {
      installed = platform === 'ios'
        ? installedIosSha256(appId, env, options.udid)
        : installedAndroidSha256(appId, env, options.serial || env.ANDROID_SERIAL)
    } catch (error) {
      fail(`device check failed: ${error.message}`, 2)
    }
    report.device = { appId, ...installed, matches: installed.sha256 === stamp.artifact.sha256 }
    if (!report.device.matches) {
      problems.push(
        `the installed ${appId} is not the stamped build: device sha256 ${installed.sha256.slice(0, 12)}… vs artifact ${stamp.artifact.sha256.slice(0, 12)}….\n` +
          `  Install the artifact you built (${artifactPath}) before trusting any crash or pass on this device.`,
      )
    }
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ ...report, ok: problems.length === 0 }, null, 2)}\n`)
  } else {
    process.stdout.write(`[native-stamp] ${path.relative(rootDir, artifactPath)} built ${stamp.generatedAt} from ${stamp.gitSha ?? 'unknown sha'}\n`)
    if (report.device) {
      process.stdout.write(`[native-stamp] installed ${report.device.appId}: ${report.device.matches ? 'is the stamped build' : 'DIFFERS from the stamped build'}\n`)
    }
    process.stdout.write(
      drift.length === 0
        ? `[native-stamp] native set matches the checkout (${Object.keys(current.packages).length} native packages)\n`
        : `[native-stamp] native set DRIFTED (${drift.length} entries)\n`,
    )
  }
  if (problems.length > 0) {
    process.stderr.write(problems.map((problem) => `[native-stamp] ${problem}`).join('\n') + '\n')
    process.exit(1)
  }
}

function usage() {
  process.stdout.write(
    [
      'Usage: node scripts/native-build-stamp.js <command> [options]',
      '',
      '  stamp <artifact> [--platform android|ios] [--root <dir>]',
      '      Record the native dependency set and sha256 next to a built APK/AAB/.app.',
      '  check [--artifact <path>] [--ios] [--device] [--package <id>] [--serial <adb>] [--udid <simctl>] [--json] [--root <dir>]',
      '      Compare the stamp with the current checkout; with --device also verify the installed binary.',
      '  manifest [--root <dir>]',
      '      Print the current native dependency manifest.',
      '',
      'Exit codes: 0 ok · 1 drift or wrong binary on the device · 2 usage, missing/stale artifact or stamp, tooling',
    ].join('\n') + '\n',
  )
}

function main(argv = process.argv.slice(2)) {
  const options = parseCli(argv)
  const command = options._[0]
  const rootDir = options.root ? path.resolve(String(options.root)) : path.resolve(__dirname, '..')
  if (command === 'stamp') {
    const target = options._[1]
    if (!target) fail('stamp needs the artifact path', 2)
    const artifactPath = path.resolve(rootDir, target)
    if (!fs.existsSync(artifactPath)) fail(`artifact not found: ${artifactPath}`, 2)
    const platform = options.platform || (artifactPath.endsWith('.app') ? 'ios' : 'android')
    const { stamp, stampPath } = writeStamp(rootDir, artifactPath, platform)
    process.stdout.write(
      `[native-stamp] ${path.relative(rootDir, stampPath)}: ${Object.keys(stamp.manifest.packages).length} native packages, sha256 ${stamp.artifact.sha256.slice(0, 12)}…\n`,
    )
    return
  }
  if (command === 'check') {
    check(rootDir, options)
    return
  }
  if (command === 'manifest') {
    process.stdout.write(`${JSON.stringify(collectNativeManifest(rootDir), null, 2)}\n`)
    return
  }
  usage()
  process.exit(command ? 2 : 0)
}

module.exports = {
  STAMP_SUFFIX,
  collectNativeManifest,
  diffManifests,
  readStamp,
  stampPathFor,
  writeStamp,
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    // Exit 1 means "drift / wrong binary"; anything unexpected (bad flag, corrupt stamp,
    // unreadable app.json, missing executable in .app) is a tooling problem.
    fail(error.message, 2)
  }
}
