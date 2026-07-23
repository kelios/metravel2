#!/usr/bin/env node

const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const {
  exportPortableSecretBundle,
  loadAndroidReleaseEnvironment,
  resolveProductionEnvPath,
  resolveServiceAccountPath,
} = require('./android-release-secrets')

const ROOT_DIR = path.resolve(__dirname, '..')
const ANDROID_DIR = path.join(ROOT_DIR, 'android')
const LOCK_DIR = path.join(
  ROOT_DIR,
  '.codex-temp',
  'ops',
  'android-local-build.lock',
)
const AAB_PATH = path.join(
  ANDROID_DIR,
  'app',
  'build',
  'outputs',
  'bundle',
  'release',
  'app-release.aab',
)
const APK_PATH = path.join(
  ANDROID_DIR,
  'app',
  'build',
  'outputs',
  'apk',
  'debug',
  'app-debug.apk',
)

function fail(message) {
  throw new Error(message)
}

function nodeVersionSupported(version = process.versions.node) {
  const [major, minor, patch] = version.split('.').map(Number)
  if (major !== 22) return false
  if (minor > 13) return true
  return minor === 13 && patch >= 1
}

function javaMajor(javaExecutable, environment = process.env) {
  const result = spawnSync(javaExecutable, ['-version'], {
    env: environment,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) return null
  const output = `${result.stdout || ''}\n${result.stderr || ''}`
  const match = output.match(/version\s+"(?:1\.)?(\d+)/i)
  return match ? Number(match[1]) : null
}

function javaVersionSupported(major) {
  return Number.isInteger(major) && major >= 17 && major <= 21
}

function javaHomeCandidates(environment = process.env) {
  const candidates = []
  if (environment.JAVA_HOME) candidates.push(environment.JAVA_HOME)

  if (process.platform === 'darwin') {
    for (const version of ['21', '17']) {
      const javaHome = spawnSync('/usr/libexec/java_home', ['-v', version], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      if (javaHome.status === 0 && javaHome.stdout.trim()) {
        candidates.push(javaHome.stdout.trim())
      }
    }
    candidates.push(
      '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
      '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home',
      '/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home',
      '/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home',
      '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
    )
  } else if (process.platform === 'win32') {
    const programFiles = environment.ProgramFiles || 'C:\\Program Files'
    candidates.push(
      path.join(programFiles, 'Android', 'Android Studio', 'jbr'),
      path.join(programFiles, 'Eclipse Adoptium', 'jdk-21'),
    )
  } else {
    candidates.push(
      '/usr/lib/jvm/java-21-openjdk-amd64',
      '/usr/lib/jvm/java-21-openjdk',
      path.join(os.homedir(), 'android-studio', 'jbr'),
    )
  }
  return [...new Set(candidates.filter(Boolean))]
}

function discoverJavaEnvironment(environment = process.env) {
  if (javaVersionSupported(javaMajor('java', environment))) {
    return { ...environment }
  }

  for (const javaHome of javaHomeCandidates(environment)) {
    const javaExecutable = path.join(
      javaHome,
      'bin',
      process.platform === 'win32' ? 'java.exe' : 'java',
    )
    if (
      fs.existsSync(javaExecutable) &&
      javaVersionSupported(javaMajor(javaExecutable, environment))
    ) {
      return {
        ...environment,
        JAVA_HOME: javaHome,
        PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${
          environment.PATH || ''
        }`,
      }
    }
  }

  const install =
    process.platform === 'darwin'
      ? 'Run: brew install openjdk@21'
      : process.platform === 'win32'
        ? 'Run in PowerShell: winget install EclipseAdoptium.Temurin.21.JDK'
        : 'Run: sudo apt-get install openjdk-21-jdk'
  fail(`A supported JDK (17 through 21) was not found. ${install}`)
}

function parseLocalPropertiesSdk(rootDir = ROOT_DIR) {
  const localProperties = path.join(rootDir, 'android', 'local.properties')
  if (!fs.existsSync(localProperties)) return null
  const match = fs
    .readFileSync(localProperties, 'utf8')
    .match(/^sdk\.dir=(.+)$/m)
  if (!match) return null
  return match[1].trim().replace(/\\\\/g, '\\').replace(/\\:/g, ':')
}

function androidSdkCandidates(environment = process.env) {
  const candidates = [
    environment.ANDROID_SDK_ROOT,
    environment.ANDROID_HOME,
    parseLocalPropertiesSdk(),
  ]
  if (process.platform === 'darwin') {
    candidates.push(path.join(os.homedir(), 'Library', 'Android', 'sdk'))
  } else if (process.platform === 'win32') {
    if (environment.LOCALAPPDATA) {
      candidates.push(path.join(environment.LOCALAPPDATA, 'Android', 'Sdk'))
    }
  } else {
    candidates.push(path.join(os.homedir(), 'Android', 'Sdk'))
  }
  return [...new Set(candidates.filter(Boolean))]
}

function discoverAndroidSdkEnvironment(environment = process.env) {
  for (const sdkPath of androidSdkCandidates(environment)) {
    if (fs.existsSync(sdkPath) && fs.statSync(sdkPath).isDirectory()) {
      return {
        ...environment,
        ANDROID_HOME: sdkPath,
        ANDROID_SDK_ROOT: sdkPath,
      }
    }
  }
  const install =
    process.platform === 'win32'
      ? 'Open Android Studio > More Actions > SDK Manager and install an Android SDK.'
      : 'Open Android Studio > Settings > Android SDK and install an Android SDK.'
  fail(`Android SDK was not found. ${install}`)
}

function acquireLock() {
  fs.mkdirSync(path.dirname(LOCK_DIR), { recursive: true })
  try {
    fs.mkdirSync(LOCK_DIR)
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    const pidPath = path.join(LOCK_DIR, 'pid')
    const ownerPid = Number(
      fs.existsSync(pidPath) ? fs.readFileSync(pidPath, 'utf8').trim() : '',
    )
    if (Number.isInteger(ownerPid) && ownerPid > 0) {
      try {
        process.kill(ownerPid, 0)
        fail(`another Android local build is active (PID ${ownerPid})`)
      } catch (processError) {
        if (processError.code !== 'ESRCH') throw processError
      }
    }
    fs.rmSync(LOCK_DIR, { recursive: true, force: true })
    fs.mkdirSync(LOCK_DIR)
  }
  fs.writeFileSync(path.join(LOCK_DIR, 'pid'), `${process.pid}\n`, {
    mode: 0o600,
  })
}

function releaseLock() {
  fs.rmSync(LOCK_DIR, { recursive: true, force: true })
}

function gitValue(args) {
  const result = spawnSync('git', args, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  return result.status === 0 ? result.stdout.trim() : ''
}

function verifyRepository() {
  const branch = gitValue(['branch', '--show-current'])
  if (branch && branch !== 'main') {
    fail(`Android release builds must run from main (current: ${branch})`)
  }
  return {
    branch: branch || 'unknown',
    dirty: Boolean(gitValue(['status', '--short'])),
  }
}

function keytoolPath(environment) {
  if (environment.JAVA_HOME) {
    const candidate = path.join(
      environment.JAVA_HOME,
      'bin',
      process.platform === 'win32' ? 'keytool.exe' : 'keytool',
    )
    if (fs.existsSync(candidate)) return candidate
  }
  return 'keytool'
}

function jarsignerPath(environment) {
  if (environment.JAVA_HOME) {
    const candidate = path.join(
      environment.JAVA_HOME,
      'bin',
      process.platform === 'win32' ? 'jarsigner.exe' : 'jarsigner',
    )
    if (fs.existsSync(candidate)) return candidate
  }
  return 'jarsigner'
}

function verifyKeystore(environment) {
  const result = spawnSync(
    keytoolPath(environment),
    [
      '-list',
      '-keystore',
      environment.METRAVEL_ANDROID_KEYSTORE_PATH,
      '-alias',
      environment.METRAVEL_ANDROID_KEY_ALIAS,
      '-storepass:env',
      'METRAVEL_ANDROID_KEYSTORE_PASSWORD',
    ],
    {
      env: environment,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  if (result.status !== 0) {
    fail(
      'The Android upload keystore or its password is invalid. Copy the complete ' +
        '.secrets bundle again from the working computer.',
    )
  }
}

function prepareEnvironment(mode) {
  if (!nodeVersionSupported()) {
    fail(
      `Node ${process.versions.node} is unsupported. Install Node 22.13.1 or newer within Node 22.`,
    )
  }
  if (!fs.existsSync(path.join(ANDROID_DIR, 'gradlew'))) {
    fail('android/gradlew is missing from the project checkout')
  }

  let environment = discoverJavaEnvironment(process.env)
  environment = discoverAndroidSdkEnvironment(environment)
  if (mode === 'production') {
    environment = loadAndroidReleaseEnvironment({
      environment,
      requireSigning: true,
      allowKeychain: true,
    })
    if (!resolveProductionEnvPath({ environment })) {
      fail(
        'Production Android environment is missing. Copy ' +
          '.secrets/metravel-android-prod.env from the working computer.',
      )
    }
    verifyKeystore(environment)
  }
  return environment
}

function doctor(mode = 'production') {
  const repository = verifyRepository()
  const environment = prepareEnvironment(mode)
  const serviceAccount = resolveServiceAccountPath({ environment })
  process.stdout.write(
    `[android-agent] Repository: ${repository.branch}${
      repository.dirty ? ' (working tree has local changes)' : ' (clean)'
    }\n`,
  )
  process.stdout.write('[android-agent] Node, JDK and Android SDK: ready\n')
  if (mode === 'production') {
    process.stdout.write(
      '[android-agent] Portable signing bundle and production environment: ready\n',
    )
    process.stdout.write(
      `[android-agent] Google Play service account: ${
        serviceAccount && fs.existsSync(serviceAccount)
          ? 'ready'
          : 'not copied (build-only mode is still available)'
      }\n`,
    )
  }
  return environment
}

function runGradleBuild(mode, environment) {
  const result = spawnSync(
    process.execPath,
    [path.join(ROOT_DIR, 'scripts', 'android-gradle-build.js'), mode],
    {
      cwd: ROOT_DIR,
      env: environment,
      stdio: 'inherit',
    },
  )
  if (result.error) fail(result.error.message)
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1)
}

function verifyArtifact(mode, environment) {
  const artifact = mode === 'production' ? AAB_PATH : APK_PATH
  if (!fs.existsSync(artifact) || fs.statSync(artifact).size === 0) {
    fail(`Android artifact was not created: ${artifact}`)
  }
  if (mode === 'production') {
    const result = spawnSync(
      jarsignerPath(environment),
      ['-verify', artifact],
      {
        env: environment,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    if (result.status !== 0)
      fail('The generated AAB signature could not be verified')
  }
  process.stdout.write(`[android-agent] Artifact verified: ${artifact}\n`)
}

function build(mode) {
  acquireLock()
  try {
    const environment = doctor(mode)
    process.stdout.write(
      `[android-agent] Building ${mode === 'production' ? 'signed production AAB' : 'debug APK'} locally (no EAS)…\n`,
    )
    runGradleBuild(mode, environment)
    verifyArtifact(mode, environment)
  } finally {
    releaseLock()
  }
}

function exportSecrets() {
  const result = exportPortableSecretBundle()
  process.stdout.write(
    '[android-agent] Portable Android release bundle created in .secrets.\n',
  )
  for (const filePath of result.files) {
    process.stdout.write(
      `[android-agent]   ${path.relative(ROOT_DIR, filePath)}\n`,
    )
  }
  process.stdout.write(
    '[android-agent] Copy these files to the same .secrets paths on another computer.\n',
  )
}

function usage() {
  process.stdout.write(
    `Usage: node scripts/android-release-agent.js <command>\n\n`,
  )
  process.stdout.write('Commands:\n')
  process.stdout.write(
    '  doctor         Check tools and portable production secrets\n',
  )
  process.stdout.write(
    '  production     Build and verify a signed production AAB\n',
  )
  process.stdout.write('  debug          Build and verify a debug APK\n')
  process.stdout.write(
    '  export-secrets Create the portable .secrets bundle on the working Mac\n',
  )
}

function main() {
  const command = process.argv[2] || 'doctor'
  if (command === 'doctor') doctor('production')
  else if (command === 'production' || command === 'build') build('production')
  else if (command === 'debug') build('debug')
  else if (command === 'export-secrets') exportSecrets()
  else if (command === '-h' || command === '--help') usage()
  else fail(`Unsupported command: ${command}`)
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    process.stderr.write(`[android-agent] ERROR: ${error.message}\n`)
    process.exitCode = 1
  }
}

module.exports = {
  androidSdkCandidates,
  discoverAndroidSdkEnvironment,
  discoverJavaEnvironment,
  doctor,
  javaHomeCandidates,
  javaMajor,
  javaVersionSupported,
  nodeVersionSupported,
  parseLocalPropertiesSdk,
  prepareEnvironment,
  verifyArtifact,
  verifyKeystore,
  verifyRepository,
}
