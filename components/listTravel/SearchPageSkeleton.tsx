import { memo, useMemo } from 'react'
import { Platform, ScrollView, StyleSheet, View } from 'react-native'

import { SkeletonLoader, TravelCardSkeleton } from '@/components/ui/SkeletonLoader'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { BREAKPOINTS } from './utils/listTravelConstants'

const FILTER_BLOCKS = [
  { titleWidth: '56%', rowCount: 1 },
  { titleWidth: '42%', rowCount: 1 },
  { titleWidth: '58%', rowCount: 2 },
  { titleWidth: '52%', rowCount: 2 },
  { titleWidth: '48%', rowCount: 1 },
  { titleWidth: '44%', rowCount: 1 },
] as const

const SearchSidebarSkeleton = memo(({ isDesktop }: { isDesktop: boolean }) => {
  const colors = useThemedColors()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          width: isDesktop ? 292 : '100%',
          backgroundColor: colors.surface,
          borderRightWidth: isDesktop ? 1 : 0,
          borderRightColor: colors.borderLight,
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 24,
          gap: 14,
        },
        summaryRow: {
          flexDirection: 'row',
          gap: 10,
          alignItems: 'center',
        },
        filterCard: {
          borderRadius: DESIGN_TOKENS.radii.lg,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.borderLight,
          padding: 14,
          gap: 12,
        },
        chipRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
        },
      }),
    [colors, isDesktop],
  )

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <SkeletonLoader width={92} height={28} borderRadius={14} />
        <SkeletonLoader width={44} height={36} borderRadius={12} />
      </View>

      <View style={styles.filterCard}>
        <SkeletonLoader width="100%" height={44} borderRadius={DESIGN_TOKENS.radii.pill} />
        <SkeletonLoader width="76%" height={16} borderRadius={6} />
      </View>

      {FILTER_BLOCKS.map((block, index) => (
        <View key={`search-filter-block-${index}`} style={styles.filterCard}>
          <View style={styles.summaryRow}>
            <SkeletonLoader width={block.titleWidth as any} height={18} borderRadius={6} />
            <SkeletonLoader width={56} height={22} borderRadius={11} />
          </View>
          <View style={styles.chipRow}>
            {Array.from({ length: block.rowCount * 3 }).map((_, chipIndex) => (
              <SkeletonLoader
                key={`search-chip-${index}-${chipIndex}`}
                width={chipIndex % 3 === 0 ? 84 : chipIndex % 3 === 1 ? 98 : 76}
                height={34}
                borderRadius={17}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  )
})

SearchSidebarSkeleton.displayName = 'SearchSidebarSkeleton'

const SearchHeaderSkeleton = memo(({ isMobile }: { isMobile: boolean }) => {
  const colors = useThemedColors()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingHorizontal: isMobile ? 12 : 16,
          paddingTop: isMobile ? 12 : 16,
          paddingBottom: 12,
        },
        row: {
          minHeight: isMobile ? 48 : 52,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderRadius: DESIGN_TOKENS.radii.xl,
          borderWidth: 1,
          borderColor: colors.borderLight,
          backgroundColor: colors.surface,
          padding: 8,
        },
      }),
    [colors, isMobile],
  )

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <SkeletonLoader width="100%" height={36} borderRadius={DESIGN_TOKENS.radii.pill} style={{ flex: 1 }} />
        {!isMobile && (
          <>
            <SkeletonLoader width={138} height={36} borderRadius={18} />
            <SkeletonLoader width={190} height={36} borderRadius={18} />
            <SkeletonLoader width={36} height={36} borderRadius={18} />
          </>
        )}
        {isMobile && <SkeletonLoader width={36} height={36} borderRadius={12} />}
      </View>
    </View>
  )
})

SearchHeaderSkeleton.displayName = 'SearchHeaderSkeleton'

const SearchCardsSkeleton = memo(
  ({ columns, count, isMobile }: { columns: number; count: number; isMobile: boolean }) => {
    const styles = useMemo(
      () =>
        StyleSheet.create({
          grid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 16,
            paddingHorizontal: isMobile ? 12 : 16,
            paddingBottom: isMobile ? 88 : 120,
            alignItems: 'flex-start',
          },
          item: {
            width: columns === 1 ? '100%' : `${Math.floor(100 / columns) - 2}%`,
            ...(Platform.OS === 'web' && columns > 1
              ? ({
                  flexBasis: `calc((100% - ${(columns - 1) * 16}px) / ${columns})`,
                  flexGrow: 0,
                  flexShrink: 0,
                } as any)
              : null),
          },
        }),
      [columns, isMobile],
    )

    return (
      <View style={styles.grid}>
        {Array.from({ length: count }).map((_, index) => (
          <View key={`search-card-skeleton-${index}`} style={styles.item}>
            <TravelCardSkeleton />
          </View>
        ))}
      </View>
    )
  },
)

SearchCardsSkeleton.displayName = 'SearchCardsSkeleton'

export const SearchPageSkeleton = memo(() => {
  const colors = useThemedColors()
  // Берём ширину из useResponsive (hydration-safe: SSR и первый клиентский
  // рендер дают width=0, после гидрации — реальную). Прямое чтение window.innerWidth
  // здесь ломало бы первый рендер и давало React #418 на /search.
  const { width: viewportWidth } = useResponsive()

  const isUnknownWebWidth = Platform.OS === 'web' && viewportWidth === 0
  const isMobile = !isUnknownWebWidth && viewportWidth < BREAKPOINTS.TABLET
  const isTablet = viewportWidth >= BREAKPOINTS.TABLET && viewportWidth < BREAKPOINTS.DESKTOP
  const isDesktop = isUnknownWebWidth || viewportWidth >= BREAKPOINTS.DESKTOP
  const columns = isMobile ? 1 : isTablet ? 2 : 3
  const cardCount = isMobile ? 4 : isTablet ? 6 : 9

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
          flexDirection: isDesktop ? 'row' : 'column',
        },
        main: {
          flex: 1,
          minWidth: 0,
        },
      }),
    [colors, isDesktop],
  )

  return (
    <View style={styles.container} testID={isDesktop ? 'search-skeleton' : 'search-skeleton-mobile'}>
      {isDesktop ? <SearchSidebarSkeleton isDesktop /> : null}
      <View style={styles.main}>
        {/* На планшете показываем скелетон сайдбара только если он реально будет виден (не на мобильных) */}
        {isTablet && <SearchSidebarSkeleton isDesktop={false} />}
        <SearchHeaderSkeleton isMobile={isMobile} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <SearchCardsSkeleton columns={columns} count={cardCount} isMobile={isMobile} />
        </ScrollView>
      </View>
    </View>
  )
})

SearchPageSkeleton.displayName = 'SearchPageSkeleton'

export default SearchPageSkeleton
