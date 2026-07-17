const FACEBOOK_PLUGIN = 'react-native-fbsdk-next'

const cleanEnv = (value) => String(value || '').trim()

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

  return { ...config, plugins }
}
