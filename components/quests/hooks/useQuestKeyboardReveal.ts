import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Keyboard,
  Platform,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useWebKeyboardInset } from '@/hooks/useWebKeyboardInset'

/** Зазор между полем ввода и верхом клавиатуры. */
const REVEAL_GAP = 16
/** Порог, ниже которого доскроллить нечего (дребезг измерений). */
const REVEAL_EPSILON = 2
/** Пауза до замера: клавиатура доехала или блок обратной связи вставлен, раскладка ещё в пути. */
const REVEAL_SETTLE_MS = 60

type MeasurableInput = {
  measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void
}

type WindowRect = { y: number; height: number }

function measureWindowRect(node: MeasurableInput): Promise<WindowRect | null> {
  return new Promise((resolve) => {
    if (!node.measureInWindow) return resolve(null)
    node.measureInWindow((_x, y, _width, height) => {
      resolve(Number.isFinite(y) && Number.isFinite(height) ? { y, height } : null)
    })
  })
}

/**
 * Клавиатура и поле ответа квеста.
 *
 * Корневое окно приложения НЕ ужимается под клавиатурой (edge-to-edge на Android,
 * visual viewport на mobile web) — тот же контракт, что и в чате
 * (`components/messages/ChatView.tsx`). Поэтому `KeyboardAvoidingView` здесь
 * ничего не даёт: поле ответа остаётся под клавиатурой и доскроллить до него
 * нечем. Хук отдаёт реальное перекрытие (резерв снизу для контент-скролла) и
 * сам доматывает сфокусированное поле над клавиатурой.
 *
 * Раскрытие поля ответа и обратной связи по нему — обязанность только этого
 * хука. Поле он доматывает над открытой клавиатурой; обратную связь под полем
 * (ошибка, пауза, подсказка, приглашение пропустить шаг) — всегда, когда она
 * появляется: над клавиатурой, если та открыта (#1072), и над нижним краем
 * области прокрутки, если закрыта (#2271: на web и тап по «Проверить», и Enter
 * снимают фокус, клавиатура уходит — это основной путь, а на desktop области
 * прокрутки снизу подпирает футер). Поле при этом не уезжает за верх области
 * прокрутки — игрок видит и то, что ввёл, и вердикт. Клавиатуру хук не прячет:
 * после неверного ответа игрок вводит следующий.
 *
 * Android: RN отдаёт высоту клавиатуры как `imeInsets.bottom - systemBars.bottom`,
 * то есть БЕЗ nav-bar инсета, тогда как корневая вьюха рисуется за этим баром —
 * поэтому добавляем `insets.bottom` обратно.
 *
 * `bottomChromePx` — нижняя панель навигации, которая лежит поверх области
 * прокрутки (на телефоне ScrollView уходит под неё): её полоса тоже не видна,
 * и вердикт под ней игрок не прочтёт (замер Android, #2271).
 */
