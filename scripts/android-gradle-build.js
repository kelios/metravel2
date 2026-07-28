#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT_DIR = path.resolve(__dirname, '..')
const ANDROID_DIR = path.join(ROOT_DIR, 'android')
const LOCAL_ENV_PATH = path.join(ROOT_DIR, '.env')
const PROD_ENV_PATH = path.join(ROOT_DIR, '.env.prod')
const PORTABLE_PROD_ENV_PATH = path.join(
  ROOT_DIR,
  '.secrets',
  'metravel-android-prod.env',
)
const GRADLE_PROPERTIES_PATH = path.join(ANDROID_DIR, 'gradle.properties')
const APP_BUILD_GRADLE_PATH = path.join(ANDROID_DIR, 'app', 'build.gradle')
const RELEASE_MAPPING_PATH = path.join(
  ANDROID_DIR,
  'app',
  'build',
  'outputs',
  'mapping',
  'release',
  'mapping.txt',
)

// The release optimisation contract (R8, resource shrinking, optimised ProGuard
// rules) lives in plugins/withAndroidReleaseSafety.js and reaches android/ only
// through `expo prebuild`. Nothing in the build path runs prebuild, so a stale
// android/ produces a "successful" release with R8 silently disabled. Fail loudly
// instead of shipping an unminified bundle.
const REQUIRED_GRADLE_PROPERTIES = [
  'android.enableMinifyInReleaseBuilds=true',
  'android.enableShrinkResourcesInReleaseBuilds=true',
  'android.r8.optimizedResourceShrinking=true',
]
const REQUIRED_APP_GRADLE_SNIPPETS = [
  'getDefaultProguardFile("proguard-android-optimize.txt")',
]

function parseEnvFile(filePath) {
  const variables = {}
  const content = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key) variables[key] = value
  }
  return variables
}

function createBuildEnvironment(mode, environment = process.env) {
  let buildEnvironment = { ...environment }

  if (mode === 'debug' && fs.existsSync(LOCAL_ENV_PATH)) {
    buildEnvironment = {
      ...parseEnvFile(LOCAL_ENV_PATH),
      ...buildEnvironment,
    }
  }

  if (mode === 'production') {
    const configuredProdEnvPath = environment.METRAVEL_ANDROID_PROD_ENV_PATH
    const productionEnvPath = configuredProdEnvPath
      ? path.resolve(ROOT_DIR, configuredProdEnvPath)
      : fs.existsSync(PROD_ENV_PATH)
        ? PROD_ENV_PATH
        : PORTABLE_PROD_ENV_PATH
    if (!fs.existsSync(productionEnvPath)) {
      throw new Error(
        '.env.prod or .secrets/metravel-android-prod.env is required for a production AAB',
      )
    }
    buildEnvironment = {
      ...buildEnvironment,
      ...parseEnvFile(productionEnvPath),
      NODE_ENV: 'production',
      EXPO_ENV: 'prod',
      EXPO_NO_INTERACTIVE: '1',
    }
  }

  return buildEnvironment
}

function getFacebookBuildConfig(environment) {
  const enabled =
    String(environment.EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED || '')
      .trim()
      .toLowerCase() === 'true'
  const appId = String(environment.EXPO_PUBLIC_META_APP_ID || '').trim()
  const clientToken = String(
    environment.META_FACEBOOK_CLIENT_TOKEN || '',
  ).trim()

  if (enabled && (appId === '0' || !/^\d+$/.test(appId) || !clientToken)) {
    throw new Error(
      'Facebook Login is enabled, but its Android credentials are incomplete',
    )
  }

  return { enabled, appId, clientToken }
}

function readAndroidResource(xml, type, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(
    `<${type}\\b[^>]*\\bname=["']${escapedName}["'][^>]*>([^<]*)<\\/${type}>`,
  )
  return xml.match(pattern)?.[1]?.trim() || ''
}

function readAndroidManifestMetaData(xml, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const tag = xml.match(
    new RegExp(
      `<meta-data\\b(?=[^>]*\\bandroid:name=["']${escapedName}["'])[^>]*>`,
    ),
  )?.[0]
  if (!tag) return ''
  return tag.match(/\bandroid:value=["']([^"']*)["']/)?.[1]?.trim() || ''
}

