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
const androidGoogleServices = () => {
  const configPath = resolveGoogleServicesFile()
  if (!configPath) return {}
  assertGoogleServicesConfig(configPath)
  return { googleServicesFile: configPath }
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
