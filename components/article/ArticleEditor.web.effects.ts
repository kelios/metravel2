import {
  createForceSyncController,
  syncInitialQuillContent,
} from './articleEditorLifecycleHelpers'
import { Alert } from 'react-native'

import { openExternalUrlInNewTab } from '@/utils/externalLinks'
import { normalizeArticleEditorHtmlForOutput } from './articleEditorConfig'

export async function openArticleEditorPreview({
  isWeb,
  windowObject,
  idTravel,
}: {
  isWeb: boolean
  windowObject: (Window & typeof globalThis) | undefined
  idTravel?: string | number | null
}): Promise<void> {
  if (!isWeb || !windowObject) return
  if (!idTravel) {
    Alert.alert('Превью', 'Сначала сохраните путешествие, чтобы открыть превью')
    return
  }

  try {
    const url = `${windowObject.location.origin}/travels/${encodeURIComponent(String(idTravel))}`
    await openExternalUrlInNewTab(url)
  } catch {
    // noop
  }
}

export function emitDebouncedParentChange({
  val,
  variant,
  sentToParentSetRef,
  onChange,
  debouncedParentChangeRaw,
}: {
  val: string
  variant: string
  sentToParentSetRef: { current: Set<string> }
  onChange: (value: string) => void
  debouncedParentChangeRaw: (value: string) => void
}): void {
  sentToParentSetRef.current.add(val)
  // Keep the set bounded to avoid memory leaks.
  if (sentToParentSetRef.current.size > 20) {
    const iter = sentToParentSetRef.current.values()
    sentToParentSetRef.current.delete(iter.next().value as string)
  }
  if (variant === 'compact') {
    onChange(val)
    return
  }
  debouncedParentChangeRaw(val)
}

export function focusQuillEditor({
  isWeb,
  showHtml,
  getEditor,
}: {
  isWeb: boolean
  showHtml: boolean
  getEditor: () => any
}): void {
  if (!isWeb) return
  if (showHtml) return
  try {
    const editor = getEditor()
    if (editor && typeof editor.focus === 'function') {
      editor.focus()
      return
    }
    const root = editor?.root as HTMLElement | undefined
    if (root && typeof root.focus === 'function') root.focus()
  } catch {
    // noop
  }
}

export function getSafeEditorHtmlFrom(getEditor: () => any): string {
  try {
    const editor = getEditor()
    return normalizeArticleEditorHtmlForOutput(String(editor?.root?.innerHTML ?? ''))
  } catch {
    return ''
  }
}

export function getCurrentEditorHtml({
  showHtml,
  htmlRef,
  getSafeEditorHtml,
}: {
  showHtml: boolean
  htmlRef: { current: string }
  getSafeEditorHtml: () => string
}): string {
  if (showHtml) {
    return normalizeArticleEditorHtmlForOutput(
      typeof htmlRef.current === 'string' ? htmlRef.current : '',
    )
  }
  const fromEditor = getSafeEditorHtml()
  if (fromEditor) return fromEditor
  return normalizeArticleEditorHtmlForOutput(
    typeof htmlRef.current === 'string' ? htmlRef.current : '',
  )
}

type TimeoutRef = { current: ReturnType<typeof setTimeout> | null }

export function suppressFindDomNodeWarning(isWeb: boolean): (() => void) | undefined {
  if (!isWeb) return
  const originalError = console.error
  console.error = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('findDOMNode is deprecated')) {
      return
    }
    originalError(...args)
  }
  return () => {
    console.error = originalError
  }
}

export function attachEditorKeyboardShortcuts({
  isWeb,
  windowObject,
  fullscreen,
  anchorModalVisible,
  linkModalVisible,
  setFullscreen,
  setAnchorModalVisible,
  setLinkModalVisible,
  tmpStoredRange,
  tmpStoredLinkQuill,
}: {
  isWeb: boolean
  windowObject: (Window & typeof globalThis) | undefined
  fullscreen: boolean
  anchorModalVisible: boolean
  linkModalVisible: boolean
  setFullscreen: (value: boolean) => void
  setAnchorModalVisible: (value: boolean) => void
  setLinkModalVisible: (value: boolean) => void
  tmpStoredRange: { current: any }
  tmpStoredLinkQuill: { current: any }
}): (() => void) | undefined {
  if (!isWeb || !windowObject) return
  if (!fullscreen && !anchorModalVisible && !linkModalVisible) return

  const win = windowObject

  const onKeyDown = (event: KeyboardEvent) => {
    const key = String(event.key ?? '').toLowerCase()

    if (key === 'escape') {
      event.preventDefault()
      if (linkModalVisible) {
        setLinkModalVisible(false)
        tmpStoredRange.current = null
        tmpStoredLinkQuill.current = null
        return
      }
      if (anchorModalVisible) {
        setAnchorModalVisible(false)
        return
      }
      if (fullscreen) {
        setFullscreen(false)
      }
      return
    }

    if ((event.metaKey || event.ctrlKey) && key === 'enter' && fullscreen) {
      event.preventDefault()
      setFullscreen(false)
    }
  }

  win.addEventListener('keydown', onKeyDown)
  return () => {
    win.removeEventListener('keydown', onKeyDown)
  }
}

export function blurActiveEditorElement({
  isWeb,
  windowObject,
}: {
  isWeb: boolean
  windowObject: (Window & typeof globalThis) | undefined
}): void {
  if (!isWeb || !windowObject) return
  try {
    const el = windowObject.document?.activeElement as any
    if (el && typeof el.blur === 'function') el.blur()
  } catch {
    // noop
  }
}

