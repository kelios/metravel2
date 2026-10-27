import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Platform, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance, type ViewInstance } from 'react-native'
import { useResponsive } from '@/hooks/useResponsive'
import { resolveHeaderContextBarIsMobile } from '@/components/layout/headerContextBarModel'
import { resolveQuestHeaderPresentation } from '@/components/layout/questHeaderPresentation'

export type QuestWizardResponsiveModel = {
  screenW: number
  screenH: number
  isMobile: boolean
  /**
   * Shared quest policy: compact web and native phones use the screen row;
   * wide web keeps its existing sidebar title/actions.
   */
  headerInScreenRow: boolean
  /** Short layout window: route/progress is the first child of the reading scroll. */
  headerInContentFlow: boolean
  isSmallScreen: boolean
  compactNav: boolean
  wideDesktop: boolean
  compactDesktopLayout: boolean
  useWideInlineLayout: boolean
  useWideExcursionsSidebar: boolean
  sidebarWidth: number
  mapPanelWidth: number
  answerPaneWidth: number
}

export function useQuestWizardResponsiveModel() {
  // `clientOnly` обязателен: без него первый кадр визарда считается на
  // `SSR_SNAPSHOT = {width: 0}` (`hooks/useResponsive.ts:166,265`), то есть по
  // мобильной ветке — `isMobile`, `compactNav` и `screenW < 600` истинны при
  // любой реальной ширине. Следующий кадр приходит с настоящей шириной и
  // перекладывает шапку:
  //   * блок прогресса 9 → 22 px. Мобильный `QuestProgressSummary` оставляет
  //     только полосу (`showCounter` и `showBreakdown` выключены), а счётчик
  //     живёт в `headerActionRowMobile`; десктопный summary добавляет под
  //     полосой счётчик и, при `countModel.source === 'explicit'`, разбор, поэтому
  //     высоты веток разные
  //     (`questWizardShell.tsx`, `questWizardStyles/headerStyles.ts`);
  //   * лента шагов 1 → 44 px. Ветка `screenW < 600` в `questWizardShell.tsx`
  //     рисовала точки вместо пилюль (с #2149 — полосу маршрута `QuestRouteStrip`,
  //     тоже ≥ 44 px). Оговорка: по стилям обе ветки заявляли 44 px
  //     (рамка точки 44x44 и `stepPill.minHeight` 44), так что 1 px — это транзиентный обмер самого
  //     нулевого кадра, а не разница объявленных высот. Замер прода
  //     (`layout-shift.sources`) фиксировал ровно `[.,.,.,1] → [.,.,.,44]`.
  // Суммарно на проде это давало CLS 0,40 на desktop-ширинах < 1280 (#1562) —
  // тот же класс, что #1282/#1298.
  //
  // Опция здесь безопасна: на web поддерево визарда монтируется только после
  // гидратации. В `app/(tabs)/quests/[city]/[questId].tsx` это `React.lazy` +
  // `Suspense` вокруг `QuestWizardComponent` и ранний return `LoadingState` по
  // `isLoading`, который на первом рендере всегда true — `useQuestBundle`
  // стартует с `loading: true`. В статическом HTML прода разметки визарда нет
  // (только «Загружаем квест…»), поэтому hydration mismatch (#418) невозможен.
  //
  // Отвергнутая альтернатива: зафиксировать ленте шагов и блоку прогресса `minHeight`
  // под финальную геометрию. Не годится — высота ленты зависит от числа шагов и
  // длины названий, а горизонтальный padding контейнера всё равно переключается
  // 16 → 24 по тому же `isMobile`.
  //
  // #2148: `headerInScreenRow` считается из этого же снимка, а не через
  // `useIsScreenHeaderMobile()`: тот рассчитан на узлы из SSR и на первом кадре
  // позднего визарда отвечает «desktop» — ряд действий мигнул бы и пропал.
  const { width, height, isMobile, isPhone, isLargePhone } = useResponsive({ clientOnly: true })

  return useMemo<QuestWizardResponsiveModel>(() => {
    const isSmallScreen = width < 360
    const presentation = resolveQuestHeaderPresentation({
      width, height, isWeb: Platform.OS === 'web',
      nativeScreenRow: resolveHeaderContextBarIsMobile({ width, isPhone, isLargePhone }),
    })
    const wideDesktop = width >= 1100
    const { compactDesktopLayout } = presentation
    const useWideInlineLayout = wideDesktop
    const useWideExcursionsSidebar = wideDesktop && !compactDesktopLayout

    const sidebarWidth = width >= 1280 ? 340 : 300
    const mapPanelWidth = width >= 1280 ? 400 : 340
    const answerPaneWidth = Math.min(260, Math.max(200, width * 0.2))

    return {
      screenW: width,
      screenH: height,
      isMobile,
      ...presentation,
      isSmallScreen,
      wideDesktop,
      useWideInlineLayout,
      useWideExcursionsSidebar,
      sidebarWidth,
      mapPanelWidth,
      answerPaneWidth,
    }
  }, [width, height, isMobile, isPhone, isLargePhone])
}


