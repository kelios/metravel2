import { getQuillModulesForVariant } from './articleEditorConfig'

type Range = { index: number; length: number } | null

export function buildArticleEditorQuillModules({
  variant,
  tmpStoredRange,
  tmpStoredLinkQuill,
  fireChangeRef,
  openImagePickerRef,
  setLinkValue,
  setLinkModalVisible,
}: {
  variant: string
  tmpStoredRange: { current: Range }
  tmpStoredLinkQuill: { current: any }
  fireChangeRef: { current: (val: string) => void }
  openImagePickerRef: { current: () => void }
  setLinkValue: (value: string) => void
  setLinkModalVisible: (visible: boolean) => void
}): any {
  const base = getQuillModulesForVariant(variant as any)
  const container = (base as any).toolbar

  return {
    ...base,
    toolbar: {
      container,
      handlers: {
        link: function (value: any) {
          const quill = (this as any)?.quill
          if (!quill) return

          if (value === false) {
            try {
              quill.format('link', false, 'user')
              fireChangeRef.current(String(quill.root.innerHTML ?? ''))
            } catch {
              // noop
            }
            return
          }

          let selection: { index: number; length: number } | null = null
          try {
            selection = quill.getSelection(true)
          } catch {
            try {
              selection = quill.getSelection()
            } catch {
              selection = null
            }
          }

          tmpStoredRange.current = selection
          tmpStoredLinkQuill.current = quill

          let existing = ''
          try {
            const fmt = selection ? quill.getFormat(selection) : quill.getFormat()
            existing = typeof fmt?.link === 'string' ? fmt.link : ''
          } catch {
            existing = ''
          }

          setLinkValue(existing)
          setLinkModalVisible(true)
        },
        image: function () {
          openImagePickerRef.current()
        },
      },
    },
  } as any
}
