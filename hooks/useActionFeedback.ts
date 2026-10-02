import { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Platform } from 'react-native'

import { translate as i18nT } from '@/i18n'
import { hapticImpact, hapticNotification } from '@/utils/haptics'
import { showToast } from '@/utils/toast'

/**
 * Единый отклик на действие в одно касание (#2103): избранное, подписка,
 * награда, статус, сохранение точки. Экран/компонент не зовёт showToast и
 * haptic* сам, а описывает действие через `run`, поэтому одна и та же кнопка
 * ведёт себя одинаково на каждом экране и в каждом варианте.
 *
 * Состояния: idle → pending (optimistic) → success | error (rollback).
 */

export type ActionUndo = {
  optimistic?: () => void
  commit: () => Promise<unknown> | unknown
  rollback?: () => void
}

export type ActionFeedbackOptions<T = unknown> = {
  /** Ключ действия: повторное касание с тем же ключом во время commit игнорируется. */
  key?: string
  optimistic?: () => void
  commit: () => Promise<T> | T
  rollback?: (error: unknown) => void
  success?: {
    message: string
    description?: string
    /** Если задано, в тосте появляется «Отменить», вызывающая обратную операцию. */
    undo?: ActionUndo
    type?: 'success' | 'info'
  }
  error?: { message: string; description?: string }
  /** Импульс при касании (сразу, до commit). 'none' — без вибрации. */
  haptic?: 'light' | 'medium' | 'heavy' | 'none'
}

export type ActionResult<T = unknown> =
  | { status: 'success'; value: T }
  | { status: 'error'; error: unknown }
  | { status: 'busy' }

const DEFAULT_KEY = '__default'
const TOAST_MS = 2500
const TOAST_UNDO_MS = 4500
const TOAST_ERROR_MS = 4000

function announce(message: string) {
  if (Platform.OS === 'web') return // у web роль status тоста уже озвучивается
  try {
    AccessibilityInfo.announceForAccessibility?.(message)
  } catch {
    // анонс — best effort
  }
}

export function useActionFeedback() {
  const inFlightRef = useRef<Set<string>>(new Set())
  const mountedRef = useRef(true)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const bump = useCallback((delta: number) => {
    if (mountedRef.current) setPendingCount((n) => Math.max(0, n + delta))
  }, [])

  const showError = useCallback((error: ActionFeedbackOptions['error']) => {
    hapticNotification('error')
    const message = error?.message ?? i18nT('common:feedback.actionError')
    void showToast({
      type: 'error',
      text1: message,
      text2: error?.description,
      position: 'bottom',
      visibilityTime: TOAST_ERROR_MS,
    })
    announce(message)
  }, [])

  const runUndo = useCallback(
    async (undo: ActionUndo, error: ActionFeedbackOptions['error']) => {
      hapticImpact('light')
      undo.optimistic?.()
      try {
        await undo.commit()
      } catch {
        undo.rollback?.()
        showError(error)
      }
    },
    [showError],
  )

  const run = useCallback(
    async <T,>(options: ActionFeedbackOptions<T>): Promise<ActionResult<T>> => {
      const key = options.key ?? DEFAULT_KEY
      if (inFlightRef.current.has(key)) return { status: 'busy' }
      inFlightRef.current.add(key)
      bump(1)

      if (options.haptic !== 'none') hapticImpact(options.haptic ?? 'light')
      options.optimistic?.()

      try {
        const value = await options.commit()
        const success = options.success
        if (success) {
          const undo = success.undo
          void showToast({
            type: success.type ?? 'success',
            text1: success.message,
            text2: success.description,
            position: 'bottom',
            visibilityTime: undo ? TOAST_UNDO_MS : TOAST_MS,
            action: undo
              ? {
                  label: i18nT('common:feedback.undo'),
                  onPress: () => void runUndo(undo, options.error),
                }
              : undefined,
          })
          announce(success.message)
        }
        return { status: 'success', value }
      } catch (error) {
        options.rollback?.(error)
        showError(options.error)
        return { status: 'error', error }
      } finally {
        inFlightRef.current.delete(key)
        bump(-1)
      }
    },
    [bump, runUndo, showError],
  )

  /** Информационный отклик без операции (подсказка, «войдите…»): тост + анонс, без haptic. */
  const notify = useCallback((message: string, type: 'success' | 'info' = 'info') => {
    void showToast({ type, text1: message, position: 'bottom', visibilityTime: TOAST_MS })
    announce(message)
  }, [])

  const isPending = useCallback((key: string = DEFAULT_KEY) => inFlightRef.current.has(key), [])

  return { run, notify, isPending, pending: pendingCount > 0 }
}

export type ActionFeedback = ReturnType<typeof useActionFeedback>
