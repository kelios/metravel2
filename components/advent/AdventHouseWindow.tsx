import { memo } from 'react'
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { ADVENT_ART_COLORS, ADVENT_FROST_OPACITY, ADVENT_VISUAL_ASSETS } from '@/constants/adventVisuals'
import { useTranslation } from '@/i18n/LocaleProvider'
import type { AdventDoorView } from '@/hooks/useAdventCampaign'
import { formatDoorDate } from './AdventDoorTile'
import { stateLabel } from './adventDoorVisuals'
import { ADVENT_WINDOW_GLASS } from './adventHouseLayout'

type Props = {
  door: AdventDoorView
  placement: ViewStyle
  disabled?: boolean
  today?: boolean
  onPress: (door: AdventDoorView) => void
}

function AdventHouseWindow({ door, placement, disabled = false, today = false, onPress }: Props) {
  const { t } = useTranslation()
  const locked = door.state === 'locked'
  const clear = door.state === 'opened' || door.state === 'done'
  const inaccessible = locked || disabled

  return (
    <Pressable
      testID={`advent-door-${door.day}`}
      accessibilityRole="button"
      accessibilityLabel={t('adventStatic:tile.windowA11y', {
        value1: door.day,
        value2: formatDoorDate(door.date),
        value3: stateLabel(door.state),
      })}
      accessibilityState={{ disabled: inaccessible }}
      disabled={inaccessible}
      onPress={() => { if (!inaccessible) onPress(door) }}
      style={({ pressed }) => [placement, pressed && !inaccessible && styles.pressed]}
    >
      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
        style={styles.decoration}
      >
        <View style={[ADVENT_WINDOW_GLASS, styles.glass]}>
          {clear ? (
            <View testID={`advent-window-clear-${door.day}`} style={styles.openedGlow} />
          ) : (
            <>
              <View testID={`advent-window-dim-${door.day}`} style={styles.closedDim} />
              <View style={styles.closedGlass} />
              <ImageCardMedia
                testID={`advent-window-frost-${door.day}`}
                source={ADVENT_VISUAL_ASSETS.frost[(door.day - 1) % ADVENT_VISUAL_ASSETS.frost.length]}
                alt=""
                fit="cover"
                borderRadius={0}
                showLoadingIndicator={false}
                transition={0}
                showImmediately
                placeholderColor="#00000000"
                style={styles.frost}
              />
            </>
          )}
        </View>
        <View testID={today ? `advent-window-today-${door.day}` : undefined} style={[styles.numberBadge, today && styles.todayBadge]}>
          <Text style={styles.number}>{door.day}</Text>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  decoration: { ...StyleSheet.absoluteFill },
  glass: { overflow: 'hidden', borderRadius: 1 },
  closedDim: { ...StyleSheet.absoluteFill, backgroundColor: ADVENT_ART_COLORS.closedDim },
  closedGlass: { ...StyleSheet.absoluteFill, backgroundColor: ADVENT_ART_COLORS.closedGlass },
  openedGlow: { ...StyleSheet.absoluteFill, borderWidth: 1, borderColor: ADVENT_ART_COLORS.openedGlow },
  frost: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', backgroundColor: 'transparent', opacity: ADVENT_FROST_OPACITY },
  numberBadge: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ADVENT_ART_COLORS.numberBorder,
    backgroundColor: ADVENT_ART_COLORS.numberBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBadge: { borderWidth: 2, borderColor: ADVENT_ART_COLORS.todayBorder, backgroundColor: ADVENT_ART_COLORS.todayRing },
  number: { fontSize: 14, lineHeight: 18, fontWeight: '600', color: ADVENT_ART_COLORS.numberText },
  pressed: { opacity: 0.8 },
})

export default memo(AdventHouseWindow)
