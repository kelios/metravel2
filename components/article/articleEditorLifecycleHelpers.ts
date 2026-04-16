import { sanitizeArticleEditorHtml } from '@/utils/articleEditorSanitize'

type Selection = { index: number; length: number }

type ForceSyncRefs = {
  pendingTimeoutRef: { current: ReturnType<typeof setTimeout> | null }
  pendingIdleRef: { current: number | null }
  pendingRafRef: { current: number | null }
  attemptRef: { current: number }
  lastForceSyncedContentRef: { current: string }
  lastSanitizedForceSyncRef: { current: { raw: string; clean: string } | null }
}

export const requestArticleEditorQuillLoad = ({
  loadModule,
  shouldLoadQuill,
  setShouldLoadQuill,
}: {
  loadModule: (() => Promise<unknown>) | null
  shouldLoadQuill: boolean
  setShouldLoadQuill: (value: boolean) => void
}) => {
  if (loadModule) {
    void loadModule().catch(() => null)
  }
  if (shouldLoadQuill) return
  setShouldLoadQuill(true)
}

export const scheduleEmptyEditorPreload = ({
  isTestEnv,
  isWeb,
  hasWindow,
  shouldLoadQuill,
  requestQuillLoad,
  preloadDelayMs,
  windowObject,
}: {
  isTestEnv: boolean
  isWeb: boolean
  hasWindow: boolean
  shouldLoadQuill: boolean
  requestQuillLoad: () => void
  preloadDelayMs: number
  windowObject: Window
}) => {
  if (isTestEnv || !isWeb || !hasWindow || shouldLoadQuill) return null

  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let idleId: number | null = null

  const trigger = () => {
    requestQuillLoad()
  }

  if (typeof windowObject.requestIdleCallback === 'function') {
    idleId = windowObject.requestIdleCallback(trigger, { timeout: preloadDelayMs })
  } else {
    timeoutId = setTimeout(trigger, preloadDelayMs)
  }

  return () => {
    if (timeoutId) clearTimeout(timeoutId)
    if (idleId != null && typeof windowObject.cancelIdleCallback === 'function') {
      windowObject.cancelIdleCallback(idleId)
    }
  }
}

export const createForceSyncController = ({
  isWeb,
  windowObject,
  refs,
}: {
  isWeb: boolean
  windowObject?: Window
  refs: ForceSyncRefs
}) => {
  const clearPending = () => {
    if (refs.pendingTimeoutRef.current) {
      clearTimeout(refs.pendingTimeoutRef.current)
      refs.pendingTimeoutRef.current = null
    }
    if (refs.pendingIdleRef.current != null && typeof (windowObject as any)?.cancelIdleCallback === 'function') {
      try {
        ;(windowObject as any).cancelIdleCallback(refs.pendingIdleRef.current)
      } catch {
        // noop
      }
      refs.pendingIdleRef.current = null
    }
    if (refs.pendingRafRef.current != null && typeof (windowObject as any)?.cancelAnimationFrame === 'function') {
      try {
        ;(windowObject as any).cancelAnimationFrame(refs.pendingRafRef.current)
      } catch {
        // noop
      }
      refs.pendingRafRef.current = null
    }
  }

  const scheduleForceSyncWork = (fn: () => void) => {
    if (!isWeb || !windowObject) {
      fn()
      return
    }

    if (typeof (windowObject as any).requestIdleCallback === 'function') {
      refs.pendingIdleRef.current = (windowObject as any).requestIdleCallback(() => {
        refs.pendingIdleRef.current = null
        fn()
      }, { timeout: 1000 })
      return
    }

    refs.pendingRafRef.current = windowObject.requestAnimationFrame(() => {
      refs.pendingRafRef.current = null
      fn()
    })
  }

  return { clearPending, scheduleForceSyncWork }
}

export const syncInitialQuillContent = ({
  next,
  quillRef,
  refs,
}: {
  next: string
  quillRef: { current: any }
  refs: ForceSyncRefs
}) => {
  const editor = quillRef.current?.getEditor?.()
  if (!editor) return

  const text = typeof editor.getText === 'function' ? String(editor.getText() ?? '') : ''
  const isEditorEmpty = text.replace(/\s+/g, '').length === 0
  if (!isEditorEmpty) return

  const prevSanitized = refs.lastSanitizedForceSyncRef.current
  const clean = prevSanitized?.raw === next ? prevSanitized.clean : sanitizeArticleEditorHtml(next)
  refs.lastSanitizedForceSyncRef.current = { raw: next, clean }

  editor.clipboard?.dangerouslyPasteHTML?.(0, clean, 'silent')
  editor.setSelection?.(0, 0, 'silent')
  refs.lastForceSyncedContentRef.current = next
}

export const restorePendingSelection = ({
  getEditor,
  pendingSelectionRestoreRef,
}: {
  getEditor: () => any
  pendingSelectionRestoreRef: { current: Selection | null }
}) => {
  if (!pendingSelectionRestoreRef.current) return
  const selection = pendingSelectionRestoreRef.current
  pendingSelectionRestoreRef.current = null

  try {
    const editor = getEditor()
    if (!editor || !selection) return
    editor.setSelection?.(selection, 'silent')
  } catch {
    // noop
  }
}

export const scheduleFullscreenRefresh = ({
  windowObject,
  ensureQuillContent,
}: {
  windowObject: Window
  ensureQuillContent: () => void
}) => {
  const raf = (windowObject as any)?.requestAnimationFrame?.(() => {
    try {
      ensureQuillContent()
    } catch {
      // noop
    }
  }) ?? 0

  return () => {
    try {
      ;(windowObject as any)?.cancelAnimationFrame?.(raf)
    } catch {
      // noop
    }
  }
}
