import { memo } from 'react'
import { StyleSheet, View } from 'react-native'

import type { AdventDoorView } from '@/hooks/useAdventCampaign'
import { breakpointLayoutProps, breakpointStyle } from '@/utils/breakpointLayout'
import AdventDoorTile from './AdventDoorTile'
import { ADVENT_GRID_GUTTER, ADVENT_GRID_LAYOUT, ADVENT_GRID_MIN_WIDTH } from './adventGridLayout'

type Props = {
  doors: AdventDoorView[]
  width: number
  disabled?: boolean
  onPressDoor: (door: AdventDoorView) => void
}

/** Одна flex-wrap сетка; ширина плитки — из брейкпоинт-раскладки, чтобы статический HTML и клиент совпали. */
function AdventGrid({ doors, width, disabled, onPressDoor }: Props) {
  const isWide = width >= ADVENT_GRID_MIN_WIDTH
  return (
    <View style={styles.grid} testID="advent-grid">
      {doors.map((door) => (
        <View
          key={door.day}
          style={[styles.cell, breakpointStyle(ADVENT_GRID_LAYOUT, 'tile', isWide)]}
          {...breakpointLayoutProps(ADVENT_GRID_LAYOUT, 'tile')}
        >
          <AdventDoorTile door={door} disabled={disabled} onPress={onPressDoor} />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -ADVENT_GRID_GUTTER },
  cell: { flexGrow: 0, flexShrink: 0, padding: ADVENT_GRID_GUTTER },
})

export default memo(AdventGrid)
