import React, { memo, useMemo, type ReactElement } from 'react'
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native'

import TravelListItemSkeleton from '@/components/listTravel/TravelListItemSkeleton'
import {
  AuthorSectionSkeleton,
  CommentsSkeleton,
  FooterSectionSkeleton,
  MapSectionSkeleton,
  RatingSectionSkeleton,
} from '@/components/travel/TravelDetailSkeletons'
import { TRAVEL_DETAILS_FOOTER_RESERVE_HEIGHT } from '@/components/travel/details/TravelDetailsDeferredTransition'
import { createTravelDetailsSectionHeaderStyles } from '@/components/travel/details/styles/travelDetailsSectionHeaderStyles'
import { createTravelTmlRoundStyles, TRAVEL_TML_ROUND_IMAGE_HEIGHT } from '@/components/travel/TravelTmlRound.styles'
import { getTravelDetailsListColumnWidth } from '@/components/travel/utils/travelDetailsListLayout'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { METRICS } from '@/constants/layout'
import { getNearbyTravelsSubtitle } from '@/constants/nearby'
import { useResponsiveWidth } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { translate as i18nT } from '@/i18n'

// #2367: геометрия ряда «Рядом» — колонки, слот, зазор, отступы — и каркасы
// сайдбара и отложенных секций, которые её повторяют. Модуль импортируют только
// ленивые travel-чанки (TravelDetailsPostLcpRuntime, TravelDetailsDeferred,
// NearTravelList), а не `TravelDetailSkeletons`/`TravelDetailsDeferredTransition`:
// те лежат в общем чанке всех HTML-маршрутов (ROUTE-BUNDLE-001); здесь же каркас
// отложенных секций — один async-чанк на троих, а не вес в PostLcpRuntime. `CardRail` и `SegmentedControl`
// сюда не тянутся — каркас повторяет их коробки простыми View, совпадение держит
// NearTravelList.sidebarSkeleton.dom.web.test.

const MOBILE_RAIL_CARD_MAX_WIDTH = 340
// Вертикальный отступ ряда под тени и фокус-кольцо карточек.
export const NEAR_RAIL_PADDING_VERTICAL = 4

export function useNearTravelRailLayout() {
  const { width } = useWindowDimensions()
  return useMemo(() => {
    const isMobile = width < METRICS.breakpoints.tablet
    const numColumns = isMobile ? 1 : width < METRICS.breakpoints.largeTablet ? 2 : 3
    const isWebGrid = Platform.OS === 'web' && !isMobile
    const gap = isMobile ? 12 : DESIGN_TOKENS.spacing.md
    // Web: колонка — доля ширины ряда; телефон и native — фиксированный слот.
    const slotWidth = isWebGrid
      ? undefined
      : isMobile
        ? Math.round(Math.min(width * 0.8, MOBILE_RAIL_CARD_MAX_WIDTH))
        : getTravelDetailsListColumnWidth(width, numColumns)
    const contentStyle = isWebGrid
      ? ({
        width: '100%',
        display: 'grid',
        gridAutoFlow: 'column',
        gridAutoColumns: `calc((100% - ${gap * (numColumns - 1)}px) / ${numColumns})`,
        alignItems: 'stretch',
      } as object)
      : undefined
    return { width, isMobile, numColumns, gap, slotWidth, contentStyle }
  }, [width])
}

export type NearTravelRailLayout = ReturnType<typeof useNearTravelRailLayout>

export const nearTravelRailStyles = StyleSheet.create({
  // Боковой отступ ряда снаружи прокрутки: внутри неё snap съедал бы его.
  listColumn: { width: '100%', paddingHorizontal: 8 },
  mobileListContent: { paddingBottom: DESIGN_TOKENS.spacing.lg },
  mapColumn: { width: '100%', minHeight: 300, overflow: 'visible' },
  railCard: { flex: 1, minWidth: 0 },
  railSlot: {
    minWidth: 0,
    ...Platform.select({
      web: { scrollSnapAlign: 'start' } as object,
      default: {},
    }),
  },
})

export const useNearTravelRailSlotStyle = (layout: NearTravelRailLayout) =>
  useMemo(
    () => [nearTravelRailStyles.railSlot, layout.slotWidth != null ? { width: layout.slotWidth } : null],
    [layout.slotWidth],
  )

