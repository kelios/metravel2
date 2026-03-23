/**
 * Hook for focus management and keyboard navigation
 * Improves accessibility by managing focus properly
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform, AccessibilityInfo, findNodeHandle } from 'react-native'

export interface FocusOptions {
  /** Auto-focus on mount */
  autoFocus?: boolean
  /** Restore focus on unmount to previous element */
  restoreFocus?: boolean
  /** Focus trap (don't allow focus outside) */
  trapFocus?: boolean
  /** Initial focus ref */
  initialFocusRef?: React.RefObject<HTMLElement | null>
}

export interface UseFocusManagementReturn {
  /** Current focused element ID */
  focusedId: string | null
  /** Focus element by ID */
  focusElement: (id: string) => void
  /** Focus next element in tab order */
  focusNext: () => void
  /** Focus previous element in tab order */
  focusPrevious: () => void
  /** Focus first element */
  focusFirst: () => void
  /** Focus last element */
  focusLast: () => void
  /** Register focusable element */
  registerFocusable: (id: string, ref: React.RefObject<HTMLElement | null>) => void
  /** Unregister focusable element */
  unregisterFocusable: (id: string) => void
  /** Check if screen reader is enabled */
  isScreenReaderEnabled: boolean
}

export function useFocusManagement(
  options: FocusOptions = {}
): UseFocusManagementReturn {
  const {
    autoFocus = false,
    restoreFocus = false,
    trapFocus = false,
    initialFocusRef,
  } = options

  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false)
  const focusableElements = useRef<Map<string, React.RefObject<HTMLElement | null>>>(new Map())
  const previousFocusRef = useRef<HTMLElement | null>(null)

  /**
   * Check screen reader status
   */
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Check for screen reader on web
      setIsScreenReaderEnabled(false) // Can't reliably detect on web
      return undefined
    } else {
      // Native: use AccessibilityInfo
      AccessibilityInfo.isScreenReaderEnabled().then(setIsScreenReaderEnabled)

      const subscription = AccessibilityInfo.addEventListener(
        'screenReaderChanged',
        setIsScreenReaderEnabled
      )

      return () => subscription?.remove()
    }
  }, [])

  /**
   * Register focusable element
   */
  const registerFocusable = useCallback(
    (id: string, ref: React.RefObject<HTMLElement | null>) => {
      focusableElements.current.set(id, ref)
    },
    []
  )

  /**
   * Unregister focusable element
   */
  const unregisterFocusable = useCallback((id: string) => {
    focusableElements.current.delete(id)
  }, [])

  /**
   * Focus element by ID
   */
  const focusElement = useCallback((id: string) => {
    const ref = focusableElements.current.get(id)
    if (!ref?.current) return

    if (Platform.OS === 'web') {
      ref.current.focus?.()
    } else {
      const nodeHandle = findNodeHandle(ref.current as never)
      if (nodeHandle != null) {
        AccessibilityInfo.setAccessibilityFocus(nodeHandle)
      }
    }

    setFocusedId(id)
  }, [])

  /**
   * Get focusable IDs in order
   */
  const getFocusableIds = useCallback(() => {
    return Array.from(focusableElements.current.keys())
  }, [])

  /**
   * Focus next element
   */
  const focusNext = useCallback(() => {
    const ids = getFocusableIds()
    if (ids.length === 0) return

    const currentIndex = focusedId ? ids.indexOf(focusedId) : -1
    const nextIndex = (currentIndex + 1) % ids.length

    focusElement(ids[nextIndex])
  }, [focusedId, getFocusableIds, focusElement])

  /**
   * Focus previous element
   */
  const focusPrevious = useCallback(() => {
    const ids = getFocusableIds()
    if (ids.length === 0) return

    const currentIndex = focusedId ? ids.indexOf(focusedId) : -1
    const prevIndex = currentIndex <= 0 ? ids.length - 1 : currentIndex - 1

    focusElement(ids[prevIndex])
  }, [focusedId, getFocusableIds, focusElement])

  /**
   * Focus first element
   */
  const focusFirst = useCallback(() => {
    const ids = getFocusableIds()
    if (ids.length > 0) {
      focusElement(ids[0])
    }
  }, [getFocusableIds, focusElement])

  /**
   * Focus last element
   */
  const focusLast = useCallback(() => {
    const ids = getFocusableIds()
    if (ids.length > 0) {
      focusElement(ids[ids.length - 1])
    }
  }, [getFocusableIds, focusElement])

  /**
   * Auto-focus on mount
   */
  useEffect(() => {
    if (!autoFocus) return

    // Save previous focus
    if (restoreFocus && Platform.OS === 'web') {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    }

    // Focus initial element
    if (initialFocusRef?.current) {
      if (Platform.OS === 'web') {
        initialFocusRef.current.focus()
      } else {
        const nodeHandle = findNodeHandle(initialFocusRef.current as never)
        if (nodeHandle != null) {
          AccessibilityInfo.setAccessibilityFocus(nodeHandle)
        }
      }
    } else {
      focusFirst()
    }

    // Restore focus on unmount
    return () => {
      if (restoreFocus && previousFocusRef.current && Platform.OS === 'web') {
        previousFocusRef.current.focus()
      }
    }
  }, [autoFocus, restoreFocus, initialFocusRef, focusFirst])

  /**
   * Trap focus within container
   */
  useEffect(() => {
    if (!trapFocus || Platform.OS !== 'web') return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      event.preventDefault()

      if (event.shiftKey) {
        focusPrevious()
      } else {
        focusNext()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [trapFocus, focusNext, focusPrevious])

  return {
    focusedId,
    focusElement,
    focusNext,
    focusPrevious,
    focusFirst,
    focusLast,
    registerFocusable,
    unregisterFocusable,
    isScreenReaderEnabled,
  }
}

/**
 * Hook for managing focus within a modal/dialog
 */
export function useModalFocus(
  isOpen: boolean,
  closeHandler?: () => void
): UseFocusManagementReturn & { handleEscape: (event: KeyboardEvent) => void } {
  const focusManagement = useFocusManagement({
    autoFocus: isOpen,
    restoreFocus: true,
    trapFocus: isOpen,
  })

  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        closeHandler?.()
      }
    },
    [isOpen, closeHandler]
  )

  useEffect(() => {
    if (!isOpen || Platform.OS !== 'web') return

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, handleEscape])

  return {
    ...focusManagement,
    handleEscape,
  }
}

/**
 * Announce message to screen readers
 */
export function announceForAccessibility(
  message: string,
  priority?: 'polite' | 'assertive'
): void {
  if (Platform.OS === 'web') {
    // Web: use live region
    const liveRegion = document.querySelector('[role="status"]') ||
      document.querySelector('[role="alert"]')

    if (liveRegion) {
      liveRegion.textContent = message
    } else {
      // Create temporary live region
      const region = document.createElement('div')
      region.setAttribute('role', priority === 'assertive' ? 'alert' : 'status')
      region.setAttribute('aria-live', priority || 'polite')
      region.setAttribute('aria-atomic', 'true')
      region.style.position = 'absolute'
      region.style.left = '-10000px'
      region.textContent = message

      document.body.appendChild(region)
      setTimeout(() => region.remove(), 1000)
    }
  } else {
    // Native: use AccessibilityInfo
    AccessibilityInfo.announceForAccessibility(message)
  }
}
