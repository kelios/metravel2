import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { StyleSheet } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'

type QuillInstance = any

type Props = {
  theme?: string
  value?: string
  onChange?: (html: string, delta: unknown, source: unknown) => void
  modules?: any
  placeholder?: string
  style?: any
  editorChromeAttrs?: {
    compact?: boolean
    fullscreen?: boolean
  }
}

const isTestEnv =
  typeof process !== 'undefined' &&
  (process as any)?.env &&
  ((process as any).env.NODE_ENV === 'test' || (process as any).env.JEST_WORKER_ID !== undefined)

let quillLoadPromise: Promise<any> | null = null
let quillCssLoadPromise: Promise<void> | null = null
const QUILL_EDITOR_WEB_STYLES_ID = 'article-editor-quill-web-styles'
const QUILL_EDITOR_THEME_LINK_ID = 'article-editor-quill-theme-link'
const QUILL_EDITOR_THEME_HREF = '/quill.snow.css'
export const ARTICLE_EDITOR_QUILL_WEB_CSS = `
[data-editor-chrome="article-editor"] {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: visible;
}
[data-editor-chrome="article-editor"] .ql-toolbar.ql-snow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  padding: 12px 14px;
  border: 0;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  box-sizing: border-box;
}
[data-editor-chrome="article-editor"] .ql-toolbar.ql-snow .ql-formats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-right: 0;
}
[data-editor-chrome="article-editor"] .ql-toolbar.ql-snow .ql-picker {
  max-width: 100%;
}
[data-editor-chrome="article-editor"] .ql-toolbar.ql-snow .ql-picker.ql-font,
[data-editor-chrome="article-editor"] .ql-toolbar.ql-snow .ql-picker.ql-size,
[data-editor-chrome="article-editor"] .ql-toolbar.ql-snow .ql-picker.ql-header {
  width: clamp(96px, 18vw, 160px);
}
[data-editor-chrome="article-editor"] .ql-toolbar.ql-snow .ql-picker-label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
[data-editor-chrome="article-editor"] .ql-toolbar.ql-snow .ql-picker-options {
  z-index: 30;
}
[data-editor-chrome="article-editor"] .ql-container.ql-snow {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  border: 0;
  min-height: 0;
  height: auto;
  overflow: hidden;
  background: var(--color-surface);
}
[data-editor-chrome="article-editor"][data-fullscreen="false"][data-compact="false"] .ql-container.ql-snow {
  max-height: 560px;
}
[data-editor-chrome="article-editor"][data-fullscreen="false"][data-compact="true"] .ql-container.ql-snow {
  max-height: 460px;
}
[data-editor-chrome="article-editor"] .ql-editor {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 280px;
  padding: 16px 18px 28px;
  overflow-x: hidden;
  overflow-y: auto;
  box-sizing: border-box;
}
[data-editor-chrome="article-editor"][data-compact="true"] .ql-editor {
  min-height: 240px;
}
[data-editor-chrome="article-editor"] .ql-editor > * {
  max-width: 100%;
  box-sizing: border-box;
}
[data-editor-chrome="article-editor"] .ql-editor p,
[data-editor-chrome="article-editor"] .ql-editor li,
[data-editor-chrome="article-editor"] .ql-editor blockquote,
[data-editor-chrome="article-editor"] .ql-editor h1,
[data-editor-chrome="article-editor"] .ql-editor h2,
[data-editor-chrome="article-editor"] .ql-editor h3,
[data-editor-chrome="article-editor"] .ql-editor h4,
[data-editor-chrome="article-editor"] .ql-editor h5,
[data-editor-chrome="article-editor"] .ql-editor h6 {
  overflow-wrap: break-word;
  word-break: break-word;
}
[data-editor-chrome="article-editor"] .ql-editor p,
[data-editor-chrome="article-editor"] .ql-editor ul,
[data-editor-chrome="article-editor"] .ql-editor ol,
[data-editor-chrome="article-editor"] .ql-editor blockquote {
  margin: 0 0 16px;
}
[data-editor-chrome="article-editor"] .ql-editor p:empty {
  min-height: 1.5em;
}
[data-editor-chrome="article-editor"] .ql-editor img,
[data-editor-chrome="article-editor"] .ql-editor figure img {
  display: block;
  width: auto !important;
  max-width: min(660px, 100%) !important;
  height: auto;
  max-height: 55vh;
  object-fit: contain;
  object-position: center;
  margin: 12px auto 20px !important;
  border-radius: 16px;
  box-sizing: border-box;
  border: 1px solid var(--color-borderLight);
  background: var(--color-surfaceMuted);
}
[data-editor-chrome="article-editor"] .ql-editor figure {
  margin: 0 0 20px;
}
[data-editor-chrome="article-editor"] .ql-editor img + *,
[data-editor-chrome="article-editor"] .ql-editor figure + * {
  margin-top: 18px !important;
}
[data-editor-chrome="article-editor"] .ql-editor > *:last-child {
  margin-bottom: 0 !important;
}
@media (max-width: 767px) {
  [data-editor-chrome="article-editor"] .ql-toolbar.ql-snow {
    gap: 6px 8px;
    padding: 10px;
  }
  [data-editor-chrome="article-editor"] .ql-toolbar.ql-snow .ql-formats {
    gap: 2px;
  }
  [data-editor-chrome="article-editor"] .ql-toolbar.ql-snow .ql-picker.ql-font,
  [data-editor-chrome="article-editor"] .ql-toolbar.ql-snow .ql-picker.ql-size,
  [data-editor-chrome="article-editor"] .ql-toolbar.ql-snow .ql-picker.ql-header {
    width: min(132px, 40vw);
  }
}
@media (max-width: 479px) {
  [data-editor-chrome="article-editor"] .ql-toolbar.ql-snow {
    padding: 8px;
  }
  [data-editor-chrome="article-editor"] .ql-toolbar.ql-snow .ql-formats {
    width: 100%;
  }
  [data-editor-chrome="article-editor"] .ql-toolbar.ql-snow .ql-picker.ql-font,
  [data-editor-chrome="article-editor"] .ql-toolbar.ql-snow .ql-picker.ql-size,
  [data-editor-chrome="article-editor"] .ql-toolbar.ql-snow .ql-picker.ql-header {
    width: min(132px, 100%);
  }
}
`

