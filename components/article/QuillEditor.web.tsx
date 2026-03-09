import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { View } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'

type QuillInstance = any

type Props = {
  theme?: string
  value?: string
  onChange?: (html: string, delta: unknown, source: unknown) => void
  modules?: any
  placeholder?: string
  style?: any
}

const isTestEnv =
  typeof process !== 'undefined' &&
  (process as any)?.env &&
  ((process as any).env.NODE_ENV === 'test' || (process as any).env.JEST_WORKER_ID !== undefined)

if (typeof window !== 'undefined' && !isTestEnv) {
  try {
    require('quill/dist/quill.snow.css')
  } catch {
    // noop
  }
}

let quillLoadPromise: Promise<any> | null = null
const QUILL_EDITOR_WEB_STYLES_ID = 'article-editor-quill-web-styles'
const QUILL_EDITOR_WEB_CSS = `
[data-editor-surface="article-editor"] .ql-toolbar.ql-snow {
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
[data-editor-surface="article-editor"] .ql-toolbar.ql-snow .ql-formats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-right: 0;
}
[data-editor-surface="article-editor"] .ql-toolbar.ql-snow .ql-picker {
  max-width: 100%;
}
[data-editor-surface="article-editor"] .ql-toolbar.ql-snow .ql-picker.ql-font,
[data-editor-surface="article-editor"] .ql-toolbar.ql-snow .ql-picker.ql-size,
[data-editor-surface="article-editor"] .ql-toolbar.ql-snow .ql-picker.ql-header {
  width: clamp(96px, 18vw, 160px);
}
[data-editor-surface="article-editor"] .ql-toolbar.ql-snow .ql-picker-label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
[data-editor-surface="article-editor"] .ql-container.ql-snow {
  border: 0;
}
.ql-editor img {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  max-height: 55vh;
  object-fit: contain;
  object-position: center;
  margin: 6px 0 26px;
  border-radius: 16px;
  box-sizing: border-box;
}
@media (max-width: 767px) {
  [data-editor-surface="article-editor"] .ql-toolbar.ql-snow {
    gap: 6px 8px;
    padding: 10px;
  }
  [data-editor-surface="article-editor"] .ql-toolbar.ql-snow .ql-formats {
    gap: 2px;
  }
  [data-editor-surface="article-editor"] .ql-toolbar.ql-snow .ql-picker.ql-font,
  [data-editor-surface="article-editor"] .ql-toolbar.ql-snow .ql-picker.ql-size,
  [data-editor-surface="article-editor"] .ql-toolbar.ql-snow .ql-picker.ql-header {
    width: min(132px, 40vw);
  }
}
@media (max-width: 479px) {
  [data-editor-surface="article-editor"] .ql-toolbar.ql-snow {
    padding: 8px;
  }
  [data-editor-surface="article-editor"] .ql-toolbar.ql-snow .ql-formats {
    width: 100%;
  }
  [data-editor-surface="article-editor"] .ql-toolbar.ql-snow .ql-picker.ql-font,
  [data-editor-surface="article-editor"] .ql-toolbar.ql-snow .ql-picker.ql-size,
  [data-editor-surface="article-editor"] .ql-toolbar.ql-snow .ql-picker.ql-header {
    width: min(132px, 100%);
  }
}
`

const loadQuill = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Quill is only available in the browser'))
  }

  const w = window as any
  if (w.Quill) return Promise.resolve(w.Quill)
  if (quillLoadPromise) return quillLoadPromise

  quillLoadPromise = import('quill')
    .then((mod) => {
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
  const { theme, value, onChange, placeholder, style } = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const quillRef = useRef<QuillInstance | null>(null)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const lastHtmlRef = useRef<string>('')
  const isApplyingValueRef = useRef(false)
  const onChangeRef = useRef<Props['onChange']>(onChange)
  const initialValueRef = useRef<string>(typeof value === 'string' ? value : '')

  const modules = useMemo(() => props.modules ?? {}, [props.modules])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (typeof document === 'undefined') return

    let styleEl = document.getElementById(QUILL_EDITOR_WEB_STYLES_ID) as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = QUILL_EDITOR_WEB_STYLES_ID
      styleEl.textContent = QUILL_EDITOR_WEB_CSS
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
    <View style={style}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
      {loadError ? (
        <div style={{ padding: 8, color: DESIGN_TOKENS.colors.error, fontSize: 12 }}>
          Не удалось загрузить редактор. Попробуйте обновить страницу.
        </div>
      ) : null}
    </View>
  )
})

export default QuillEditorWeb
