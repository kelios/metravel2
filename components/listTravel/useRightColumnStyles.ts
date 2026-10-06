import { useMemo } from 'react'
import { Platform, type StyleProp, type ViewStyle } from 'react-native'

import { useScrollBottomPadding } from '@/components/layout/bottomChromeInset'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import {
  getRightColumnColumns,
  getRightColumnWebRowBaseStyle,
  RECOMMENDATIONS_TOTAL_HEIGHT,
} from '@/components/listTravel/rightColumnModel'

const isWeb = Platform.OS === 'web'

const eagerFirstWebRowStyle = {
  contentVisibility: 'visible',
  containIntrinsicSize: 'none',
} as ViewStyle

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
  isMobileViewport?: boolean
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
  isMobileViewport = isMobile,
  isExport,
  isWebMobile,
  cardsContainerStyle,
  cardsGridStyle,
}: UseRightColumnStylesArgs) {
  const nativeBottomReserve = useScrollBottomPadding(DESIGN_TOKENS.spacing.xl)

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
    // Reserve whichever bottom overlay is taller: the responsive bottom dock or
    // the consent banner. The dock is also used at tablet widths, where the card
    // grid may still be multi-column, so this cannot depend on the single-column
    // mobile breakpoint.
    paddingBottom: `calc(max(var(--mt-dock-h, 0px), var(--mt-consent-h, 0px), 28px) + 8px)` as any,
  }), [contentPadding])

  const nativeContentContainerStyle = useMemo(() => ({
    paddingHorizontal: contentPadding,
    paddingTop: 8,
    paddingBottom: nativeBottomReserve,
  }), [contentPadding, nativeBottomReserve])

  const paddingHorizontalStyle = useMemo(
    () => ({ paddingHorizontal: contentPadding }),
    [contentPadding],
  )

  // #2179: скелетоны живут в ListEmptyComponent списка — горизонтальный
  // отступ и верхний зазор даёт контейнер содержимого, как рядам карточек.
  const recommendationsSkeletonStyle = useMemo(
    () => ({
      height: RECOMMENDATIONS_TOTAL_HEIGHT,
      marginBottom: 24,
      overflow: 'hidden' as const,
    }),
    [],
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
        minHeight: 44,
        maxWidth: isMobileViewport ? '100%' : 280,
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
    [colors.border, colors.surface, colors.text, isMobileViewport],
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

    // Первый ряд в первом экране и меряется по содержимому: отложенный ряд
    // отдал бы FlashList contain-intrinsic-size, и второй ряд прыгал бы при
    // приходе настоящей высоты (#1298). Тот же стиль у первого ряда каркаса (#2253).
    const firstRowStyle =
      Platform.OS === 'web' && !isExport ? [rowStyle, eagerFirstWebRowStyle] : rowStyle

    // Ряды на web разделяет ItemSeparatorComponent списка этой высоты; на native
    // зазор даёт paddingBottom ячейки, разделителя нет (null) — для карточек и каркаса.
    const rowSeparatorStyle: ViewStyle | null =
      Platform.OS === 'web' ? { height: cardSpacing } : null

    return { cols, rowStyle, firstRowStyle, rowSeparatorStyle, itemWrapperStyle, placeholderStyle }
  }, [cardsGridStyle, cardSpacing, gridColumns, isMobile, isExport])

  return {
    cardsWrapperStyle,
    webContentContainerStyle,
    nativeContentContainerStyle,
    paddingHorizontalStyle,
    recommendationsSkeletonStyle,
    activeConditionChipStyles,
    rowLayout,
  }
}

export { isWeb }
