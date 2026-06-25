import { Platform, Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { MapPageSkeleton } from '@/components/MapPage/MapPageSkeleton'

export const IS_WEB = Platform.OS === 'web'
export const BADGE_COUNT_CAP = 999

export const PRESSED_OPACITY_07 = { opacity: 0.7 } as const
export const PRESSED_OPACITY_085 = { opacity: 0.85 } as const
export const POINTER_EVENTS_NONE = { pointerEvents: 'none' } as const

export const MAP_PANEL_PLACEHOLDER = <MapPageSkeleton inline />

export const ROOT_MAP_PROPS = IS_WEB
  ? ({ testID: 'map-screen-root', 'data-testid': 'map-screen-root', 'data-active': 'true' } as any)
  : ({ testID: 'map-screen-root' } as any)

export function CollapsedIconButton({
  icon,
  label,
  title,
  onPress,
  styles,
  iconColor,
  badge,
  badgeStyles,
}: {
  icon: 'search' | 'navigation' | 'list' | 'sliders'
  label: string
  title: string
  onPress: () => void
  styles: any
  iconColor: string
  badge?: number
  badgeStyles?: { container: any; text: any }
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.collapsedIconBtn, pressed && PRESSED_OPACITY_07]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...({ title } as any)}
    >
      <Feather name={icon} size={18} color={iconColor} />
      {badge != null && badge > 0 && badgeStyles && (
        <View style={badgeStyles.container}>
          <Text style={badgeStyles.text}>
            {badge > BADGE_COUNT_CAP ? `${BADGE_COUNT_CAP}+` : badge}
          </Text>
        </View>
      )}
    </Pressable>
  )
}
