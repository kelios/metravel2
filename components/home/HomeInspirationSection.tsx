import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import Feather from '@expo/vector-icons/Feather'

import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'
import { sendAnalyticsEvent } from '@/utils/analytics'
import RenderTravelItem from '@/components/listTravel/RenderTravelItem'
import CardRail from '@/components/ui/CardRail'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import Button from '@/components/ui/Button'
import ErrorDisplay from '@/components/ui/ErrorDisplay'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { queryConfigs } from '@/utils/reactQueryConfig'
import { createSectionStyles } from './homeInspirationStyles'
import { translate as i18nT } from '@/i18n'
import { getUserFriendlyError } from '@/utils/userFriendlyErrors'


type Styles = ReturnType<typeof createSectionStyles>

interface HomeSectionProps {
  title: string
  titleAccent?: string
  subtitle?: string
  queryKey: string
  fetchFn: (options?: { signal?: AbortSignal }) => Promise<any>
  hideAuthor?: boolean
  fixedCount?: number
  layout?: 'editorial' | 'rail'
}

const IS_WEB = Platform.OS === 'web'
const NAV_FEEDBACK_MS = 700

const EMPTY_STATE_TEXT: Record<string, { title: string; subtitle: string }> = {
  'home-travels-of-month': {
    get title() { return i18nT('homeStatic:components.home.HomeInspirationSection.novaya_podborka_uzhe_v_puti_dfbafc73') },
    get subtitle() { return i18nT('homeStatic:components.home.HomeInspirationSection.skoro_dobavim_svezhie_idei_dlya_blizhayshih__09439763') },
  },
  'home-popular-travels': {
    get title() { return i18nT('homeStatic:components.home.HomeInspirationSection.esche_malo_dannyh_po_populyarnosti_e2389d04') },
    get subtitle() { return i18nT('homeStatic:components.home.HomeInspirationSection.otkroyte_katalog_i_vyberite_marshrut_po_filt_ab31f38d') },
  },
  'home-new-travels': {
    get title() { return i18nT('homeStatic:components.home.HomeInspirationSection.svezhie_marshruty_v_puti_967363eb') },
    get subtitle() { return i18nT('homeStatic:components.home.HomeInspirationSection.zaglyanite_v_katalog_tam_uzhe_est_gotovye_id_9a0dc772') },
  },
  'home-random-travels': {
    get title() { return i18nT('homeStatic:components.home.HomeInspirationSection.sluchaynaya_ideya_poka_ne_zagruzilas_65bc0861') },
    get subtitle() { return i18nT('homeStatic:components.home.HomeInspirationSection.poprobuyte_katalog_ili_vernites_k_podborke_c_4e3fe0f1') },
  },
}

const SECTION_BADGES: Record<string, string> = {
  get 'home-travels-of-month'() { return i18nT('homeStatic:inspiration.month') },
  get 'home-random-travels'() { return i18nT('homeStatic:inspiration.random') },
  get 'home-popular-travels'() { return i18nT('homeStatic:inspiration.popular') },
  get 'home-new-travels'() { return i18nT('homeStatic:inspiration.new') },
}

function extractItems(data: any): any[] {
  if (Array.isArray(data)) return data
  if (data?.data && Array.isArray(data.data)) return data.data
  if (data?.results && Array.isArray(data.results)) return data.results
  if (data && typeof data === 'object') {
    return Object.values(data).filter((item) => item && typeof item === 'object')
  }
  return []
}

function getItemKey(item: any, queryKey: string, index: number) {
  if (item?.id != null && String(item.id).length > 0) return String(item.id)
  if (item?.url) return String(item.url)
  return `${queryKey}-${index}`
}

function getEditorialImageHeight(index: number, count: number) {
  if (count <= 2) return 340
  if (count === 3) return index === 0 ? 336 : 296
  return index === 0 ? 316 : 292
}

function getEditorialCardStyle(styles: Styles, index: number, count: number) {
  if (count === 1) return styles.editorialCardHero
  if (count === 2) {
    return index === 0 ? styles.editorialCardHero : styles.editorialCardStackTop
  }
  if (count === 3) {
    if (index === 0) return styles.editorialCardHeroTall
    if (index === 1) return styles.editorialCardStackTop
    return styles.editorialCardStackMiddle
  }
  if (index === 0) return styles.editorialCardHero
  if (index === 1) return styles.editorialCardStackTop
  if (index === 2) return styles.editorialCardStackMiddle
  return styles.editorialCardStackBottom
}

function chunkArray<T>(array: T[], columns: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < array.length; i += columns) result.push(array.slice(i, i + columns))
  return result
}

