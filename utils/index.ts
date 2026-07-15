import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { translate as i18nT } from '@/i18n'


export const isIos = Platform.OS === 'ios'
export const isAndroid = Platform.OS === 'android'
export const isWeb = Platform.OS === 'web'

export const webTouchScrollStyle = Platform.OS === 'web'
  ? ({
      flex: 1,
      minHeight: 0,
      WebkitOverflowScrolling: 'touch',
      touchAction: 'pan-y',
      overscrollBehaviorY: 'contain',
    } as any)
  : undefined

type AppConfigLike = {
  version?: unknown
  android?: {
    package?: unknown
    versionCode?: unknown
  }
  ios?: {
    bundleIdentifier?: unknown
    buildNumber?: unknown
  }
}

type ConstantsLike = {
  expoConfig?: AppConfigLike | null
  manifest?: AppConfigLike | null
  nativeAppVersion?: unknown
  nativeBuildVersion?: unknown
}

export type AppVersionInfo = {
  appVersion: string
  buildVersion?: string
  displayVersion: string
  packageName?: string
  platformLabel: 'Android' | 'iOS' | 'Web' | 'App'
}

function firstNonEmpty(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (value === null || value === undefined) continue
    const normalized = String(value).trim()
    if (normalized) return normalized
  }
  return undefined
}

function getBuildModeLabel(isDev: boolean): string {
  return isDev ? 'dev' : 'release'
}

export function createAppVersionInfo(
  source: ConstantsLike,
  platform: typeof Platform.OS,
  isDev: boolean
): AppVersionInfo {
  const config = source.expoConfig ?? source.manifest ?? {}
  const appVersion = firstNonEmpty(source.nativeAppVersion, config.version, 'unknown') ?? 'unknown'

  const isAndroidPlatform = platform === 'android'
  const isIosPlatform = platform === 'ios'
  const platformLabel = isAndroidPlatform ? 'Android' : isIosPlatform ? 'iOS' : platform === 'web' ? 'Web' : 'App'
  const buildVersion = isAndroidPlatform
    ? firstNonEmpty(source.nativeBuildVersion, config.android?.versionCode)
    : isIosPlatform
      ? firstNonEmpty(source.nativeBuildVersion, config.ios?.buildNumber)
      : undefined
  const packageName = isAndroidPlatform
    ? firstNonEmpty(config.android?.package)
    : isIosPlatform
      ? firstNonEmpty(config.ios?.bundleIdentifier)
      : undefined
  const buildMode = getBuildModeLabel(isDev)
  const buildPart = buildVersion ? i18nT('shared:utils.index.sborka_value1_7f6e458f', { value1: buildVersion }) : ''

  return {
    appVersion,
    buildVersion,
    displayVersion: `${platformLabel} ${appVersion}${buildPart} · ${buildMode}`,
    packageName,
    platformLabel,
  }
}

export function getAppVersionInfo(): AppVersionInfo {
  return createAppVersionInfo(Constants as ConstantsLike, Platform.OS, __DEV__)
}
