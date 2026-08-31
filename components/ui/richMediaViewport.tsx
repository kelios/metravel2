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
 * Native-only viewport gate for rich-text media (#1035).
 *
 * A long travel article carries dozens of body photos (travel #564 has 94). On
 * native every mounted `expo-image` starts its Glide request as soon as the view
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
 * Without a provider the hook reports "always visible", so web, article details
 * and tests keep the current behaviour.
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
  children,
}: {
  scrollY: Animated.Value
  children: React.ReactNode
}) {
  const entriesRef = useRef(new Set<GateEntry>())
  const offsetRef = useRef(0)
  const lastEvaluatedOffsetRef = useRef(Number.NaN)
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isEnabled = Platform.OS !== 'web'

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
 * is mounted above (web, article details, tests).
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