type HeaderPlacement = Pick<QuestWizardResponsiveModel, 'headerInContentFlow' | 'compactNav' | 'compactDesktopLayout'>
const samePlacement = (a: HeaderPlacement, b: HeaderPlacement) =>
  a.headerInContentFlow === b.headerInContentFlow && a.compactNav === b.compactNav &&
  a.compactDesktopLayout === b.compactDesktopLayout

/** Wait until the gesture/scroll momentum settles, including browser-toolbar resizing. */
const SCROLL_IDLE_MS = 120

type WindowMeasurable = { measureInWindow?: (callback: (x: number, y: number) => void) => void }

/**
 * How far the start of mainContent lies above the top of the visible reading
 * area (the ScrollView frame). `<= 0` — the reader is at the start. The two
 * layouts differ by what is pinned above that frame (screen row vs. screen row
 * plus header), so a window coordinate alone is not a reading position (#2198).
 */
function measureReadingDepth(
  scroller: WindowMeasurable | null,
  content: WindowMeasurable | null,
  done: (depth: number | null) => void,
) {
  if (!scroller?.measureInWindow || !content?.measureInWindow) {
    done(null)
    return
  }
  scroller.measureInWindow((_sx, viewportTop) => {
    content.measureInWindow?.((_x, contentTop) => {
      done(Number.isFinite(viewportTop) && Number.isFinite(contentTop) ? viewportTop - contentTop : null)
    })
  })
}

/**
 * Relocating a header remounts its route strip. Keep its composition until an
 * open sheet/input/keyboard/scroll ends, then apply only the latest layout.
 * mainContent and its ScrollView stay mounted; the reading line at the top of
 * the visible area is kept, and a reader at the start stays at the start.
 */
