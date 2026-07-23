#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT_DIR = path.resolve(__dirname, '..')
const SECRETS_DIR = path.join(ROOT_DIR, '.secrets')
const RELEASE_BUNDLE_PATH = path.join(
  SECRETS_DIR,
  'metravel-android-release.json',
)
const DEFAULT_KEYSTORE_PATH = path.join(
  SECRETS_DIR,
  'metravel-android-upload.jks',
)
const DEFAULT_PRODUCTION_ENV_PATH = path.join(
  SECRETS_DIR,
  'metravel-android-prod.env',
)
const DEFAULT_SERVICE_ACCOUNT_PATH = path.join(
  SECRETS_DIR,
  'google-play-service-account.json',
)
const LEGACY_PRODUCTION_ENV_PATH = path.join(ROOT_DIR, '.env.prod')
const LEGACY_SERVICE_ACCOUNT_PATH = path.join(
  ROOT_DIR,
  'google-play-service-account.json',
)
const KEYCHAIN_STORE_SERVICE = 'metravel-android-upload-store-password'
const KEYCHAIN_KEY_SERVICE = 'metravel-android-upload-key-password'
const DEFAULT_KEY_ALIAS = 'metravel-upload'

const SIGNING_ENV_KEYS = Object.freeze([
  'METRAVEL_ANDROID_KEYSTORE_PATH',
  'METRAVEL_ANDROID_KEYSTORE_PASSWORD',
  'METRAVEL_ANDROID_KEY_ALIAS',
  'METRAVEL_ANDROID_KEY_PASSWORD',
])

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function resolveFromRoot(value, rootDir = ROOT_DIR) {
  if (!nonEmpty(value)) return null
  return path.isAbsolute(value) ? value : path.resolve(rootDir, value)
}

function relativeToRoot(filePath, rootDir = ROOT_DIR) {
  const relative = path.relative(rootDir, filePath)
  return relative && !relative.startsWith('..') ? relative : filePath
}

function readReleaseBundle(rootDir = ROOT_DIR) {
  const bundlePath = path.join(
    rootDir,
    '.secrets',
    'metravel-android-release.json',
  )
  if (!fs.existsSync(bundlePath)) return null

  let bundle
  try {
    bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'))
  } catch {
    throw new Error('.secrets/metravel-android-release.json is not valid JSON')
  }
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
    throw new Error(
      '.secrets/metravel-android-release.json must contain a JSON object',
    )
  }
  return bundle
}

