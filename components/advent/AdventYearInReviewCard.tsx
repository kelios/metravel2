import { memo, useCallback, useMemo } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'

import Button from '@/components/ui/Button'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { ADVENT_MAIN_DOORS } from '@/constants/advent'
import { isYearInReviewEmpty, type YearInReview } from '@/api/advent'
import { useYearInReviewQuery } from '@/hooks/useYearInReviewQuery'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { formatInteger } from '@/i18n/format'
import { translate as i18nT } from '@/i18n'
import type { AdventCardSpec, AdventCardStat } from '@/utils/advent/adventShareImage'
import { adventFooterUrl } from '@/utils/advent/adventShare'
import AdventShareActions from './AdventShareActions'
import { useAdventCardShare } from './useAdventCardShare'

type Props = { year: number }

const MAX_COUNTRY_CHIPS = 8
const PLAN_ROUTE = '/trips'

type StatTile = AdventCardStat & { icon: keyof typeof Feather.glyphMap; key: string }

/** Показатели итогов: только ненулевые, в порядке силы для соцсетей. */
export const buildYearInReviewStats = (data: YearInReview): StatTile[] => {
  const tiles: StatTile[] = []
  const push = (key: string, icon: StatTile['icon'], value: number, label: string, formatted?: string) => {
    if (value > 0) tiles.push({ key, icon, value: formatted ?? formatInteger(value), label })
  }
  push('countries', 'globe', data.countries.count, i18nT('adventStatic:yir.countries'))
  push('cities', 'map-pin', data.cities.count, i18nT('adventStatic:yir.cities'))
  push('travels', 'map', data.visitedTravels, i18nT('adventStatic:yir.travels'))
  push(
    'route',
    'navigation',
    data.longestRouteKm,
    i18nT('adventStatic:yir.longestRoute'),
    i18nT('adventStatic:yir.km', { value1: formatInteger(data.longestRouteKm) }),
  )
  push('published', 'edit-3', data.publishedTravels, i18nT('adventStatic:yir.published'))
  push('quests', 'flag', data.questsCompleted, i18nT('adventStatic:yir.quests'))
  push('badges', 'award', data.badgesEarned, i18nT('adventStatic:yir.badges'))
  push(
    'advent',
    'gift',
    data.advent.opened,
    i18nT('adventStatic:yir.advent'),
    `${formatInteger(data.advent.opened)}/${formatInteger(ADVENT_MAIN_DOORS)}`,
  )
  return tiles
}

/**
 * Финал адвента 24.12 — личные «Итоги года путешественника» (#2868). Состояния:
 * загрузка; данные с «Скачать»/«Поделиться»; пустой год — мягкий призыв
 * запланировать следующий; сервер недоступен (в т.ч. бэкенд #2865 ещё не
 * выкачен) — открытка без итогов и честное сообщение.
 */
function AdventYearInReviewCard({ year }: Props) {
  const colors = useThemedColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const router = useRouter()
  const query = useYearInReviewQuery(year)
  const data = query.data

  const stats = useMemo(() => (data ? buildYearInReviewStats(data) : []), [data])
  const title = i18nT('adventStatic:yir.title', { value1: year })
  const shareText = i18nT('adventStatic:yir.shareText', { value1: year })

  const buildSpec = useCallback(
    (): AdventCardSpec => ({
      eyebrow: i18nT('adventStatic:page.title'),
      title,
      subtitle: data?.countries.names.slice(0, 4).join(' · ') || undefined,
      stats: stats.map(({ value, label }) => ({ value, label })),
      footer: adventFooterUrl(),
    }),
    [title, data, stats],
  )

  const { status, share, download, canDownload } = useAdventCardShare({
    kind: 'year',
    year,
    filename: `metravel-itogi-${year}.png`,
    buildSpec,
    shareTitle: title,
    shareText,
  })

  if (query.isLoading) {
    return (
      <View style={[styles.card, styles.center]} testID="advent-yir-loading">
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.body}>{i18nT('adventStatic:yir.loading')}</Text>
      </View>
    )
  }

  if (!data) {
    return (
      <View style={styles.card} testID="advent-yir-unavailable">
        <View style={styles.titleRow}>
          <Feather name="gift" size={20} color={colors.accent} />
          <Text style={styles.title}>{i18nT('adventStatic:yir.unavailable.title')}</Text>
        </View>
        <Text style={styles.body}>{i18nT('adventStatic:yir.unavailable.text')}</Text>
      </View>
    )
  }

  if (isYearInReviewEmpty(data)) {
    return (
      <View style={styles.card} testID="advent-yir-empty">
        <View style={styles.titleRow}>
          <Feather name="sunrise" size={20} color={colors.accent} />
          <Text style={styles.title}>{i18nT('adventStatic:yir.empty.title')}</Text>
        </View>
        <Text style={styles.body}>{i18nT('adventStatic:yir.empty.text', { value1: year + 1 })}</Text>
        <View style={styles.row}>
          <Button
            label={i18nT('adventStatic:yir.empty.cta')}
            size="sm"
            variant="soft"
            onPress={() => router.push(PLAN_ROUTE as never)}
            testID="advent-yir-plan"
          />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.card} testID="advent-yir-card">
      <View style={styles.titleRow}>
        <Feather name="star" size={20} color={colors.accent} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.body}>{i18nT('adventStatic:yir.subtitle')}</Text>
      <View style={styles.grid}>
        {stats.map((stat) => (
          <View key={stat.key} style={styles.tile} testID={`advent-yir-stat-${stat.key}`}>
            <Feather name={stat.icon} size={16} color={colors.primaryDark} />
            <Text style={styles.tileValue}>{stat.value}</Text>
            <Text style={styles.tileLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
      {data.countries.names.length > 0 ? (
        <View style={styles.chips} testID="advent-yir-countries">
          {data.countries.names.slice(0, MAX_COUNTRY_CHIPS).map((name, index) => (
            <View key={`${index}-${name}`} style={styles.chip}>
              <Text style={styles.chipText}>{name}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {data.firstSubscriptionAuthor ? (
        <Text style={styles.body}>{i18nT('adventStatic:yir.author', { value1: data.firstSubscriptionAuthor })}</Text>
      ) : null}
      <AdventShareActions
        status={status}
        canDownload={canDownload}
        onShare={() => void share()}
        onDownload={() => void download()}
        testIDPrefix="advent-yir"
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
      gap: DESIGN_TOKENS.spacing.sm,
    },
    center: { alignItems: 'center' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xs },
    title: { fontSize: 18, fontWeight: '700', color: colors.text, flexShrink: 1 },
    body: { fontSize: 15, lineHeight: 22, color: colors.textSecondary },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.xs },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.xs },
    tile: {
      flexGrow: 1,
      flexBasis: 140,
      padding: DESIGN_TOKENS.spacing.sm,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.surface,
      gap: DESIGN_TOKENS.spacing.xxs,
    },
    tileValue: { fontSize: 22, fontWeight: '800', color: colors.text },
    tileLabel: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.xxs },
    chip: {
      paddingHorizontal: DESIGN_TOKENS.spacing.sm,
      paddingVertical: DESIGN_TOKENS.spacing.xxs,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipText: { fontSize: 13, color: colors.text },
  })

export default memo(AdventYearInReviewCard)
