import { memo } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import Chip from '@/components/ui/Chip'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { translate as i18nT } from '@/i18n'
import type { AdventRegion } from '@/types/advent'
import { useAdventPaper } from './useAdventPaper'

type Props = {
  regions: AdventRegion[]
  value: AdventRegion
  onChange: (region: AdventRegion) => void
}

/**
 * Переключатель варианта дверцы «Беларусь / Польша» (#3486). Выбор общий для
 * календаря и запоминается; дверца засчитывается любым вариантом.
 */
function AdventRegionSwitch({ regions, value, onChange }: Props) {
  const paper = useAdventPaper()
  if (regions.length < 2) return null
  return (
    // Без role="radiogroup": Chip — toggle-кнопка с aria-pressed, а не radio.
    <View style={styles.wrap} testID="advent-region-switch">
      <Text style={[styles.label, { color: paper.inkMuted }]}>{i18nT('adventStatic:region.label')}</Text>
      <View style={styles.chips}>
        {regions.map((region) => (
          <Chip
            key={region}
            label={region === 'pl' ? i18nT('adventStatic:region.pl') : i18nT('adventStatic:region.by')}
            selected={region === value}
            onPress={() => onChange(region)}
            testID={`advent-region-${region}`}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  label: { fontSize: 12, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.xs },
})

export default memo(AdventRegionSwitch)