export function useQuestKeyboardReveal(scrollRef: React.RefObject<ScrollView | null>, bottomChromePx = 0, stepKey?: string | null) {
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const webKeyboardInset = useWebKeyboardInset()
  const [nativeKeyboardHeight, setNativeKeyboardHeight] = useState(0)

  const keyboardInset =
    Platform.OS === 'web'
      ? webKeyboardInset
      : nativeKeyboardHeight > 0
        ? nativeKeyboardHeight + (Platform.OS === 'android' ? insets.bottom : 0)
        : 0

  const keyboardInsetRef = useRef(keyboardInset)
  keyboardInsetRef.current = keyboardInset
  const windowHeightRef = useRef(windowHeight)
  windowHeightRef.current = windowHeight
  const bottomChromeRef = useRef(bottomChromePx)
  bottomChromeRef.current = bottomChromePx

  const scrollOffsetRef = useRef(0)
  const focusedInputRef = useRef<MeasurableInput | null>(null)
  // Поле ответа, к которому относится обратная связь: фокус к её появлению уже
  // снят (blur на отправке), а верхняя граница раскрытия считается по полю.
  const answerInputRef = useRef<MeasurableInput | null>(null)
  const feedbackEndRef = useRef<MeasurableInput | null>(null)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const measurementGeneration = useRef(0)
  // Reset before the new card's passive feedback report, including steps without
  // a text input. SSR has no layout work; native/web commits use a layout effect.
  const useStepResetEffect = Platform.OS === 'web' && typeof window === 'undefined' ? useEffect : useLayoutEffect
  useStepResetEffect(() => {
    const generation = measurementGeneration
    generation.current += 1
    focusedInputRef.current = null
    answerInputRef.current = null
    feedbackEndRef.current = null
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = null
    return () => { generation.current += 1 }
  }, [stepKey])

  const handleContentScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = event.nativeEvent?.contentOffset?.y ?? 0
  }, [])

  // `freshFeedback` — обратная связь появилась только что, в этой сессии шага
  // (отказ, тап по подсказке): её раскрываем и без клавиатуры. Начальное
  // состояние шага (подсказка/попытки из сохранённого прогресса) без клавиатуры
  // экран не двигает — иначе он уезжал вниз сразу после входа на шаг.
  const revealAnswerArea = useCallback((freshFeedback = false) => {
    const generation = measurementGeneration.current
    const feedbackEnd = feedbackEndRef.current
    const input = focusedInputRef.current ?? (feedbackEnd ? answerInputRef.current : null)
    const scroll = scrollRef.current
    if (!input || !scroll) return
    // Одно поле без клавиатуры уже там, где игрок по нему кликнул.
    if (keyboardInsetRef.current <= 0 && !(feedbackEnd && freshFeedback)) return

    // Ref ScrollView и в RN, и в RNW — сам хост-узел с методами прокрутки,
    // поэтому `measureInWindow` у него есть, хотя в типах ScrollView его нет.
    void Promise.all([
      measureWindowRect(input),
      measureWindowRect(scroll as unknown as MeasurableInput),
      feedbackEnd ? measureWindowRect(feedbackEnd) : null,
    ]).then(([inputRect, viewportRect, feedbackRect]) => {
      if (!inputRect || generation !== measurementGeneration.current || scrollRef.current !== scroll) return
      // Видимый низ — самый высокий из: верха клавиатуры, верха нижней панели
      // поверх области прокрутки и низа самой области (под ней футер на desktop).
      const aboveChrome = windowHeightRef.current - Math.max(keyboardInsetRef.current, bottomChromeRef.current)
      const visibleBottom = viewportRect
        ? Math.min(aboveChrome, viewportRect.y + viewportRect.height)
        : aboveChrome
      const inputDelta = inputRect.y + inputRect.height + REVEAL_GAP - visibleBottom
      // Низ обратной связи — над клавиатурой, но не ценой поля: верх поля
      // остаётся в области прокрутки, а само поле видно в любом случае.
      const delta = feedbackRect && viewportRect
        ? Math.max(
          inputDelta,
          Math.min(
            feedbackRect.y + feedbackRect.height + REVEAL_GAP - visibleBottom,
            inputRect.y - viewportRect.y - REVEAL_GAP,
          ),
        )
        : inputDelta
      if (delta <= REVEAL_EPSILON) return
      scroll.scrollTo({ y: Math.max(0, scrollOffsetRef.current + delta), animated: true })
    })
  }, [scrollRef])

  const handleInputFocus = useCallback(
    (node: MeasurableInput | null) => {
      measurementGeneration.current += 1
      focusedInputRef.current = node
      if (node) answerInputRef.current = node
      // Клавиатура ещё выезжает — меряем после её появления (эффект ниже), а этот
      // прогон помогает, когда клавиатура уже открыта и меняется только фокус.
      revealAnswerArea()
    },
    [revealAnswerArea],
  )

  const handleInputBlur = useCallback(() => {
    measurementGeneration.current += 1
    focusedInputRef.current = null
  }, [])

  /**
   * Под полем появилась, сменилась или исчезла обратная связь по ответу.
   * `node` — метка конца этой обратной связи (null — её нет, раскрываем одно поле),
   * `input` — поле ответа, к которому она относится; `fresh` — появилась в этой
   * сессии шага, а не пришла с сохранённым прогрессом при входе на шаг.
   */
  const handleAnswerFeedback = useCallback(
    (node: MeasurableInput | null, input?: MeasurableInput | null, fresh = true) => {
      measurementGeneration.current += 1
      feedbackEndRef.current = node
      if (input) answerInputRef.current = input
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = node ? setTimeout(() => revealAnswerArea(fresh), REVEAL_SETTLE_MS) : null
    },
    [revealAnswerArea],
  )

  useEffect(
    () => () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    },
    [],
  )

  useEffect(() => {
    if (Platform.OS === 'web') return
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      setNativeKeyboardHeight(event.endCoordinates?.height ?? 0)
    })
    const hide = Keyboard.addListener('keyboardDidHide', () => setNativeKeyboardHeight(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  // Клавиатура доехала (native) или visual viewport ужался (web) — только теперь
  // известно реальное перекрытие, поэтому доматываем поле именно здесь.
  useEffect(() => {
    if (keyboardInset <= 0) return
    const id = setTimeout(revealAnswerArea, REVEAL_SETTLE_MS)
    return () => clearTimeout(id)
  }, [keyboardInset, revealAnswerArea])

  return { keyboardInset, handleContentScroll, handleInputFocus, handleInputBlur, handleAnswerFeedback }
}
