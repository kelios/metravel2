import { Platform, type ViewStyle } from 'react-native'

import { getRightColumnColumns, getRightColumnWebRowBaseStyle } from './rightColumnModel'

const eagerFirstWebRowStyle = { contentVisibility: 'visible', containIntrinsicSize: 'none' } as ViewStyle

/** One row/cell/separator descriptor for real catalog rows and every loading phase. */
export function createTravelListRowLayout({ cardsGridStyle, cardSpacing, gridColumns, isMobile, isExport }: {
  cardsGridStyle?: ViewStyle | ViewStyle[]
  cardSpacing: number
  gridColumns: number
  isMobile: boolean
  isExport: boolean
}) {
    const cols = getRightColumnColumns(gridColumns, isMobile)
    const calcWidth =
      cols > 1 ? `calc((100% - ${(cols - 1) * cardSpacing}px) / ${cols})` : '100%'

    const rowStyle = [
      cardsGridStyle,
      (Platform.OS === 'web'
        ? (getRightColumnWebRowBaseStyle({ cardSpacing, isExport, isMobile }) as ViewStyle)
        : ({
            flexWrap: 'nowrap',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
          } as ViewStyle)),
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
              } as ViewStyle)
            : ({
                // Equal column widths on web (prevents last-row stretching and uneven widths)
                flexGrow: 0,
                flexShrink: 0,
                flexBasis: calcWidth,
                width: calcWidth,
                maxWidth: calcWidth,
                minWidth: 0,
                alignSelf: 'stretch',
              } as ViewStyle))
        : ({
            flex: 1,
            width: '100%',
            maxWidth: '100%',
          } as ViewStyle)) as ViewStyle,
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
      } as ViewStyle),
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
}