const separatorStyles = StyleSheet.create({
  separator: { height: 20 },
})

function buildEmptyPillStyle(colors: ThemedColors) {
  return {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryAlpha30,
  } as const
}

function buildEmptyPillTextStyle(colors: ThemedColors) {
  return {
    color: colors.primaryText,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  }
}

export function HomeInspirationSection({
  title,
  titleAccent,
  subtitle,
  queryKey,
  fetchFn,
  hideAuthor = false,
  fixedCount,
  layout = 'editorial',
}: HomeSectionProps) {
  const router = useRouter()
  const colors = useThemedColors()
  const { isPhone, isLargePhone, width: viewportWidth } = useResponsive()
  const isMobile = isPhone || isLargePhone
  const isRail = layout === 'rail'
  const [openingCatalog, setOpeningCatalog] = useState(false)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isWeekendShowcase = queryKey === 'home-travels-of-month'

  const {
    data: travelData = {},
    error,
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [queryKey],
    queryFn: ({ signal } = {} as any) => fetchFn({ signal }),
    ...queryConfigs.dynamic,
    // Секции главной — lazy-острова: не рефетчим фоново при каждом маунте, если
    // кэш ещё свежий (<staleTime). refetchOnMount из queryConfigs.dynamic (true)
    // здесь даёт лишний запрос на нав-туда-обратно; scoped-override, чтобы не
    // ломать других потребителей dynamic (профиль country-progress).
    refetchOnMount: false,
  })

  const travelsList = useMemo(() => {
    const arr = extractItems(travelData)
    if (fixedCount != null) return arr.slice(0, fixedCount)
    if (isRail) return arr.slice(0, isMobile ? 8 : 10)
    if (isWeekendShowcase) return isMobile ? arr : arr.slice(0, 4)
    return arr.slice(0, isMobile ? 4 : 6)
  }, [travelData, isMobile, isWeekendShowcase, isRail, fixedCount])

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    }
  }, [])

  const handleViewMore = useCallback(() => {
    sendAnalyticsEvent('HomeClick_ViewMore', { section: title })
    setOpeningCatalog(true)
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = setTimeout(() => setOpeningCatalog(false), NAV_FEEDBACK_MS)
    router.push('/search' as any)
  }, [title, router])

  const viewMoreLabel = isMobile ? i18nT('home:components.home.HomeInspirationSection.vse_marshruty_b0e98d06') : i18nT('home:components.home.HomeInspirationSection.smotret_vse_marshruty_b50a25b9')
  const emptyState = EMPTY_STATE_TEXT[queryKey] ?? {
    title: i18nT('home:components.home.HomeInspirationSection.poka_zdes_pusto_79cbcf37'),
    subtitle: i18nT('home:components.home.HomeInspirationSection.poprobuyte_otkryt_katalog_marshrutov_053c11a6'),
  }
  const sectionBadge = SECTION_BADGES[queryKey]

  const styles = useMemo(() => createSectionStyles(colors, isMobile), [colors, isMobile])
  const isDesktopEditorial = IS_WEB && !isMobile && !isRail
  const railCardWidth = isMobile ? Math.min(Math.round(viewportWidth * 0.78), 320) : 300
  const shouldUseThreeColumnRow =
    IS_WEB && !isMobile && queryKey === 'home-random-travels' && travelsList.length === 3

  const renderViewMoreButton = (extraStyle?: any) => (
    <Button
      label={viewMoreLabel}
      onPress={handleViewMore}
      accessibilityLabel={i18nT('home:components.home.HomeInspirationSection.otkryt_katalog_marshrutov_dlya_sektsii_value_43809a8e', { value1: title })}
      loading={openingCatalog}
      icon={<Feather name="arrow-right" size={16} color={colors.text} />}
      iconPosition="right"
      variant="secondary"
      style={[styles.viewMoreButton, isMobile && styles.viewMoreButtonMobile, extraStyle]}
      labelStyle={styles.viewMoreText}
      hoverStyle={styles.viewMoreButtonHover}
      pressedStyle={styles.viewMoreButtonHover}
    />
  )

  if (isLoading) {
    return (
      <View style={[styles.section, isMobile && styles.sectionMobile]}>
        <View
          style={[styles.sectionFrame, isWeekendShowcase && styles.showcaseSectionFrame]}
        >
          <LoadingSkeleton
            styles={styles}
            isMobile={isMobile}
            isDesktopEditorial={isDesktopEditorial}
          />
        </View>
      </View>
    )
  }

  if (isError) {
    return (
      <View style={[styles.section, isMobile && styles.sectionMobile]}>
        <View style={[styles.sectionFrame, isWeekendShowcase && styles.showcaseSectionFrame]}>
          <ErrorDisplay
            title={i18nT('home:components.home.HomeInspirationSection.ne_udalos_zagruzit_podborku_520d6c7c')}
            message={getUserFriendlyError(error)}
            onRetry={() => {
              void refetch()
            }}
            variant="warning"
            showContact={false}
          />
          <View style={styles.errorFallbackActions}>
            <Button
              label={isFetching ? i18nT('home:components.home.HomeInspirationSection.obnovlyaem_95ce25b5') : i18nT('home:components.home.HomeInspirationSection.otkryt_katalog_2dac5825')}
              onPress={handleViewMore}
              accessibilityLabel={i18nT('home:components.home.HomeInspirationSection.otkryt_katalog_marshrutov_bez_etoy_podborki_fdd3388b')}
              icon={<Feather name="compass" size={16} color={colors.text} />}
              variant="secondary"
              loading={openingCatalog}
              style={[styles.viewMoreButton, isMobile && styles.viewMoreButtonMobile]}
              labelStyle={styles.viewMoreText}
              hoverStyle={styles.viewMoreButtonHover}
              pressedStyle={styles.viewMoreButtonHover}
            />
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.section, isMobile && styles.sectionMobile]}>
      <View style={[styles.sectionFrame, isWeekendShowcase && styles.showcaseSectionFrame]}>
        <View style={[styles.heroHeader, { marginBottom: isMobile ? 20 : 32 }]}>
          {sectionBadge && (
            <View style={styles.sectionBadge}>
              <Feather
                name="star"
                size={12}
                color={colors.textMuted}
                {...({ 'aria-hidden': true, focusable: false } as any)}
              />
              <Text style={styles.sectionBadgeText}>{sectionBadge}</Text>
            </View>
          )}
          <View
            style={{ alignItems: 'center', gap: isMobile ? 6 : 10 }}
            accessibilityRole="header"
            {...({ 'aria-level': 2 } as any)}
          >
            <Text style={styles.heroTitle}>{title}</Text>
            {titleAccent && <Text style={styles.heroTitleAccent}>{titleAccent}</Text>}
          </View>
          {subtitle && <Text style={styles.heroSubtitle}>{subtitle}</Text>}
        </View>

        {travelsList.length === 0 ? (
          <EmptyState
            styles={styles}
            colors={colors}
            queryKey={queryKey}
            emptyState={emptyState}
            renderButton={renderViewMoreButton}
          />
        ) : isRail ? (
          <Rail
            styles={styles}
            items={travelsList}
            queryKey={queryKey}
            isMobile={isMobile}
            hideAuthor={hideAuthor}
            viewportWidth={viewportWidth}
            cardWidth={railCardWidth}
          />
        ) : isMobile ? (
          <MobileBento
            styles={styles}
            items={travelsList}
            queryKey={queryKey}
            isMobile
            hideAuthor={hideAuthor}
            viewportWidth={viewportWidth}
          />
        ) : shouldUseThreeColumnRow ? (
          <ThreeColumn
            styles={styles}
            items={travelsList}
            queryKey={queryKey}
            isMobile={isMobile}
            hideAuthor={hideAuthor}
            viewportWidth={viewportWidth}
          />
        ) : isDesktopEditorial && travelsList.length >= 2 ? (
          <EditorialGrid
            styles={styles}
            items={travelsList}
            queryKey={queryKey}
            isMobile={isMobile}
            hideAuthor={hideAuthor}
            viewportWidth={viewportWidth}
          />
        ) : travelsList.length === 3 ? (
          <TrioGrid
            styles={styles}
            items={travelsList}
            isMobile={isMobile}
            hideAuthor={hideAuthor}
            viewportWidth={viewportWidth}
          />
        ) : (
          <DefaultBento
            styles={styles}
            items={travelsList}
            queryKey={queryKey}
            isMobile={isMobile}
            hideAuthor={hideAuthor}
            viewportWidth={viewportWidth}
          />
        )}

        {travelsList.length > 0 && (
          <View style={[styles.headerActions, { marginTop: isMobile ? 14 : 20 }]}>
            {renderViewMoreButton()}
          </View>
        )}
      </View>
    </View>
  )
}

