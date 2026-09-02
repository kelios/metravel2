import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Animated, Dimensions, Platform, View } from 'react-native'

/**
 * Android-only viewport gate for rich-text media (#1035).
 *
 * A long travel article carries dozens of body photos (travel #564 has 94). On
 * Android every mounted `expo-image` starts its Glide request as soon as the view
 * is attached — there is no viewport-based laziness like `loading="lazy"` on web.
 * All of them therefore decode at once, blow past Glide's bitmap cache and the
 * cache then re-decodes/re-uploads textures on every scroll frame: Android marks
 * 100% of frames janky with "slow bitmap uploads" even over pure text.
 *
 * The gate keeps only the media near the viewport mounted. Geometry does not need
 * a per-frame measure: `measureInWindow` is taken once per item together with the
 * scroll offset at that moment, and the window position at any later offset is
 * `windowY - (offset - offsetAtMeasure)`. Positions are re-measured when the item
 * re-lays out and shortly after scrolling settles, so deferred sections mounting
 * above the description cannot leave stale coordinates behind.
 *
 * iOS is deliberately excluded. #1666 turned the provider on for all native and
 * exempted only the article body photo; the consumers that stayed gated broke in
 * the very next build. Замер симулятора iPhone 17 / iOS 26.5 на travel 630
 * (main с #1666): секция «Квесты по этому городу и рядом» приезжает с тремя
 * пустыми плитками и остаётся пустой, пока рамки стоят во вьюпорте; обложки
 * появляются только после ЕЩЁ одного жеста скролла (#1696). Тот же симптом
 * #1666 описал для inline-фото: «пустым до тапа». Общее у случаев то, что
 * рамка регистрируется в гейте не в момент раскладки: секция ждёт данные и
 * монтируется после них. Какое именно звено iOS-жизненного цикла отдаёт
 * несовпадающую геометрию, не измерялось — гейт заведён под Glide, у которого
 * на iOS нет аналога, поэтому лечение не в том, чтобы чинить измерение, а в том,
 * чтобы вернуть гейт туда, где он нужен и проверен.
 *
 * Without an active gate the hook reports "always visible", so iOS, web, article
 * details and tests keep the current behaviour.
 */

type MeasurableView = View & {
  measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void
}

type GateEntry = {
  ref: React.RefObject<MeasurableView | null>
  height: number
  visible: boolean
  windowY: number | null
  offsetAtMeasure: number
  setVisible: (visible: boolean) => void
}

type RichMediaViewportGate = {
  register: (entry: GateEntry) => () => void
  measure: (entry: GateEntry) => void
}

// Mount media this far ahead of / behind the viewport (in viewport heights). Ahead
// is generous so a normal fling lands on already-decoded photos; behind is smaller
// because scrolling back up is rarer and Glide's disk cache makes it cheap.
const AHEAD_VIEWPORTS = 1.25
const BEHIND_VIEWPORTS = 0.75
// Re-evaluating on every scroll frame is pointless — the mount band is viewport-sized.
const EVALUATE_STEP_PX = 64
const SETTLE_REMEASURE_MS = 250
// If a view never reports a position (never laid out, measure unsupported), show it
// rather than leaving a permanently blank frame.
const MEASURE_FALLBACK_MS = 1500

const RichMediaViewportContext = createContext<RichMediaViewportGate | null>(null)

