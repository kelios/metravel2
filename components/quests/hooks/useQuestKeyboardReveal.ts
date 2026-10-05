import { useCallback, useEffect, useRef, useState } from 'react'
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
 * Раскрытие над клавиатурой — обязанность только этого хука: вместе с полем он
 * раскрывает и обратную связь по ответу под ним (ошибка, пауза, подсказка,
 * приглашение пропустить шаг), когда она появляется при открытой клавиатуре
 * (#1072). Поле при этом не уезжает за верх области прокрутки — игрок видит и
 * то, что ввёл, и вердикт. Клавиатуру хук не прячет: после неверного ответа
 * игрок вводит следующий.
 *
 * Android: RN отдаёт высоту клавиатуры как `imeInsets.bottom - systemBars.bottom`,
 * то есть БЕЗ nav-bar инсета, тогда как корневая вьюха рисуется за этим баром —
 * поэтому добавляем `insets.bottom` обратно.
 */
export function useQuestKeyboardReveal(scrollRef: React.RefObject<ScrollView | null>) {
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

  const scrollOffsetRef = useRef(0)
  const focusedInputRef = useRef<MeasurableInput | null>(null)
  const feedbackEndRef = useRef<MeasurableInput | null>(null)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleContentScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = event.nativeEvent?.contentOffset?.y ?? 0
  }, [])

  const revealAnswerArea = useCallback(() => {
    const input = focusedInputRef.current
    const scroll = scrollRef.current
    if (!input || !scroll) return
    if (keyboardInsetRef.current <= 0) return
    const feedbackEnd = feedbackEndRef.current

    // Ref ScrollView и в RN, и в RNW — сам хост-узел с методами прокрутки,
    // поэтому `measureInWindow` у него есть, хотя в типах ScrollView его нет.
    void Promise.all([
      measureWindowRect(input),
      measureWindowRect(scroll as unknown as MeasurableInput),
      feedbackEnd ? measureWindowRect(feedbackEnd) : null,
    ]).then(([inputRect, viewportRect, feedbackRect]) => {
      if (!inputRect) return
      const visibleBottom = windowHeightRef.current - keyboardInsetRef.current
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
      focusedInputRef.current = node
      // Клавиатура ещё выезжает — меряем после её появления (эффект ниже), а этот
      // прогон помогает, когда клавиатура уже открыта и меняется только фокус.
      revealAnswerArea()
    },
    [revealAnswerArea],
  )

  const handleInputBlur = useCallback(() => {
    focusedInputRef.current = null
  }, [])

  /**
   * Под полем появилась, сменилась или исчезла обратная связь по ответу.
   * `node` — метка конца этой обратной связи (null — её нет, раскрываем одно поле).
   */
  const handleAnswerFeedback = useCallback(
    (node: MeasurableInput | null) => {
      feedbackEndRef.current = node
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = node ? setTimeout(revealAnswerArea, REVEAL_SETTLE_MS) : null
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