function LoadingSkeleton({
  styles,
  isMobile,
  isDesktopEditorial,
}: {
  styles: Styles
  isMobile: boolean
  isDesktopEditorial: boolean
}) {
  return (
    <>
      <View style={[styles.showcaseHeader]}>
        <View style={styles.titleContainer}>
          <SkeletonLoader
            width={isMobile ? 80 : 110}
            height={28}
            borderRadius={14}
            style={{ marginBottom: 4 }}
          />
          <SkeletonLoader
            width={isMobile ? 200 : 320}
            height={isMobile ? 28 : 40}
            borderRadius={8}
            style={{ marginBottom: 6 }}
          />
          <SkeletonLoader
            width={isMobile ? 160 : 260}
            height={isMobile ? 14 : 16}
            borderRadius={4}
          />
        </View>
      </View>
      <View style={styles.bentoGrid}>
        {isMobile
          ? Array.from({ length: 2 }, (_, i) => (
              <SkeletonLoader key={i} width="100%" height={260} borderRadius={12} />
            ))
          : isDesktopEditorial
            ? (
                <View style={[styles.editorialGrid, styles.editorialGridFour]}>
                  {[
                    styles.editorialCardHero,
                    styles.editorialCardStackTop,
                    styles.editorialCardStackMiddle,
                    styles.editorialCardStackBottom,
                  ].map((cardStyle, i) => (
                    <View key={i} style={[styles.editorialCard, cardStyle]}>
                      <SkeletonLoader width="100%" height="100%" borderRadius={12} />
                    </View>
                  ))}
                </View>
              )
            : [0, 1].map((rowIdx) => {
                const wideFirst = rowIdx % 2 === 0
                return (
                  <View key={rowIdx} style={styles.bentoRow}>
                    <View style={wideFirst ? styles.bentoCardWide : styles.bentoCardNarrow}>
                      <SkeletonLoader width="100%" height={340} borderRadius={12} />
                    </View>
                    <View style={wideFirst ? styles.bentoCardNarrow : styles.bentoCardWide}>
                      <SkeletonLoader width="100%" height={340} borderRadius={12} />
                    </View>
                  </View>
                )
              })}
      </View>
    </>
  )
}

