import React, { useMemo, useCallback } from 'react'
import { View, Text, StyleSheet, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import Feather from '@expo/vector-icons/Feather'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { sendAnalyticsEvent } from '@/utils/analytics'
import RenderTravelItem from '@/components/listTravel/RenderTravelItem'
import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import Button from '@/components/ui/Button'
import ErrorDisplay from '@/components/ui/ErrorDisplay'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { queryConfigs } from '@/utils/reactQueryConfig'
import { createSectionStyles } from './homeInspirationStyles'

interface HomeSectionProps {
  title: string
  titleAccent?: string
  subtitle?: string
  queryKey: string
  fetchFn: (options?: { signal?: AbortSignal }) => Promise<any>
  hideAuthor?: boolean
  fixedCount?: number
}

const EMPTY_STATE_TEXT: Record<string, { title: string; subtitle: string }> = {
  'home-travels-of-month': {
    title: 'Новая подборка уже в пути',
    subtitle: 'Скоро добавим свежие идеи для ближайших выходных.',
  },
  'home-popular-travels': {
    title: 'Ещё мало данных по популярности',
    subtitle: 'Откройте каталог и выберите маршрут по фильтрам.',
  },
  'home-random-travels': {
    title: 'Случайная идея пока не загрузилась',
    subtitle: 'Попробуйте каталог или вернитесь к подборке чуть позже.',
  },
}

const SECTION_BADGES: Record<string, string> = {
  'home-travels-of-month': 'Подборка выходного дня',
  'home-random-travels': 'Быстрый старт',
  'home-popular-travels': 'Популярное',
}

const SECTION_META: Record<string, string> = {
  'home-travels-of-month': '1-2 дня',
  'home-random-travels': 'Спонтанно',
  'home-popular-travels': 'По интересу',
}

export function HomeInspirationSection({
  title,
  titleAccent,
  subtitle,
  queryKey,
  fetchFn,
  hideAuthor = false,
  fixedCount,
}: HomeSectionProps) {
  const router = useRouter()
  const colors = useThemedColors()
  const { isPhone, isLargePhone, width: viewportWidth } = useResponsive()
  const isMobile = isPhone || isLargePhone

  const isWeekendShowcase = queryKey === 'home-travels-of-month'

  const {
    data: travelData = {},
    error,
    isError,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [queryKey],
    queryFn: ({ signal } = {} as any) => fetchFn({ signal }),
    ...queryConfigs.dynamic,
  })

  const travelsList = useMemo(() => {
    // Обработка разных форматов ответа от API
    let arr: any[] = []

    if (Array.isArray(travelData)) {
      arr = travelData
    } else if (travelData?.data && Array.isArray(travelData.data)) {
      arr = travelData.data
    } else if (travelData?.results && Array.isArray(travelData.results)) {
      arr = travelData.results
    } else if (typeof travelData === 'object') {
      // Для TravelsMap формата (ключи - это ID путешествий)
      arr = Object.values(travelData).filter(
        (item) => item && typeof item === 'object',
      )
    }

    const maxItems =
      fixedCount ?? (isWeekendShowcase ? (isMobile ? 2 : 4) : isMobile ? 4 : 6)

    return arr.slice(0, maxItems)
  }, [travelData, isMobile, isWeekendShowcase, fixedCount])

  const handleViewMore = useCallback(() => {
    sendAnalyticsEvent('HomeClick_ViewMore', { section: title })
    router.push('/search' as any)
  }, [title, router])

  const viewMoreLabel = isMobile ? 'Все маршруты' : 'Смотреть все маршруты'
  const emptyState = EMPTY_STATE_TEXT[queryKey] ?? {
    title: 'Пока здесь пусто',
    subtitle: 'Попробуйте открыть каталог маршрутов.',
  }
  const sectionBadge = SECTION_BADGES[queryKey]
  const sectionMeta = SECTION_META[queryKey]

  const styles = useMemo(
    () => createSectionStyles(colors, isMobile),
    [colors, isMobile],
  )
  const isDesktopEditorial = Platform.OS === 'web' && !isMobile
  const shouldUseThreeColumnRow =
    Platform.OS === 'web' &&
    !isMobile &&
    queryKey === 'home-random-travels' &&
    travelsList.length === 3

  const getEditorialCardStyle = useCallback(
    (index: number, count: number) => {
      if (count === 1) return styles.editorialCardHero
      if (count === 2)
        return index === 0
          ? styles.editorialCardHero
          : styles.editorialCardStackTop
      if (count === 3) {
        if (index === 0) return styles.editorialCardHeroTall
        if (index === 1) return styles.editorialCardStackTop
        return styles.editorialCardStackMiddle
      }

      if (index === 0) return styles.editorialCardHero
      if (index === 1) return styles.editorialCardStackTop
      if (index === 2) return styles.editorialCardStackMiddle
      return styles.editorialCardStackBottom
    },
    [
      styles.editorialCardHero,
      styles.editorialCardHeroTall,
      styles.editorialCardStackBottom,
      styles.editorialCardStackMiddle,
      styles.editorialCardStackTop,
    ],
  )

  const getEditorialImageHeight = useCallback(
    (index: number, count: number) => {
      if (count === 1) return 340
      if (count === 2) return 340
      if (count === 3) return index === 0 ? 336 : 296
      return index === 0 ? 316 : 292
    },
    [],
  )

  if (isLoading) {
    return (
      <View style={[styles.section, isMobile && styles.sectionMobile]}>
        <View
          style={[
            styles.sectionFrame,
            isWeekendShowcase && styles.showcaseSectionFrame,
          ]}
        >
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
            {isMobile ? (
              Array.from({ length: 2 }).map((_, i) => (
                <SkeletonLoader
                  key={i}
                  width="100%"
                  height={260}
                  borderRadius={12}
                />
              ))
            ) : isDesktopEditorial ? (
              <View style={[styles.editorialGrid, styles.editorialGridFour]}>
                <View style={[styles.editorialCard, styles.editorialCardHero]}>
                  <SkeletonLoader
                    width="100%"
                    height="100%"
                    borderRadius={12}
                  />
                </View>
                <View
                  style={[styles.editorialCard, styles.editorialCardStackTop]}
                >
                  <SkeletonLoader
                    width="100%"
                    height="100%"
                    borderRadius={12}
                  />
                </View>
                <View
                  style={[
                    styles.editorialCard,
                    styles.editorialCardStackMiddle,
                  ]}
                >
                  <SkeletonLoader
                    width="100%"
                    height="100%"
                    borderRadius={12}
                  />
                </View>
                <View
                  style={[
                    styles.editorialCard,
                    styles.editorialCardStackBottom,
                  ]}
                >
                  <SkeletonLoader
                    width="100%"
                    height="100%"
                    borderRadius={12}
                  />
                </View>
              </View>
            ) : (
              [0, 1].map((rowIdx) => {
                const wideFirst = rowIdx % 2 === 0
                return (
                  <View key={rowIdx} style={styles.bentoRow}>
                    <View
                      style={
                        wideFirst
                          ? styles.bentoCardWide
                          : styles.bentoCardNarrow
                      }
                    >
                      <SkeletonLoader
                        width="100%"
                        height={340}
                        borderRadius={12}
                      />
                    </View>
                    <View
                      style={
                        wideFirst
                          ? styles.bentoCardNarrow
                          : styles.bentoCardWide
                      }
                    >
                      <SkeletonLoader
                        width="100%"
                        height={340}
                        borderRadius={12}
                      />
                    </View>
                  </View>
                )
              })
            )}
          </View>
        </View>
      </View>
    )
  }

  if (isError) {
    return (
      <View style={[styles.section, isMobile && styles.sectionMobile]}>
        <View
          style={[
            styles.sectionFrame,
            isWeekendShowcase && styles.showcaseSectionFrame,
          ]}
        >
          <ErrorDisplay
            title="Не удалось загрузить подборку"
            message={
              error instanceof Error
                ? error.message
                : 'Попробуйте обновить подборку ещё раз.'
            }
            onRetry={() => {
              void refetch()
            }}
            variant="warning"
            showContact={false}
          />
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.section, isMobile && styles.sectionMobile]}>
      <View
        style={[
          styles.sectionFrame,
          isWeekendShowcase && styles.showcaseSectionFrame,
        ]}
      >
        <View style={[styles.heroHeader, { marginBottom: isMobile ? 20 : 32 }]}>
          {sectionBadge ? (
            <View style={styles.sectionBadge}>
              <Feather name="star" size={12} color={colors.textMuted} />
              <Text style={styles.sectionBadgeText}>{sectionBadge}</Text>
            </View>
          ) : null}
          <View style={{ alignItems: 'center', gap: isMobile ? 6 : 10 }}>
            <Text style={styles.heroTitle}>{title}</Text>
            {titleAccent && (
              <Text style={styles.heroTitleAccent}>{titleAccent}</Text>
            )}
          </View>
          {subtitle && <Text style={styles.heroSubtitle}>{subtitle}</Text>}
          {sectionMeta ? (
            <View
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: DESIGN_TOKENS.radii.pill,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.borderLight,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: 13,
                  fontWeight: '600',
                  letterSpacing: 0.1,
                }}
              >
                {sectionMeta}
              </Text>
            </View>
          ) : null}
        </View>

        {travelsList.length === 0 ? (
          <View style={styles.emptyState} testID={`home-empty-${queryKey}`}>
            <View style={styles.emptyStateIconWrap}>
              <Feather name="compass" size={22} color={colors.primary} />
            </View>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: DESIGN_TOKENS.radii.pill,
                backgroundColor: colors.primarySoft,
                borderWidth: 1,
                borderColor: colors.primaryAlpha30,
              }}
            >
              <Text
                style={{
                  color: colors.primaryText,
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                }}
              >
                Пока без совпадений
              </Text>
            </View>
            <Text style={[styles.emptyStateTitle, { textAlign: 'center' }]}>
              {emptyState.title}
            </Text>
            <Text style={[styles.emptyStateSubtitle, { textAlign: 'center' }]}>
              {emptyState.subtitle}
            </Text>
            <Button
              label="Открыть каталог"
              onPress={handleViewMore}
              variant="secondary"
              icon={
                <Feather name="arrow-right" size={16} color={colors.text} />
              }
              iconPosition="right"
              style={[
                styles.viewMoreButton,
                isMobile && styles.viewMoreButtonMobile,
              ]}
              labelStyle={styles.viewMoreText}
              hoverStyle={styles.viewMoreButtonHover}
              pressedStyle={styles.viewMoreButtonHover}
            />
          </View>
        ) : isMobile ? (
          <View style={styles.bentoGrid}>
            {travelsList.map((item: any, index: number) => {
              const key =
                item?.id != null && String(item.id).length > 0
                  ? String(item.id)
                  : item?.url
                    ? String(item.url)
                    : `${queryKey}-${index}`
              return (
                <React.Fragment key={key}>
                  {index > 0 && <Separator />}
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
              )
            })}
          </View>
        ) : shouldUseThreeColumnRow ? (
          <View style={styles.threeColumnGrid}>
            {travelsList.map((item: any, index: number) => {
              const key =
                item?.id != null && String(item.id).length > 0
                  ? String(item.id)
                  : item?.url
                    ? String(item.url)
                    : `${queryKey}-${index}`

              return (
                <View key={key} style={styles.threeColumnCard}>
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
            })}
          </View>
        ) : isDesktopEditorial && travelsList.length >= 2 ? (
          <View
            style={[
              styles.editorialGrid,
              travelsList.length === 3
                ? styles.editorialGridThree
                : styles.editorialGridFour,
            ]}
          >
            {travelsList.slice(0, 4).map((item: any, index: number) => {
              const key =
                item?.id != null && String(item.id).length > 0
                  ? String(item.id)
                  : item?.url
                    ? String(item.url)
                    : `${queryKey}-${index}`

              return (
                <View
                  key={key}
                  style={[
                    styles.editorialCard,
                    getEditorialCardStyle(
                      index,
                      Math.min(travelsList.length, 4),
                    ),
                  ]}
                >
                  <RenderTravelItem
                    item={item}
                    index={index}
                    isMobile={isMobile}
                    imageHeight={getEditorialImageHeight(
                      index,
                      Math.min(travelsList.length, 4),
                    )}
                    hideAuthor={hideAuthor}
                    viewportWidth={viewportWidth}
                    visualVariant="home-featured"
                  />
                </View>
              )
            })}
          </View>
        ) : travelsList.length === 3 ? (
          <View style={styles.trioGrid}>
            <View style={styles.trioCardTop}>
              <RenderTravelItem
                item={travelsList[0]}
                index={0}
                isMobile={isMobile}
                hideAuthor={hideAuthor}
                viewportWidth={viewportWidth}
                visualVariant="home-featured"
              />
            </View>
            <View style={styles.trioBottomRow}>
              <View style={styles.trioCardBottom}>
                <RenderTravelItem
                  item={travelsList[1]}
                  index={1}
                  isMobile={isMobile}
                  hideAuthor={hideAuthor}
                  viewportWidth={viewportWidth}
                  visualVariant="home-featured"
                />
              </View>
              <View style={styles.trioCardBottom}>
                <RenderTravelItem
                  item={travelsList[2]}
                  index={2}
                  isMobile={isMobile}
                  hideAuthor={hideAuthor}
                  viewportWidth={viewportWidth}
                  visualVariant="home-featured"
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.bentoGrid}>
            {chunkArray(travelsList, 2).map((pair: any[], rowIdx: number) => {
              const wideFirst = rowIdx % 2 === 0
              const left = pair[0] ?? null
              const right = pair[1] ?? null
              const leftKey =
                left?.id != null
                  ? String(left.id)
                  : left?.url
                    ? String(left.url)
                    : `${queryKey}-${rowIdx}-0`
              const rightKey =
                right?.id != null
                  ? String(right.id)
                  : right?.url
                    ? String(right.url)
                    : `${queryKey}-${rowIdx}-1`

              return (
                <View key={`bento-row-${rowIdx}`} style={styles.bentoRow}>
                  {left ? (
                    <View
                      style={
                        wideFirst
                          ? styles.bentoCardWide
                          : styles.bentoCardNarrow
                      }
                    >
                      <RenderTravelItem
                        item={left}
                        index={rowIdx * 2}
                        isMobile={isMobile}
                        hideAuthor={hideAuthor}
                        viewportWidth={viewportWidth}
                        visualVariant="home-featured"
                      />
                    </View>
                  ) : (
                    <View
                      key={`ph-${leftKey}`}
                      style={[
                        wideFirst
                          ? styles.bentoCardWide
                          : styles.bentoCardNarrow,
                        styles.cardWrapperPlaceholder,
                      ]}
                      aria-hidden={Platform.OS === 'web' ? true : undefined}
                      importantForAccessibility="no-hide-descendants"
                    />
                  )}
                  {right ? (
                    <View
                      style={
                        wideFirst
                          ? styles.bentoCardNarrow
                          : styles.bentoCardWide
                      }
                    >
                      <RenderTravelItem
                        item={right}
                        index={rowIdx * 2 + 1}
                        isMobile={isMobile}
                        hideAuthor={hideAuthor}
                        viewportWidth={viewportWidth}
                        visualVariant="home-featured"
                      />
                    </View>
                  ) : (
                    <View
                      key={`ph-${rightKey}`}
                      style={[
                        wideFirst
                          ? styles.bentoCardNarrow
                          : styles.bentoCardWide,
                        styles.cardWrapperPlaceholder,
                      ]}
                      aria-hidden={Platform.OS === 'web' ? true : undefined}
                      importantForAccessibility="no-hide-descendants"
                    />
                  )}
                </View>
              )
            })}
          </View>
        )}

        {!isWeekendShowcase && travelsList.length > 0 && (
          <View
            style={[styles.headerActions, { marginTop: isMobile ? 14 : 20 }]}
          >
            <Button
              label={viewMoreLabel}
              onPress={handleViewMore}
              accessibilityLabel={`Открыть каталог маршрутов для секции «${title}»`}
              icon={
                <Feather name="arrow-right" size={16} color={colors.text} />
              }
              iconPosition="right"
              variant="secondary"
              style={[
                styles.viewMoreButton,
                isMobile && styles.viewMoreButtonMobile,
              ]}
              labelStyle={styles.viewMoreText}
              hoverStyle={styles.viewMoreButtonHover}
              pressedStyle={styles.viewMoreButtonHover}
            />
          </View>
        )}
      </View>
    </View>
  )
}

function chunkArray<T>(array: T[], columns: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < array.length; i += columns)
    result.push(array.slice(i, i + columns))
  return result
}

const separatorStyles = StyleSheet.create({
  separator: {
    height: 20,
  },
})

function Separator() {
  return <View style={separatorStyles.separator} />
}
