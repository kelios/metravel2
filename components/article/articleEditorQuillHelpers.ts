import { Alert } from 'react-native'

import type { Dispatch, SetStateAction } from 'react'
import { normalizeAnchorId, escapeHtml, normalizeHtmlForQuill } from '@/utils/htmlUtils'
import type { ArticleEditorSelection } from './articleEditor.types'

type EditorGetter = () => any

type FireChange = (
  val: string,
  selection?: ArticleEditorSelection | null,
  markUserEdited?: boolean,
) => void

export const resolveEditorSelection = (
  editor: any,
  lastSelection: ArticleEditorSelection | null,
): ArticleEditorSelection => {
  if (!editor) return { index: 0, length: 0 }
  try {
    const direct = typeof editor.getSelection === 'function' ? editor.getSelection(true) : null
    if (direct && typeof direct.index === 'number') return direct
  } catch {
    // noop
  }

  if (lastSelection) return lastSelection
  return { index: editor.getLength?.() ?? 0, length: 0 }
}

export const rememberSelectionFromEditor = (
  getEditor: EditorGetter,
  setStoredRange: (selection: ArticleEditorSelection | null) => void,
) => {
  try {
    const editor = getEditor()
    if (editor && typeof editor.focus === 'function') editor.focus()
    const selection =
      (editor && typeof editor.getSelection === 'function'
        ? (() => {
            try {
              return editor.getSelection(true)
            } catch {
              return editor.getSelection()
            }
          })()
        : null) ?? null
    setStoredRange(selection)
    return selection
  } catch {
    setStoredRange(null)
    return null
  }
}

export const insertAnchorIntoEditor = ({
  getEditor,
  idRaw,
  storedRange,
  onClearStoredRange,
  lastSelection,
  fireChange,
}: {
  getEditor: EditorGetter
  idRaw: string
  storedRange: ArticleEditorSelection | null
  onClearStoredRange: () => void
  lastSelection: ArticleEditorSelection | null
  fireChange: FireChange
}) => {
  const editor = getEditor()
  if (!editor) return
  const id = normalizeAnchorId(idRaw)
  if (!id) {
    Alert.alert('Якорь', 'Введите корректный идентификатор (например: day-3)')
    return
  }

  try {
    if (typeof editor.focus === 'function') editor.focus()
  } catch {
    // noop
  }

  const range = storedRange || resolveEditorSelection(editor, lastSelection)
  try {
    if (range.length > 0) {
      const selectedText = editor.getText(range.index, range.length)
      const htmlSnippet = `<span id="${id}">${escapeHtml(selectedText)}</span>`
      editor.deleteText(range.index, range.length, 'user')
      editor.clipboard.dangerouslyPasteHTML(range.index, htmlSnippet, 'user')
      editor.setSelection(range.index + selectedText.length, 0, 'silent')
    } else {
      const tokenText = `[#${id}]`
      const htmlSnippet = `<span id="${id}">${tokenText}</span>`
      editor.clipboard.dangerouslyPasteHTML(range.index, htmlSnippet, 'user')
      editor.setSelection(range.index + tokenText.length, 0, 'silent')
    }
    onClearStoredRange()
    const nextIndex =
      range.length > 0 ? range.index + range.length : range.index + `[#${id}]`.length
    fireChange(editor.root.innerHTML, { index: nextIndex, length: 0 })
  } catch (e) {
    try {
      const fallbackText = `[#${id}] `
      editor.insertText(range.index, fallbackText, 'user')
      onClearStoredRange()
      fireChange(editor.root.innerHTML, { index: range.index + fallbackText.length, length: 0 })
    } catch (inner) {
      if (__DEV__) {
        console.warn('Failed to insert anchor into editor', { e, inner })
      }
    }
  }
}

export const applyLinkToEditorSelection = ({
  editor,
  urlRaw,
  storedRange,
  lastSelection,
  onClearStoredState,
  fireChange,
}: {
  editor: any
  urlRaw: string
  storedRange: ArticleEditorSelection | null
  lastSelection: ArticleEditorSelection | null
  onClearStoredState: () => void
  fireChange: FireChange
}) => {
  const url = String(urlRaw ?? '').trim()

  if (!editor) return

  try {
    if (typeof editor.focus === 'function') editor.focus()
  } catch {
    // noop
  }

  const range = storedRange || resolveEditorSelection(editor, lastSelection)
  const safeRange = range ?? { index: 0, length: 0 }

  try {
    editor.setSelection(safeRange, 'silent')
  } catch {
    // noop
  }

  try {
    if (url) {
      if (safeRange.length > 0) {
        if (typeof editor.formatText === 'function') {
          editor.formatText(safeRange.index, safeRange.length, 'link', url, 'user')
        } else {
          editor.format('link', url, 'user')
        }
      } else if (typeof editor.insertText === 'function') {
        editor.insertText(safeRange.index, url, { link: url }, 'user')
        editor.setSelection(safeRange.index + url.length, 0, 'silent')
      } else {
        editor.format('link', url, 'user')
      }
    } else if (safeRange.length > 0 && typeof editor.formatText === 'function') {
      editor.formatText(safeRange.index, safeRange.length, 'link', false, 'user')
    } else {
      editor.format('link', false, 'user')
    }

    onClearStoredState()
    const nextIndex = url
      ? (safeRange.length > 0 ? safeRange.index + safeRange.length : safeRange.index + url.length)
      : safeRange.index + safeRange.length
    fireChange(editor.root.innerHTML, { index: nextIndex, length: 0 })
  } catch {
    // noop
  }
}

