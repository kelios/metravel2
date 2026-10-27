import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode, type RefObject } from 'react'
import { type ViewInstance, AccessibilityInfo, View } from 'react-native'

type FocusTarget = RefObject<ViewInstance | null>
type Scope = { activeCount: number; register: () => (returnFocusRef?: FocusTarget) => void }
const NativeMenuAccessibilityContext = createContext<Scope | null>(null)

export function NativeMenuAccessibilityProvider({ children }: { children: ReactNode }) {
  const [{ activeCount, focusTarget }, setScope] = useState<{ activeCount: number; focusTarget: FocusTarget | null }>({
    activeCount: 0, focusTarget: null,
  })
  const register = useCallback(() => {
    setScope(({ activeCount }) => ({ activeCount: activeCount + 1, focusTarget: null }))
    return (returnFocusRef?: FocusTarget) => setScope(({ activeCount }) => ({
      activeCount: activeCount - 1,
      focusTarget: activeCount === 1 ? returnFocusRef ?? null : null,
    }))
  }, [])
  useEffect(() => {
    // The background's accessibility flags have committed before this effect.
    if (activeCount === 0 && focusTarget?.current) {
      AccessibilityInfo.sendAccessibilityEvent(focusTarget.current, 'focus')
    }
  }, [activeCount, focusTarget])
  const value = useMemo(() => ({ activeCount, register }), [activeCount, register])
  return <NativeMenuAccessibilityContext.Provider value={value}>{children}</NativeMenuAccessibilityContext.Provider>
}

export function useNativeMenuAccessibilityScope() {
  const scope = useContext(NativeMenuAccessibilityContext)
  if (!scope) throw new Error('Native menus require NativeMenuAccessibilityProvider')
  return scope
}

export function NativeMenuBackground({ children }: { children: ReactNode }) {
  const { activeCount } = useNativeMenuAccessibilityScope()
  const hidden = activeCount > 0
  return (
    <View
      style={{ flex: 1 }}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      pointerEvents={hidden ? 'none' : 'box-none'}
      testID="native-menu-background"
    >
      {children}
    </View>
  )
}
