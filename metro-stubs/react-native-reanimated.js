// #764: web-стаб react-native-reanimated (по образцу react-native-gesture-handler.js).
// На web микроанимации карточек/панелей деградируют до мгновенных статичных стилей,
// зато ~670KB raw reanimated уходит из eager __common. Native-бандл не затронут —
// резолв подменяется только для platform === 'web' в metro.config.js.
// Opt-out: DISABLE_REANIMATED_STUB=1.
import { useCallback, useEffect, useRef, forwardRef, createElement } from 'react'
import { View, Text, Image, ScrollView, FlatList, SectionList } from 'react-native'

const REANIMATED_ONLY_PROPS = [
  'entering',
  'exiting',
  'layout',
  'animatedProps',
  'sharedTransitionTag',
  'sharedTransitionStyle',
]

export function createAnimatedComponent(Component) {
  const Animated = forwardRef(function AnimatedStub(props, ref) {
    const rest = { ...props }
    const animatedProps = rest.animatedProps
    for (const key of REANIMATED_ONLY_PROPS) delete rest[key]
    // useAnimatedProps в стабе возвращает обычный объект — применяем как props.
    if (animatedProps && typeof animatedProps === 'object') Object.assign(rest, animatedProps)
    return createElement(Component, { ...rest, ref })
  })
  Animated.displayName = `AnimatedStub(${Component.displayName || Component.name || 'Component'})`
  return Animated
}

const AnimatedView = createAnimatedComponent(View)
const AnimatedText = createAnimatedComponent(Text)
const AnimatedImage = createAnimatedComponent(Image)
const AnimatedScrollView = createAnimatedComponent(ScrollView)
const AnimatedFlatList = createAnimatedComponent(FlatList)
const AnimatedSectionList = createAnimatedComponent(SectionList)

function makeMutable(initial) {
  const mutable = {
    value: initial,
    get: () => mutable.value,
    set: (next) => {
      mutable.value = typeof next === 'function' ? next(mutable.value) : next
    },
    modify: (fn) => {
      mutable.value = fn ? fn(mutable.value) : mutable.value
    },
    addListener: () => {},
    removeListener: () => {},
  }
  return mutable
}

export function useSharedValue(initial) {
  const ref = useRef(null)
  if (ref.current === null) ref.current = makeMutable(initial)
  return ref.current
}

// Стили/props вычисляются один раз за рендер; обновления sharedValue.value между
// рендерами кадр не двигают (анимации на web мгновенные — withTiming/withSpring
// возвращают конечное значение сразу).
export function useAnimatedStyle(updater) {
  return updater()
}

export function useAnimatedProps(updater) {
  return updater()
}

export function useDerivedValue(updater) {
  const sv = useSharedValue(undefined)
  sv.value = updater()
  return sv
}

