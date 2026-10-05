import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Text, View, type LayoutChangeEvent } from 'react-native'
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
import {
  SHOWCASE_EXPECTED_ITEMS,
  chunkArray,
  getShowcaseCardCount,
  getShowcaseCardWidth,
  getShowcaseColumns,
} from './homeShowcaseGrid'
import { translate as i18nT } from '@/i18n'
import { getUserFriendlyError } from '@/utils/userFriendlyErrors'
import { isPhoneLayout } from '@/utils/phoneLayout'


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
  enabled?: boolean
}

const IS_WEB = Platform.OS === 'web'
const NAV_FEEDBACK_MS = 700
// Рельса на мобильной ширине: карточка = измеренная ширина рельсы минус peek.
const RAIL_PEEK_WIDTH = 44
const RAIL_CARD_MIN_WIDTH = 240
const RAIL_CARD_MAX_WIDTH = 320

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

// Сколько карточек показывает рельса. На телефоне карточка занимает почти всю
// ширину, поэтому «сколько в подборке» = «сколько свайпов подряд»: восемь
// карточек «Популярного» читались как каталог, а не как подборка (отзыв
// TestFlight 1.0.5 (8): «Слишком много популярных нам точно столько нужно?»).
// Пять — это топ, который пролистывается парой инерционных свайпов; за большим
// под рельсой стоит кнопка «Все маршруты».
const RAIL_COUNT_DESKTOP = 10
const RAIL_COUNT_MOBILE = 8
const RAIL_COUNT_MOBILE_BY_SECTION: Record<string, number> = {
  'home-popular-travels': 5,
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
  enabled = true,
}: HomeSectionProps) {
  const router = useRouter()
  const colors = useThemedColors()
  const { isPhone, isLargePhone, width: viewportWidth } = useResponsive()
  const isMobile = isPhoneLayout({ width: viewportWidth, isPhone, isLargePhone })
  const isRail = layout === 'rail'
  const showcaseColumns = getShowcaseColumns(viewportWidth)
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
    enabled,
  })

  const travelsList = useMemo(() => {
    const arr = extractItems(travelData)
    if (fixedCount != null) return arr.slice(0, fixedCount)
    if (isRail) {
      const railCount = isMobile
        ? (RAIL_COUNT_MOBILE_BY_SECTION[queryKey] ?? RAIL_COUNT_MOBILE)
        : RAIL_COUNT_DESKTOP
      return arr.slice(0, railCount)
    }
    return arr.slice(0, getShowcaseCardCount(arr.length, showcaseColumns))
  }, [travelData, isMobile, isRail, fixedCount, queryKey, showcaseColumns])

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
  const railCardWidth = isMobile ? Math.min(Math.round(viewportWidth * 0.78), 320) : 300

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
            isRail={isRail}
            columns={showcaseColumns}
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
          {/* На мобиле бейдж дублировал заголовок слово в слово («НОВИНКИ» над
              «Новые маршруты», «ПОПУЛЯРНОЕ» над «Популярное у путешественников»)
              и вместе с крупным заголовком съедал экран до первой карточки —
              отзыв TestFlight 1.0.5 (8). На десктопе места хватает, бейдж остаётся. */}
          {sectionBadge && !isMobile && (
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
        ) : (
          <ShowcaseGrid
            styles={styles}
            items={travelsList}
            columns={showcaseColumns}
            getKey={(item, index) => getItemKey(item, queryKey, index)}
            renderItem={(item, index) => (
              <RenderTravelItem
                item={item}
                index={index}
                isMobile={isMobile}
                // На native `cardWidth` задаёт карточке фиксированную ширину,
                // а оценка сверху шире ячейки — там ширину даёт flex-ячейка.
                cardWidth={
                  IS_WEB && showcaseColumns > 1
                    ? getShowcaseCardWidth(showcaseColumns, viewportWidth)
                    : undefined
                }
                hideAuthor={hideAuthor}
                viewportWidth={viewportWidth}
                visualVariant="home-featured"
                mediaLoading="lazy"
              />
            )}
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
  isRail,
  columns,
}: {
  styles: Styles
  isMobile: boolean
  isRail: boolean
  columns: number
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
      {isRail ? (
        <RailSkeleton styles={styles} isMobile={isMobile} />
      ) : (
        <ShowcaseGrid
          styles={styles}
          items={Array.from(
            { length: getShowcaseCardCount(SHOWCASE_EXPECTED_ITEMS, columns) },
            (_, i) => i,
          )}
          columns={columns}
          getKey={(slot) => `skeleton-${slot}`}
          renderItem={() => (
            <View testID="home-showcase-skeleton-slot">
              <View style={styles.showcaseSkeletonMedia}>
                <SkeletonLoader width="100%" height="100%" borderRadius={12} />
              </View>
              <SkeletonLoader width="100%" height={77} borderRadius={8} style={{ marginTop: 8 }} />
            </View>
          )}
        />
      )}
    </>
  )
}

