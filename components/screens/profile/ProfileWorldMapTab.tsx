// [FE-634] T5 — Вкладка профиля «Карта»: scratch-карта мира.
// Серая заливка = не посещено, акцент = посещено. Данные — useVisitedCountries (T2),
// рендер — WorldChoroplethMap (T3). Флаг-маркеры (T4) и тап-инфо (T6).
// [FE-635-T2] Зум/пан карты (жесты + кнопки +/−/сброс).
// [FE-635-T3] Клик по стране → список маршрутов пользователя в стране.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useRouter } from 'expo-router'

import ProfileSectionHeader from '@/components/profile/ProfileSectionHeader'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { CountryTravelsPanel } from './CountryTravelsPanel'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useMapZoomPan } from '@/hooks/useMapZoomPan'
import { useResponsive } from '@/hooks/useResponsive'
import { useTheme, useThemedColors } from '@/hooks/useTheme'
import { useVisitedCountries } from '@/hooks/useVisitedCountries'
import type { TravelStatusEntry } from '@/stores/travelStatusStore'
import type { Travel } from '@/types/types'

import { buildTravelsByCountryCode } from './profileCountries'
import { WorldChoroplethMap } from './worldMap/WorldChoroplethMap'
import { WorldMapFlags } from './worldMap/WorldMapFlags'
import {
  WORLD_MAP_HEIGHT,
  WORLD_MAP_WIDTH,
  getCountryGeometry,
  getWorldMapUnvisitedFill,
} from './worldMap/worldGeometry'

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

const formatRoutesLabel = (count: number) => {
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
  const { isDark } = useTheme()
  const { isMobile } = useResponsive()
  const router = useRouter()
  const infoCardRef = useRef<View>(null)

  const { visitedCodes, byCode, visitedCount, remainingCount, totalCount, isLoading } =
    useVisitedCountries({ userId, travels, personalTravelStatusEntries })

  const zoom = useMapZoomPan({ contentWidth: WORLD_MAP_WIDTH, contentHeight: WORLD_MAP_HEIGHT })
  const { reset } = zoom

  useEffect(() => {
    reset(false)
  }, [reset])

  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const handleCountryPress = useCallback((code: string) => setSelectedCode(code), [])

  // Клик по стране должен давать явный отклик: проскроллить инфо-панель в вид.
  useEffect(() => {
    if (!selectedCode) return
    const node = infoCardRef.current as unknown as {
      scrollIntoView?: (opts: { behavior: 'smooth'; block: 'nearest' }) => void
    } | null
    if (Platform.OS === 'web' && node?.scrollIntoView) {
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedCode])

  const travelsByCountry = useMemo(() => buildTravelsByCountryCode(travels), [travels])

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
      travels: travelsByCountry.get(selectedCode) ?? [],
    }
  }, [selectedCode, byCode, visitedCodes, travelsByCountry])

  const openTravel = useCallback(
    (url: string) => {
      if (url) router.push(url as never)
    },
    [router],
  )

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
          // На desktop карта иначе ~640–880px высотой и инфо-панель уходит под
          // сгиб. Ограничиваем высоту, чтобы клик по стране давал видимый отклик.
          alignSelf: 'center',
          width: '100%',
          ...(isMobile ? {} : { maxWidth: 920 }),
        },
        zoomControls: {
          position: 'absolute',
          right: DESIGN_TOKENS.spacing.sm,
          bottom: DESIGN_TOKENS.spacing.sm,
          flexDirection: 'column',
          gap: 6,
        },
        zoomButton: {
          width: isMobile ? 34 : 38,
          height: isMobile ? 34 : 38,
          borderRadius: DESIGN_TOKENS.radii.md,
          // frost: статичный surfaceMuted на мобильном (без живого blur — правило перфа).
          backgroundColor: colors.surfaceMuted,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
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
          borderWidth: 1,
          borderColor: colors.primary,
          paddingVertical: DESIGN_TOKENS.spacing.sm,
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
          gap: 4,
          ...Platform.select({
            web: { boxShadow: DESIGN_TOKENS.shadows.card } as object,
            default: {},
          }),
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
        travelsList: {
          marginTop: DESIGN_TOKENS.spacing.sm,
        },
        emptyTravels: {
          marginTop: DESIGN_TOKENS.spacing.xs,
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
            <>
              <WorldChoroplethMap
                visitedCodes={visitedCodes}
                selectedCode={selectedCode}
                onCountryPress={handleCountryPress}
                zoom={zoom}
              >
                <WorldMapFlags visitedCodes={visitedCodes} size={isMobile ? 13 : 16} zoom={zoom} />
              </WorldChoroplethMap>

              <View style={styles.zoomControls}>
                <Pressable
                  onPress={() => zoom.zoomByCentered(1.5)}
                  accessibilityRole="button"
                  accessibilityLabel="Приблизить карту"
                  style={styles.zoomButton}
                >
                  <Feather name="plus" size={18} color={colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => zoom.zoomByCentered(1 / 1.5)}
                  accessibilityRole="button"
                  accessibilityLabel="Отдалить карту"
                  style={styles.zoomButton}
                >
                  <Feather name="minus" size={18} color={colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => zoom.reset()}
                  accessibilityRole="button"
                  accessibilityLabel="Сбросить масштаб карты"
                  style={styles.zoomButton}
                >
                  <Feather name="maximize" size={16} color={colors.text} />
                </Pressable>
              </View>
            </>
          )}
        </View>

        {selected ? (
          <View ref={infoCardRef} style={styles.infoCard}>
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

            {selected.travels.length > 0 ? (
              <View style={styles.travelsList}>
                <CountryTravelsPanel
                  travels={selected.travels}
                  isMobile={isMobile}
                  onOpenTravel={openTravel}
                  onShowAll={onBackToOverview}
                />
              </View>
            ) : (
              <Text style={styles.emptyTravels}>Нет маршрутов в этой стране</Text>
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
            <View style={[styles.legendSwatch, { backgroundColor: getWorldMapUnvisitedFill(isDark), borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]} />
            <Text style={styles.legendText}>Не посещено</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

export default ProfileWorldMapTab
