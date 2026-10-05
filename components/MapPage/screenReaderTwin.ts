import { Platform, type AccessibilityActionEvent } from 'react-native'

/**
 * #2243 — a control that must draw over a later sibling (zIndex) but must be
 * READ before it is split in two: the visible control, hidden from screen
 * readers, and its screen-reader twin placed where the reading order needs it
 * (see `collapseToggleLead` in `screens/tabs/mapDesktopOverlay.styles.ts`).
 * The twin never takes a touch; screen-reader activation runs the same action.
 */
export const HIDDEN_FROM_SCREEN_READERS = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const

const ACTIVATE_ACTION = [{ name: 'activate' }] as const

/**
 * Activation of a twin by VoiceOver / TalkBack double tap. iOS: a View
 * activates through `onAccessibilityTap` (`RCTViewComponentView
 * accessibilityActivate`); an `activate` entry in `accessibilityActions` would
 * only add a stray rotor action there. Android: `activate` maps to
 * `ACTION_CLICK` (`ReactAccessibilityDelegate`) and arrives as
 * `onAccessibilityAction`.
 */
export function screenReaderActivateProps(onActivate: () => void) {
  if (Platform.OS === 'ios') return { onAccessibilityTap: onActivate }
  return {
    accessibilityActions: ACTIVATE_ACTION,
    onAccessibilityAction: (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === 'activate') onActivate()
    },
  }
}
