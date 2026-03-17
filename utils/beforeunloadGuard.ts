/**
 * Safe beforeunload handler that respects Permissions Policy
 * Prevents "Permissions policy violation: unload is not allowed" errors
 */

import { Platform } from 'react-native'

/**
 * Check if unload/beforeunload is allowed by Permissions Policy
 */
export function isUnloadAllowed(): boolean {
  if (Platform.OS !== 'web') return false

  try {
    // Check if we're in top window
    const isTopWindow = window.self === window.top

    if (!isTopWindow) {
      return false
    }

    // Check Permissions Policy
    const permissionsPolicy = (document as any).permissionsPolicy
    if (!permissionsPolicy?.allowsFeature) {
      // Old browser - assume allowed
      return true
    }

    // Check if 'unload' feature is allowed
    return permissionsPolicy.allowsFeature('unload')
  } catch (error) {
    // If we can't check, assume not allowed to be safe
    console.warn('[beforeunloadGuard] Failed to check unload permission:', error)
    return false
  }
}

/**
 * Safely add beforeunload event listener
 * Returns cleanup function or null if not supported
 */
export function addBeforeUnloadListener(
  handler: (event: BeforeUnloadEvent) => string | void
): (() => void) | null {
  if (!isUnloadAllowed()) {
    return null
  }

  try {
    window.addEventListener('beforeunload', handler)
    return () => {
      try {
        window.removeEventListener('beforeunload', handler)
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    console.warn('[beforeunloadGuard] Failed to add beforeunload listener:', error)
    return null
  }
}

/**
 * Hook-friendly version for React components
 */
export function useBeforeUnload(
  handler: (event: BeforeUnloadEvent) => string | void,
  enabled: boolean = true
): void {
  if (Platform.OS !== 'web') return

  React.useEffect(() => {
    if (!enabled) return

    const cleanup = addBeforeUnloadListener(handler)
    return cleanup || undefined
  }, [handler, enabled])
}

/**
 * Create a beforeunload handler that shows confirmation
 */
export function createBeforeUnloadHandler(
  message: string = 'У вас есть несохранённые изменения. Вы уверены?'
): (event: BeforeUnloadEvent) => string {
  return (event: BeforeUnloadEvent) => {
    event.preventDefault()
    // Modern browsers ignore custom message, but we still need to set returnValue
    event.returnValue = message
    return message
  }
}

/**
 * Safe wrapper for pagehide event (modern alternative to unload)
 * This is the recommended approach for cleanup tasks
 */
export function addPageHideListener(
  handler: (event: PageTransitionEvent) => void
): (() => void) | null {
  if (Platform.OS !== 'web') return null

  try {
    window.addEventListener('pagehide', handler)
    return () => {
      try {
        window.removeEventListener('pagehide', handler)
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    console.warn('[beforeunloadGuard] Failed to add pagehide listener:', error)
    return null
  }
}

/**
 * Safe wrapper for visibilitychange event (another modern alternative)
 * Useful for detecting when user navigates away
 */
export function addVisibilityChangeListener(
  handler: () => void
): (() => void) | null {
  if (Platform.OS !== 'web') return null

  try {
    const wrappedHandler = () => {
      if (document.visibilityState === 'hidden') {
        handler()
      }
    }

    document.addEventListener('visibilitychange', wrappedHandler)
    return () => {
      try {
        document.removeEventListener('visibilitychange', wrappedHandler)
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    console.warn('[beforeunloadGuard] Failed to add visibilitychange listener:', error)
    return null
  }
}

// Re-export React for useBeforeUnload hook
import * as React from 'react'
