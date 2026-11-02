import { memo } from 'react'
import { StyleSheet, View } from 'react-native'

import type { AdventDoorView } from '@/hooks/useAdventCampaign'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import AdventDoorTile from './AdventDoorTile'
import AdventHouseFacade from './AdventHouseFacade'

type Props = {
  doors: AdventDoorView[]
  todayDay?: number | null
  disabled?: boolean
  onPressDoor: (door: AdventDoorView) => void
}

/** One invariant facade and a separate wrapping row of real calendar-date bonuses. */
function AdventGrid({ doors, todayDay, disabled, onPressDoor }: Props) {
  return (
    <View style={styles.grid} testID="advent-grid">
      <AdventHouseFacade doors={doors} todayDay={todayDay} disabled={disabled} onPressDoor={onPressDoor} />
      <View style={styles.bonuses} testID="advent-bonus-doors">
        {doors.filter((door) => door.bonus).map((door) => (
          <View key={door.day} style={styles.cell}>
            <AdventDoorTile door={door} disabled={disabled} onPress={onPressDoor} />
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { gap: DESIGN_TOKENS.spacing.md },
  bonuses: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.xs },
  cell: { flexBasis: '30%', flexGrow: 1, flexShrink: 1, minWidth: 84 },
})

export default memo(AdventGrid)
