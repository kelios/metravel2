#!/usr/bin/env node

// Android push (Expo token) needs FCM, and FCM needs the default FirebaseApp to
// initialise. Firebase only initialises when `google-services.json` reaches the
// native project: `expo prebuild` copies it and applies the Gradle plugin ONLY
// when `android.googleServicesFile` is set in the app config, and the plugin is
// what turns the JSON into the google_app_id / gcm_defaultSenderId /
// google_api_key string resources. Without that chain Gradle still reports
// BUILD SUCCESSFUL and the installed APK logs "Default FirebaseApp failed to
// initialize because no default options were found", so getExpoPushTokenAsync
// throws and the settings screen shows `unavailable` (#1818).
//
// Nothing here reads or returns credential values — only their presence and the
// package they belong to, so build logs stay free of secrets.

const fs = require('fs')
const path = require('path')

const ROOT_DIR = path.resolve(__dirname, '..')
const CONFIG_FILE_NAME = 'google-services.json'
const ANDROID_PACKAGE = 'by.metravel.app'

/** String resources the Gradle plugin generates from google-services.json. */
const REQUIRED_FIREBASE_RESOURCES = [
  'google_app_id',
  'gcm_defaultSenderId',
  'google_api_key',
]

const GOOGLE_SERVICES_CLASS_PATH = 'com.google.gms:google-services'
const GOOGLE_SERVICES_PLUGIN = 'com.google.gms.google-services'

const MISSING_CONFIG_HINT =
  `Firebase Android config is missing. Download ${CONFIG_FILE_NAME} for the ` +
  `Firebase Android app registered with package ${ANDROID_PACKAGE} and put it ` +
  `in the repository root (or .secrets/${CONFIG_FILE_NAME}, or point ` +
  'GOOGLE_SERVICES_JSON at it). The file is gitignored on purpose.'

/**
 * Locate google-services.json without ever creating a placeholder: an invented
 * config would produce a build that looks healthy and still cannot register.
 * Returns null when no config is available, so `expo start`/web keep working.
 */
function resolveGoogleServicesFile({ env = process.env, rootDir = ROOT_DIR } = {}) {
  const configured = String(env.GOOGLE_SERVICES_JSON || '').trim()
  if (configured) {
    const resolved = path.isAbsolute(configured)
      ? configured
      : path.join(rootDir, configured)
    if (!fs.existsSync(resolved)) {
      throw new Error(
        `GOOGLE_SERVICES_JSON points to a missing file: ${configured}`,
      )
    }
    return resolved
  }
  const candidates = [
    path.join(rootDir, CONFIG_FILE_NAME),
    path.join(rootDir, '.secrets', CONFIG_FILE_NAME),
  ]
  return candidates.find((candidate) => fs.existsSync(candidate)) || null
}

/**
 * Structural validation of google-services.json. A config downloaded for a
 * different Firebase Android app parses fine and still leaves the shipped
 * package without options, so the package match is checked explicitly.
 */
function assertGoogleServicesConfig(
  filePath,
  { packageName = ANDROID_PACKAGE } = {},
) {
  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    throw new Error(`${CONFIG_FILE_NAME} is not readable JSON: ${filePath}`)
  }

  if (!String(parsed?.project_info?.project_number || '').trim()) {
    throw new Error(
      `${CONFIG_FILE_NAME} has no project_info.project_number — it is not a ` +
        'Firebase Android config',
    )
  }

  const clients = Array.isArray(parsed?.client) ? parsed.client : []
  const client = clients.find(
    (entry) =>
      String(
        entry?.client_info?.android_client_info?.package_name || '',
      ).trim() === packageName,
  )
  if (!client) {
    throw new Error(
      `${CONFIG_FILE_NAME} has no Android app for package ${packageName} — ` +
        'download the config of the Firebase Android app registered for that ' +
        'package',
    )
  }

  if (!String(client?.client_info?.mobilesdk_app_id || '').trim()) {
    throw new Error(
      `${CONFIG_FILE_NAME} has no mobilesdk_app_id for ${packageName}`,
    )
  }
  const hasApiKey = (Array.isArray(client.api_key) ? client.api_key : []).some(
    (entry) => String(entry?.current_key || '').trim(),
  )
  if (!hasApiKey) {
    throw new Error(`${CONFIG_FILE_NAME} has no api_key for ${packageName}`)
  }

  return { packageName, configPath: filePath }
}

/**
 * The Gradle wiring reaches android/ only through prebuild. A checkout
 * generated before googleServicesFile was configured keeps building happily
 * and ships without Firebase, so treat missing wiring as a stale android/.
 */
function findMissingFirebaseGradleWiring({
  projectBuildGradle = '',
  appBuildGradle = '',
  hasCopiedConfig = false,
} = {}) {
  const missing = []
  if (!projectBuildGradle.includes(GOOGLE_SERVICES_CLASS_PATH)) {
    missing.push(`android/build.gradle: classpath ${GOOGLE_SERVICES_CLASS_PATH}`)
  }
  if (
    !new RegExp(
      `apply\\s+plugin:\\s*['"]${GOOGLE_SERVICES_PLUGIN.replace(/\./g, '\\.')}['"]`,
    ).test(appBuildGradle)
  ) {
    missing.push(`android/app/build.gradle: apply plugin ${GOOGLE_SERVICES_PLUGIN}`)
  }
  if (!hasCopiedConfig) {
    missing.push(`android/app/${CONFIG_FILE_NAME}`)
  }
  return missing
}

/** CLI: exit 0 when a usable config is in place, otherwise explain what to get. */
function main() {
  try {
    const configPath = resolveGoogleServicesFile()
    if (!configPath) throw new Error(MISSING_CONFIG_HINT)
    assertGoogleServicesConfig(configPath)
    process.stdout.write(
      `${CONFIG_FILE_NAME} found for ${ANDROID_PACKAGE}: ` +
        `${path.relative(ROOT_DIR, configPath)}\n`,
    )
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exit(1)
  }
}

if (require.main === module) main()

module.exports = {
  ANDROID_PACKAGE,
  CONFIG_FILE_NAME,
  GOOGLE_SERVICES_CLASS_PATH,
  GOOGLE_SERVICES_PLUGIN,
  MISSING_CONFIG_HINT,
  REQUIRED_FIREBASE_RESOURCES,
  assertGoogleServicesConfig,
  findMissingFirebaseGradleWiring,
  resolveGoogleServicesFile,
}
