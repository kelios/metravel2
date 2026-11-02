import { memo, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { ADVENT_ART_COLORS, ADVENT_VISUAL_ASSETS } from '@/constants/adventVisuals'
import type { AdventDoorView } from '@/hooks/useAdventCampaign'
import AdventHouseWindow from './AdventHouseWindow'
import { ADVENT_HOUSE_ASPECT_RATIO, ADVENT_HOUSE_MAX_WIDTH, ADVENT_HOUSE_WINDOWS } from './adventHouseLayout'

type Props = {
  doors: AdventDoorView[]
  todayDay?: number | null
  disabled?: boolean
  onPressDoor: (door: AdventDoorView) => void
}

/** The real campaign owns state; the facade only maps its 24 main doors onto the artwork. */
function AdventHouseFacade({ doors, todayDay, disabled, onPressDoor }: Props) {
  const mainDoors = useMemo(() => new Map(doors.filter((door) => !door.bonus).map((door) => [door.day, door])), [doors])

  return (
    <View style={styles.house} testID="advent-house-facade">
      <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={styles.artwork}>
        <ImageCardMedia
          source={ADVENT_VISUAL_ASSETS.facade}
          testID="advent-house-artwork"
          alt=""
          fit="contain"
          placeholderColor="#00000000"
          borderRadius={0}
          loading="eager"
          priority="high"
          transition={0}
          showImmediately
          showLoadingIndicator={false}
          style={styles.fill}
        />
        <LinearGradient
          colors={[ADVENT_ART_COLORS.moonlight, ADVENT_ART_COLORS.moonlightClear]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.2, y: 0.65 }}
          style={styles.moonlight}
        />
      </View>
      {ADVENT_HOUSE_WINDOWS.map(({ day, style }) => {
        const door = mainDoors.get(day)
        return door ? (
          <AdventHouseWindow key={day} door={door} placement={style} disabled={disabled} today={day === todayDay} onPress={onPressDoor} />
        ) : null
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  house: { position: 'relative', width: '100%', maxWidth: ADVENT_HOUSE_MAX_WIDTH, aspectRatio: ADVENT_HOUSE_ASPECT_RATIO, alignSelf: 'center' },
  artwork: { ...StyleSheet.absoluteFill, overflow: 'hidden', borderRadius: 5 },
  fill: { width: '100%', height: '100%' },
  moonlight: { ...StyleSheet.absoluteFill },
})

export default memo(AdventHouseFacade)
