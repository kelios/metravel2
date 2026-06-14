// hooks/useAriaHiddenFocusGuard.ts
// Web-only предохранитель против предупреждения Chromium
// "Blocked aria-hidden on an element because its descendant retained focus".
//
// Причина (доброкачественная гонка): при тапе, который запускает навигацию или
// открытие оверлея, RN Web / expo-router на мгновение вешают aria-hidden="true"
// на уходящий экран-контейнер ДО того, как фокус уйдёт с нажатого Pressable.
// Браузер логирует предупреждение в этот микро-зазор. Это всегда некорректное
// состояние (фокус под aria-hidden), поэтому снять его — безопасно: фреймворк
// сбросил бы фокус тиком позже, UX не меняется.

import { useEffect } from 'react'
import { Platform } from 'react-native'

function isHidden(node: Element | null): boolean {
  let n: Element | null = node
  while (n) {
    if (typeof n.getAttribute === 'function' && n.getAttribute('aria-hidden') === 'true') {
      return true
    }
    n = n.parentElement
  }
  return false
}

export function useAriaHiddenFocusGuard(): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return

    // Случай 1: фокус переходит ВНУТРЬ уже скрытого поддерева.
    // blur() синхронно внутри focusin браузер игнорирует (фокус ещё устанавливается),
    // поэтому откладываем на микротаск и перепроверяем актуальное состояние.
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null
      if (!target || typeof target.blur !== 'function') return
      Promise.resolve().then(() => {
        if (document.activeElement === target && isHidden(target)) {
          target.blur()
        }
      })
    }
    document.addEventListener('focusin', onFocusIn)

    // Случай 2 (наблюдаемая гонка): предок уже сфокусированного элемента
    // ПОЛУЧАЕТ aria-hidden="true".
    let observer: MutationObserver | null = null
    if (typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver((mutations) => {
        const active = document.activeElement as HTMLElement | null
        if (!active || active === document.body || typeof active.blur !== 'function') return
        for (const m of mutations) {
          if (m.attributeName !== 'aria-hidden') continue
          const target = m.target as Element
          if (target.getAttribute('aria-hidden') === 'true' && target.contains(active)) {
            active.blur()
            return
          }
        }
      })
      if (document.body) {
        observer.observe(document.body, {
          attributes: true,
          subtree: true,
          attributeFilter: ['aria-hidden'],
        })
      }
    }

    return () => {
      document.removeEventListener('focusin', onFocusIn)
      observer?.disconnect()
    }
  }, [])
}
