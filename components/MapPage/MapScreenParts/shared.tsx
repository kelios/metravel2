import { Pressable, Text, View } from 'react-native'
import { webTitleRef } from '@/utils/webProps'
import Feather from '@expo/vector-icons/Feather'

import { MapPageSkeleton } from '@/components/MapPage/MapPageSkeleton'
import { formatPlaceCountBadge } from '@/components/MapPage/TravelListPanel/helpers'

export const PRESSED_OPACITY_07 = { opacity: 0.7 } as const
export const PRESSED_OPACITY_085 = { opacity: 0.85 } as const
export const POINTER_EVENTS_NONE = { pointerEvents: 'none' } as const

export const MAP_PANEL_PLACEHOLDER = <MapPageSkeleton inline />

// `testID` сам ставит `data-testid="map-screen-root"` на web — его читают правила
// `body:has([data-testid="map-screen-root"])` в `app/global.css`.
export const ROOT_MAP_PROPS = { testID: 'map-screen-root' } as const

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
      ref={webTitleRef(title)}
      style={({ pressed }) => [styles.collapsedIconBtn, pressed && PRESSED_OPACITY_07]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather name={icon} size={18} color={iconColor} />
      {badge != null && badge > 0 && badgeStyles && (
        <View style={badgeStyles.container}>
          <Text style={badgeStyles.text}>
            {formatPlaceCountBadge(badge)}
          </Text>
        </View>
      )}
    </Pressable>
  )
}
