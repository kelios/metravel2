import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Keyboard, Platform, ScrollView, StyleSheet, TextInput, View,
  type KeyboardEvent, type LayoutChangeEvent, type StyleProp, type ViewStyle,
} from 'react-native'

type Viewport = { width: number; height: number }

/** Dialog resize has already removed this part of the reported IME overlap. */
export function residualModalKeyboardInset(reported: number, restingHeight: number, height: number): number {
  const safe = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0
  return Math.max(0, safe(reported) - Math.max(0, safe(restingHeight) - safe(height)))
}

export function modalChromeNeedsFlow(height: number, header: number, footer: number, minimumControl: number): boolean {
  return height > 0 && header + footer + minimumControl > height
}

type Props = {
  active: boolean
  editing: boolean
  header: ReactNode
  footer: ReactNode
  children: ReactNode
  backgroundColor: string
  contentContainerStyle?: StyleProp<ViewStyle>
  testID?: string
}

/** One stable scroll/focus owner; only stateless chrome changes parents. */
export default function NativeModalFormShell({
  active, editing, header, footer, children, backgroundColor, contentContainerStyle, testID = 'native-modal-form',
}: Props) {
  const scroll = useRef<ScrollView>(null)
  const body = useRef<View>(null)
  const restingViewport = useRef<Viewport | null>(null)
  const [viewport, setViewport] = useState<Viewport>({ width: 0, height: 0 })
  const [headerHeight, setHeaderHeight] = useState(0)
  const [footerHeight, setFooterHeight] = useState(0)
  const [focusRevision, setFocusRevision] = useState(0)
  const [keyboard, setKeyboard] = useState({ visible: false, height: 0 })

  useEffect(() => {
    if (!active) {
      restingViewport.current = null
      setKeyboard({ visible: false, height: 0 })
      setViewport({ width: 0, height: 0 })
      setHeaderHeight(0)
      setFooterHeight(0)
      return
    }
    const sync = (event?: KeyboardEvent) => {
      const visible = event ? true : Keyboard.isVisible()
      setKeyboard({ visible, height: visible ? (event?.endCoordinates.height ?? Keyboard.metrics()?.height ?? 0) : 0 })
    }
    sync()
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', sync)
    // Keep flow chrome through interactive dismissal, until the keyboard is gone.
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard({ visible: false, height: 0 }))
    const frame = Keyboard.addListener('keyboardDidChangeFrame', (event) => {
      if (Keyboard.isVisible()) sync(event)
    })
    return () => { show.remove(); hide.remove(); frame.remove() }
  }, [active])

  const inset = Platform.OS === 'android' && keyboard.visible
    ? residualModalKeyboardInset(keyboard.height, restingViewport.current?.height ?? viewport.height, viewport.height)
    : 0
  const flow = editing || keyboard.visible || modalChromeNeedsFlow(
    viewport.height, headerHeight, footerHeight, Platform.OS === 'android' ? 48 : 44,
  )

  useEffect(() => {
    if (Platform.OS !== 'android' || !active || !editing || !keyboard.visible) return
    const input = TextInput.State.currentlyFocusedInput()
    if (!input || !body.current || viewport.height <= 0) return
    let cancelled = false
    // RN's keyboard responder assumes a full-screen scroll and uses screenY.
    // Keep both measurements local to this safe modal viewport instead.
    input.measureLayout(body.current, (_left, top, _width, height) => {
      if (cancelled || TextInput.State.currentlyFocusedInput() !== input) return
      // A rotation with the IME open may have no hidden baseline yet. The
      // conservative inset must not scroll the entire focused input above us.
      const visibleHeight = Math.max(height, viewport.height - inset)
      scroll.current?.scrollTo({ y: Math.max(0, headerHeight + top + height - visibleHeight), animated: true })
    })
    return () => { cancelled = true }
  }, [active, editing, focusRevision, headerHeight, inset, keyboard.visible, viewport.height, viewport.width])

  const onLayout = ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    const next = { width: layout.width, height: layout.height }
    // A rotation/window resize needs a new hidden baseline, not a historic max.
    if (restingViewport.current?.width !== next.width) restingViewport.current = null
    // Focus arrives before Android's resize/show event; do not mistake that
    // intermediate resized frame for a new keyboard-hidden baseline.
    if (!editing && !Keyboard.isVisible() && !keyboard.visible) restingViewport.current = next
    setViewport(next)
  }
  const headerView = (
    <View key="header" testID={`${testID}-header`} onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
      style={[{ backgroundColor }, !flow && styles.header]}>{header}</View>
  )
  const footerView = (
    <View key="footer" testID={`${testID}-footer`} onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
      style={[{ backgroundColor }, !flow && styles.footer]}>{footer}</View>
  )

  return (
    <View testID={testID} onLayout={onLayout} style={styles.root}>
      <ScrollView key="scroll" ref={scroll} testID={`${testID}-scroll`} style={styles.root}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: flow ? 0 : headerHeight, paddingBottom: (flow ? 0 : footerHeight) + inset }}>
        {flow ? headerView : null}
        <View key="body" ref={body} testID={`${testID}-body`}
          onLayout={() => setFocusRevision((value) => value + 1)} onFocus={() => setFocusRevision((value) => value + 1)}
          style={contentContainerStyle}>{children}</View>
        {flow ? footerView : null}
      </ScrollView>
      {flow ? null : headerView}
      {flow ? null : footerView}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { position: 'absolute', top: 0, left: 0, right: 0 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
})
