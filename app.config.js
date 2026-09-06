const path = require('path')

const {
  assertGoogleServicesConfig,
  resolveGoogleServicesFile,
} = require('./scripts/android-firebase-config')

const FACEBOOK_PLUGIN = 'react-native-fbsdk-next'

const cleanEnv = (value) => String(value || '').trim()

// `android.googleServicesFile` is the only switch that makes prebuild copy
// google-services.json and apply the Gradle plugin; without it Firebase never
// initialises and Android cannot obtain an Expo push token (#1818). The config
// is a gitignored secret, so it is wired in only when actually present — web
// and `expo start` must keep working on a machine that does not hold it.
//
// A relative path is deliberate: expo-constants serialises the public app
// config into the APK assets, and an absolute path would ship the build
// machine's home directory. Nothing here throws — an unusable config only skips
// the wiring, and scripts/android-gradle-build.js refuses the Android build
// with the precise reason. An `expo start`/web run must not die over it.
const androidGoogleServices = () => {
  let configPath = null
  try {
    configPath = resolveGoogleServicesFile()
    if (!configPath) return {}
    assertGoogleServicesConfig(configPath)
  } catch (error) {
    process.stderr.write(`[app.config] ${error.message}\n`)
    return {}
  }
  // prebuild resolves this against the project root, so a relative path is
  // enough and keeps the build machine's home directory out of the artifact.
  return { googleServicesFile: path.relative(__dirname, configPath) }
}

module.exports = ({ config }) => {
  const appID = cleanEnv(process.env.EXPO_PUBLIC_META_APP_ID)
  const clientToken = cleanEnv(process.env.META_FACEBOOK_CLIENT_TOKEN)
  const facebookEnabled =
    cleanEnv(process.env.EXPO_PUBLIC_FACEBOOK_LOGIN_ENABLED).toLowerCase() ===
    'true'
  const plugins = (config.plugins || []).filter(
    (plugin) =>
      (Array.isArray(plugin) ? plugin[0] : plugin) !== FACEBOOK_PLUGIN,
  )

  if (facebookEnabled && appID && clientToken) {
    plugins.push([
      FACEBOOK_PLUGIN,
      {
        appID,
        clientToken,
        displayName: 'meTravel.by',
        scheme: `fb${appID}`,
        advertiserIDCollectionEnabled: false,
        autoLogAppEventsEnabled: false,
        isAutoInitEnabled: true,
        iosUserTrackingPermission: false,
      },
    ])
  }

  return {
    ...config,
    plugins,
    android: { ...config.android, ...androidGoogleServices() },
  }
}
