import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { View } from 'react-native'

type QuillInstance = any

type Props = {
  theme?: string
  value?: string
  onChange?: (html: string, delta: unknown, source: unknown) => void
  modules?: any
  placeholder?: string
  style?: any
}

const QUILL_CDN_JS = 'https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.js'

let quillLoadPromise: Promise<any> | null = null
const loadQuillFromCdn = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Quill is only available in the browser'))
  }

  const w = window as any
  if (w.Quill) return Promise.resolve(w.Quill)
  if (quillLoadPromise) return quillLoadPromise

  quillLoadPromise = new Promise((resolve, reject) => {
    try {
      const existing = window.document.querySelector(`script[src="${QUILL_CDN_JS}"]`) as HTMLScriptElement | null
      if (existing) {
        const done = () => {
          if (w.Quill) resolve(w.Quill)
          else reject(new Error('Quill script loaded but window.Quill is missing'))
        }
        if ((existing as any).dataset?.loaded === 'true') return done()
        existing.addEventListener('load', done, { once: true })
        existing.addEventListener('error', () => reject(new Error('Failed to load Quill script')), { once: true })
        return
      }

      const script = window.document.createElement('script')
      script.async = true
      script.defer = true
      script.src = QUILL_CDN_JS
      try {
        script.dataset.loaded = 'false'
      } catch {
        // noop
      }

      script.addEventListener(
        'load',
        () => {
          try {
            ;(script as any).dataset.loaded = 'true'
          } catch {
            // noop
          }
          if (w.Quill) resolve(w.Quill)
          else reject(new Error('Quill script loaded but window.Quill is missing'))
        },
        { once: true }
      )
      script.addEventListener('error', () => reject(new Error('Failed to load Quill script')), { once: true })
      window.document.head.appendChild(script)
    } catch (e: any) {
      reject(e)
    }
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
    if (!containerRef.current) return

    let cancelled = false
    const containerEl = containerRef.current
    const parent = containerEl.parentElement
    if (parent) {
      const toolbars = Array.from(parent.querySelectorAll(':scope > .ql-toolbar'))
      toolbars.forEach((node) => {
        try {
          parent.removeChild(node)
        } catch (e) {
          void e
        }
      })
    }

    try {
      containerEl.innerHTML = ''
    } catch (e) {
      void e
    }

    if (quillRef.current) return

    setLoadError(null)

    let quillInstance: any | null = null
    let onTextChange: ((delta: unknown, _oldDelta: unknown, source: unknown) => void) | null = null

    loadQuillFromCdn()
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

      if (parent) {
        const toolbars = Array.from(parent.querySelectorAll(':scope > .ql-toolbar'))
        toolbars.forEach((node) => {
          try {
            parent.removeChild(node)
          } catch (err) {
            void err
          }
        })
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
      quill.clipboard?.dangerouslyPasteHTML?.(next, 'silent')
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
        <div style={{ padding: 8, color: '#b00020', fontSize: 12 }}>
          Не удалось загрузить редактор. Попробуйте обновить страницу.
        </div>
      ) : null}
    </View>
  )
})

export default QuillEditorWeb