export const clearFormattingPreservingEmbeds = ({
  editor,
  fireChange,
}: {
  editor: any
  fireChange: FireChange
}) => {
  if (!editor) return

  const selection = editor.getSelection?.() || { index: 0, length: editor.getLength?.() ?? 0 }
  const inlineFormats = [
    'bold',
    'italic',
    'underline',
    'strike',
    'link',
    'color',
    'background',
    'font',
    'size',
    'script',
  ]
  const lineFormats = ['header', 'list', 'align', 'blockquote', 'indent', 'direction', 'code-block']

  if (!selection.length || selection.length <= 0) {
    const formats = editor.getFormat?.(selection) ?? {}
    Object.keys(formats).forEach((formatName) => {
      try {
        editor.format?.(formatName, false, 'user')
      } catch {
        // noop
      }
    })
    fireChange(editor.root.innerHTML)
    return
  }

  const contents = editor.getContents?.(selection.index, selection.length)
  const ops = Array.isArray(contents?.ops) ? contents.ops : null

  if (!ops) {
    editor.removeFormat?.(selection.index, selection.length, 'user')
    fireChange(editor.root.innerHTML)
    return
  }

  let offset = selection.index
  ops.forEach((op: any) => {
    const insert = op?.insert
    if (typeof insert === 'string') {
      const textLength = insert.length
      if (textLength > 0) {
        inlineFormats.forEach((formatName) => {
          try {
            editor.formatText?.(offset, textLength, formatName, false, 'user')
          } catch {
            // noop
          }
        })
        lineFormats.forEach((formatName) => {
          try {
            editor.formatLine?.(offset, textLength, formatName, false, 'user')
          } catch {
            // noop
          }
        })
      }
      offset += textLength
      return
    }

    offset += 1
  })

  fireChange(editor.root.innerHTML)
}

export const buildHtmlModeToggleHandler = ({
  rememberSelection,
  showHtml,
  getEditorHtml,
  html,
  fireChange,
  requestQuillLoad,
  setShowHtml,
}: {
  rememberSelection: () => ArticleEditorSelection | null
  showHtml: boolean
  getEditorHtml: () => string
  html: string
  fireChange: FireChange
  requestQuillLoad: () => void
  setShowHtml: Dispatch<SetStateAction<boolean>>
}) => {
  rememberSelection()

  if (!showHtml) {
    try {
      const currentFromQuill = getEditorHtml()
      if (currentFromQuill) {
        fireChange(currentFromQuill, undefined, false)
      }
    } catch {
      // noop
    }
  }

  if (showHtml) {
    const currentRaw = typeof html === 'string' ? html : ''
    const normalized = normalizeHtmlForQuill(currentRaw)
    if (normalized !== currentRaw) {
      fireChange(normalized)
    }
    if (normalized.trim().length > 0) requestQuillLoad()
  }

  setShowHtml((v) => !v)
}

export const ensureQuillContent = ({
  editor,
  html,
  remountQuill,
}: {
  editor: any
  html: string
  remountQuill: () => void
}) => {
  if (!editor) return

  editor.update?.('silent')
  editor.scroll?.update?.('silent')

  const nextHtml = typeof html === 'string' ? html : ''
  if (nextHtml.trim().length === 0) return

  const text = typeof editor.getText === 'function' ? String(editor.getText() ?? '') : ''
  const isEditorEmpty = text.replace(/\s+/g, '').length === 0
  if (!isEditorEmpty) return

  try {
    editor.clipboard?.dangerouslyPasteHTML?.(0, nextHtml, 'silent')
    editor.setSelection?.(0, 0, 'silent')
  } catch {
    // noop
  }

  try {
    const textAfter = typeof editor.getText === 'function' ? String(editor.getText() ?? '') : ''
    const stillEmpty = textAfter.replace(/\s+/g, '').length === 0
    if (stillEmpty) remountQuill()
  } catch {
    remountQuill()
  }
}

export const handleQuillHtmlChange = ({
  val,
  source,
  currentHtml,
  fireChange,
}: {
  val: string
  source: unknown
  currentHtml: string
  fireChange: FireChange
}) => {
  const next = typeof val === 'string' ? val : ''
  const local = typeof currentHtml === 'string' ? currentHtml : ''

  if (source !== 'user' && next.trim().length === 0 && local.trim().length > 0) return

  fireChange(next, undefined, source === 'user')
}
