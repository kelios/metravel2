
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
      const target = e.target instanceof HTMLElement ? e.target : null
      const targetTag = String(target?.tagName || '').toLowerCase()
      const isEditableTarget =
        targetTag === 'input' ||
        targetTag === 'textarea' ||
        target?.isContentEditable === true

      if (isEditableTarget) return

      const pressedKey = String(e.key || '').toLowerCase()

      for (const shortcut of shortcuts) {
        if (!shortcut) continue
        const expectedKey = String(shortcut.key || '').toLowerCase()
        if (!expectedKey || pressedKey !== expectedKey) continue

        const ctrlPressed = !!e.ctrlKey
        const metaPressed = !!e.metaKey
        const shiftPressed = !!e.shiftKey
        const altPressed = !!e.altKey

        if (shortcut.ctrlKey !== undefined && ctrlPressed !== !!shortcut.ctrlKey) continue
        if (shortcut.metaKey !== undefined && metaPressed !== !!shortcut.metaKey) continue
        if (shortcut.shiftKey !== undefined && shiftPressed !== !!shortcut.shiftKey) continue
        if (shortcut.altKey !== undefined && altPressed !== !!shortcut.altKey) continue

        if (shortcut.ctrlKey === undefined && ctrlPressed) continue
        if (shortcut.metaKey === undefined && metaPressed) continue
        if (shortcut.shiftKey === undefined && shiftPressed) continue
        if (shortcut.altKey === undefined && altPressed) continue

        e.preventDefault()

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
