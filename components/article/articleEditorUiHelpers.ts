import { Alert } from 'react-native'

import { escapeHtml, normalizeAnchorId } from '@/utils/htmlUtils'
import { translate as i18nT } from '@/i18n'


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
  compact = false,
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
  compact?: boolean
}): ToolbarAction[] => {
  if (compact) {
    const actions: ToolbarAction[] = [
      {
        name: fullscreen ? 'minimize' : 'maximize',
        onPress: toggleFullscreen,
        label: fullscreen ? i18nT('shared:components.article.articleEditorUiHelpers.svernut_da962db5') : i18nT('shared:components.article.articleEditorUiHelpers.na_ves_ekran_7f0bfab2'),
      },
      {
        name: 'image',
        onPress: openImagePicker,
        label: i18nT('shared:components.article.articleEditorUiHelpers.izobrazhenie_a7123dea'),
      },
    ]

    if (showHtml) {
      actions.unshift({
        name: 'code',
        onPress: toggleHtmlMode,
        label: i18nT('shared:components.article.articleEditorUiHelpers.vizualno_eb1d89cc'),
      })
    }

    return actions
  }

  const actions: ToolbarAction[] = [
    {
      name: 'rotate-ccw',
      onPress: () => quillRef.current?.getEditor().history.undo(),
      label: i18nT('shared:components.article.articleEditorUiHelpers.otmenit_poslednee_deystvie_0195723d'),
    },
    {
      name: 'rotate-cw',
      onPress: () => quillRef.current?.getEditor().history.redo(),
      label: i18nT('shared:components.article.articleEditorUiHelpers.povtorit_deystvie_198fd1da'),
    },
    {
      name: 'code',
      onPress: toggleHtmlMode,
      label: showHtml ? i18nT('shared:components.article.articleEditorUiHelpers.skryt_html_kod_4232e09c') : i18nT('shared:components.article.articleEditorUiHelpers.pokazat_html_kod_d7c4b2c8'),
    },
    {
      name: fullscreen ? 'minimize' : 'maximize',
      onPress: toggleFullscreen,
      label: fullscreen ? i18nT('shared:components.article.articleEditorUiHelpers.vyyti_iz_polnoekrannogo_rezhima_aad1f4e2') : i18nT('shared:components.article.articleEditorUiHelpers.pereyti_v_polnoekrannyy_rezhim_c0a207e4'),
    },
    {
      name: 'delete',
      onPress: clearFormattingPreservingEmbeds,
      label: i18nT('shared:components.article.articleEditorUiHelpers.ochistit_formatirovanie_2b4eecb3'),
    },
    {
      name: 'image',
      onPress: openImagePicker,
      label: i18nT('shared:components.article.articleEditorUiHelpers.vstavit_izobrazhenie_28818f8f'),
    },
  ]

  if (isWeb) {
    actions.push({
      name: 'external-link',
      onPress: openPreview,
      label: i18nT('shared:components.article.articleEditorUiHelpers.otkryt_prevyu_5ddef1e1'),
    })
  }

  actions.push({
    name: 'bookmark',
    onPress: openAnchorModal,
    label: i18nT('shared:components.article.articleEditorUiHelpers.vstavit_yakor_8649e9ae'),
  })

  return actions
}

export const buildArticleEditorModalCallbacks = ({
  setAnchorModalVisible,
  setLinkModalVisible,
  tmpStoredRange,
  tmpStoredLinkQuill,
  getEditor,
  showHtml,
  anchorValue,
  linkValue,
  html,
  htmlSelectionRef,
  setHtmlForcedSelection,
  fireChange,
  insertAnchor,
  applyLinkToSelection,
}: {
  setAnchorModalVisible: (visible: boolean) => void
  setLinkModalVisible: (visible: boolean) => void
  tmpStoredRange: { current: EditorSelection | null }
  tmpStoredLinkQuill: { current: any }
  getEditor: () => any
  showHtml: boolean
  anchorValue: string
  linkValue: string
  html: string
  htmlSelectionRef: { current: HtmlSelection }
  setHtmlForcedSelection: (selection: HtmlSelection) => void
  fireChange: (value: string) => void
  insertAnchor: (value: string) => void
  applyLinkToSelection: (value: string) => void
}) => ({
  onAnchorCancel: () => setAnchorModalVisible(false),
  onAnchorConfirm: () => {
    confirmAnchorEditorModal({
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
    })
  },
  onLinkCancel: () => {
    cancelLinkEditorModal({
      setLinkModalVisible,
      tmpStoredRange,
      tmpStoredLinkQuill,
    })
  },
  onLinkConfirm: () => {
    confirmLinkEditorModal({
      setLinkModalVisible,
      linkValue,
      applyLinkToSelection,
    })
  },
})

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
      Alert.alert(i18nT('shared:components.article.articleEditorUiHelpers.yakor_e4219338'), i18nT('shared:components.article.articleEditorUiHelpers.vvedite_korrektnyy_identifikator_naprimer_da_095e84b3'))
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
