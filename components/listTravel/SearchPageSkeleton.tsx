import { memo, useMemo } from 'react'
import { Platform, ScrollView, StyleSheet, View } from 'react-native'

import { SkeletonLoader } from '@/components/ui/SkeletonLoader'
import TravelListItemSkeleton from '@/components/listTravel/TravelListItemSkeleton'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useResponsive } from '@/hooks/useResponsive'
import { useThemedColors } from '@/hooks/useTheme'
import { createTravelListRowLayout } from './travelListRowLayout'
import { getListTravelViewportState } from './listTravelBaseModel'
import { useStickySearchBarStyles } from '@/components/mainPage/StickySearchBar.styles'
import { getRightColumnHeaderMinHeight } from './rightColumnModel'

export const SEARCH_SKELETON_FIRST_FRAME_CSS = `
[data-search-skeleton-unknown="true"] [data-search-skeleton-padding="true"]{padding-left:10px!important;padding-right:10px!important}
[data-search-skeleton-unknown="true"] [data-search-skeleton-separator="true"]{height:8px!important}
@media(max-width:359.98px){[data-search-skeleton-unknown="true"] [data-search-skeleton-padding="true"]{padding-left:8px!important;padding-right:8px!important}[data-search-skeleton-unknown="true"] [data-search-skeleton-separator="true"]{height:6px!important}}
@media(min-width:480px) and (max-width:767.98px){[data-search-skeleton-unknown="true"] [data-search-skeleton-padding="true"]{padding-left:12px!important;padding-right:12px!important}[data-search-skeleton-unknown="true"] [data-search-skeleton-separator="true"]{height:10px!important}}
`

const FILTER_BLOCKS = [
  { titleWidth: '56%', rowCount: 1 },
  { titleWidth: '42%', rowCount: 1 },
  { titleWidth: '58%', rowCount: 2 },
  { titleWidth: '52%', rowCount: 2 },
  { titleWidth: '48%', rowCount: 1 },
  { titleWidth: '44%', rowCount: 1 },
] as const

