// [FE-634] T5 — Вкладка профиля «Карта»: scratch-карта мира.
// Серая заливка = не посещено, акцент = посещено. Данные — useVisitedCountries (T2),
// рендер — WorldChoroplethMap (T3). Флаг-маркеры (T4) и тап-инфо (T6).
// [FE-635-T2] Зум/пан карты (жесты + кнопки +/−/сброс).
// [FE-635-T3] Клик по стране → список маршрутов пользователя в стране.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { useRouter } from 'expo-router'

import ProfileSectionHeader from '@/components/profile/ProfileSectionHeader'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { CountryTravelsPanel, type CountryTravelCard } from './CountryTravelsPanel'
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
  getCountryFlagAnchor,
  getCountryGeometry,
  getWorldMapUnvisitedFill,
} from './worldMap/worldGeometry'
import { selectPlural, translate as i18nT } from '@/i18n'


interface ProfileWorldMapTabProps {
  userId: string | number | null | undefined
  travels: Travel[]
  personalTravelStatusEntries: TravelStatusEntry[]
  onBackToOverview: () => void
  onMapGestureActiveChange?: (active: boolean) => void
}

const formatCountriesLabel = (count: number) => {
  return selectPlural(count, {
    one: i18nT('profile:components.screens.profile.ProfileWorldMapTab.value1_strana_e6f0e1db', { value1: count }),
    few: i18nT('profile:components.screens.profile.ProfileWorldMapTab.value1_strany_376fa642', { value1: count }),
    many: i18nT('profile:components.screens.profile.ProfileWorldMapTab.value1_stran_c44237e0', { value1: count }),
    other: i18nT('profile:components.screens.profile.ProfileWorldMapTab.value1_stran_c44237e0', { value1: count }),
  })
}

const formatRoutesLabel = (count: number) => {
  return selectPlural(count, {
    one: i18nT('profile:components.screens.profile.ProfileWorldMapTab.value1_marshrut_63e26e9c', { value1: count }),
    few: i18nT('profile:components.screens.profile.ProfileWorldMapTab.value1_marshruta_64d72f90', { value1: count }),
    many: i18nT('profile:components.screens.profile.ProfileWorldMapTab.value1_marshrutov_9be4e19a', { value1: count }),
    other: i18nT('profile:components.screens.profile.ProfileWorldMapTab.value1_marshrutov_9be4e19a', { value1: count }),
  })
}

