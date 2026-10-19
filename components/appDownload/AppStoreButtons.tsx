import { memo, useMemo } from 'react'
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import type { AppStorePlatform } from '@/constants/appStore'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useDeviceStorePlatform } from '@/hooks/useDeviceStorePlatform'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import type { AppDownloadSource } from '@/utils/growthFunnelAnalytics'
import { openAppStoreListing } from '@/utils/openAppStoreListing'

const STORE_ORDER: AppStorePlatform[] = ['ios', 'android']

const STORE_COPY: Record<AppStorePlatform, { label: () => string; a11y: () => string }> = {
  ios: {
    label: () => i18nT('sharedStatic:appDownload.appStore.label'),
    a11y: () => i18nT('sharedStatic:appDownload.appStore.a11y'),
  },
  android: {
    label: () => i18nT('sharedStatic:appDownload.googlePlay.label'),
    a11y: () => i18nT('sharedStatic:appDownload.googlePlay.a11y'),
  },
}

type Props = {
  source: AppDownloadSource
  size?: 'md' | 'lg'
  /** Кнопки во всю ширину колонки (узкие карточки). */
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * Кнопки витрин приложения: App Store и Google Play. Витрина устройства идёт
 * первой и главной кнопкой, вторая остаётся доступной (iPad с Android-телефоном
 * в кармане, ссылка «для друга»). На десктопе обе кнопки равноправны.
 */
function AppStoreButtons({ source, size = 'lg', fullWidth = false, style, testID = 'app-store-buttons' }: Props) {
  const colors = useThemedColors()
  const devicePlatform = useDeviceStorePlatform()

  const stores = useMemo<AppStorePlatform[]>(() => {
    if (!devicePlatform) return STORE_ORDER
    // Внутри native-приложения — только своя витрина: App Review 2.3.10 не
    // допускает упоминания другой мобильной платформы в iOS-приложении.
    if (Platform.OS !== 'web') return [devicePlatform]
    return [devicePlatform, ...STORE_ORDER.filter((platform) => platform !== devicePlatform)]
  }, [devicePlatform])

  return (
    <View testID={testID} style={[styles.row, fullWidth && styles.column, style]}>
      {stores.map((platform) => {
        const primary = !devicePlatform || platform === devicePlatform
        return (
          <Button
            key={platform}
            testID={`${testID}-${platform}`}
            label={STORE_COPY[platform].label()}
            accessibilityLabel={STORE_COPY[platform].a11y()}
            onPress={() => {
              void openAppStoreListing({ platform, source })
            }}
            variant={primary ? 'primary' : 'outline'}
            size={size}
            fullWidth={fullWidth}
            style={fullWidth ? undefined : styles.button}
            icon={
              <Feather
                name={platform === 'ios' ? 'smartphone' : 'download'}
                size={18}
                color={primary ? colors.textOnPrimary : colors.text}
              />
            }
          />
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    width: '100%',
    maxWidth: 560,
  },
  // Подписи витрин разной длины: общая основа держит пару ровной — рядом на
  // широком экране и друг под другом во всю ширину на телефоне.
  button: {
    flexGrow: 1,
    flexBasis: 240,
  },
  column: {
    flexDirection: 'column',
    alignSelf: 'stretch',
    maxWidth: undefined,
  },
})

export default memo(AppStoreButtons)
