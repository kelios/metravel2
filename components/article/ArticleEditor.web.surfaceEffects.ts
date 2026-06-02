import {
  hasSurfaceDraggedFiles,
  pasteHtmlIntoEditor,
  resolvePastePayload,
} from './articleEditorMediaHelpers'

type Selection = { index: number; length: number } | null

export function attachEditorSurfaceHandlers({
  isWeb,
  getEditor,
  uploadAndInsert,
  lastSelectionRef,
}: {
  isWeb: boolean
  getEditor: () => any
  uploadAndInsert: (file: File) => void | Promise<void>
  lastSelectionRef: { current: Selection }
}): () => void {
  if (!isWeb) return () => {}

  const MAX_ATTEMPTS = 20
  const ATTEMPT_DELAY_MS = 50
  let attempt = 0
  let t: ReturnType<typeof setTimeout> | null = null

  let cleanup: (() => void) | null = null

  const tryAttach = () => {
    attempt += 1

    const editor = getEditor()
    const root = editor?.root as HTMLElement | undefined
    if (!root) {
      if (attempt < MAX_ATTEMPTS) {
        t = setTimeout(tryAttach, ATTEMPT_DELAY_MS)
      }
      return
    }

    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return
      e.preventDefault()
      try {
        e.dataTransfer.dropEffect = 'copy'
      } catch {
        // noop
      }
    }

    const onDrop = (e: DragEvent) => {
      const file = e.dataTransfer?.files?.[0]
      if (__DEV__) {
        console.info('[ArticleEditor] drop event', {
          hasFile: !!file,
          type: file?.type,
          fileCount: e.dataTransfer?.files?.length ?? 0,
        })
      }
      if (!file) return
      if (typeof file.type !== 'string' || !file.type.startsWith('image/')) return
      e.preventDefault()
      e.stopPropagation()
      try {
        ;(e as any).stopImmediatePropagation?.()
      } catch {
        // noop
      }
      void uploadAndInsert(file)
    }
    const onPaste = (e: ClipboardEvent) => {
      const { fileFromFiles, fileFromItems, file, pastedHtml, knownEmbedHtml, cleanedHtml } =
        resolvePastePayload(e.clipboardData)
      if (__DEV__) {
        console.info('[ArticleEditor] paste event', {
          filesCount: e.clipboardData?.files?.length ?? 0,
          itemsCount: e.clipboardData?.items?.length ?? 0,
          hasFileFromFiles: !!fileFromFiles,
          hasFileFromItems: !!fileFromItems,
          resolvedType: file?.type,
        })
      }
      if (file && typeof file.type === 'string' && file.type.startsWith('image/')) {
        e.preventDefault()
        try {
          ;(e as any).stopImmediatePropagation?.()
        } catch (err) {
          void err
        }
        void uploadAndInsert(file)
        return
      }

      if (knownEmbedHtml) {
        e.preventDefault()
        try {
          ;(e as any).stopImmediatePropagation?.()
        } catch (err) {
          void err
        }
        pasteHtmlIntoEditor({
          editor: getEditor(),
          html: knownEmbedHtml,
        })
        return
      }
      if (pastedHtml && cleanedHtml !== pastedHtml) {
        e.preventDefault()
        try {
          ;(e as any).stopImmediatePropagation?.()
        } catch (err) {
          void err
        }
        pasteHtmlIntoEditor({
          editor: getEditor(),
          html: cleanedHtml,
        })
      }
    }

    const onSelectionChange = (range: { index: number; length: number } | null) => {
      if (!range || typeof range.index !== 'number') return
      lastSelectionRef.current = range
    }

    root.addEventListener('dragover', onDragOver)
    root.addEventListener('dragenter', onDragOver)
    root.addEventListener('drop', onDrop, true)
    root.addEventListener('paste', onPaste, true)

    if (typeof editor.on === 'function') {
      editor.on('selection-change', onSelectionChange)
    }

    cleanup = () => {
      root.removeEventListener('dragover', onDragOver)
      root.removeEventListener('dragenter', onDragOver)
      root.removeEventListener('drop', onDrop, true)
      root.removeEventListener('paste', onPaste, true)
      if (typeof editor.off === 'function') {
        editor.off('selection-change', onSelectionChange)
      }
    }
  }

  tryAttach()

  return () => {
    if (t) clearTimeout(t)
    if (cleanup) cleanup()
  }
}

export function attachFullscreenSurfaceDnd({
  isWeb,
  windowObject,
  fullscreen,
  getEditor,
  getViewport,
  handleSurfaceFileDrop,
}: {
  isWeb: boolean
  windowObject: (Window & typeof globalThis) | undefined
  fullscreen: boolean
  getEditor: () => any
  getViewport: () => HTMLElement | undefined
  handleSurfaceFileDrop: (file: File | null | undefined) => boolean
}): () => void {
  if (!isWeb || !windowObject || !fullscreen) return () => {}

  const win = windowObject
  const doc = win.document
  if (!doc) return () => {}

  const isInsideEditorSurface = (target: EventTarget | null) => {
    const editor = getEditor()
    const quillRoot = editor?.root as HTMLElement | undefined
    const viewport = getViewport()
    const candidate = target instanceof win.Node ? target : null
    const containers = [viewport, quillRoot, quillRoot?.parentElement].filter(
      (value): value is HTMLElement => !!value && typeof value.contains === 'function',
    )

    if (containers.length === 0) return true
    if (!candidate) return true

    return containers.some(
      container => container === candidate || container.contains(candidate),
    )
  }

  const onDocumentDragOver = (event: DragEvent) => {
    if (!hasSurfaceDraggedFiles(event)) return
    if (!isInsideEditorSurface(event.target)) return
    event.preventDefault()
    try {
      event.dataTransfer!.dropEffect = 'copy'
    } catch {
      // noop
    }
  }

  const onDocumentDrop = (event: DragEvent) => {
    if (!isInsideEditorSurface(event.target)) return
    const file = event.dataTransfer?.files?.[0] ?? null
    const accepted = handleSurfaceFileDrop(file)
    if (!accepted) return
    event.preventDefault()
    event.stopPropagation()
    try {
      ;(event as any).stopImmediatePropagation?.()
    } catch {
      // noop
    }
  }

  doc.addEventListener('dragenter', onDocumentDragOver, true)
  doc.addEventListener('dragover', onDocumentDragOver, true)
  doc.addEventListener('drop', onDocumentDrop, true)

  return () => {
    doc.removeEventListener('dragenter', onDocumentDragOver, true)
    doc.removeEventListener('dragover', onDocumentDragOver, true)
    doc.removeEventListener('drop', onDocumentDrop, true)
  }
}