export function RichMediaViewportProvider({
  scrollY,
  settledOffsetY,
  children,
}: {
  scrollY: Animated.Value
  /**
   * Смещение скролла из обычного JS-колбэка (`onScrollEndDrag` /
   * `onMomentumScrollEnd`). Обязательный второй источник: см. эффект ниже.
   */
  settledOffsetY?: number
  children: React.ReactNode
}) {
  const entriesRef = useRef(new Set<GateEntry>())
  const offsetRef = useRef(0)
  const lastEvaluatedOffsetRef = useRef(Number.NaN)
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Только Android: на iOS этот же measure/unmount-цикл оставляет рамку пустой
  // (inline-фото — #1666, плитки квестов — #1696), а выигрыша Glide там нет.
  const isEnabled = Platform.OS === 'android'

  const applyVisibility = useCallback((entry: GateEntry) => {
    if (entry.windowY == null) return
    const viewportHeight = Dimensions.get('window').height || 0
    const y = entry.windowY - (offsetRef.current - entry.offsetAtMeasure)
    const visible =
      y < viewportHeight + viewportHeight * AHEAD_VIEWPORTS &&
      y + entry.height > -viewportHeight * BEHIND_VIEWPORTS
    if (visible === entry.visible) return
    entry.visible = visible
    entry.setVisible(visible)
  }, [])

  const measure = useCallback(
    (entry: GateEntry) => {
      if (!isEnabled) return
      const node = entry.ref.current
      if (!node || typeof node.measureInWindow !== 'function') return
      node.measureInWindow((_x, y, _width, height) => {
        if (!Number.isFinite(y)) return
        entry.windowY = y
        entry.offsetAtMeasure = offsetRef.current
        if (Number.isFinite(height) && height > 0) entry.height = height
        applyVisibility(entry)
      })
    },
    [applyVisibility, isEnabled]
  )

  const evaluateAll = useCallback(() => {
    entriesRef.current.forEach(applyVisibility)
  }, [applyVisibility])

  const remeasureAll = useCallback(() => {
    entriesRef.current.forEach(measure)
  }, [measure])

  const register = useCallback(
    (entry: GateEntry) => {
      const entries = entriesRef.current
      entries.add(entry)
      measure(entry)
      const fallback = setTimeout(() => {
        if (entry.windowY == null && !entry.visible) {
          entry.visible = true
          entry.setVisible(true)
        }
      }, MEASURE_FALLBACK_MS)
      return () => {
        clearTimeout(fallback)
        entries.delete(entry)
      }
    },
    [measure]
  )

  useEffect(() => {
    if (!isEnabled || !scrollY) return undefined

    const id = scrollY.addListener(({ value }) => {
      offsetRef.current = value
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
      settleTimerRef.current = setTimeout(remeasureAll, SETTLE_REMEASURE_MS)
      const last = lastEvaluatedOffsetRef.current
      if (Number.isFinite(last) && Math.abs(value - last) < EVALUATE_STEP_PX) return
      lastEvaluatedOffsetRef.current = value
      evaluateAll()
    })

    return () => {
      scrollY.removeListener(id)
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
    }
  }, [evaluateAll, isEnabled, remeasureAll, scrollY])

  // Второй, надёжный источник положения скролла.
  //
  // `Animated.event` для этого экрана создаётся с `useNativeDriver: true`
  // (`useTravelDetailsContainerViewModel.ts:187`), а JS-слушатель такого
  // значения обновлений на Android не получает. Из-за этого `offsetRef`
  // оставался нулём, `evaluateAll` после регистрации не вызывался ни разу, и
  // любое фото, не попавшее в стартовую полосу видимости, не монтировалось
  // НИКОГДА: пустая серая рамка и ноль сетевых запросов, сколько ни скролль.
  // Страховочный таймер здесь не помогал — он срабатывает только при
  // `windowY == null`, а измерение как раз проходило успешно.
  //
  // `onScrollEndDrag`/`onMomentumScrollEnd` — обычные JS-колбэки и приходят
  // всегда. Полагаться на них достаточно: полоса монтирования размером с
  // вьюпорт, и гейт и так задуман как «досчитать, когда жест успокоился».
  useEffect(() => {
    if (!isEnabled) return
    if (typeof settledOffsetY !== 'number' || !Number.isFinite(settledOffsetY)) return
    offsetRef.current = settledOffsetY
    lastEvaluatedOffsetRef.current = settledOffsetY
    remeasureAll()
  }, [isEnabled, remeasureAll, settledOffsetY])

  const gate = useMemo<RichMediaViewportGate | null>(
    () => (isEnabled ? { register, measure } : null),
    [isEnabled, measure, register]
  )

  if (!gate) return <>{children}</>

  return (
    <RichMediaViewportContext.Provider value={gate}>{children}</RichMediaViewportContext.Provider>
  )
}

/**
 * Returns a ref/onLayout pair to attach to the media frame plus whether the frame
 * is close enough to the viewport to mount its image. Reports `true` when no gate
 * is active above (iOS, web, article details, tests).
 */
export function useRichMediaVisibility(estimatedHeight: number) {
  const gate = useContext(RichMediaViewportContext)
  const ref = useRef<MeasurableView | null>(null)
  const [visible, setVisible] = useState(() => gate == null)
  const entryRef = useRef<GateEntry | null>(null)

  if (entryRef.current == null) {
    entryRef.current = {
      ref,
      height: estimatedHeight,
      visible: gate == null,
      windowY: null,
      offsetAtMeasure: 0,
      setVisible: () => {},
    }
  }
  entryRef.current.setVisible = setVisible

  useEffect(() => {
    const entry = entryRef.current
    if (!entry) return undefined
    if (!gate) {
      entry.visible = true
      setVisible(true)
      return undefined
    }
    return gate.register(entry)
  }, [gate])

  const onLayout = useCallback(() => {
    const entry = entryRef.current
    if (!gate || !entry) return
    entry.height = estimatedHeight
    gate.measure(entry)
  }, [estimatedHeight, gate])

  return { ref, visible, onLayout }
}