function verifyFacebookAndroidResources(mode, environment) {
  const facebook = getFacebookBuildConfig(environment)
  const variant = mode === 'production' ? 'release' : 'debug'
  const variantTitle = variant[0].toUpperCase() + variant.slice(1)
  const valuesPath = path.join(
    ANDROID_DIR,
    'app',
    'build',
    'intermediates',
    'packaged_res',
    variant,
    `package${variantTitle}Resources`,
    'values',
    'values.xml',
  )
  const manifestPath = path.join(
    ANDROID_DIR,
    'app',
    'build',
    'intermediates',
    'merged_manifest',
    variant,
    `process${variantTitle}MainManifest`,
    'AndroidManifest.xml',
  )
  if (!fs.existsSync(valuesPath) || !fs.existsSync(manifestPath)) {
    throw new Error('compiled Android Facebook configuration is missing')
  }

  const xml = fs.readFileSync(valuesPath, 'utf8')
  const manifest = fs.readFileSync(manifestPath, 'utf8')
  const actual = {
    appId: readAndroidResource(xml, 'string', 'facebook_app_id'),
    clientToken: readAndroidResource(xml, 'string', 'facebook_client_token'),
    scheme: readAndroidResource(xml, 'string', 'fb_login_protocol_scheme'),
    autoInit: readAndroidManifestMetaData(
      manifest,
      'com.facebook.sdk.AutoInitEnabled',
    ),
  }
  const expected = facebook.enabled
    ? {
        appId: facebook.appId,
        clientToken: facebook.clientToken,
        scheme: `fb${facebook.appId}`,
        autoInit: 'true',
      }
    : {
        appId: '0',
        clientToken: '0',
        scheme: 'fb0',
        autoInit: 'false',
      }

  if (Object.keys(expected).some((key) => actual[key] !== expected[key])) {
    throw new Error(
      'compiled Facebook Android resources do not match the selected environment',
    )
  }

  process.stdout.write(
    '[android-gradle] Facebook Android resources verified (values hidden)\n',
  )
}

/** Release optimisations that prebuild should have written into android/. */
function findMissingReleaseOptimizations({ gradleProperties, appBuildGradle }) {
  const missing = []
  for (const property of REQUIRED_GRADLE_PROPERTIES) {
    const pattern = new RegExp(
      `^${property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
      'm',
    )
    if (!pattern.test(gradleProperties)) missing.push(property)
  }
  for (const snippet of REQUIRED_APP_GRADLE_SNIPPETS) {
    if (!appBuildGradle.includes(snippet)) missing.push(snippet)
  }
  return missing
}

function assertReleaseConfigApplied() {
  const gradleProperties = fs.existsSync(GRADLE_PROPERTIES_PATH)
    ? fs.readFileSync(GRADLE_PROPERTIES_PATH, 'utf8')
    : ''
  const appBuildGradle = fs.existsSync(APP_BUILD_GRADLE_PATH)
    ? fs.readFileSync(APP_BUILD_GRADLE_PATH, 'utf8')
    : ''
  const missing = findMissingReleaseOptimizations({
    gradleProperties,
    appBuildGradle,
  })
  if (missing.length === 0) return

  throw new Error(
    'release optimisations are missing from android/ — the config plugin was ' +
      'never applied, so this build would ship without R8.\n' +
      missing.map((entry) => `  missing: ${entry}`).join('\n') +
      '\nRun `npx expo prebuild -p android` first (it applies ' +
      'plugins/withAndroidReleaseSafety.js), then rebuild.',
  )
}

// R8 writes mapping.txt for every minified release. A missing mapping means the
// minify task never ran, which Gradle still reports as BUILD SUCCESSFUL.
function assertR8Ran() {
  if (fs.existsSync(RELEASE_MAPPING_PATH)) return
  throw new Error(
    `R8 did not run: ${path.relative(ROOT_DIR, RELEASE_MAPPING_PATH)} was not ` +
      'created. The release bundle is unminified — do not submit it.',
  )
}

function main() {
  const mode = process.argv[2]
  if (!['debug', 'production'].includes(mode)) {
    process.stderr.write('[android-gradle] mode must be debug or production\n')
    process.exit(2)
  }

  let buildEnvironment
  try {
    buildEnvironment = createBuildEnvironment(mode)
    getFacebookBuildConfig(buildEnvironment)
    if (mode === 'production') assertReleaseConfigApplied()
  } catch (error) {
    process.stderr.write(`[android-gradle] ${error.message}\n`)
    process.exit(1)
  }

  const gradleExecutable =
    process.platform === 'win32' ? 'gradlew.bat' : './gradlew'
  const task =
    mode === 'production' ? ':app:bundleRelease' : ':app:assembleDebug'
  const gradleArgs =
    mode === 'production'
      ? [task, '--no-daemon', '--no-parallel', '--max-workers=2']
      : [task, '--no-daemon']

  const result = spawnSync(gradleExecutable, gradleArgs, {
    cwd: ANDROID_DIR,
    env: buildEnvironment,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  })

  if (result.error) {
    process.stderr.write(`[android-gradle] ${result.error.message}\n`)
    process.exit(1)
  }
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1)

  try {
    verifyFacebookAndroidResources(mode, buildEnvironment)
    if (mode === 'production') assertR8Ran()
  } catch (error) {
    process.stderr.write(`[android-gradle] ${error.message}\n`)
    process.exit(1)
  }
}

if (require.main === module) main()

module.exports = {
  REQUIRED_APP_GRADLE_SNIPPETS,
  REQUIRED_GRADLE_PROPERTIES,
  assertR8Ran,
  assertReleaseConfigApplied,
  createBuildEnvironment,
  findMissingReleaseOptimizations,
  getFacebookBuildConfig,
  parseEnvFile,
  readAndroidManifestMetaData,
  readAndroidResource,
  verifyFacebookAndroidResources,
}