function readMacosKeychainPassword(service, environment = process.env) {
  if (process.platform !== 'darwin' || !nonEmpty(environment.USER)) return null
  const result = spawnSync(
    'security',
    ['find-generic-password', '-a', environment.USER, '-s', service, '-w'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  )
  if (result.status !== 0 || !nonEmpty(result.stdout)) return null
  return result.stdout.replace(/\r?\n$/, '')
}

function getBundleSigningValues(bundle, rootDir) {
  if (!bundle) return {}
  return {
    METRAVEL_ANDROID_KEYSTORE_PATH: resolveFromRoot(
      bundle.keystorePath,
      rootDir,
    ),
    METRAVEL_ANDROID_KEYSTORE_PASSWORD: bundle.keystorePassword,
    METRAVEL_ANDROID_KEY_ALIAS: bundle.keyAlias,
    METRAVEL_ANDROID_KEY_PASSWORD: bundle.keyPassword,
  }
}

function loadAndroidReleaseEnvironment(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR
  const environment = options.environment || process.env
  const bundle = readReleaseBundle(rootDir)
  const fromBundle = getBundleSigningValues(bundle, rootDir)
  const merged = { ...fromBundle }

  for (const key of SIGNING_ENV_KEYS) {
    if (nonEmpty(environment[key])) merged[key] = environment[key]
  }

  const defaultKeystore = path.join(
    rootDir,
    '.secrets',
    'metravel-android-upload.jks',
  )
  if (
    !nonEmpty(merged.METRAVEL_ANDROID_KEYSTORE_PATH) &&
    fs.existsSync(defaultKeystore)
  ) {
    merged.METRAVEL_ANDROID_KEYSTORE_PATH = defaultKeystore
  }
  if (!nonEmpty(merged.METRAVEL_ANDROID_KEY_ALIAS)) {
    merged.METRAVEL_ANDROID_KEY_ALIAS = DEFAULT_KEY_ALIAS
  }

  if (options.allowKeychain !== false) {
    if (!nonEmpty(merged.METRAVEL_ANDROID_KEYSTORE_PASSWORD)) {
      merged.METRAVEL_ANDROID_KEYSTORE_PASSWORD = readMacosKeychainPassword(
        KEYCHAIN_STORE_SERVICE,
        environment,
      )
    }
    if (!nonEmpty(merged.METRAVEL_ANDROID_KEY_PASSWORD)) {
      merged.METRAVEL_ANDROID_KEY_PASSWORD = readMacosKeychainPassword(
        KEYCHAIN_KEY_SERVICE,
        environment,
      )
    }
  }

  if (nonEmpty(merged.METRAVEL_ANDROID_KEYSTORE_PATH)) {
    merged.METRAVEL_ANDROID_KEYSTORE_PATH = resolveFromRoot(
      merged.METRAVEL_ANDROID_KEYSTORE_PATH,
      rootDir,
    )
  }

  const missing = SIGNING_ENV_KEYS.filter((key) => !nonEmpty(merged[key]))
  if (options.requireSigning !== false && missing.length > 0) {
    throw new Error(
      `Android release secrets are incomplete (${missing.join(', ')}). ` +
        'Copy the portable .secrets bundle from the working computer.',
    )
  }
  if (
    options.requireSigning !== false &&
    !fs.existsSync(merged.METRAVEL_ANDROID_KEYSTORE_PATH)
  ) {
    throw new Error(
      'Android release keystore is missing. Copy ' +
        '.secrets/metravel-android-upload.jks from the working computer.',
    )
  }

  const productionEnvPath = resolveProductionEnvPath({
    rootDir,
    environment,
    bundle,
  })
  const serviceAccountPath = resolveServiceAccountPath({
    rootDir,
    environment,
    bundle,
  })

  return {
    ...environment,
    ...merged,
    ...(productionEnvPath
      ? { METRAVEL_ANDROID_PROD_ENV_PATH: productionEnvPath }
      : {}),
    ...(serviceAccountPath
      ? { GOOGLE_PLAY_SERVICE_ACCOUNT_PATH: serviceAccountPath }
      : {}),
  }
}

function resolveProductionEnvPath(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR
  const environment = options.environment || process.env
  const bundle = options.bundle || readReleaseBundle(rootDir)
  const candidates = [
    environment.METRAVEL_ANDROID_PROD_ENV_PATH,
    bundle?.productionEnvPath,
    path.join(rootDir, '.env.prod'),
    path.join(rootDir, '.secrets', 'metravel-android-prod.env'),
  ]
  for (const candidate of candidates) {
    const resolved = resolveFromRoot(candidate, rootDir)
    if (resolved && fs.existsSync(resolved)) return resolved
  }
  return null
}

function resolveServiceAccountPath(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR
  const environment = options.environment || process.env
  const bundle = options.bundle || readReleaseBundle(rootDir)
  const candidates = [
    environment.GOOGLE_PLAY_SERVICE_ACCOUNT_PATH,
    bundle?.serviceAccountPath,
    path.join(rootDir, '.secrets', 'google-play-service-account.json'),
    path.join(rootDir, 'google-play-service-account.json'),
  ]
  for (const candidate of candidates) {
    const resolved = resolveFromRoot(candidate, rootDir)
    if (resolved && fs.existsSync(resolved)) return resolved
  }
  return resolveFromRoot(candidates[2], rootDir)
}

function copySecretFile(source, destination) {
  if (!source || !fs.existsSync(source)) return false
  if (path.resolve(source) !== path.resolve(destination)) {
    fs.copyFileSync(source, destination)
  }
  if (process.platform !== 'win32') fs.chmodSync(destination, 0o600)
  return true
}

function exportPortableSecretBundle(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR
  const environment = options.environment || process.env
  const secretsDir = path.join(rootDir, '.secrets')
  fs.mkdirSync(secretsDir, { recursive: true, mode: 0o700 })

  const releaseEnvironment = loadAndroidReleaseEnvironment({
    rootDir,
    environment,
    allowKeychain: true,
    requireSigning: true,
  })
  const keystoreDestination = path.join(
    secretsDir,
    'metravel-android-upload.jks',
  )
  copySecretFile(
    releaseEnvironment.METRAVEL_ANDROID_KEYSTORE_PATH,
    keystoreDestination,
  )

  const productionEnvSource = resolveProductionEnvPath({
    rootDir,
    environment: releaseEnvironment,
  })
  if (!productionEnvSource) {
    throw new Error(
      'Production Android environment is missing. Expected .env.prod or ' +
        '.secrets/metravel-android-prod.env.',
    )
  }
  const productionEnvDestination = path.join(
    secretsDir,
    'metravel-android-prod.env',
  )
  copySecretFile(productionEnvSource, productionEnvDestination)

  const serviceAccountSource = resolveServiceAccountPath({
    rootDir,
    environment: releaseEnvironment,
  })
  const serviceAccountDestination = path.join(
    secretsDir,
    'google-play-service-account.json',
  )
  const hasServiceAccount = copySecretFile(
    serviceAccountSource,
    serviceAccountDestination,
  )

  const bundle = {
    version: 1,
    keystorePath: relativeToRoot(keystoreDestination, rootDir),
    keystorePassword: releaseEnvironment.METRAVEL_ANDROID_KEYSTORE_PASSWORD,
    keyAlias: releaseEnvironment.METRAVEL_ANDROID_KEY_ALIAS,
    keyPassword: releaseEnvironment.METRAVEL_ANDROID_KEY_PASSWORD,
    productionEnvPath: relativeToRoot(productionEnvDestination, rootDir),
    ...(hasServiceAccount
      ? {
          serviceAccountPath: relativeToRoot(
            serviceAccountDestination,
            rootDir,
          ),
        }
      : {}),
  }
  const bundlePath = path.join(secretsDir, 'metravel-android-release.json')
  fs.writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`, {
    mode: 0o600,
  })
  if (process.platform !== 'win32') fs.chmodSync(bundlePath, 0o600)

  return {
    bundlePath,
    files: [
      bundlePath,
      keystoreDestination,
      productionEnvDestination,
      ...(hasServiceAccount ? [serviceAccountDestination] : []),
    ],
  }
}

module.exports = {
  DEFAULT_KEY_ALIAS,
  DEFAULT_KEYSTORE_PATH,
  DEFAULT_PRODUCTION_ENV_PATH,
  DEFAULT_SERVICE_ACCOUNT_PATH,
  KEYCHAIN_KEY_SERVICE,
  KEYCHAIN_STORE_SERVICE,
  LEGACY_PRODUCTION_ENV_PATH,
  LEGACY_SERVICE_ACCOUNT_PATH,
  RELEASE_BUNDLE_PATH,
  ROOT_DIR,
  SECRETS_DIR,
  SIGNING_ENV_KEYS,
  exportPortableSecretBundle,
  loadAndroidReleaseEnvironment,
  readReleaseBundle,
  relativeToRoot,
  resolveProductionEnvPath,
  resolveServiceAccountPath,
}
