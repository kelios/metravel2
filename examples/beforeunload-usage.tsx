/**
 * Примеры безопасного использования beforeunload
 * Решает проблему: [Violation] Permissions policy violation: unload is not allowed
 */

import React, { useState, useEffect } from 'react'
import {
  isUnloadAllowed,
  addBeforeUnloadListener,
  useBeforeUnload,
  createBeforeUnloadHandler,
  addPageHideListener,
  addVisibilityChangeListener,
} from '@/utils/beforeunloadGuard'

// ============================================
// ПРИМЕР 1: Простое предупреждение о несохранённых данных
// ============================================

export function FormWithUnsavedWarning() {
  const [isDirty, setIsDirty] = useState(false)

  // ✅ ПРАВИЛЬНО: Используем безопасный hook
  useBeforeUnload(
    (event) => {
      event.preventDefault()
      event.returnValue = 'У вас есть несохранённые изменения'
      return 'У вас есть несохранённые изменения'
    },
    isDirty // Включаем только когда есть изменения
  )

  return (
    <form>
      <input onChange={() => setIsDirty(true)} />
      <button type="submit" onClick={() => setIsDirty(false)}>
        Сохранить
      </button>
    </form>
  )
}

// ============================================
// ПРИМЕР 2: Ручное управление listener
// ============================================

export function ManualBeforeUnloadExample() {
  const [hasChanges] = useState(false)

  useEffect(() => {
    if (!hasChanges) return

    // ✅ ПРАВИЛЬНО: Проверяем разрешение и добавляем listener
    const cleanup = addBeforeUnloadListener((event) => {
      event.preventDefault()
      event.returnValue = 'Несохранённые изменения будут потеряны'
      return 'Несохранённые изменения будут потеряны'
    })

    // cleanup может быть null если unload не разрешён
    return cleanup || undefined
  }, [hasChanges])

  return <div>Manual control example</div>
}

// ============================================
// ПРИМЕР 3: Автосохранение при уходе со страницы
// ============================================

export function AutoSaveOnLeave() {
  const [draft, setDraft] = useState('')

  useEffect(() => {
    // ✅ ПРАВИЛЬНО: Используем visibilitychange для автосохранения
    const cleanup = addVisibilityChangeListener(() => {
      if (draft) {
        // Сохраняем в localStorage когда пользователь уходит
        localStorage.setItem('draft', draft)
      }
    })

    return cleanup || undefined
  }, [draft])

  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      placeholder="Ваш текст..."
    />
  )
}

// ============================================
// ПРИМЕР 4: Cleanup при закрытии страницы
// ============================================

export function CleanupOnPageHide() {
  useEffect(() => {
    // ✅ ПРАВИЛЬНО: Используем pagehide для cleanup операций
    const cleanup = addPageHideListener(() => {
      // Отправить аналитику
      if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
        navigator.sendBeacon('/api/analytics', JSON.stringify({
          action: 'page_leave',
          timestamp: Date.now(),
        }))
      }

      // Очистить временные данные
      sessionStorage.removeItem('temp-data')
    })

    return cleanup || undefined
  }, [])

  return <div>Component with cleanup</div>
}

// ============================================
// ПРИМЕР 5: Условное предупреждение
// ============================================

export function ConditionalWarning({ hasUnsavedData }: { hasUnsavedData: boolean }) {
  // ✅ ПРАВИЛЬНО: Используем готовый handler creator
  const handler = createBeforeUnloadHandler(
    'У вас есть несохранённые данные. Продолжить?'
  )

  useBeforeUnload(handler, hasUnsavedData)

  return <div>Conditional warning</div>
}

// ============================================
// ПРИМЕР 6: Проверка доступности unload
// ============================================

export function CheckUnloadAvailability() {
  const [canUseUnload, setCanUseUnload] = useState(false)

  useEffect(() => {
    // ✅ ПРАВИЛЬНО: Проверяем доступность перед использованием
    setCanUseUnload(isUnloadAllowed())
  }, [])

  return (
    <div>
      {canUseUnload ? (
        <p>✅ beforeunload доступен</p>
      ) : (
        <p>⚠️ beforeunload заблокирован (возможно iframe)</p>
      )}
    </div>
  )
}

// ============================================
// ❌ НЕПРАВИЛЬНЫЕ ПРИМЕРЫ (не делайте так!)
// ============================================

export function WrongExamples() {
  // ❌ НЕПРАВИЛЬНО: Прямое использование без проверки
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      return 'Warning'
    }

    // Это вызовет Permissions Policy Violation!
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // ❌ НЕПРАВИЛЬНО: Использование deprecated 'unload' event
  useEffect(() => {
    const handler = () => {
      // Page unloaded
    }

    // unload deprecated и может быть заблокирован!
    window.addEventListener('unload', handler)
    return () => window.removeEventListener('unload', handler)
  }, [])

  return null
}

// ============================================
// BEST PRACTICES SUMMARY
// ============================================

/**
 * ✅ Правильный подход:
 *
 * 1. Для предупреждений:
 *    - useBeforeUnload() из beforeunloadGuard
 *
 * 2. Для автосохранения:
 *    - addVisibilityChangeListener()
 *
 * 3. Для cleanup:
 *    - addPageHideListener()
 *
 * 4. Всегда проверять:
 *    - isUnloadAllowed() перед использованием
 *
 * ❌ Избегайте:
 *    - Прямое использование window.addEventListener('beforeunload')
 *    - Использование deprecated 'unload' event
 *    - Игнорирование Permissions Policy
 */
