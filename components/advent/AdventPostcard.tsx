import { memo, useCallback } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { ADVENT_ART_COLORS } from '@/constants/adventVisuals'
import { ADVENT_MAIN_DOORS } from '@/constants/advent'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { translate as i18nT } from '@/i18n'
import type { AdventCardSpec } from '@/utils/advent/adventShareImage'
import AdventShareActions from './AdventShareActions'
import AdventWindowCrop from './AdventWindowCrop'
import { useAdventCardShare } from './useAdventCardShare'

type Props = { year: number; preview?: boolean }

/**
 * Открытка дверцы 25: ночной фасад того же дома под луной, поздравление и
 * шеринг. Картинка для соцсетей — тот же дом со всеми горящими окнами.
 */
function AdventPostcard({ year, preview }: Props) {
  const title = i18nT('adventStatic:postcard.title')
  const wish = i18nT('adventStatic:postcard.wish', { value1: year + 1 })

  const buildSpec = useCallback(
    (): AdventCardSpec => ({
      eyebrow: i18nT('adventStatic:page.title'),
      title,
      subtitle: wish,
      stats: [],
      house: { lit: ADVENT_MAIN_DOORS },
    }),
    [title, wish],
  )

  const { status, share, download, canDownload } = useAdventCardShare({
    kind: 'postcard',
    preview,
    year,
    filename: `metravel-rozhdestvo-${year}.png`,
    buildSpec,
    shareTitle: title,
    shareText: i18nT('adventStatic:postcard.shareText'),
  })

  return (
    <View style={styles.wrap} testID="advent-postcard">
      <View style={styles.card}>
        <AdventWindowCrop aspectRatio={4 / 3} style={styles.art} />
        <View style={styles.caption}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.wish}>{wish}</Text>
        </View>
      </View>
      <AdventShareActions
        status={status}
        canDownload={canDownload}
        onShare={() => void share()}
        onDownload={() => void download()}
        shareLabel={i18nT('adventStatic:postcard.share')}
        testIDPrefix="advent-postcard"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: DESIGN_TOKENS.spacing.sm },
  card: {
    borderRadius: DESIGN_TOKENS.radii.lg,
    borderWidth: 2,
    borderColor: ADVENT_ART_COLORS.gold,
    overflow: 'hidden',
    backgroundColor: ADVENT_ART_COLORS.night,
  },
  art: { width: '100%' },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: DESIGN_TOKENS.spacing.md,
    gap: DESIGN_TOKENS.spacing.xxs,
    backgroundColor: ADVENT_ART_COLORS.nightSoft,
  },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: ADVENT_ART_COLORS.nightText },
  wish: { fontSize: 15, lineHeight: 21, color: ADVENT_ART_COLORS.nightTextMuted },
})

export default memo(AdventPostcard)
