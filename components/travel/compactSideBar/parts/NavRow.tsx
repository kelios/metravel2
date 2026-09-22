import { memo, useCallback } from 'react'
import { Platform, Pressable, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { Text } from '@/ui/paper'
import type { TravelSectionLink } from '@/components/travel/sectionLinks'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'

import { webOnly } from '../helpers'
import { createStyles } from '../styles'

type NavRowProps = {
  link: TravelSectionLink
  showDividerAbove: boolean
  active: boolean
  isTablet: boolean
  textColor: string
  mutedText: string
  colors: ReturnType<typeof useThemedColors>
  styles: ReturnType<typeof createStyles>
  onPress: (key: string) => void
}

export const NavRow = memo(function NavRow({
  link,
  showDividerAbove,
  active,
  isTablet,
  textColor,
  mutedText,
  colors,
  styles,
  onPress,
}: NavRowProps) {
  const { key, icon, label, meta } = link
  const iconSize = (Platform.OS === 'web') && isTablet ? 20 : 18
  const handlePress = useCallback(() => onPress(key), [key, onPress])

  return (
    <>
      {showDividerAbove && <View style={styles.linkDivider} />}
      <Pressable
        style={({ pressed }) => [
          styles.link,
          active && styles.linkActive,
          pressed && styles.linkPressed,
        ]}
        onPress={handlePress}
        android_ripple={{ color: colors.primarySoft }}
        accessibilityRole="button"
        accessibilityLabel={label}
        // Маркеры hover-правил сайдбара в `app/global.css` — только через `dataSet`:
        // сырой `data-*` react-native-web до DOM не пропускает (#2032). Активный
        // пункт CSS узнаёт по `aria-current`.
        {...webOnly({
          dataSet: { sidebarLink: 'true' },
          'aria-pressed': active,
          'aria-current': active ? 'page' : undefined,
          role: 'button',
          'aria-label': label,
        } as any)}
      >
        <View
          style={[
            styles.activeIndicator,
            active && styles.activeIndicatorActive,
            { pointerEvents: 'none' },
          ]}
        />
        <View style={styles.linkLeft}>
          <Feather
            name={icon as any}
            size={iconSize}
            color={active ? textColor : mutedText}
            {...webOnly({ dataSet: { sidebarLinkIcon: 'true' } })}
          />
          <Text
            style={[
              styles.linkTxt,
              isTablet && { fontSize: DESIGN_TOKENS.typography.sizes.sm },
              active && styles.linkTxtActive,
              { color: active ? textColor : mutedText },
            ]}
            {...webOnly({ dataSet: { sidebarLinkLabel: 'true' } })}
          >
            {label}
          </Text>
        </View>
        {meta ? (
          <View style={styles.linkMetaPill}>
            <Text style={[styles.linkMetaText, { color: mutedText }]}>{meta}</Text>
          </View>
        ) : null}
      </Pressable>
    </>
  )
})