const SearchSidebarSkeleton = memo(({ sidebarWidth }: { sidebarWidth: number }) => {
  const colors = useThemedColors()

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          width: sidebarWidth,
          backgroundColor: colors.surface,
          borderRightWidth: 1,
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
    [colors, sidebarWidth],
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

const SearchHeaderSkeleton = memo(({ isCompact, isMobileViewport, contentPadding }: { isCompact: boolean; isMobileViewport: boolean; contentPadding: number }) => {
  const colors = useThemedColors()
  const styles = useStickySearchBarStyles(colors)
  return (
    <>
      <View style={{ paddingHorizontal: contentPadding, minHeight: getRightColumnHeaderMinHeight(isMobileViewport) }} {...{ dataSet: { searchSkeletonPadding: 'true' } }}>
        <View style={[styles.container, Platform.OS === 'web' && styles.containerFlush, isCompact && Platform.OS === 'web' && styles.containerMobileWeb, isCompact && styles.containerMobile]}>
          <View style={[styles.inner, Platform.OS === 'web' && styles.innerFlush]}>
            <View style={[styles.contentRow, isCompact && styles.contentRowMobile]}>
              <View style={[styles.searchBox, isCompact && styles.searchBoxMobile]}>
                <SkeletonLoader width="75%" height={20} borderRadius={6} />
              </View>
              <View style={[styles.actions, isCompact ? styles.actionsMobile : styles.actionsDesktop]}>
                {[0, 1].map(index => (
                  <View key={index} style={[styles.actionButton, isCompact && styles.actionButtonMobile, isCompact && Platform.OS === 'web' && styles.actionButtonMobileWeb]}>
                    <SkeletonLoader width="100%" height="100%" borderRadius={12} />
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </View>
      <View style={{ paddingHorizontal: contentPadding, paddingTop: DESIGN_TOKENS.spacing.xxs, minHeight: DESIGN_TOKENS.touchTarget.minHeight + 6, alignItems: 'flex-end' }} {...{ dataSet: { searchSkeletonPadding: 'true' } }}>
        <SkeletonLoader width={90} height={DESIGN_TOKENS.touchTarget.minHeight + 2} borderRadius={DESIGN_TOKENS.radii.pill} />
      </View>
    </>
  )
})

SearchHeaderSkeleton.displayName = 'SearchHeaderSkeleton'

const SearchCardsSkeleton = memo(({ columns, count, isMobile, cardSpacing }: { columns: number; count: number; isMobile: boolean; cardSpacing: number }) => {
  const { cols, rowStyle, firstRowStyle, rowSeparatorStyle, itemWrapperStyle } = createTravelListRowLayout({
    gridColumns: columns, isMobile, cardSpacing, isExport: false,
    cardsGridStyle: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', alignItems: 'flex-start' },
  })
  return (
    <View testID="search-page-skeleton-rows" {...{ dataSet: { searchSkeletonRows: 'true' } }}>
      {Array.from({ length: Math.ceil(count / cols) }, (_, rowIndex) => (
        <View key={rowIndex}>
          {rowIndex > 0 && rowSeparatorStyle ? <View style={rowSeparatorStyle} {...{ dataSet: { searchSkeletonSeparator: 'true' } }} /> : null}
          <View style={rowIndex === 0 ? firstRowStyle : rowStyle} testID={`search-page-skeleton-row-${rowIndex}`} {...{ dataSet: { searchSkeletonRow: 'true' } }}>
            {Array.from({ length: Math.min(cols, count - rowIndex * cols) }, (_, itemIndex) => (
              <View key={itemIndex} style={itemWrapperStyle} testID={`search-page-skeleton-row-${rowIndex}-item-${itemIndex}`} {...{ dataSet: { searchSkeletonSlot: String(rowIndex * cols + itemIndex) } }}>
                <TravelListItemSkeleton />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  )
})

SearchCardsSkeleton.displayName = 'SearchCardsSkeleton'

export const SearchPageSkeleton = memo(() => {
  const colors = useThemedColors()
  // Берём ширину из useResponsive (hydration-safe: SSR и первый клиентский
  // рендер дают width=0, после гидрации — реальную). Прямое чтение window.innerWidth
  // здесь ломало бы первый рендер и давало React #418 на /search.
  const responsive = useResponsive()
  const viewportWidth = responsive.width

  const isUnknownWebWidth = Platform.OS === 'web' && viewportWidth === 0
  const viewport = getListTravelViewportState({ rawWidth: viewportWidth, isPhone: responsive.isPhone, isLargePhone: responsive.isLargePhone, isTabletSize: responsive.isTablet, isDesktopSize: responsive.isDesktop, isPortrait: responsive.isPortrait })
  const isMobile = viewport.isCardsSingleColumn
  const isDesktop = !viewport.usesOverlaySidebar
  const columns = viewport.gridColumns
  const cardCount = isMobile ? 4 : Math.max(columns * 2, 6)

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
    <View style={styles.container} testID={isDesktop ? 'search-skeleton' : 'search-skeleton-mobile'} {...{ dataSet: { searchSkeletonUnknown: String(isUnknownWebWidth) } }}>
      {isUnknownWebWidth ? <style>{SEARCH_SKELETON_FIRST_FRAME_CSS}</style> : null}
      {isDesktop ? <SearchSidebarSkeleton sidebarWidth={viewport.sidebarWidth} /> : null}
      <View style={styles.main}>
        <SearchHeaderSkeleton isCompact={viewport.usesOverlaySidebar} isMobileViewport={isMobile} contentPadding={viewport.contentPadding} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: viewport.contentPadding, paddingTop: 8 }} {...{ dataSet: { searchSkeletonPadding: 'true' } }}>
          <SearchCardsSkeleton columns={columns} count={cardCount} isMobile={isMobile} cardSpacing={viewport.gapSize} />
          </View>
        </ScrollView>
      </View>
    </View>
  )
})

SearchPageSkeleton.displayName = 'SearchPageSkeleton'

export default SearchPageSkeleton