function RailSkeleton({ styles, isMobile }: { styles: Styles; isMobile: boolean }) {
  return (
    <View style={styles.bentoGrid}>
      {isMobile
        ? Array.from({ length: 2 }, (_, i) => (
            <SkeletonLoader key={i} width="100%" height={260} borderRadius={12} />
          ))
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
  )
}

// #2289: ровная сетка витрины. Ячейка `flexBasis: 100/cols %` без роста:
// в полном ряду ячейки поровну ужимаются под gap, неполный ряд (n < cols)
// остаётся шириной колонки и стоит по центру — без onLayout и второго кадра.
function ShowcaseGrid<T>({
  styles,
  items,
  columns,
  getKey,
  renderItem,
}: {
  styles: Styles
  items: T[]
  columns: number
  getKey: (item: T, index: number) => string
  renderItem: (item: T, index: number) => React.ReactNode
}) {
  const cellBasis = useMemo(() => ({ flexBasis: `${100 / columns}%` as const }), [columns])
  return (
    <View
      testID="home-showcase-grid"
      style={[styles.showcaseGrid, columns === 1 && styles.showcaseGridSingleColumn]}
    >
      {chunkArray(items, columns).map((row, rowIdx) => (
        <View key={`row-${rowIdx}`} testID="home-showcase-row" style={styles.showcaseRow}>
          {row.map((item, colIdx) => {
            const index = rowIdx * columns + colIdx
            return (
              <View
                key={getKey(item, index)}
                testID="home-showcase-cell"
                style={[styles.showcaseCardWrapper, cellBasis]}
              >
                {renderItem(item, index)}
              </View>
            )
          })}
        </View>
      ))}
    </View>
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

function Rail({
  styles,
  items,
  queryKey,
  isMobile,
  hideAuthor,
  viewportWidth,
  cardWidth,
}: GridListProps & { cardWidth: number }) {
  // Ширину рельсы меряем, а не считаем от вьюпорта: карточка жила по формуле
  // 78% ОКНА, а лежит внутри секции с отступами (поле страницы + padding рамки).
  // На 402 pt это давало карточку 314 в контентной коробке 330 — она прижималась
  // влево, справа оставалось 14 pt пустоты, следующая карточка не выглядывала, и
  // блок читался как «съехавший» (отзыв TestFlight 1.0.5 (8): «Блок смещен
  // визуально»). От измеренной ширины карточка получает предсказуемый peek.
  const [railWidth, setRailWidth] = useState(0)
  const handleRailLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width)
    setRailWidth((prev) => (prev === next ? prev : next))
  }, [])

  const effectiveCardWidth = useMemo(() => {
    if (!isMobile || railWidth <= 0) return cardWidth
    // 44 = зазор между карточками (12) + видимый край следующей (32): столько
    // нужно, чтобы рельса читалась как рельса, а не как одна кривая карточка.
    return Math.max(RAIL_CARD_MIN_WIDTH, Math.min(RAIL_CARD_MAX_WIDTH, railWidth - RAIL_PEEK_WIDTH))
  }, [cardWidth, isMobile, railWidth])

  return (
    <View onLayout={handleRailLayout}>
      <CardRail gap={isMobile ? 12 : 16} contentPaddingHorizontal={isMobile ? 0 : 2}>
        {items.map((item: any, index: number) => (
          <View key={getItemKey(item, queryKey, index)} style={[styles.railCard, { width: effectiveCardWidth }]}>
            <RenderTravelItem
              item={item}
              index={index}
              isMobile={isMobile}
              cardWidth={effectiveCardWidth}
              hideAuthor={hideAuthor}
              viewportWidth={viewportWidth}
              visualVariant="home-featured"
              mediaLoading="lazy"
            />
          </View>
        ))}
      </CardRail>
    </View>
  )
}
