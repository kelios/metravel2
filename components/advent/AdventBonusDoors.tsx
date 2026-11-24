import { memo, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { AdventDoorView } from '@/hooks/useAdventCampaign'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import AdventDoorTile from './AdventDoorTile'

type Props = {
  doors: AdventDoorView[]
  disabled?: boolean
  onPressDoor: (door: AdventDoorView) => void
}

/** Три бонусные даты кампании — вне фасада, в док-панели экрана. */
function AdventBonusDoors({ doors, disabled, onPressDoor }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const bonuses = useMemo(() => doors.filter((door) => door.bonus), [doors])
  if (!bonuses.length) return null

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{i18nT('adventStatic:panel.bonusTitle')}</Text>
      <View style={styles.bonuses} testID="advent-bonus-doors">
        {bonuses.map((door) => (
          <View key={door.day} style={styles.cell}>
            <AdventDoorTile door={door} disabled={disabled} onPress={onPressDoor} />
          </View>
        ))}
      </View>
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    section: { gap: DESIGN_TOKENS.spacing.xs },
    title: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.text },
    // Строки на всю ширину: в узкой панели три колонки рвали «Откроется» по буквам (#3482 B4).
    bonuses: { gap: DESIGN_TOKENS.spacing.xs },
    cell: { width: '100%' },
  })

export default memo(AdventBonusDoors)