// Каркас TravelTmlRound (#2253): та же обёртка фиксированной высоты, рамка и
// медиа `TRAVEL_TML_ROUND_IMAGE_HEIGHT`; граф карточки (действия, шаринг) сюда
// не тянется. Один компонент на ряд «Рядом» и native «Популярные» сайдбара.
export const TravelTmlRoundSkeleton = memo(function TravelTmlRoundSkeleton({
  testID = 'travel-tml-round-skeleton',
}: { testID?: string }) {
  const colors = useThemedColors()
  const styles = useMemo(() => createTravelTmlRoundStyles(colors), [colors])
  return (
    <View style={styles.container} testID={testID} aria-hidden>
      <View style={[styles.card, styles.skeletonCard]}>
        <SkeletonLoader width="100%" height={TRAVEL_TML_ROUND_IMAGE_HEIGHT} borderRadius={0} />
      </View>
    </View>
  )
})

export const nearTravelSkeletonSlots = (layout: NearTravelRailLayout): ReactElement[] =>
  Array.from({ length: layout.numColumns }, (_, i) => (
    layout.isMobile
      ? <TravelTmlRoundSkeleton key={`skeleton-${i}`} />
      : <View key={`skeleton-${i}`} style={nearTravelRailStyles.railCard}><TravelListItemSkeleton /></View>
  ))

// Коробка `SegmentedControl` в NearTravelList: телефон — compact, иначе обычный
// (поля 0/12 × 4/8, padding 1/2, рамка 1, сегмент minHeight 44).
const skeletonStyles = StyleSheet.create({
  toggle: { borderWidth: 1, borderRadius: 12, marginHorizontal: 12, marginVertical: 8, padding: 2 },
  toggleCompact: { borderWidth: 1, borderRadius: 12, marginHorizontal: 0, marginVertical: 4, padding: 1 },
  toggleSegment: { minHeight: 44 },
  rail: { position: 'relative', width: '100%', overflow: 'hidden' },
  railContent: { flexDirection: 'row', paddingHorizontal: 0, paddingVertical: NEAR_RAIL_PADDING_VERTICAL },
  sidebarContainer: { width: '100%', gap: DESIGN_TOKENS.spacing.xl },
  sidebarSection: { width: '100%', gap: DESIGN_TOKENS.spacing.sm },
  sidebarWebSection: { width: '100%' },
  sidebarCardContent: { marginTop: 8 },
  sidebarIconPlaceholder: { width: 18, height: 18, flexShrink: 0 },
  sidebarDecorativeText: { color: 'transparent' },
})

/**
 * Каркас «Рядом» для сайдбара до монтирования секции: строка «Список/Карта» и
 * ряд каркасов карточек той же геометрии, что `NearTravelList`. Декоративный —
 * без фокуса и вне дерева доступности.
 */