function EmptyState({
  styles,
  colors,
  queryKey,
  emptyState,
  renderButton,
}: {
  styles: Styles
  colors: ThemedColors
  queryKey: string
  emptyState: { title: string; subtitle: string }
  renderButton: () => React.ReactNode
}) {
  return (
    <View style={styles.emptyState} testID={`home-empty-${queryKey}`}>
      <View
        style={styles.emptyStateIconWrap}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        {...({ 'aria-hidden': true } as any)}
      >
        <Feather name="compass" size={22} color={colors.primaryDark} focusable={false as any} />
      </View>
      <View style={buildEmptyPillStyle(colors)}>
        <Text style={buildEmptyPillTextStyle(colors)}>{i18nT('home:components.home.HomeInspirationSection.poka_bez_sovpadeniy_6a4a2ee3')}</Text>
      </View>
      <Text style={[styles.emptyStateTitle, { textAlign: 'center' }]}>
        {emptyState.title}
      </Text>
      <Text style={[styles.emptyStateSubtitle, { textAlign: 'center' }]}>
        {emptyState.subtitle}
      </Text>
      {renderButton()}
    </View>
  )
}

type GridListProps = {
  styles: Styles
  items: any[]
  queryKey: string
  isMobile: boolean
  hideAuthor: boolean
  viewportWidth: number
}

function MobileBento({
  styles,
  items,
  queryKey,
  isMobile,
  hideAuthor,
  viewportWidth,
}: GridListProps) {
  return (
    <View style={styles.bentoGrid}>
      {items.map((item: any, index: number) => (
        <React.Fragment key={getItemKey(item, queryKey, index)}>
          {index > 0 && <View style={separatorStyles.separator} />}
          <View style={styles.bentoCardWide}>
            <RenderTravelItem
              item={item}
              index={index}
              isMobile={isMobile}
              hideAuthor={hideAuthor}
              viewportWidth={viewportWidth}
              visualVariant="home-featured"
            />
          </View>
        </React.Fragment>
      ))}
    </View>
  )
}

function Rail({
  styles,
  items,
  queryKey,
  isMobile,
  hideAuthor,
  viewportWidth,
  cardWidth,
}: GridListProps & { cardWidth: number }) {
  return (
    <CardRail gap={isMobile ? 12 : 16} contentPaddingHorizontal={isMobile ? 0 : 2}>
      {items.map((item: any, index: number) => (
        <View key={getItemKey(item, queryKey, index)} style={[styles.railCard, { width: cardWidth }]}>
          <RenderTravelItem
            item={item}
            index={index}
            isMobile={isMobile}
            imageHeight={isMobile ? 200 : 210}
            hideAuthor={hideAuthor}
            viewportWidth={viewportWidth}
            visualVariant="home-featured"
          />
        </View>
      ))}
    </CardRail>
  )
}

