import { memo, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import Button from '@/components/ui/Button'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { AdventCampaignView, AdventDoorView } from '@/hooks/useAdventCampaign'
import type { AdventSyncState } from '@/hooks/useAdventApi'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'
import AdventHeader from './AdventHeader'
import AdventBonusDoors from './AdventBonusDoors'
import AdventShareCard from './AdventShareCard'
import { formatDoorDate } from './AdventDoorTile'

type Props = {
  campaign: AdventCampaignView
  streak: number
  syncState: AdventSyncState
  preview?: boolean
  /** Дверцы ещё нельзя открывать: конфиг или локальный прогресс не готовы. */
  disabled: boolean
  onPressDoor: (door: AdventDoorView) => void
}

/** Всё, кроме самого дома: дверца дня, прогресс, бонусы, шеринг и правила. */
function AdventDockContent({ campaign, streak, syncState, preview, disabled, onPressDoor }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { todayDoor } = campaign

  return (
    <View style={styles.stack}>
      {todayDoor ? (
        <View style={styles.todayCard} testID="advent-today-action">
          <Text style={styles.todayDate}>{formatDoorDate(todayDoor.date)}</Text>
          <Text style={styles.todayTitle}>
            {i18nT('adventStatic:home.today', {
              value1: todayDoor.day,
              value2: todayDoor.secret && todayDoor.state !== 'opened' && todayDoor.state !== 'done'
                ? i18nT('adventStatic:tile.secret')
                : todayDoor.gift.title,
            })}
          </Text>
          <Button
            label={todayDoor.state === 'available' ? i18nT('adventStatic:home.cta') : i18nT('adventStatic:profile.cta')}
            disabled={disabled || todayDoor.state === 'locked'}
            onPress={() => onPressDoor(todayDoor)}
            testID="advent-today-open"
            labelNumberOfLines={2}
            fullWidth
          />
        </View>
      ) : null}
      <AdventHeader
        openedCount={campaign.openedCount}
        doneCount={campaign.doneCount}
        streak={streak}
        nextDoor={campaign.nextDoor}
        now={campaign.now}
        hydrated={campaign.hydrated}
        syncState={syncState}
      />
      <AdventBonusDoors doors={campaign.doors} disabled={disabled} onPressDoor={onPressDoor} />
      {!preview && campaign.hydrated && campaign.openedCount > 0 ? (
        <AdventShareCard openedCount={campaign.openedCount} streak={streak} year={campaign.campaign.year} />
      ) : null}
      <Text style={styles.intro}>{i18nT('adventStatic:page.intro')}</Text>
      <Text style={styles.rules}>{i18nT('adventStatic:page.rules')}</Text>
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    stack: { gap: DESIGN_TOKENS.spacing.md },
    todayCard: { padding: DESIGN_TOKENS.spacing.md, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primarySoft, borderRadius: DESIGN_TOKENS.radii.lg, gap: DESIGN_TOKENS.spacing.xs },
    todayDate: { fontSize: 13, lineHeight: 18, color: colors.primaryDark, fontWeight: '600' },
    todayTitle: { fontSize: 18, lineHeight: 25, color: colors.text, fontWeight: '700' },
    intro: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
    rules: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  })

export default memo(AdventDockContent)