export const NearTravelListSkeleton = memo(function NearTravelListSkeleton({
  canShowMapMode = false,
}: { canShowMapMode?: boolean }) {
  const layout = useNearTravelRailLayout()
  const colors = useThemedColors()
  const slotStyle = useNearTravelRailSlotStyle(layout)
  const toggleStyle = useMemo(
    () => [
      layout.isMobile ? skeletonStyles.toggleCompact : skeletonStyles.toggle,
      { borderColor: colors.borderLight, backgroundColor: colors.backgroundSecondary },
    ],
    [colors.backgroundSecondary, colors.borderLight, layout.isMobile],
  )
  const contentStyle = useMemo(
    () => [skeletonStyles.railContent, { gap: layout.gap }, layout.contentStyle],
    [layout.contentStyle, layout.gap],
  )
  return (
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {canShowMapMode && <View style={toggleStyle} testID="near-travel-toggle-skeleton">
        <View style={skeletonStyles.toggleSegment} />
      </View>}
      <View style={layout.isMobile ? nearTravelRailStyles.mobileListContent : nearTravelRailStyles.listColumn}>
        <View style={skeletonStyles.rail} testID="near-travel-rail">
          <View style={contentStyle}>
            {nearTravelSkeletonSlots(layout).map((card) => (
              <View key={card.key} style={slotStyle} testID="near-travel-rail-slot">
                {card}
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  )
})

const SidebarRoundCardSkeleton = () => <TravelTmlRoundSkeleton testID="travel-sidebar-round-card-skeleton" />

export const PopularTravelListSkeleton = memo(function PopularTravelListSkeleton() {
  const layout = useNearTravelRailLayout()
  const slotStyle = useNearTravelRailSlotStyle(layout)
  return (
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={layout.isMobile ? nearTravelRailStyles.mobileListContent : nearTravelRailStyles.listColumn}>
      <View style={skeletonStyles.rail} testID="popular-travel-rail">
        <View style={[skeletonStyles.railContent, { gap: layout.gap }, layout.contentStyle]}>
          {Array.from({ length: layout.numColumns }, (_, i) => (
            <View key={i} style={slotStyle} testID="popular-travel-rail-slot">
              <TravelListItemSkeleton />
            </View>
          ))}
        </View>
      </View>
    </View>
  )
})

export const SidebarSectionSkeleton = ({ canShowMapMode = false }: { canShowMapMode?: boolean }) => {
  const width = useResponsiveWidth()
  const colors = useThemedColors()
  const headers = useMemo(() => createTravelDetailsSectionHeaderStyles(colors), [colors])
  const isNearMobile = width < METRICS.breakpoints.tablet
  if (Platform.OS !== 'web') {
    return (
      <View style={skeletonStyles.sidebarContainer}>
        <View style={skeletonStyles.sidebarSection} testID="travel-sidebar-near-skeleton">
          <SkeletonLoader width={220} height={26} borderRadius={8} />
          <SkeletonLoader width="52%" height={18} borderRadius={6} />
          {isNearMobile ? <SidebarRoundCardSkeleton /> : <TravelListItemSkeleton />}
        </View>
        <View style={skeletonStyles.sidebarSection} testID="travel-sidebar-popular-skeleton">
          <SkeletonLoader width={210} height={26} borderRadius={8} />
          <SkeletonLoader width="58%" height={18} borderRadius={6} />
          <SidebarRoundCardSkeleton />
        </View>
      </View>
    )
  }
  // Real strings with real lightweight typography preserve natural wrapping;
  // these decorative headers announce no duplicate content to screen readers.
  const header = (kind: 'near' | 'popular', title: string, subtitle: string) => (
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={headers.sectionHeaderRow}>
        <View style={[skeletonStyles.sidebarIconPlaceholder, { backgroundColor: colors.borderLight }]} />
        <Text testID={`travel-sidebar-${kind}-skeleton-title`}
          style={[headers.sectionHeaderText, skeletonStyles.sidebarDecorativeText, { backgroundColor: colors.borderLight }]}>{title}</Text>
      </View>
      <Text testID={`travel-sidebar-${kind}-skeleton-subtitle`}
        style={[headers.sectionSubtitle, skeletonStyles.sidebarDecorativeText, { backgroundColor: colors.borderLight }]}>{subtitle}</Text>
    </View>
  )
  return (
    <View style={skeletonStyles.sidebarContainer}>
      <View style={skeletonStyles.sidebarWebSection} testID="travel-sidebar-near-skeleton">
        {header('near', i18nT('travel:components.travel.details.sections.TravelDetailsSidebarSection.ryadom_mozhno_posmotret_3f015f94'), getNearbyTravelsSubtitle())}
        <View style={skeletonStyles.sidebarCardContent}>
          <NearTravelListSkeleton canShowMapMode={canShowMapMode} />
        </View>
      </View>
      <View style={skeletonStyles.sidebarWebSection} testID="travel-sidebar-popular-skeleton">
        {header('popular', i18nT('travel:components.travel.details.sections.TravelDetailsSidebarSection.populyarnye_marshruty_e9bc8e8c'), i18nT('travel:components.travel.details.sections.TravelDetailsSidebarSection.samye_prosmatrivaemye_napravleniya_za_nedely_e8d2c61d'))}
        <View style={skeletonStyles.sidebarCardContent}>
          <PopularTravelListSkeleton />
        </View>
      </View>
    </View>
  )
}

export function TravelDetailsDeferredSectionsSkeleton({ isMobile, canShowMapMode = false }: { isMobile: boolean; canShowMapMode?: boolean }) {
  return (
    <>
      <View>{isMobile ? <AuthorSectionSkeleton /> : null}</View>
      <View>
        <RatingSectionSkeleton />
      </View>
      <View>
        <MapSectionSkeleton />
      </View>
      <View>
        <SidebarSectionSkeleton canShowMapMode={canShowMapMode} />
      </View>
      <View>
        <CommentsSkeleton />
      </View>
      <View style={{ minHeight: TRAVEL_DETAILS_FOOTER_RESERVE_HEIGHT } as never}>
        <FooterSectionSkeleton isMobile={isMobile} />
      </View>
    </>
  )
}