export function ProfileWorldMapTab({
  userId,
  travels,
  personalTravelStatusEntries,
  onBackToOverview,
  onMapGestureActiveChange,
}: ProfileWorldMapTabProps) {
  const colors = useThemedColors()
  const { isDark } = useTheme()
  const { height, isMobile } = useResponsive()
  const router = useRouter()
  const infoCardRef = useRef<View>(null)
  const fullscreenTopOffset = (Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0) + 56
  const fullscreenMapHeight = isMobile
    ? Math.max(240, height - fullscreenTopOffset)
    : undefined

  const { visitedCodes, byCode, visitedCount, remainingCount, totalCount, isLoading } =
    useVisitedCountries({ userId, travels, personalTravelStatusEntries })

  const zoom = useMapZoomPan({ contentWidth: WORLD_MAP_WIDTH, contentHeight: WORLD_MAP_HEIGHT })
  const { reset } = zoom

  useEffect(() => {
    reset(false)
  }, [reset])

  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)
  const handleCountryPress = useCallback((code: string) => setSelectedCode(code), [])

  // Fullscreen-портрет карты рендерится в cover-режиме (SVG slice): при scale=1 карта
  // уже заполняет ВСЮ высоту (все широты), обрезана по долготе — мир листается пальцем
  // E↔W. Дополнительный масштаб не нужен, только центрируем видимую долготу на
  // центроиде посещённых стран, чтобы они были в кадре сразу. Вертикаль залочена
  // клампом (высота заполнена целиком).
  const fullscreenFitApplied = useRef(false)
  const applyFullscreenFit = useCallback(
    (width: number, height: number) => {
      if (fullscreenFitApplied.current || width <= 0 || height <= 0) return
      fullscreenFitApplied.current = true
      reset(false)
      // Центроид посещённых стран (единицы viewBox) → центрируем окно по X.
      if (visitedCodes.size === 0) return
      let sumX = 0
      let count = 0
      for (const code of visitedCodes) {
        const geom = getCountryFlagAnchor(code)
        if (!geom) continue
        sumX += geom.cx
        count += 1
      }
      if (count === 0) return
      const focusX = sumX / count
      const coverScale = Math.max(width / WORLD_MAP_WIDTH, height / WORLD_MAP_HEIGHT)
      const viewW = width / coverScale // видимая ширина в единицах viewBox
      // translateX так, чтобы focusX оказался в центре окна; кламп внутри panBy.
      const targetTx = viewW / 2 - focusX
      zoom.panBy(targetTx, 0)
    },
    [reset, zoom, visitedCodes]
  )

  const openMapFullscreen = useCallback(() => {
    fullscreenFitApplied.current = false
    setIsMapFullscreen(true)
  }, [])
  const closeMapFullscreen = useCallback(() => {
    setIsMapFullscreen(false)
    fullscreenFitApplied.current = false
    reset(false)
    onMapGestureActiveChange?.(false)
  }, [onMapGestureActiveChange, reset])

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

  // Индекс авторских маршрутов по id — источник фото/заголовка для карточек,
  // собранных из бэкендового visits[] (который фото не отдаёт).
  const travelsById = useMemo(() => {
    const map = new Map<string, Travel>()
    travels.forEach((travel) => map.set(String(travel.id), travel))
    return map
  }, [travels])

  const selected = useMemo(() => {
    if (!selectedCode) return null
    const meta = byCode.get(selectedCode)
    const geom = getCountryGeometry(selectedCode)

    const toImageUrl = (travel: Travel | undefined) =>
      travel?.travel_image_thumb_small_url || travel?.travel_image_thumb_url || ''

    // Список карточек — из бэкендового visits[] (совпадает со счётчиком и учитывает
    // страны, привязанные метаданными визита, а не только primary-кодом маршрута).
    // Фото/заголовок обогащаем из локальных авторских маршрутов по id. Если бэкенд
    // visits не отдал (fallback-режим без userId) — берём локальную группировку.
    const backendVisits = meta?.visits ?? []
    const cards: CountryTravelCard[] = backendVisits.length
      ? backendVisits.map((visit) => {
          const local = travelsById.get(visit.travelId)
          return {
            id: visit.travelId,
            name: local?.name || visit.title,
            url: local?.url || visit.url,
            imageUrl: toImageUrl(local),
          }
        })
      : (travelsByCountry.get(selectedCode) ?? []).map((travel) => ({
          id: String(travel.id),
          name: travel.name,
          url: travel.url,
          imageUrl: toImageUrl(travel),
        }))

    return {
      code: selectedCode,
      name: meta?.name || geom?.name || selectedCode,
      visited: visitedCodes.has(selectedCode),
      visitedTravelsCount: meta?.visitedTravelsCount ?? 0,
      firstVisitedDate: meta?.firstVisitedDate ?? null,
      travels: cards,
    }
  }, [selectedCode, byCode, visitedCodes, travelsByCountry, travelsById])

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
        fullscreenRoot: {
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
        },
        fullscreenHeader: {
          minHeight: 56,
          paddingHorizontal: DESIGN_TOKENS.spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        },
        fullscreenTitle: {
          flex: 1,
          fontSize: DESIGN_TOKENS.typography.sizes.lg,
          fontWeight: DESIGN_TOKENS.typography.weights.bold as '700',
          color: colors.text,
        },
        fullscreenCloseButton: {
          width: 44,
          height: 44,
          borderRadius: DESIGN_TOKENS.radii.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceMuted,
          ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
        },
        fullscreenBody: {
          flex: 1,
          position: 'relative',
          padding: isMobile ? 0 : DESIGN_TOKENS.spacing.md,
          gap: isMobile ? 0 : DESIGN_TOKENS.spacing.md,
        },
        fullscreenMapFrame: {
          flex: isMobile ? 0 : 1,
          ...(isMobile ? { height: fullscreenMapHeight } : {}),
        },
        fullscreenMapWrap: {
          flex: 1,
          width: '100%',
          ...(isMobile ? { minHeight: fullscreenMapHeight } : {}),
          maxWidth: isMobile ? undefined : 1180,
          alignSelf: 'center',
          overflow: 'hidden',
          backgroundColor: colors.surface,
          ...(isMobile
            ? {}
            : {
                borderRadius: DESIGN_TOKENS.radii.md,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
              }),
        },
        fullscreenInfo: {
          ...(isMobile
            ? {
                position: 'absolute' as const,
                left: DESIGN_TOKENS.spacing.md,
                right: DESIGN_TOKENS.spacing.md,
                bottom: DESIGN_TOKENS.spacing.md,
                maxHeight: '85%' as const,
                zIndex: 3,
              }
            : {
                maxWidth: 1180,
                alignSelf: 'center' as const,
                width: '100%' as const,
              }),
        },
        zoomControls: {
          position: 'absolute',
          right: DESIGN_TOKENS.spacing.sm,
          bottom: DESIGN_TOKENS.spacing.sm,
          flexDirection: 'column',
          gap: 6,
        },
        zoomControlsWithInfo: {
          top: DESIGN_TOKENS.spacing.sm,
          bottom: undefined,
          zIndex: 4,
        },
        zoomButton: {
          width: DESIGN_TOKENS.touchTarget.minWidth,
          height: DESIGN_TOKENS.touchTarget.minHeight,
          borderRadius: DESIGN_TOKENS.radii.md,
          // frost: статичный surfaceMuted на мобильном (без живого blur — правило перфа).
          backgroundColor: colors.surfaceMuted,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
        },
        hint: {
          fontSize: DESIGN_TOKENS.typography.sizes.xs,
          color: colors.textSecondary,
          textAlign: 'center',
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
          width: DESIGN_TOKENS.touchTarget.minWidth,
          height: DESIGN_TOKENS.touchTarget.minHeight,
          alignItems: 'center',
          justifyContent: 'center',
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
    [colors, fullscreenMapHeight, isMobile]
  )

  const renderMap = useCallback(
    (mode: 'inline' | 'fullscreen') => (
      <>
        <WorldChoroplethMap
          visitedCodes={visitedCodes}
          selectedCode={selectedCode}
          onCountryPress={handleCountryPress}
          zoom={zoom}
          fillParent={mode === 'fullscreen'}
          // Явная px-высота: проценты <svg height="100%"> не резолвятся сквозь
          // цепочку flex-высот Modal → падают в интринсик 2:1 (узкая полоса).
          style={mode === 'fullscreen' && isMobile ? { height: fullscreenMapHeight } : undefined}
          onContainerLayout={mode === 'fullscreen' ? applyFullscreenFit : undefined}
          onGestureActiveChange={onMapGestureActiveChange}
        >
          <WorldMapFlags visitedCodes={visitedCodes} size={mode === 'fullscreen' ? 16 : isMobile ? 13 : 16} zoom={zoom} cover={mode === 'fullscreen'} />
        </WorldChoroplethMap>

        <View
          style={[
            styles.zoomControls,
            mode === 'fullscreen' && isMobile && selectedCode
              ? styles.zoomControlsWithInfo
              : null,
          ]}
        >
          <Pressable
            onPress={() => zoom.zoomByCentered(1.5)}
            accessibilityRole="button"
            accessibilityLabel={i18nT('profile:components.screens.profile.ProfileWorldMapTab.priblizit_kartu_437e65c8')}
            hitSlop={6}
            style={styles.zoomButton}
          >
            <Feather name="plus" size={18} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => zoom.zoomByCentered(1 / 1.5)}
            accessibilityRole="button"
            accessibilityLabel={i18nT('profile:components.screens.profile.ProfileWorldMapTab.otdalit_kartu_46122c74')}
            hitSlop={6}
            style={styles.zoomButton}
          >
            <Feather name="minus" size={18} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => zoom.reset()}
            accessibilityRole="button"
            accessibilityLabel={i18nT('profile:components.screens.profile.ProfileWorldMapTab.sbrosit_masshtab_karty_502994d5')}
            hitSlop={6}
            style={styles.zoomButton}
          >
            <Feather name="maximize" size={16} color={colors.text} />
          </Pressable>
          {mode === 'inline' ? (
            <Pressable
              onPress={openMapFullscreen}
              accessibilityRole="button"
              accessibilityLabel={i18nT('profile:components.screens.profile.ProfileWorldMapTab.otkryt_kartu_vo_ves_ekran_b743e70f')}
              hitSlop={6}
              style={styles.zoomButton}
            >
              <Feather name="maximize-2" size={17} color={colors.text} />
            </Pressable>
          ) : null}
        </View>
      </>
    ),
    [
      visitedCodes,
      selectedCode,
      handleCountryPress,
      zoom,
      applyFullscreenFit,
      fullscreenMapHeight,
      onMapGestureActiveChange,
      isMobile,
      styles,
      colors.text,
      openMapFullscreen,
    ]
  )

  return (
    <View>
      <ProfileSectionHeader
        title={i18nT('profile:components.screens.profile.ProfileWorldMapTab.karta_mira_562a96c2')}
        subtitle={i18nT('profile:components.screens.profile.ProfileWorldMapTab.serym_kuda_esche_ne_dobralis_tsvetom_gde_uzh_b4b218b6')}
        onBack={onBackToOverview}
      />

      <View style={styles.card}>
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{visitedCount}</Text>
            <Text style={styles.metricLabel}>{i18nT('profile:components.screens.profile.ProfileWorldMapTab.posetili_1380bcdf')}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{remainingCount}</Text>
            <Text style={styles.metricLabel}>{i18nT('profile:components.screens.profile.ProfileWorldMapTab.ostalos_ac89d2ac')}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{totalCount}</Text>
            <Text style={styles.metricLabel}>{i18nT('profile:components.screens.profile.ProfileWorldMapTab.vsego_8d74e949')}</Text>
          </View>
        </View>

        <View style={styles.mapWrap}>
          {isLoading ? (
            <SkeletonLoader width="100%" height={isMobile ? 180 : 320} borderRadius={DESIGN_TOKENS.radii.md} />
          ) : (
            renderMap('inline')
          )}
        </View>

        {!isLoading ? (
          <Text style={styles.hint}>
            {isMobile
              ? i18nT('profile:components.screens.profile.ProfileWorldMapTab.dvumya_paltsami_masshtab_peretaskivanie_sdvi_ab64f87b')
              : i18nT('profile:components.screens.profile.ProfileWorldMapTab.koleso_masshtab_peretaskivanie_sdvig_klik_po_e0db776f')}
          </Text>
        ) : null}

        {selected ? (
          <View ref={infoCardRef} style={styles.infoCard}>
            <View style={styles.infoTitleRow}>
              <Text style={styles.infoName} numberOfLines={1}>
                {selected.name}
              </Text>
              <Pressable
                onPress={() => setSelectedCode(null)}
                accessibilityRole="button"
                accessibilityLabel={i18nT('profile:components.screens.profile.ProfileWorldMapTab.zakryt_62507eb9')}
                hitSlop={8}
                style={styles.infoClose}
              >
                <Feather name="x" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>
            {selected.visited ? (
              <Text style={styles.infoMeta}>
                {i18nT('profile:components.screens.profile.ProfileWorldMapTab.posescheno_cc5df481')}{selected.visitedTravelsCount > 0
                  ? ` · ${formatRoutesLabel(selected.visitedTravelsCount)}`
                  : ''}
                {selected.firstVisitedDate
                  ? i18nT('profile:components.screens.profile.ProfileWorldMapTab.s_value1_ffc67c78', { value1: selected.firstVisitedDate.slice(0, 4) })
                  : ''}
              </Text>
            ) : (
              <Text style={styles.infoMeta}>{i18nT('profile:components.screens.profile.ProfileWorldMapTab.esche_ne_posescheno_e8d56073')}</Text>
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
              <Text style={styles.emptyTravels}>{i18nT('profile:components.screens.profile.ProfileWorldMapTab.net_marshrutov_v_etoy_strane_0d2e3533')}</Text>
            )}
          </View>
        ) : null}

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: colors.primary }]} />
            <Text style={styles.legendText}>
              {i18nT('profile:components.screens.profile.ProfileWorldMapTab.posescheno_c0485db4')}{formatCountriesLabel(visitedCount)}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: getWorldMapUnvisitedFill(isDark), borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]} />
            <Text style={styles.legendText}>{i18nT('profile:components.screens.profile.ProfileWorldMapTab.ne_posescheno_2882e15a')}</Text>
          </View>
        </View>
      </View>

      <Modal
        visible={isMapFullscreen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeMapFullscreen}
      >
        <SafeAreaView style={styles.fullscreenRoot}>
          <View style={styles.fullscreenHeader}>
            <Text style={styles.fullscreenTitle} numberOfLines={1}>
              {i18nT('profile:components.screens.profile.ProfileWorldMapTab.karta_mira_562a96c2')}</Text>
            <Pressable
              onPress={closeMapFullscreen}
              accessibilityRole="button"
              accessibilityLabel={i18nT('profile:components.screens.profile.ProfileWorldMapTab.zakryt_polnoekrannuyu_kartu_5b8e0903')}
              hitSlop={8}
              style={styles.fullscreenCloseButton}
            >
              <Feather name="x" size={22} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.fullscreenBody}>
            <View style={styles.fullscreenMapFrame}>
              <View style={styles.fullscreenMapWrap}>{isLoading ? null : renderMap('fullscreen')}</View>
            </View>
            {selected ? (
              <View style={[styles.infoCard, styles.fullscreenInfo]}>
                <View style={styles.infoTitleRow}>
                  <Text style={styles.infoName} numberOfLines={1}>
                    {selected.name}
                  </Text>
                  <Pressable
                    onPress={() => setSelectedCode(null)}
                    accessibilityRole="button"
                    accessibilityLabel={i18nT('profile:components.screens.profile.ProfileWorldMapTab.zakryt_62507eb9')}
                    hitSlop={8}
                    style={styles.infoClose}
                  >
                    <Feather name="x" size={16} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <Text style={styles.infoMeta}>
                  {selected.visited
                    ? i18nT('profile:components.screens.profile.ProfileWorldMapTab.posescheno_value1_value2_13f06767', { value1: selected.visitedTravelsCount > 0
                          ? ` · ${formatRoutesLabel(selected.visitedTravelsCount)}`
                          : '', value2: selected.firstVisitedDate
                          ? i18nT('profile:components.screens.profile.ProfileWorldMapTab.sinceYearSuffix', { value1: selected.firstVisitedDate.slice(0, 4) })
                          : '' })
                    : i18nT('profile:components.screens.profile.ProfileWorldMapTab.esche_ne_posescheno_e8d56073')}
                </Text>

                {selected.travels.length > 0 ? (
                  <View style={styles.travelsList}>
                    <CountryTravelsPanel
                      travels={selected.travels}
                      isMobile={isMobile}
                      onOpenTravel={openTravel}
                      onShowAll={onBackToOverview}
                    />
                  </View>
                ) : selected.visited ? (
                  <Text style={styles.emptyTravels}>{i18nT('profile:components.screens.profile.ProfileWorldMapTab.net_marshrutov_v_etoy_strane_0d2e3533')}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  )
}

export default ProfileWorldMapTab
