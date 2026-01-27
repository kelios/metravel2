import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react'
import { View } from 'react-native'
import Quill from 'quill'

type QuillInstance = any

type Props = {
  theme?: string
  value?: string
  onChange?: (html: string, delta: unknown, source: unknown) => void
  modules?: any
  placeholder?: string
  style?: any
}

const ensureIdAttributeRegistered = (() => {
  let done = false
  return () => {
    if (done) return
    done = true
    try {
      const Parchment = (Quill as any).import('parchment')
      const IdAttribute = new (Parchment as any).Attributor.Attribute('id', 'id', {
        scope: (Parchment as any).Scope.INLINE,
      })
      ;(Quill as any).register(IdAttribute, true)
    } catch (e) {
      void e
    }
  }
})()

const QuillEditorWeb = forwardRef(function QuillEditorWeb(props: Props, ref: any) {
  const { theme, value, onChange, placeholder, style } = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const quillRef = useRef<QuillInstance | null>(null)
  const lastHtmlRef = useRef<string>('')
  const isApplyingValueRef = useRef(false)
  const onChangeRef = useRef<Props['onChange']>(onChange)
  const initialValueRef = useRef<string>(typeof value === 'string' ? value : '')

  const modules = useMemo(() => props.modules ?? {}, [props.modules])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    ensureIdAttributeRegistered()
    if (!containerRef.current) return

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

    const quill = new (Quill as any)(containerEl, {
      theme: theme ?? 'snow',
      modules,
      placeholder,
    })

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

    const onTextChange = (delta: unknown, _oldDelta: unknown, source: unknown) => {
      if (isApplyingValueRef.current) return
      const html = String(quill.root?.innerHTML ?? '')
      lastHtmlRef.current = html
      onChangeRef.current?.(html, delta, source)
    }

    quill.on('text-change', onTextChange)

    return () => {
      try {
        quill.off('text-change', onTextChange)
      } catch (e) {
        void e
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
    </View>
  )
})

export default QuillEditorWeb
