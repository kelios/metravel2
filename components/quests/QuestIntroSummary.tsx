import React, { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors } from '@/hooks/useTheme'
import { useTranslation } from '@/i18n/LocaleProvider'
import { formatDistanceMeters, formatTravelTime, ROUTE_DISTANCE_FORMAT } from '@/utils/distanceCalculator'
import type { QuestRouteGeometryState } from './useQuestRouteGeometry'

export type QuestIntroSummaryProps = {
  durationMin?: number
  difficulty?: 'easy' | 'medium' | 'hard'
  metaLoading?: boolean
  routeLoading?: boolean
  routeComplete: boolean
  route: QuestRouteGeometryState
  pointsCount: number
}

export default function QuestIntroSummary({ durationMin, difficulty, metaLoading, routeLoading, routeComplete, route, pointsCount }: QuestIntroSummaryProps) {
  const { t } = useTranslation()
  const colors = useThemedColors()
  const styles = useMemo(() => StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.sm, marginBottom: DESIGN_TOKENS.spacing.md },
    item: { flexBasis: '45%', flexGrow: 1, minWidth: 0 },
    label: { color: colors.textMuted, fontSize: 12 },
    value: { color: colors.text, fontSize: 14, fontWeight: '600' },
    offer: { flexBasis: '100%', color: colors.text, fontSize: 15, fontWeight: '700' },
  }), [colors])
  const unavailable = t('quests:components.quests.QuestIntroSummary.unavailable')
  const loading = t('quests:components.quests.QuestIntroSummary.loading')
  const difficultyText = difficulty === 'easy' ? t('quests:components.quests.QuestForCityCard.difficulty.easy')
    : difficulty === 'medium' ? t('quests:components.quests.QuestForCityCard.difficulty.medium')
      : difficulty === 'hard' ? t('quests:components.quests.QuestForCityCard.difficulty.hard') : null
  const distance = routeComplete && (routeLoading || route.status === 'idle' || route.status === 'loading') ? loading
    : routeComplete && route.status === 'ready' && route.source === 'routed' && route.track.length >= 2 && Number.isFinite(route.distanceM) && route.distanceM > 0
      ? formatDistanceMeters(route.distanceM, ROUTE_DISTANCE_FORMAT) : unavailable
  // #3219: one offer line carries the points count and the duration; the trust
  // bar below explains the same count (required / optional / start / finale).
  // An unknown duration is left out, never guessed.
  const points = t('quests:components.quests.QuestTrustBar.pointsCount', { count: pointsCount })
  const hasDuration = typeof durationMin === 'number' && Number.isFinite(durationMin) && durationMin > 0
  const offer = hasDuration
    ? t('quests:components.quests.QuestIntroSummary.offer', { points, duration: formatTravelTime(durationMin) })
    : t('quests:components.quests.QuestIntroSummary.offerNoDuration', { points })
  const fields = [
    { label: t('quests:components.quests.QuestIntroSummary.difficulty'), value: difficultyText ?? (metaLoading ? loading : unavailable) },
    { label: t('quests:components.quests.QuestIntroSummary.distance'), value: distance },
  ]
  return <View style={styles.row} testID="quest-intro-summary">
    <Text style={styles.offer} testID="quest-intro-offer">{offer}</Text>
    {fields.map(({ label, value }) => <View key={label} style={styles.item}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>)}
  </View>
}