const ensureQuillThemeCss = () => {
  if (typeof document === 'undefined' || isTestEnv) return Promise.resolve()

  const existing = document.getElementById(QUILL_EDITOR_THEME_LINK_ID) as HTMLLinkElement | null
  if (existing) {
    if ((existing as any).dataset?.loaded === 'true') return Promise.resolve()
    if (quillCssLoadPromise) return quillCssLoadPromise
  }

  const link =
    existing ??
    (() => {
      const next = document.createElement('link')
      next.id = QUILL_EDITOR_THEME_LINK_ID
      next.rel = 'stylesheet'
      next.href = QUILL_EDITOR_THEME_HREF
      document.head.appendChild(next)
      return next
    })()

  quillCssLoadPromise = new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      link.removeEventListener('load', handleLoad)
      link.removeEventListener('error', handleError)
    }
    const handleLoad = () => {
      cleanup()
      ;(link as any).dataset.loaded = 'true'
      quillCssLoadPromise = null
      resolve()
    }
    const handleError = () => {
      cleanup()
      quillCssLoadPromise = null
      reject(new Error('Failed to load Quill theme CSS'))
    }

    link.addEventListener('load', handleLoad, { once: true })
    link.addEventListener('error', handleError, { once: true })

    try {
      if ((link.sheet && (link.sheet as CSSStyleSheet).cssRules) || (link as any).dataset?.loaded === 'true') {
        cleanup()
        ;(link as any).dataset.loaded = 'true'
        quillCssLoadPromise = null
        resolve()
      }
    } catch {
      cleanup()
      ;(link as any).dataset.loaded = 'true'
      quillCssLoadPromise = null
      resolve()
    }
  })

  return quillCssLoadPromise
}

const loadQuill = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Quill is only available in the browser'))
  }

  const w = window as any
  if (w.Quill) return Promise.resolve(w.Quill)
  if (quillLoadPromise) return quillLoadPromise

  quillLoadPromise = Promise.all([ensureQuillThemeCss(), import('quill')])
    .then(([, mod]) => {
      const Quill = (mod as any)?.default ?? (mod as any)
      if (!Quill) throw new Error('Failed to load Quill module')
      try {
        ;(window as any).Quill = Quill
      } catch {
        // noop
      }
      return Quill
    })
    .catch((e) => {
      quillLoadPromise = null
      throw e
    })

  return quillLoadPromise
}

let idAttributeRegistered = false
const ensureIdAttributeRegistered = (Quill: any) => {
  if (idAttributeRegistered) return
  idAttributeRegistered = true
  try {
    const Parchment = Quill.import('parchment')
    const IdAttribute = new (Parchment as any).Attributor.Attribute('id', 'id', {
      scope: (Parchment as any).Scope.INLINE,
    })
    Quill.register(IdAttribute, true)
  } catch (e) {
    void e
  }
}

