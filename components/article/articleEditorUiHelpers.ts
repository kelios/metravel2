import { Alert } from 'react-native'

import { escapeHtml, normalizeAnchorId } from '@/utils/htmlUtils'

type HtmlSelection = { start: number; end: number }
type EditorSelection = { index: number; length: number }

type ToolbarAction = {
  name: 'rotate-ccw' | 'rotate-cw' | 'code' | 'minimize' | 'maximize' | 'delete' | 'image' | 'external-link' | 'bookmark'
  label: string
  onPress: () => void
}

export const buildArticleEditorToolbarActions = ({
  quillRef,
  toggleHtmlMode,
  showHtml,
  fullscreen,
  toggleFullscreen,
  clearFormattingPreservingEmbeds,
  openImagePicker,
  isWeb,
  openPreview,
  openAnchorModal,
}: {
  quillRef: { current: any }
  toggleHtmlMode: () => void
  showHtml: boolean
  fullscreen: boolean
  toggleFullscreen: () => void
  clearFormattingPreservingEmbeds: () => void
  openImagePicker: () => void
  isWeb: boolean
  openPreview: () => void
  openAnchorModal: () => void
}): ToolbarAction[] => {
  const actions: ToolbarAction[] = [
    {
      name: 'rotate-ccw',
      onPress: () => quillRef.current?.getEditor().history.undo(),
      label: 'Отменить последнее действие',
    },
    {
      name: 'rotate-cw',
      onPress: () => quillRef.current?.getEditor().history.redo(),
      label: 'Повторить действие',
    },
    {
      name: 'code',
      onPress: toggleHtmlMode,
      label: showHtml ? 'Скрыть HTML-код' : 'Показать HTML-код',
    },
    {
      name: fullscreen ? 'minimize' : 'maximize',
      onPress: toggleFullscreen,
      label: fullscreen ? 'Выйти из полноэкранного режима' : 'Перейти в полноэкранный режим',
    },
    {
      name: 'delete',
      onPress: clearFormattingPreservingEmbeds,
      label: 'Очистить форматирование',
    },
    {
      name: 'image',
      onPress: openImagePicker,
      label: 'Вставить изображение',
    },
  ]

  if (isWeb) {
    actions.push({
      name: 'external-link',
      onPress: openPreview,
      label: 'Открыть превью',
    })
  }

  actions.push({
    name: 'bookmark',
    onPress: openAnchorModal,
    label: 'Вставить якорь',
  })

  return actions
}

export const openAnchorEditorModal = ({
  rememberSelectionFromEditor,
  setAnchorValue,
  setAnchorModalVisible,
}: {
  rememberSelectionFromEditor: () => void
  setAnchorValue: (value: string) => void
  setAnchorModalVisible: (visible: boolean) => void
}) => {
  rememberSelectionFromEditor()
  setAnchorValue('')
  setAnchorModalVisible(true)
}

export const cancelLinkEditorModal = ({
  setLinkModalVisible,
  tmpStoredRange,
  tmpStoredLinkQuill,
}: {
  setLinkModalVisible: (visible: boolean) => void
  tmpStoredRange: { current: EditorSelection | null }
  tmpStoredLinkQuill: { current: any }
}) => {
  setLinkModalVisible(false)
  tmpStoredRange.current = null
  tmpStoredLinkQuill.current = null
}

export const confirmLinkEditorModal = ({
  setLinkModalVisible,
  linkValue,
  applyLinkToSelection,
}: {
  setLinkModalVisible: (visible: boolean) => void
  linkValue: string
  applyLinkToSelection: (value: string) => void
}) => {
  setLinkModalVisible(false)
  applyLinkToSelection(linkValue)
}

export const confirmAnchorEditorModal = ({
  setAnchorModalVisible,
  tmpStoredRange,
  getEditor,
  showHtml,
  anchorValue,
  html,
  htmlSelectionRef,
  setHtmlForcedSelection,
  fireChange,
  insertAnchor,
}: {
  setAnchorModalVisible: (visible: boolean) => void
  tmpStoredRange: { current: EditorSelection | null }
  getEditor: () => any
  showHtml: boolean
  anchorValue: string
  html: string
  htmlSelectionRef: { current: HtmlSelection }
  setHtmlForcedSelection: (selection: HtmlSelection) => void
  fireChange: (value: string) => void
  insertAnchor: (value: string) => void
}) => {
  setAnchorModalVisible(false)

  if (tmpStoredRange.current) {
    const editor = getEditor()
    if (editor && typeof editor.setSelection === 'function') {
      try {
        editor.setSelection(tmpStoredRange.current as any, 'silent')
      } catch {
        // noop
      }
    }
  }

  if (showHtml) {
    const id = normalizeAnchorId(anchorValue)
    if (!id) {
      Alert.alert('Якорь', 'Введите корректный идентификатор (например: day-3)')
      return
    }

    const current = String(html ?? '')
    const sel = htmlSelectionRef.current
    const start = Math.max(0, Math.min(sel.start ?? 0, current.length))
    const end = Math.max(0, Math.min(sel.end ?? 0, current.length))
    const from = Math.min(start, end)
    const to = Math.max(start, end)

    if (to > from) {
      const selected = current.slice(from, to)
      const wrapped = `<span id="${id}">${escapeHtml(selected)}</span>`
      const next = `${current.slice(0, from)}${wrapped}${current.slice(to)}`
      const caret = from + wrapped.length
      htmlSelectionRef.current = { start: caret, end: caret }
      setHtmlForcedSelection({ start: caret, end: caret })
      fireChange(next)
      return
    }

    const htmlSnippet = `<span id="${id}">[#${id}]</span>`
    const next = `${current.slice(0, from)}${htmlSnippet}${current.slice(from)}`
    const caret = from + htmlSnippet.length
    htmlSelectionRef.current = { start: caret, end: caret }
    setHtmlForcedSelection({ start: caret, end: caret })
    fireChange(next)
    return
  }

  insertAnchor(anchorValue)
}