export function focusEditorInput({
  isWeb,
  windowObject,
  blurActiveElement,
  inputRef,
}: {
  isWeb: boolean
  windowObject: (Window & typeof globalThis) | undefined
  blurActiveElement: () => void
  inputRef: { current: any }
}): void {
  if (!isWeb) return
  blurActiveElement()
  const schedule = (fn: () => void) => {
    if (typeof windowObject?.requestAnimationFrame === 'function') {
      windowObject.requestAnimationFrame(fn)
      return
    }
    setTimeout(fn, 0)
  }
  schedule(() => {
    try {
      inputRef.current?.focus?.()
    } catch {
      // noop
    }
  })
}

export function runInitialForceSyncEffect({
  isWeb,
  windowObject,
  showHtml,
  shouldLoadQuill,
  content,
  quillRef,
  refs,
}: {
  isWeb: boolean
  windowObject: (Window & typeof globalThis) | undefined
  showHtml: boolean
  shouldLoadQuill: boolean
  content: unknown
  quillRef: { current: any }
  refs: {
    pendingTimeoutRef: TimeoutRef
    pendingIdleRef: { current: number | null }
    pendingRafRef: { current: number | null }
    attemptRef: { current: number }
    lastForceSyncedContentRef: { current: string }
    lastSanitizedForceSyncRef: { current: { raw: string; clean: string } | null }
  }
}): (() => void) | undefined {
  if (!isWeb) return
  if (showHtml) return
  if (!shouldLoadQuill) return
  const next = typeof content === 'string' ? content : ''
  if (next.trim().length === 0) return

  const MAX_ATTEMPTS = 20
  const ATTEMPT_DELAY_MS = 50
  const { clearPending, scheduleForceSyncWork } = createForceSyncController({
    isWeb,
    windowObject,
    refs,
  })

  const attempt = () => {
    clearPending()
    refs.attemptRef.current += 1

    // Wait for lazy-loaded Quill to mount.
    if (!quillRef.current) {
      if (refs.attemptRef.current < MAX_ATTEMPTS) {
        refs.pendingTimeoutRef.current = setTimeout(attempt, ATTEMPT_DELAY_MS)
      }
      return
    }

    if (refs.lastForceSyncedContentRef.current === next) return

    scheduleForceSyncWork(() => {
      try {
        syncInitialQuillContent({
          next,
          quillRef,
          refs,
        })
      } catch (_e) {
        // noop
      }
    })
  }

  refs.attemptRef.current = 0
  refs.pendingTimeoutRef.current = setTimeout(attempt, 0)

  return () => {
    clearPending()
  }
}

export function runAutosaveEffect({
  html,
  onAutosave,
  autosaveDelay,
  refs,
}: {
  html: string
  onAutosave?: (html: string) => void | Promise<void>
  autosaveDelay: number
  refs: {
    autosaveIsMountedRef: { current: boolean }
    hasUserEditedRef: { current: boolean }
    lastAutosavedHtmlRef: { current: string }
    autosaveRetryTimeoutRef: TimeoutRef
    htmlRef: { current: string }
    autosaveInFlightHtmlRef: { current: string | null }
  }
}): (() => void) | undefined {
  const {
    autosaveIsMountedRef,
    hasUserEditedRef,
    lastAutosavedHtmlRef,
    autosaveRetryTimeoutRef,
    htmlRef,
    autosaveInFlightHtmlRef,
  } = refs

  if (!autosaveIsMountedRef.current) return
  if (!onAutosave) return
  if (!hasUserEditedRef.current) return
  if (html === lastAutosavedHtmlRef.current) return

  if (autosaveRetryTimeoutRef.current) {
    clearTimeout(autosaveRetryTimeoutRef.current)
    autosaveRetryTimeoutRef.current = null
  }

  let canceled = false
  const snapshot = html

  const attemptAutosave = async (failCount: number) => {
    if (canceled || !autosaveIsMountedRef.current) return
    if (!onAutosave) return
    if (htmlRef.current !== snapshot) return

    // Avoid duplicate concurrent saves for the same content.
    if (autosaveInFlightHtmlRef.current === snapshot) return
    autosaveInFlightHtmlRef.current = snapshot

    try {
      await onAutosave(snapshot)
      if (canceled || !autosaveIsMountedRef.current) return
      lastAutosavedHtmlRef.current = snapshot
      if (htmlRef.current === snapshot) {
        hasUserEditedRef.current = false
      }
    } catch {
      if (canceled || !autosaveIsMountedRef.current) return
      if (htmlRef.current !== snapshot) return

      // Retry with exponential backoff, but keep it bounded.
      const exp = Math.min(4, Math.max(0, failCount))
      const retryDelay = Math.min(60_000, autosaveDelay * Math.pow(2, exp))
      autosaveRetryTimeoutRef.current = setTimeout(() => {
        void attemptAutosave(failCount + 1)
      }, retryDelay)
    } finally {
      if (autosaveInFlightHtmlRef.current === snapshot) {
        autosaveInFlightHtmlRef.current = null
      }
    }
  }

  const t = setTimeout(() => {
    void attemptAutosave(0)
  }, autosaveDelay)

  return () => {
    canceled = true
    clearTimeout(t)
    if (autosaveRetryTimeoutRef.current) {
      clearTimeout(autosaveRetryTimeoutRef.current)
      autosaveRetryTimeoutRef.current = null
    }
  }
}
