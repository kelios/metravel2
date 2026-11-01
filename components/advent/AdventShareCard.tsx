import { memo, useCallback, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { ADVENT_MAIN_DOORS } from '@/constants/advent'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { formatInteger } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'
import type { AdventCardSpec } from '@/utils/advent/adventShareImage'
import AdventShareActions from './AdventShareActions'
import { useAdventCardShare } from './useAdventCardShare'

type Props = { openedCount: number; streak: number; year: number }

/** Шеринг-карточка «Мой адвент N/24» с серией (#2868): доступна в любой день кампании. */
function AdventShareCard({ openedCount, streak, year }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const total = formatInteger(ADVENT_MAIN_DOORS)
  const opened = formatInteger(openedCount)
  const title = i18nT('adventStatic:share.title', { value1: opened, value2: total })
  const streakText = i18nT('adventStatic:header.streak', { value1: formatInteger(streak) })
  const shareText = i18nT('adventStatic:share.text', { value1: opened, value2: total })

  const buildSpec = useCallback(
    (): AdventCardSpec => ({
      eyebrow: i18nT('adventStatic:page.title'),
      title: i18nT('adventStatic:share.heading'),
      hero: `${opened}/${total}`,
      subtitle: streakText,
      stats: [],
    }),
    [opened, total, streakText],
  )

  const { status, share, download, canDownload } = useAdventCardShare({
    kind: 'progress',
    year,
    filename: `metravel-advent-${year}-${openedCount}.png`,
    buildSpec,
    shareTitle: title,
    shareText,
  })

  return (
    <View style={styles.card} testID="advent-share-card">
      <View style={styles.titleRow}>
        <Feather name="gift" size={18} color={colors.accent} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.body}>{streakText}</Text>
      <AdventShareActions
        status={status}
        canDownload={canDownload}
        onShare={() => void share()}
        onDownload={() => void download()}
        testIDPrefix="advent-share-card"
      />
    </View>
  )
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    card: {
      padding: DESIGN_TOKENS.spacing.md,
      borderRadius: DESIGN_TOKENS.radii.lg,
      backgroundColor: colors.accentSoft,
      borderWidth: 1,
      borderColor: colors.border,
      gap: DESIGN_TOKENS.spacing.xs,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xs },
    title: { fontSize: 17, fontWeight: '700', color: colors.text, flexShrink: 1 },
    body: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  })

export default memo(AdventShareCard)
