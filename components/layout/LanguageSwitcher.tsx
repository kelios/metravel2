import Feather from '@expo/vector-icons/Feather'
import { useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { useLocale } from '@/i18n/LocaleProvider'
import { getLocaleDisplayCode, getLocaleDisplayName } from '@/i18n/localeLabels'
import { translate as i18nT } from '@/i18n'
import { useThemedColors } from '@/hooks/useTheme'
import { DialogMenu } from '@/ui/paper'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import LanguageOptionList from './LanguageOptionList'
import { webAccessibilityProps, webDataSetProps, webViewStyle } from '@/utils/webProps'

type LanguageSwitcherProps = {
  compact?: boolean
}

// #1298: до гидратации web рисует полный (не компактный) переключатель, чтобы
// строка шапки сразу имела desktop-геометрию. Ниже 1280px критический CSS
// прячет шеврон и сжимает бокс — ровно к тому виду, который поставит React.
const webChevronSlotProps = () =>
  Platform.OS === 'web' ? webDataSetProps({ headerLangChevron: 'true' }) : null

export default function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { locale } = useLocale()
  const [visible, setVisible] = useState(false)
  const currentLanguage = getLocaleDisplayName(locale)
  const accessibilityLabel = `${i18nT('common:language.headerLabel')}: ${currentLanguage}`

  return (
    <DialogMenu
      visible={visible}
      onDismiss={() => setVisible(false)}
      accessibilityLabel={i18nT('common:language.settingTitle')}
      contentStyle={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}
      anchor={
        <Pressable
          onPress={() => setVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ expanded: visible }}
          style={({ pressed }) => [
            styles.anchor,
            compact && styles.anchorCompact,
            (pressed || visible) && styles.anchorActive,
          ]}
          testID="header-language-switcher"
          {...(Platform.OS === 'web'
            ? webAccessibilityProps({
                'aria-haspopup': 'dialog',
                'aria-expanded': visible,
              })
            : {})}
        >
          {/* #1298: иконочные глифы Feather приходят вебшрифтом, и до его
              загрузки их ширина другая — бокс переключателя прыгал 74 -> 86 и
              двигал соседей. Фиксированные слоты держат ширину с первого кадра. */}
          <View style={styles.globeSlot}>
            <Feather name="globe" size={17} color={colors.textMuted} />
          </View>
          <Text style={styles.code} numberOfLines={1}>
            {getLocaleDisplayCode(locale)}
          </Text>
          {!compact ? (
            <View style={styles.chevronSlot} {...webChevronSlotProps()}>
              <Feather
                name={visible ? 'chevron-up' : 'chevron-down'}
                size={15}
                color={colors.textMuted}
              />
            </View>
          ) : null}
        </Pressable>
      }
    >
      <LanguageOptionList onChosen={() => setVisible(false)} />
    </DialogMenu>
  )
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    anchor: {
      minWidth: 74,
      minHeight: 44,
      paddingHorizontal: 10,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.backgroundSecondary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      flexShrink: 0,
      ...Platform.select({ web: webViewStyle({ cursor: 'pointer' }) }),
    },
    anchorCompact: {
      minWidth: 54,
      paddingHorizontal: 8,
    },
    globeSlot: {
      width: 17,
      height: 17,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    chevronSlot: {
      width: 15,
      height: 15,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    anchorActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    code: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.4,
      // #1879: тот же приём, что у иконочных слотов рядом, — фиксированный бокс
      // вместо ширины по контенту. Статический HTML пререндерится на RU, а
      // выбранная локаль доезжает из хранилища уже после первого кадра, и код
      // менялся RU -> BY/UK/PL/EN. Ширины кода в проде на 13px/700: RU 19.56,
      // UK 19.77, EN 18.73, BY 18.63, PL 17.14 px, то есть бокс переключателя
      // ехал до 2.6 px, а вместе с ним и его x — сам переключатель стоит правее
      // `navScroll` c `flex:1`, поэтому весь слак строки левее него. 22 px
      // накрывают весь закрытый набор `LOCALE_DISPLAY_CODES` с запасом.
      // Только web: сдвиг от смены локали живёт в пререндеренном HTML, а на
      // native фиксированный бокс с `numberOfLines` резал бы код при системном
      // увеличении шрифта.
      ...(Platform.OS === 'web' ? { width: 22, textAlign: 'center' as const } : null),
    },
    menu: {
      width: 220,
      paddingVertical: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: DESIGN_TOKENS.radii.md,
      ...Platform.select({
        web: webViewStyle({ boxShadow: DESIGN_TOKENS.shadows.card }),
      }),
    },
  })
