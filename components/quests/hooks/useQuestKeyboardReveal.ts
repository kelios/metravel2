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

type MeasurableInput = {
  measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void
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

  const handleContentScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = event.nativeEvent?.contentOffset?.y ?? 0
  }, [])

  const revealFocusedInput = useCallback(() => {
    const node = focusedInputRef.current
    const scroll = scrollRef.current
    if (!node?.measureInWindow || !scroll) return
    if (keyboardInsetRef.current <= 0) return

    node.measureInWindow((_x, y, _width, height) => {
      if (!Number.isFinite(y) || !Number.isFinite(height)) return
      const visibleBottom = windowHeightRef.current - keyboardInsetRef.current
      const delta = y + height + REVEAL_GAP - visibleBottom
      if (delta <= REVEAL_EPSILON) return
      scroll.scrollTo({ y: Math.max(0, scrollOffsetRef.current + delta), animated: true })
    })
  }, [scrollRef])

  const handleInputFocus = useCallback(
    (node: MeasurableInput | null) => {
      focusedInputRef.current = node
      // Клавиатура ещё выезжает — меряем после её появления (эффект ниже), а этот
      // прогон помогает, когда клавиатура уже открыта и меняется только фокус.
      revealFocusedInput()
    },
    [revealFocusedInput],
  )

  const handleInputBlur = useCallback(() => {
    focusedInputRef.current = null
  }, [])

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
    const id = setTimeout(revealFocusedInput, 60)
    return () => clearTimeout(id)
  }, [keyboardInset, revealFocusedInput])

  return { keyboardInset, handleContentScroll, handleInputFocus, handleInputBlur }
}
