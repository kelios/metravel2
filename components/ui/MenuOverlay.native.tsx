import { useEffect, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { AccessibilityInfo, BackHandler, StyleSheet, View } from 'react-native'
import { Portal } from 'react-native-paper'
import { useNativeMenuAccessibilityScope } from '@/components/ui/NativeMenuAccessibilityScope'
import type { MenuOverlayProps } from '@/components/ui/MenuOverlay.types'

function NativeMenuContent({
  onRequestClose, onClosed, accessibilityLabel, initialFocusRef, returnFocusRef, restoreFocusRef, children, presentationRef,
}: MenuOverlayProps & { presentationRef: RefObject<boolean> }) {
  const { register } = useNativeMenuAccessibilityScope()
  const closeRef = useRef(onRequestClose)
  closeRef.current = onRequestClose
  const lifecycleRef = useRef({ onClosed, returnFocusRef, restoreFocusRef })
  lifecycleRef.current = { onClosed, returnFocusRef, restoreFocusRef }
  const focusedRef = useRef(false)

  useLayoutEffect(() => {
    const unregister = register()
    // Visibility is live: retain the ref object, not its value at registration.
    const presentation = presentationRef
    return () => {
      const { returnFocusRef, restoreFocusRef } = lifecycleRef.current
      unregister(!presentation.current && restoreFocusRef.current ? returnFocusRef : undefined)
    }
  }, [register, presentationRef])
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeRef.current()
      return true
    })
    return () => subscription.remove()
  }, [])
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(accessibilityLabel)
  }, [accessibilityLabel])
  useEffect(() => () => {
    if (presentationRef.current) return // StrictMode effect replay is not dismissal.
    const { onClosed } = lifecycleRef.current
    // PortalConsumer only requests removal. This child's passive cleanup runs
    // after PortalManager commits the actual menu removal from the native host.
    onClosed?.()
  }, [presentationRef])

  return (
    <View
      style={StyleSheet.absoluteFill}
      accessibilityViewIsModal
      testID="native-menu-overlay"
      onLayout={() => {
        if (!focusedRef.current && initialFocusRef.current) {
          focusedRef.current = true
          AccessibilityInfo.sendAccessibilityEvent(initialFocusRef.current, 'focus')
        }
      }}
    >
      {children}
    </View>
  )
}

export default function MenuOverlay(props: MenuOverlayProps) {
  const presentationRef = useRef(props.visible)
  presentationRef.current = props.visible
  useLayoutEffect(() => {
    presentationRef.current = props.visible
    return () => { presentationRef.current = false }
  }, [props.visible])
  return props.visible ? <Portal><NativeMenuContent {...props} presentationRef={presentationRef} /></Portal> : null
}