export function useAnimatedReaction(prepare, react) {
  useEffect(() => {
    try {
      react(prepare(), null)
    } catch {
      // noop
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

export function useAnimatedScrollHandler(handlerOrHandlers) {
  return useCallback(
    (event) => {
      const e = event?.nativeEvent ?? event
      if (typeof handlerOrHandlers === 'function') handlerOrHandlers(e, {})
      else handlerOrHandlers?.onScroll?.(e, {})
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
}

export function useAnimatedRef() {
  return useRef(null)
}

export function useEvent(handler) {
  return handler
}

export function useHandler() {
  return { context: {}, doDependenciesDiffer: false, useWeb: true }
}

const deferCallback = (callback, finished) => {
  if (typeof callback === 'function') setTimeout(() => callback(finished), 0)
}

export function withTiming(toValue, _config, callback) {
  deferCallback(callback, true)
  return toValue
}

export function withSpring(toValue, _config, callback) {
  deferCallback(callback, true)
  return toValue
}

export function withDecay(_config, callback) {
  deferCallback(callback, true)
  return 0
}

export function withDelay(_delayMs, animation) {
  return animation
}

export function withRepeat(animation) {
  return animation
}

export function withSequence(...animations) {
  return animations.length ? animations[animations.length - 1] : 0
}

export function cancelAnimation() {}

export function runOnJS(fn) {
  return (...args) => fn(...args)
}

export function runOnUI(fn) {
  return (...args) => fn(...args)
}

export function measure() {
  return null
}

export function scrollTo(animatedRef, x, y, animated) {
  const node = animatedRef?.current
  if (node?.scrollTo) node.scrollTo({ x, y, animated })
}

export const Extrapolate = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' }
export const Extrapolation = Extrapolate
export const ReduceMotion = { System: 'system', Always: 'always', Never: 'never' }

const resolveExtrapolation = (extrapolationType, side) => {
  if (!extrapolationType) return 'extend'
  if (typeof extrapolationType === 'string') return extrapolationType
  return extrapolationType[side === 'left' ? 'extrapolateLeft' : 'extrapolateRight'] || 'extend'
}

export function interpolate(value, inputRange, outputRange, extrapolationType) {
  const n = Math.min(inputRange.length, outputRange.length)
  if (n < 2 || !Number.isFinite(value)) return outputRange[0] ?? 0

  if (value <= inputRange[0]) {
    const mode = resolveExtrapolation(extrapolationType, 'left')
    if (mode === 'clamp') return outputRange[0]
    if (mode === 'identity') return value
  }
  if (value >= inputRange[n - 1]) {
    const mode = resolveExtrapolation(extrapolationType, 'right')
    if (mode === 'clamp') return outputRange[n - 1]
    if (mode === 'identity') return value
  }

  let i = 1
  while (i < n - 1 && inputRange[i] < value) i += 1
  const x0 = inputRange[i - 1]
  const x1 = inputRange[i]
  const y0 = outputRange[i - 1]
  const y1 = outputRange[i]
  if (x1 === x0) return y1
  return y0 + ((value - x0) / (x1 - x0)) * (y1 - y0)
}

export function interpolateColor(value, inputRange, outputRange) {
  const n = Math.min(inputRange.length, outputRange.length)
  if (!n) return 'transparent'
  let nearest = 0
  for (let i = 1; i < n; i += 1) {
    if (Math.abs(inputRange[i] - value) < Math.abs(inputRange[nearest] - value)) nearest = i
  }
  return outputRange[nearest]
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

// Любой Easing.<x> — значение-функция; любой Easing.<x>(...) — тоже функция. Конфиги
// стабом игнорируются, поэтому достаточно identity-поведения на любом пути доступа.
export const Easing = new Proxy(
  {},
  {
    get: () => {
      const chain = (...args) => (typeof args[0] === 'number' ? args[0] : chain)
      return chain
    },
  }
)

// Layout/entering/exiting-пресеты (LinearTransition, FadeIn.duration(200).delay(50)...)
// — бесконечно чейнящиеся no-op объекты; createAnimatedComponent эти props отбрасывает.
const makeLayoutPreset = () => {
  const preset = new Proxy(function () {}, {
    get: (_target, prop) => {
      if (prop === 'build') return () => ({})
      if (prop === Symbol.toPrimitive || prop === 'toString') return () => 'ReanimatedStubPreset'
      return () => preset
    },
    apply: () => preset,
  })
  return preset
}

export const LinearTransition = makeLayoutPreset()
export const Layout = makeLayoutPreset()
export const CurvedTransition = makeLayoutPreset()
export const SequencedTransition = makeLayoutPreset()
export const FadingTransition = makeLayoutPreset()
export const FadeIn = makeLayoutPreset()
export const FadeOut = makeLayoutPreset()
export const FadeInDown = makeLayoutPreset()
export const FadeInUp = makeLayoutPreset()
export const FadeOutDown = makeLayoutPreset()
export const FadeOutUp = makeLayoutPreset()
export const SlideInDown = makeLayoutPreset()
export const SlideInUp = makeLayoutPreset()
export const SlideInLeft = makeLayoutPreset()
export const SlideInRight = makeLayoutPreset()
export const SlideOutDown = makeLayoutPreset()
export const SlideOutUp = makeLayoutPreset()
export const SlideOutLeft = makeLayoutPreset()
export const SlideOutRight = makeLayoutPreset()
export const ZoomIn = makeLayoutPreset()
export const ZoomOut = makeLayoutPreset()

export function configureReanimatedLogger() {}
export const ReanimatedLogLevel = { warn: 1, error: 2 }

const Animated = {
  View: AnimatedView,
  Text: AnimatedText,
  Image: AnimatedImage,
  ScrollView: AnimatedScrollView,
  FlatList: AnimatedFlatList,
  SectionList: AnimatedSectionList,
  createAnimatedComponent,
}

export default Animated
