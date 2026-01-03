
import { useEffect } from 'react'
import { Platform } from 'react-native'

export type KeyboardShortcut = {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  action: () => void
  description?: string
}

export const COMMON_SHORTCUTS = {
  SEARCH: {
    key: 'k',
    ctrlKey: true,
    description: 'Search',
  },
} as const

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    if (Platform.OS !== 'web') return
    if (typeof document === 'undefined') return

    const handler = (e: KeyboardEvent) => {
      const pressedKey = String((e as any).key || '').toLowerCase()

      for (const shortcut of shortcuts) {
        if (!shortcut) continue
        const expectedKey = String(shortcut.key || '').toLowerCase()
        if (!expectedKey || pressedKey !== expectedKey) continue

        if (shortcut.ctrlKey !== undefined && !!(e as any).ctrlKey !== !!shortcut.ctrlKey) continue
        if (shortcut.metaKey !== undefined && !!(e as any).metaKey !== !!shortcut.metaKey) continue
        if (shortcut.shiftKey !== undefined && !!(e as any).shiftKey !== !!shortcut.shiftKey) continue
        if (shortcut.altKey !== undefined && !!(e as any).altKey !== !!shortcut.altKey) continue

        if (typeof (e as any).preventDefault === 'function') {
          ;(e as any).preventDefault()
        }

        shortcut.action()
        return
      }
    }

    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
    }
  }, [shortcuts])
}