export function useQuestHeaderPlacement(
  desired: HeaderPlacement,
  scrollRef: RefObject<ScrollViewInstance | null>,
  keyboardInset: number,
  stepKey?: string | null,
) {
  const [applied, setApplied] = useState<HeaderPlacement>(() => ({
    headerInContentFlow: desired.headerInContentFlow,
    compactNav: desired.compactNav,
    compactDesktopLayout: desired.compactDesktopLayout,
  }))
  const [busy, setBusy] = useState({ sheet: false, input: false, scroll: false })
  const busyRef = useRef(busy)
  const desiredRef = useRef(desired)
  desiredRef.current = desired
  const keyboardRef = useRef(keyboardInset)
  keyboardRef.current = keyboardInset
  const mainContentRef = useRef<ViewInstance>(null)
  const routeTriggerRef = useRef<ViewInstance>(null)
  const restoreRouteFocus = useRef(false)
  const scrollOffset = useRef(0)
  const dragging = useRef(false)
  const touching = useRef(false)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // `gesture`: the reader touched/dragged after the relocation started — their
  // own position wins over the compensation.
  const anchor = useRef<{ depth: number; gesture: boolean } | null>(null)
  const previousStepKey = useRef(stepKey)
  const stepGeneration = useRef(0)
  const stepChanged = previousStepKey.current !== stepKey

  const updateBusy = useCallback((kind: keyof typeof busy, value: boolean) => {
    if (busyRef.current[kind] === value) return
    busyRef.current = { ...busyRef.current, [kind]: value }
    setBusy(busyRef.current)
  }, [])
  const onRouteSheetChange = useCallback((open: boolean) => {
    if (busyRef.current.sheet && !open) restoreRouteFocus.current = true
    updateBusy('sheet', open)
  }, [updateBusy])
  const onAnswerFocusChange = useCallback((focused: boolean) => updateBusy('input', focused), [updateBusy])
  const settleScroll = useCallback(() => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current)
    scrollTimer.current = setTimeout(() => {
      scrollTimer.current = null
      if (!dragging.current && !touching.current) updateBusy('scroll', false)
    }, SCROLL_IDLE_MS)
  }, [updateBusy])
  const onContentScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = event.nativeEvent?.contentOffset?.y ?? 0
    updateBusy('scroll', true)
    settleScroll()
  }, [settleScroll, updateBusy])
  const onScrollBegin = useCallback(() => {
    dragging.current = true
    if (anchor.current) anchor.current.gesture = true
    updateBusy('scroll', true)
    if (scrollTimer.current) clearTimeout(scrollTimer.current)
  }, [updateBusy])
  const onScrollEnd = useCallback(() => {
    dragging.current = false
    settleScroll()
  }, [settleScroll])
  // RNW emits scroll ticks, not native drag events. A paused finger is still
  // an active gesture even after the scroll-tick idle timer has expired.
  const onTouchBegin = useCallback(() => {
    touching.current = true
    if (anchor.current) anchor.current.gesture = true
    updateBusy('scroll', true)
    if (scrollTimer.current) clearTimeout(scrollTimer.current)
  }, [updateBusy])
  const onTouchEnd = useCallback(() => {
    touching.current = false
    settleScroll()
  }, [settleScroll])
  useEffect(() => () => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current)
  }, [])
  const usePlacementEffect = Platform.OS === 'web' && typeof window === 'undefined' ? useEffect : useLayoutEffect
  // Intentional point changes own the scroll-to-top reset. No old-point
  // measurement or pending compensation may restore its reading coordinate.
  usePlacementEffect(() => {
    previousStepKey.current = stepKey
    stepGeneration.current += 1
    anchor.current = null
    onAnswerFocusChange(false)
    scrollOffset.current = 0
  }, [stepKey, onAnswerFocusChange])

  usePlacementEffect(() => {
    let cancelled = false
    const generation = stepGeneration.current
    const isCurrent = () => !cancelled && generation === stepGeneration.current
    const isBusy = () => busyRef.current.sheet || busyRef.current.input || busyRef.current.scroll || keyboardRef.current > 0
    if (isBusy()) return
    const focusRoute = () => {
      if (!restoreRouteFocus.current) return
      restoreRouteFocus.current = false
      const target = routeTriggerRef.current as unknown as { focus?: (options?: { preventScroll: boolean }) => void } | null
      target?.focus?.(Platform.OS === 'web' ? { preventScroll: true } : undefined)
    }
    const previous = anchor.current
    const scroller = scrollRef.current as unknown as WindowMeasurable | null
    if (previous) {
      const finish = () => {
        anchor.current = null
        if (!samePlacement(applied, desiredRef.current)) setApplied((current) => ({ ...current }))
        else focusRoute()
      }
      if (previous.gesture) {
        finish()
        return () => { cancelled = true }
      }
      measureReadingDepth(scroller, mainContentRef.current, (depth) => {
        if (!isCurrent()) return
        if (depth === null || previous.gesture) {
          finish()
          return
        }
        if (isBusy()) return
        // Web reads the live scrollTop: a browser scroll-anchoring adjustment
        // may land before its scroll event, and the measured depth already
        // includes it. Native scroll position only changes through onScroll.
        const node = scroller as unknown as { scrollTop?: unknown } | null
        const offset = typeof node?.scrollTop === 'number' ? node.scrollTop : scrollOffset.current
        const nextOffset = previous.depth <= 0 ? 0 : Math.max(0, offset + previous.depth - depth)
        scrollOffset.current = nextOffset
        scrollRef.current?.scrollTo({ y: nextOffset, animated: false })
        finish()
      })
    } else if (samePlacement(applied, desired)) {
      focusRoute()
    } else {
      const next = {
        headerInContentFlow: desired.headerInContentFlow,
        compactNav: desired.compactNav,
        compactDesktopLayout: desired.compactDesktopLayout,
      }
      measureReadingDepth(scroller, mainContentRef.current, (depth) => {
        if (!isCurrent() || isBusy() || !samePlacement(next, desiredRef.current)) return
        anchor.current = !stepChanged && depth !== null ? { depth, gesture: false } : null
        setApplied(next)
      })
    }
    return () => { cancelled = true }
  }, [applied, desired.headerInContentFlow, desired.compactNav, desired.compactDesktopLayout, busy, keyboardInset, scrollRef, stepKey, stepChanged])

  return { ...applied, mainContentRef, routeTriggerRef, onRouteSheetChange, onAnswerFocusChange, onContentScroll, onScrollBegin, onScrollEnd, onTouchBegin, onTouchEnd }
}