function ThreeColumn({
  styles,
  items,
  queryKey,
  isMobile,
  hideAuthor,
  viewportWidth,
}: GridListProps) {
  return (
    <View style={styles.threeColumnGrid}>
      {items.map((item: any, index: number) => (
        <View key={getItemKey(item, queryKey, index)} style={styles.threeColumnCard}>
          <RenderTravelItem
            item={item}
            index={index}
            isMobile={isMobile}
            hideAuthor={hideAuthor}
            viewportWidth={viewportWidth}
            visualVariant="home-featured"
          />
        </View>
      ))}
    </View>
  )
}

function EditorialGrid({
  styles,
  items,
  queryKey,
  isMobile,
  hideAuthor,
  viewportWidth,
}: GridListProps) {
  const visibleCount = Math.min(items.length, 4)
  return (
    <View
      style={[
        styles.editorialGrid,
        items.length === 3 ? styles.editorialGridThree : styles.editorialGridFour,
      ]}
    >
      {items.slice(0, 4).map((item: any, index: number) => (
        <View
          key={getItemKey(item, queryKey, index)}
          style={[styles.editorialCard, getEditorialCardStyle(styles, index, visibleCount)]}
        >
          <RenderTravelItem
            item={item}
            index={index}
            isMobile={isMobile}
            imageHeight={getEditorialImageHeight(index, visibleCount)}
            hideAuthor={hideAuthor}
            viewportWidth={viewportWidth}
            visualVariant="home-featured"
          />
        </View>
      ))}
    </View>
  )
}

function TrioGrid({
  styles,
  items,
  isMobile,
  hideAuthor,
  viewportWidth,
}: Omit<GridListProps, 'queryKey'>) {
  return (
    <View style={styles.trioGrid}>
      <View style={styles.trioCardTop}>
        <RenderTravelItem
          item={items[0]}
          index={0}
          isMobile={isMobile}
          hideAuthor={hideAuthor}
          viewportWidth={viewportWidth}
          visualVariant="home-featured"
        />
      </View>
      <View style={styles.trioBottomRow}>
        {[1, 2].map((i) => (
          <View key={i} style={styles.trioCardBottom}>
            <RenderTravelItem
              item={items[i]}
              index={i}
              isMobile={isMobile}
              hideAuthor={hideAuthor}
              viewportWidth={viewportWidth}
              visualVariant="home-featured"
            />
          </View>
        ))}
      </View>
    </View>
  )
}

function BentoSlot({
  item,
  index,
  wide,
  styles,
  isMobile,
  hideAuthor,
  viewportWidth,
}: {
  item: any | null
  index: number
  wide: boolean
  styles: Styles
  isMobile: boolean
  hideAuthor: boolean
  viewportWidth: number
}) {
  const slotStyle = wide ? styles.bentoCardWide : styles.bentoCardNarrow
  if (!item) {
    return (
      <View
        style={[slotStyle, styles.cardWrapperPlaceholder]}
        aria-hidden={IS_WEB ? true : undefined}
        importantForAccessibility="no-hide-descendants"
      />
    )
  }
  return (
    <View style={slotStyle}>
      <RenderTravelItem
        item={item}
        index={index}
        isMobile={isMobile}
        hideAuthor={hideAuthor}
        viewportWidth={viewportWidth}
        visualVariant="home-featured"
      />
    </View>
  )
}

function DefaultBento({
  styles,
  items,
  queryKey,
  isMobile,
  hideAuthor,
  viewportWidth,
}: GridListProps) {
  return (
    <View style={styles.bentoGrid}>
      {chunkArray(items, 2).map((pair, rowIdx) => {
        const wideFirst = rowIdx % 2 === 0
        return (
          <View key={`${queryKey}-row-${rowIdx}`} style={styles.bentoRow}>
            <BentoSlot
              item={pair[0] ?? null}
              index={rowIdx * 2}
              wide={wideFirst}
              styles={styles}
              isMobile={isMobile}
              hideAuthor={hideAuthor}
              viewportWidth={viewportWidth}
            />
            <BentoSlot
              item={pair[1] ?? null}
              index={rowIdx * 2 + 1}
              wide={!wideFirst}
              styles={styles}
              isMobile={isMobile}
              hideAuthor={hideAuthor}
              viewportWidth={viewportWidth}
            />
          </View>
        )
      })}
    </View>
  )
}