const QuillEditorWeb = forwardRef(function QuillEditorWeb(props: Props, ref: any) {
  const { theme, value, onChange, placeholder, style, editorChromeAttrs } = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const quillRef = useRef<QuillInstance | null>(null)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const lastHtmlRef = useRef<string>('')
  const isApplyingValueRef = useRef(false)
  const onChangeRef = useRef<Props['onChange']>(onChange)
  const initialValueRef = useRef<string>(typeof value === 'string' ? value : '')

  const modules = useMemo(() => props.modules ?? {}, [props.modules])
  const shellStyle = useMemo(() => StyleSheet.flatten(style) ?? {}, [style])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (typeof document === 'undefined') return

    let styleEl = document.getElementById(QUILL_EDITOR_WEB_STYLES_ID) as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = QUILL_EDITOR_WEB_STYLES_ID
      styleEl.textContent = ARTICLE_EDITOR_QUILL_WEB_CSS
      document.head.appendChild(styleEl)
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    let cancelled = false
    const containerEl = containerRef.current
    const parent = containerEl.parentElement

    try {
      containerEl.innerHTML = ''
    } catch (e) {
      void e
    }

    if (quillRef.current) return

    setLoadError(null)

    let quillInstance: any | null = null
    let toolbarEl: HTMLElement | null = null
    let onTextChange: ((delta: unknown, _oldDelta: unknown, source: unknown) => void) | null = null

    loadQuill()
      .then((Quill) => {
        if (cancelled) return
        ensureIdAttributeRegistered(Quill)

        const quill = new Quill(containerEl, {
          theme: theme ?? 'snow',
          modules,
          placeholder,
        })

        quillInstance = quill
        quillRef.current = quill

        // Strip base64 data-URI images from clipboard/drop content.
        // Our custom handlers in ArticleEditor upload images to S3 and insert
        // the real URL; Quill's default clipboard would insert base64 inline.
        try {
          const clipboard = quill.getModule?.('clipboard')
          if (clipboard && typeof clipboard.addMatcher === 'function') {
            clipboard.addMatcher('IMG', (node: HTMLElement, delta: any) => {
              const src = node.getAttribute?.('src') ?? ''
              if (src.startsWith('data:')) {
                // Return empty delta to suppress the base64 image
                const Delta = quill.constructor?.import?.('delta') ?? quill.import?.('delta')
                if (Delta) return new Delta()
                return { ops: [] }
              }
              return delta
            })
          }
        } catch (e) {
          void e
        }

        // Disable Quill's default uploader module to prevent it from intercepting
        // drop events. Our custom drop handler in ArticleEditor handles S3 uploads.
        try {
          const uploader = quill.getModule?.('uploader')
          if (uploader) {
            // Remove the uploader's drop handler if it exists
            if (typeof uploader.onDrop === 'function') {
              quill.root.removeEventListener('drop', uploader.onDrop)
            }
          }
        } catch (e) {
          void e
        }

        try {
          const toolbarModule = quill.getModule?.('toolbar')
          const candidate = toolbarModule?.container
          toolbarEl = candidate instanceof HTMLElement ? candidate : null
        } catch (e) {
          void e
        }

        const initial = initialValueRef.current
        lastHtmlRef.current = initial
        try {
          quill.clipboard?.dangerouslyPasteHTML?.(initial, 'silent')
        } catch {
          try {
            quill.root.innerHTML = initial
          } catch (e) {
            void e
          }
        }

        onTextChange = (delta: unknown, _oldDelta: unknown, source: unknown) => {
          if (isApplyingValueRef.current) return
          const html = String(quill.root?.innerHTML ?? '')
          lastHtmlRef.current = html
          onChangeRef.current?.(html, delta, source)
        }

        quill.on('text-change', onTextChange)
      })
      .catch((e) => {
        if (cancelled) return
        setLoadError(e instanceof Error ? e : new Error(String(e)))
      })

    return () => {
      cancelled = true
      const q = quillInstance
      const handler = onTextChange
      if (q && handler) {
        try {
          q.off('text-change', handler)
        } catch (e) {
          void e
        }
      }
      quillRef.current = null

      if (toolbarEl && parent && toolbarEl.parentElement === parent) {
        try {
          parent.removeChild(toolbarEl)
        } catch (err) {
          void err
        }
      }

      try {
        containerEl.innerHTML = ''
      } catch (err) {
        void err
      }
    }
  }, [modules, placeholder, theme])

  useEffect(() => {
    const quill = quillRef.current
    if (!quill) return
    const next = typeof value === 'string' ? value : ''
    if (next === lastHtmlRef.current) return

    isApplyingValueRef.current = true
    try {
      const sel = quill.getSelection?.(true) ?? null
      // Replace editor contents atomically to avoid duplicating HTML on repeated external syncs.
      if (typeof quill.setContents === 'function' && quill.clipboard?.convert) {
        const delta = quill.clipboard.convert({ html: next })
        quill.setContents(delta, 'silent')
      } else {
        quill.clipboard?.dangerouslyPasteHTML?.(0, next, 'silent')
      }
      if (sel) {
        try {
          quill.setSelection(sel, 'silent')
        } catch (e) {
          void e
        }
      }
      lastHtmlRef.current = next
    } catch {
      try {
        quill.root.innerHTML = next
        lastHtmlRef.current = next
      } catch (e) {
        void e
      }
    } finally {
      isApplyingValueRef.current = false
    }
  }, [value])

  useImperativeHandle(ref, () => ({
    getEditor: () => quillRef.current,
  }))

  return (
    <div
      data-editor-chrome="article-editor"
      data-compact={editorChromeAttrs?.compact ? 'true' : 'false'}
      data-fullscreen={editorChromeAttrs?.fullscreen ? 'true' : 'false'}
      style={shellStyle}
    >
      <div ref={containerRef} style={{ width: '100%', minHeight: 0 }} />
      {loadError ? (
        <div style={{ padding: 8, color: DESIGN_TOKENS.colors.error, fontSize: 12 }}>
          Не удалось загрузить редактор. Попробуйте обновить страницу.
        </div>
      ) : null}
    </div>
  )
})

export default QuillEditorWeb
