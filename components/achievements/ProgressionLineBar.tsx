import { memo, useMemo } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { TIER_VISUALS } from '@/components/achievements/badgeVisuals'
import {
  MaxLevelLaurel,
  ProgressionAnimalMedallion,
} from '@/components/achievements/GamificationIcons'
import type {
  ActivityKind,
  ProgressionLine,
  ProgressionLineSlug,
} from '@/api/gamification'

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

// Что засчитывается в трек — FE-фолбэк, если BE не прислал description.
// Снимает главную путаницу: пользователь видит, какое действие растит линейку.
const ACTIVITY_DESC: Record<ActivityKind, string> = {
  participant: 'Совместные поездки, к которым вы присоединились',
  author: 'Опубликованные путешествия и статьи',
  reader: 'Прочитанные истории путешествий',
  explorer: 'Открытые места и точки на карте',
}

/** Одна линейка прогрессии: маскот ветки, тип активности, уровень и % до следующего. */
function ProgressionLineBar({ line, testID, style }: Props) {
  const colors = useThemedColors()

  const { ratio, remaining } = useMemo(() => {
    if (line.isMaxLevel || line.nextLevelMin == null) {
      return { ratio: 1, remaining: 0 }
    }
    // Приоритет — готовым серверным значениям (progressPercent/pointsToNext);
    // при их отсутствии считаем из порогов клиентом (legacy-фолбэк).
    if (line.progressPercent != null && line.pointsToNext != null) {
      return {
        ratio: Math.max(0, Math.min(1, line.progressPercent / 100)),
        remaining: Math.max(0, line.pointsToNext),
      }
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

  const description = line.description ?? ACTIVITY_DESC[line.activityKind]

  return (
    <View
      style={[styles.container, style]}
      testID={testID}
      accessibilityRole="summary"
      accessibilityLabel={`${line.activityName}. ${description}. Уровень ${line.level}, ${line.levelTitle}. ${
        line.isMaxLevel
          ? 'Максимальный уровень'
          : `до уровня ${line.nextLevelTitle} осталось ${remaining}`
      }`}
    >
      <View style={styles.row}>
        <ProgressionAnimalMedallion slug={line.slug} size={40} />
        <View style={styles.titleWrap}>
          <View style={styles.titleLine}>
            <Text style={styles.activity} numberOfLines={1}>
              {line.activityName}
            </Text>
            <View style={styles.levelChip}>
              <Text style={styles.levelChipText}>Ур. {line.level}</Text>
            </View>
          </View>
          <Text style={styles.desc} numberOfLines={2}>
            {description}
          </Text>
        </View>
        <View style={styles.valueWrap}>
          <Text style={styles.value}>{line.current}</Text>
          <Text style={styles.valueLabel}>очк.</Text>
        </View>
      </View>

      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: fillColor }]}
        />
      </View>

      {line.isMaxLevel ? (
        <View style={styles.captionRow}>
          <MaxLevelLaurel size={16} color={colors.textMuted} />
          <Text style={styles.caption} numberOfLines={1}>
            «{line.levelTitle}» — максимальный уровень
          </Text>
        </View>
      ) : (
        <Text style={styles.caption} numberOfLines={1}>
          «{line.levelTitle}» · ещё {remaining} до «{line.nextLevelTitle}»
        </Text>
      )}
    </View>
  )
}

const getStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: { gap: 6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.sm },
    titleWrap: { flex: 1, minWidth: 0, gap: 2 },
    titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    activity: {
      flexShrink: 1,
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '700',
      color: colors.text,
    },
    levelChip: {
      paddingHorizontal: 7,
      paddingVertical: 1,
      borderRadius: 999,
      backgroundColor: colors.backgroundTertiary,
    },
    levelChipText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    desc: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      lineHeight: 16,
    },
    valueWrap: { alignItems: 'flex-end', minWidth: 40 },
    value: {
      fontSize: DESIGN_TOKENS.typography.sizes.md,
      fontWeight: '800',
      color: colors.primaryText,
    },
    valueLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textMuted,
      marginTop: -2,
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
