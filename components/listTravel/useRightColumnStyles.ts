import { useMemo } from 'react'
import { Platform, type StyleProp, type ViewStyle } from 'react-native'

import { useAuth } from '@/context/AuthContext'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import {
  getRightColumnColumns,
  getRightColumnWebRowBaseStyle,
  RECOMMENDATIONS_TOTAL_HEIGHT,
} from '@/components/listTravel/rightColumnModel'

const isWeb = Platform.OS === 'web'

type ThemedColors = {
  border: string
  surface: string
  text: string
}

type UseRightColumnStylesArgs = {
  colors: ThemedColors
  cardSpacing: number
  contentPadding: number
  gridColumns: number
  isMobile: boolean
  isExport: boolean
  isWebMobile: boolean
  cardsContainerStyle?: ViewStyle | ViewStyle[]
  cardsGridStyle?: ViewStyle | ViewStyle[]
}

export function useRightColumnStyles({
  colors,
  cardSpacing,
  contentPadding,
  gridColumns,
  isMobile,
  isExport,
  isWebMobile,
  cardsContainerStyle,
  cardsGridStyle,
}: UseRightColumnStylesArgs) {
  // Native-only: the FAB «Создать маршрут» (56dp, bottom:80) floats over the list
  // for authorized users and would otherwise cover the last card. Reserve clearance
  // (dock offset 80 + fab 56 + gap) only when the FAB is actually present.
  const { isAuthenticated } = useAuth()
  const nativeBottomReserve = !isWeb && isAuthenticated ? 150 : 28
  const cardsWrapperStyle = useMemo<StyleProp<ViewStyle>>(() => {
    const resetPadding = {
      flex: 1,
      minHeight: 0,
      paddingHorizontal: 0,
      paddingTop: Platform.OS === 'web' ? 0 : 12,
      ...(Platform.OS === 'web'
        ? ({
            // Important: keep this wrapper non-scrolling so FlashList's internal
            // ScrollView is the only scroll container on web, otherwise its onScroll
            // won't fire and infinite scroll won't fetch next pages.
            overflow: 'hidden',
            overflowY: 'hidden',
            overflowX: 'hidden',
            // Only reserve scrollbar gutter on desktop to prevent layout shift;
            // on mobile web scrollbars are overlay so this wastes ~15px.
            ...(isWebMobile ? {} : { scrollbarGutter: 'stable' }),
          } as any)
        : null),
    }

    if (Array.isArray(cardsContainerStyle)) {
      return [...cardsContainerStyle, resetPadding]
    }

    if (cardsContainerStyle) {
      return [cardsContainerStyle, resetPadding]
    }

    return resetPadding
  }, [cardsContainerStyle, isWebMobile])

  const webContentContainerStyle = useMemo(() => ({
    paddingHorizontal: contentPadding,
    // Keep a small gap below the search chrome on web so the first card
    // doesn't visually tuck under the header shadow or clip its top actions.
    paddingTop: 8,
    // Reserve whichever bottom overlay is taller: the bottom dock or the consent banner
    // (set by ConsentBanner via --mt-consent-h). max() avoids cards hiding under the banner.
    paddingBottom: isMobile
      ? (`calc(max(var(--mt-dock-h, 0px), var(--mt-consent-h, 0px)) + 8px)` as any)
      : (`calc(max(var(--mt-consent-h, 0px), 28px) + 8px)` as any),
  }), [isMobile, contentPadding])

  const nativeContentContainerStyle = useMemo(() => ({
    paddingHorizontal: contentPadding,
    paddingTop: 8,
    paddingBottom: nativeBottomReserve,
  }), [contentPadding, nativeBottomReserve])

  const paddingHorizontalStyle = useMemo(
    () => ({ paddingHorizontal: contentPadding }),
    [contentPadding],
  )

  const recommendationsSkeletonStyle = useMemo(
    () => ({
      height: RECOMMENDATIONS_TOTAL_HEIGHT,
      marginBottom: 24,
      overflow: 'hidden' as const,
      paddingHorizontal: contentPadding,
    }),
    [contentPadding],
  )

  const activeConditionChipStyles = useMemo(
    () => ({
      wrapper: {
        flexDirection: 'row' as const,
        flexWrap: 'wrap' as const,
        gap: DESIGN_TOKENS.spacing.xs,
        paddingTop: DESIGN_TOKENS.spacing.sm,
        paddingBottom: DESIGN_TOKENS.spacing.xxs,
      },
      chip: {
        minHeight: 34,
        maxWidth: isMobile ? '100%' : 280,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: DESIGN_TOKENS.spacing.xs,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: DESIGN_TOKENS.radii.pill,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        ...(Platform.OS === 'web'
          ? ({
              cursor: 'pointer',
              transition: 'border-color 0.18s ease, background-color 0.18s ease',
            } as any)
          : null),
      },
      chipText: {
        flexShrink: 1,
        color: colors.text,
        fontSize: 13,
        fontWeight: '600' as const,
      },
    }),
    [colors.border, colors.surface, colors.text, isMobile],
  )

  // Инварианты строки зависят только от сетки/размеров, а не от конкретной
  // строки — считаем один раз на рендер, а не на каждую из N строк.
  const rowLayout = useMemo(() => {
    const cols = getRightColumnColumns(gridColumns, isMobile)
    const calcWidth =
      cols > 1 ? `calc((100% - ${(cols - 1) * cardSpacing}px) / ${cols})` : '100%'

    const rowStyle = [
      cardsGridStyle,
      (Platform.OS === 'web'
        ? (getRightColumnWebRowBaseStyle({ cardSpacing, isExport, isMobile }) as any)
        : ({
            flexWrap: 'nowrap',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
          } as any)),
    ]

    const itemWrapperStyle = [
      (Platform.OS === 'web'
        ? (isMobile
            ? ({
                flex: 1,
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                flexBasis: '100%',
              } as any)
            : ({
                // Equal column widths on web (prevents last-row stretching and uneven widths)
                flexGrow: 0,
                flexShrink: 0,
                flexBasis: calcWidth,
                width: calcWidth,
                maxWidth: calcWidth,
                minWidth: 0,
                alignSelf: 'stretch',
              } as any))
        : ({
            flex: 1,
            width: '100%',
            maxWidth: '100%',
          } as any)) as ViewStyle,
      Platform.OS === 'web'
        ? null
        : {
            paddingHorizontal: cardSpacing / 2,
            paddingBottom: cardSpacing,
          },
    ]

    const placeholderStyle = [
      ({
        flexGrow: 0,
        flexShrink: 0,
        flexBasis: calcWidth,
        width: calcWidth,
        maxWidth: calcWidth,
        minWidth: 0,
        opacity: 0,
        pointerEvents: 'none',
        paddingHorizontal: cardSpacing / 2,
      } as any) as ViewStyle,
    ]

    return { cols, rowStyle, itemWrapperStyle, placeholderStyle }
  }, [cardsGridStyle, cardSpacing, gridColumns, isMobile, isExport])

  const skeletonCardWidth = useMemo(() => {
    if (Platform.OS !== 'web') return '100%'
    const columns = Math.max(gridColumns, 1)
    if (isMobile || columns === 1) return '100%'
    return `calc((100% - ${(columns - 1) * cardSpacing}px) / ${columns})`
  }, [cardSpacing, gridColumns, isMobile])

  const skeletonGridStyle = useMemo(
    () => ({
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: cardSpacing,
      paddingHorizontal: contentPadding,
      paddingTop: 8,
      paddingBottom: 24,
    }),
    [cardSpacing, contentPadding],
  )

  const skeletonCardWrapperStyle = useMemo<StyleProp<ViewStyle>>(
    () => ({
      width: skeletonCardWidth as any,
      ...(Platform.OS === 'web'
        ? ({ flexGrow: 0, flexShrink: 0, flexBasis: skeletonCardWidth as any } as const)
        : null),
    }),
    [skeletonCardWidth],
  )

  return {
    cardsWrapperStyle,
    webContentContainerStyle,
    nativeContentContainerStyle,
    paddingHorizontalStyle,
    recommendationsSkeletonStyle,
    activeConditionChipStyles,
    rowLayout,
    skeletonGridStyle,
    skeletonCardWrapperStyle,
  }
}

export { isWeb }
