import { memo, useMemo } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { TIER_VISUALS } from '@/components/achievements/badgeVisuals'
import {
  MaxLevelLaurel,
  ProgressionAnimalMedallion,
} from '@/components/achievements/GamificationIcons'
import type { ProgressionLine, ProgressionLineSlug } from '@/api/gamification'

interface Props {
  line: ProgressionLine
  testID?: string
  style?: StyleProp<ViewStyle>
}

// Спокойный тон заливки бара по тропе — из палитры тиров (бумага/гравюра,
// не неон): каждая ветка получает свой землистый/благородный цвет.
const LINE_FILL_TIER: Record<ProgressionLineSlug, keyof typeof TIER_VISUALS> = {
  dog: 'bronze',
  boar: 'gold',
  fox: 'bronze',
  bird: 'platinum',
}

/** Одна линейка прогрессии: маскот ветки, тип активности, уровень и % до следующего. */
function ProgressionLineBar({ line, testID, style }: Props) {
  const colors = useThemedColors()

  const { ratio, remaining } = useMemo(() => {
    if (line.isMaxLevel || line.nextLevelMin == null) {
      return { ratio: 1, remaining: 0 }
    }
    const span = Math.max(1, line.nextLevelMin - line.currentLevelMin)
    const done = line.current - line.currentLevelMin
    return {
      ratio: Math.max(0, Math.min(1, done / span)),
      remaining: Math.max(0, line.nextLevelMin - line.current),
    }
  }, [line])

  const fillColor = TIER_VISUALS[LINE_FILL_TIER[line.slug]].ring
  const styles = useMemo(() => getStyles(colors), [colors])

  return (
    <View
      style={[styles.container, style]}
      testID={testID}
      accessibilityRole="summary"
      accessibilityLabel={`${line.activityName}, ${line.name}. Уровень ${line.level}, ${line.levelTitle}. ${
        line.isMaxLevel ? 'Максимальный уровень' : `до следующего уровня осталось ${remaining}`
      }`}
    >
      <View style={styles.row}>
        <ProgressionAnimalMedallion slug={line.slug} size={40} />
        <View style={styles.titleWrap}>
          <Text style={styles.activity} numberOfLines={1}>
            {line.activityName}
          </Text>
          <Text style={styles.lineName} numberOfLines={1}>
            {line.name} · ур. {line.level} «{line.levelTitle}»
          </Text>
        </View>
        <Text style={styles.value}>{line.current}</Text>
      </View>

      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: fillColor }]}
        />
      </View>

      {line.isMaxLevel ? (
        <View style={styles.captionRow}>
          <MaxLevelLaurel size={16} color={colors.textMuted} />
          <Text style={styles.caption}>Максимальный уровень</Text>
        </View>
      ) : (
        <Text style={styles.caption}>
          До «{line.nextLevelTitle}»: ещё {remaining}
        </Text>
      )}
    </View>
  )
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: { gap: 6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.sm },
    titleWrap: { flex: 1, minWidth: 0 },
    activity: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '700',
      color: colors.text,
    },
    lineName: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
    },
    value: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '800',
      color: colors.primary,
    },
    track: {
      height: 7,
      borderRadius: 999,
      backgroundColor: colors.backgroundTertiary,
      overflow: 'hidden',
    },
    fill: { height: '100%', borderRadius: 999 },
    captionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    caption: { fontSize: DESIGN_TOKENS.typography.sizes.xs, color: colors.textMuted },
  })

export default memo(ProgressionLineBar)
