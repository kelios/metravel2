
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
      const target = (e as any).target as HTMLElement | null
      const targetTag = String((target as any)?.tagName || '').toLowerCase()
      const isEditableTarget =
        targetTag === 'input' ||
        targetTag === 'textarea' ||
        (target as any)?.isContentEditable === true

      if (isEditableTarget) return

      const pressedKey = String((e as any).key || '').toLowerCase()

      for (const shortcut of shortcuts) {
        if (!shortcut) continue
        const expectedKey = String(shortcut.key || '').toLowerCase()
        if (!expectedKey || pressedKey !== expectedKey) continue

        const ctrlPressed = !!(e as any).ctrlKey
        const metaPressed = !!(e as any).metaKey
        const shiftPressed = !!(e as any).shiftKey
        const altPressed = !!(e as any).altKey

        if (shortcut.ctrlKey !== undefined && ctrlPressed !== !!shortcut.ctrlKey) continue
        if (shortcut.metaKey !== undefined && metaPressed !== !!shortcut.metaKey) continue
        if (shortcut.shiftKey !== undefined && shiftPressed !== !!shortcut.shiftKey) continue
        if (shortcut.altKey !== undefined && altPressed !== !!shortcut.altKey) continue

        if (shortcut.ctrlKey === undefined && ctrlPressed) continue
        if (shortcut.metaKey === undefined && metaPressed) continue
        if (shortcut.shiftKey === undefined && shiftPressed) continue
        if (shortcut.altKey === undefined && altPressed) continue

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
