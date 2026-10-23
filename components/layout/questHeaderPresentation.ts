import { METRICS } from '@/constants/layout'

/** Quest detail only: catalog, city and country landings keep their site shell. */
export const isQuestDetailHeaderPath = (pathname: string) =>
  /^\/(?:(?:be|uk|pl|en)\/)?quests\/(?!(?:country|theme)\/)[^/]+\/[^/]+\/?$/.test(pathname || '')

export const QUEST_HEADER_PRESENTATION = {
  desktopWidth: METRICS.breakpoints.desktop,
  routeDisclosureWidth: 600,
  shortHeight: 840,
  screenRowHeight: 52,
  screenSlotHeight: 54,
} as const

/** One viewport policy shared by the site shell and the late-mounted wizard. */
export function resolveQuestHeaderPresentation({
  width,
  height,
  isWeb,
  nativeScreenRow = false,
}: {
  width: number
  height: number
  isWeb: boolean
  nativeScreenRow?: boolean
}) {
  const compactNav = width < QUEST_HEADER_PRESENTATION.routeDisclosureWidth
  const compactDesktopLayout = isWeb && width >= QUEST_HEADER_PRESENTATION.desktopWidth
  const headerInScreenRow = isWeb ? !compactDesktopLayout : nativeScreenRow
  return {
    compactNav,
    compactDesktopLayout,
    headerInScreenRow,
    headerInContentFlow: headerInScreenRow && (isWeb || compactNav) && height < QUEST_HEADER_PRESENTATION.shortHeight,
  }
}
