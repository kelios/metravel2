// [FE-634] T5 — Вкладка профиля «Карта»: scratch-карта мира.
// Серая заливка = не посещено, акцент = посещено. Данные — useVisitedCountries (T2),
// рендер — WorldChoroplethMap (T3). Флаг-маркеры (T4) и тап-инфо (T6) — отдельные тикеты.

import { useCallback, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import ProfileSectionHeader from '@/components/profile/ProfileSectionHeader'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { useVisitedCountries } from '@/hooks/useVisitedCountries'
import type { TravelStatusEntry } from '@/stores/travelStatusStore'
import type { Travel } from '@/types/types'

import { WorldChoroplethMap } from './worldMap/WorldChoroplethMap'
import { WorldMapFlags } from './worldMap/WorldMapFlags'
import { getCountryGeometry } from './worldMap/worldGeometry'

interface ProfileWorldMapTabProps {
  userId: string | number | null | undefined
  travels: Travel[]
  personalTravelStatusEntries: TravelStatusEntry[]
  onBackToOverview: () => void
}

const formatCountriesLabel = (count: number) => {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} страна`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} страны`
  return `${count} стран`
}

const _formatRoutesLabel = (count: number) => {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} маршрут`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} маршрута`
  return `${count} маршрутов`
}

export function ProfileWorldMapTab({
  userId,
  travels,
  personalTravelStatusEntries,
  onBackToOverview,
}: ProfileWorldMapTabProps) {
  const colors = useThemedColors()
  const { isPhone, isLargePhone } = useResponsive()
  const isMobile = isPhone || isLargePhone

  const { visitedCodes, byCode, visitedCount, remainingCount, totalCount, isLoading } =
    useVisitedCountries({ userId, travels, personalTravelStatusEntries })

  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const handleCountryPress = useCallback((code: string) => setSelectedCode(code), [])

  const selected = useMemo(() => {
    if (!selectedCode) return null
    const meta = byCode.get(selectedCode)
    const geom = getCountryGeometry(selectedCode)
    return {
      code: selectedCode,
      name: meta?.name || geom?.name || selectedCode,
      visited: visitedCodes.has(selectedCode),
      visitedTravelsCount: meta?.visitedTravelsCount ?? 0,
      firstVisitedDate: meta?.firstVisitedDate ?? null,
    }
  }, [selectedCode, byCode, visitedCodes])

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.surface,
          borderRadius: DESIGN_TOKENS.radii.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: isMobile ? DESIGN_TOKENS.spacing.md : DESIGN_TOKENS.spacing.lg,
          gap: DESIGN_TOKENS.spacing.md,
          marginHorizontal: isMobile ? DESIGN_TOKENS.spacing.md : 0,
        },
        metricsRow: {
          flexDirection: 'row',
          gap: DESIGN_TOKENS.spacing.sm,
        },
        metric: {
          flex: 1,
          backgroundColor: colors.surfaceMuted,
          borderRadius: DESIGN_TOKENS.radii.md,
          paddingVertical: DESIGN_TOKENS.spacing.sm,
          paddingHorizontal: DESIGN_TOKENS.spacing.sm,
          alignItems: 'center',
        },
        metricValue: {
          fontSize: DESIGN_TOKENS.typography.sizes.xl,
          fontWeight: DESIGN_TOKENS.typography.weights.bold as '700',
          color: colors.text,
        },
        metricLabel: {
          marginTop: 2,
          fontSize: DESIGN_TOKENS.typography.sizes.xs,
          color: colors.textSecondary,
          textAlign: 'center',
        },
        mapWrap: {
          borderRadius: DESIGN_TOKENS.radii.md,
          overflow: 'hidden',
          backgroundColor: colors.background,
        },
        legendRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: DESIGN_TOKENS.spacing.md,
          alignItems: 'center',
        },
        legendItem: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        legendSwatch: {
          width: 14,
          height: 14,
          borderRadius: 3,
        },
        legendText: {
          fontSize: DESIGN_TOKENS.typography.sizes.sm,
          color: colors.textSecondary,
        },
        infoCard: {
          backgroundColor: colors.surfaceMuted,
          borderRadius: DESIGN_TOKENS.radii.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingVertical: DESIGN_TOKENS.spacing.sm,
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
          gap: 4,
        },
        infoTitleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: DESIGN_TOKENS.spacing.sm,
        },
        infoName: {
          flex: 1,
          fontSize: DESIGN_TOKENS.typography.sizes.md,
          fontWeight: DESIGN_TOKENS.typography.weights.bold as '700',
          color: colors.text,
        },
        infoClose: {
          padding: 2,
          ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
        },
        infoMeta: {
          fontSize: DESIGN_TOKENS.typography.sizes.sm,
          color: colors.textSecondary,
        },
      }),
    [colors, isMobile]
  )

  return (
    <View>
      <ProfileSectionHeader
        title="Карта мира"
        subtitle="Серым — куда ещё не добрались, цветом — где уже были"
        onBack={onBackToOverview}
      />

      <View style={styles.card}>
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{visitedCount}</Text>
            <Text style={styles.metricLabel}>Посетили</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{remainingCount}</Text>
            <Text style={styles.metricLabel}>Осталось</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{totalCount}</Text>
            <Text style={styles.metricLabel}>Всего</Text>
          </View>
        </View>

        <View style={styles.mapWrap}>
          {isLoading ? (
            <SkeletonLoader width="100%" height={isMobile ? 180 : 320} borderRadius={DESIGN_TOKENS.radii.md} />
          ) : (
            <WorldChoroplethMap
              visitedCodes={visitedCodes}
              selectedCode={selectedCode}
              onCountryPress={handleCountryPress}
            >
              <WorldMapFlags visitedCodes={visitedCodes} size={isMobile ? 13 : 16} />
            </WorldChoroplethMap>
          )}
        </View>

        {selected ? (
          <View style={styles.infoCard}>
            <View style={styles.infoTitleRow}>
              <Text style={styles.infoName} numberOfLines={1}>
                {selected.name}
              </Text>
              <Pressable
                onPress={() => setSelectedCode(null)}
                accessibilityRole="button"
                accessibilityLabel="Закрыть"
                hitSlop={8}
                style={styles.infoClose}
              >
                <Feather name="x" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>
            {selected.visited ? (
              <Text style={styles.infoMeta}>
                Посещено
                {selected.visitedTravelsCount > 0
                  ? ` · ${formatRoutesLabel(selected.visitedTravelsCount)}`
                  : ''}
                {selected.firstVisitedDate
                  ? ` · с ${selected.firstVisitedDate.slice(0, 4)}`
                  : ''}
              </Text>
            ) : (
              <Text style={styles.infoMeta}>Ещё не посещено</Text>
            )}
          </View>
        ) : null}

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendText}>
              Посещено · {formatCountriesLabel(visitedCount)}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: colors.surfaceMuted, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]} />
            <Text style={styles.legendText}>Не посещено</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

export default ProfileWorldMapTab
