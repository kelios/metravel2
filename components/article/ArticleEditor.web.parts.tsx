import React, { Suspense, type ReactNode } from 'react'
import { View, Text, TextInput, ActivityIndicator, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import Button from '@/components/ui/Button'
import { hasSurfaceDraggedFiles } from './articleEditorMediaHelpers'
import {
  ArticleEditorAnchorModal,
  ArticleEditorLinkModal,
  ArticleEditorToolbar,
} from './ArticleEditorWebChrome'
import { translate as i18nT } from '@/i18n'


export const ArticleEditorShell = ({
  children,
  dynamicStyles,
  fullscreen,
}: {
  children: ReactNode
  dynamicStyles: any
  fullscreen: boolean
}) => fullscreen ? (
  <Modal visible animationType="slide">
    <SafeAreaView style={dynamicStyles.fullWrap}>
      <View style={dynamicStyles.fullInner}>{children}</View>
    </SafeAreaView>
  </Modal>
) : (
  <View style={dynamicStyles.wrap}>{children}</View>
)


export const ArticleEditorLoader: React.FC<{
  canActivate?: boolean
  dynamicStyles: any
  primaryColor: string
  onRequestLoad: () => void
}> = ({ canActivate = false, dynamicStyles, primaryColor, onRequestLoad }) => (
  <View style={dynamicStyles.loadBox}>
    {canActivate ? (
      <>
        <Text style={dynamicStyles.loadTxt}>{i18nT('shared:components.article.ArticleEditor_web_parts.redaktor_podgotavlivaetsya_d0f38cfc')}</Text>
        <Text style={dynamicStyles.loadHint}>
          {i18nT('shared:components.article.ArticleEditor_web_parts.mozhno_otkryt_ego_srazu_ili_podozhdat_avtoma_813c0424')}</Text>
        <Button
          onPress={onRequestLoad}
          label={i18nT('shared:components.article.ArticleEditor_web_parts.otkryt_redaktor_5bf866ec')}
          variant="outline"
          size="sm"
        />
      </>
    ) : (
      <>
        <ActivityIndicator size="small" color={primaryColor} />
        <Text style={dynamicStyles.loadTxt}>{i18nT('shared:components.article.ArticleEditor_web_parts.zagruzka_2973bf98')}</Text>
      </>
    )}
  </View>
)

export const ArticleEditorSurfaceContent: React.FC<{
  showHtml: boolean
  shouldLoadQuill: boolean
  dynamicStyles: any
  colors: any
  html: string
  placeholder: string
  fireChange: (text: string) => void
  htmlForcedSelection: { start: number; end: number } | null
  setHtmlForcedSelection: (value: { start: number; end: number } | null) => void
  htmlSelectionRef: React.MutableRefObject<{ start: number; end: number }>
  QuillEditor: any
  quillMountKey: number
  handleQuillRef: (node: any) => void
  handleQuillChange: (val: string, delta: unknown, source: unknown) => void
  modules: any
  isCompactViewport: boolean
  fullscreen: boolean
  renderLoader: (canActivate?: boolean) => React.ReactNode
}> = ({
  showHtml,
  shouldLoadQuill,
  dynamicStyles,
  colors,
  html,
  placeholder,
  fireChange,
  htmlForcedSelection,
  setHtmlForcedSelection,
  htmlSelectionRef,
  QuillEditor,
  quillMountKey,
  handleQuillRef,
  handleQuillChange,
  modules,
  isCompactViewport,
  fullscreen,
  renderLoader,
}) => {
  if (showHtml) {
    return (
      <TextInput
        style={dynamicStyles.html}
        multiline
        value={html}
        onChangeText={text => fireChange(text)}
        selection={htmlForcedSelection ?? undefined}
        onSelectionChange={e => {
          const sel = e?.nativeEvent?.selection
          if (!sel) return
          if (
            htmlForcedSelection &&
            typeof sel.start === 'number' &&
            typeof sel.end === 'number' &&
            sel.start === htmlForcedSelection.start &&
            sel.end === htmlForcedSelection.end
          ) {
            setHtmlForcedSelection(null)
          }
          htmlSelectionRef.current = {
            start: typeof sel.start === 'number' ? sel.start : 0,
            end: typeof sel.end === 'number' ? sel.end : 0,
          }
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
      />
    )
  }

  if (!shouldLoadQuill) {
    return <>{renderLoader(true)}</>
  }

  return (
    <Suspense fallback={<>{renderLoader()}</>}>
      <QuillEditor
        key={quillMountKey}
        ref={handleQuillRef}
        theme="snow"
        value={html}
        onChange={handleQuillChange}
        modules={modules}
        placeholder={placeholder}
        style={dynamicStyles.editor}
        editorChromeAttrs={{
          compact: isCompactViewport,
          fullscreen,
        }}
      />
    </Suspense>
  )
}

export const ArticleEditorBody: React.FC<{
  colors: any
  dynamicStyles: any
  isCompactViewport: boolean
  isImageUploading: boolean
  isManualSaving: boolean
  isWeb: boolean
  label: string
  onManualSave?: (() => void) | null
  toolbarActions: any
  editorViewportRef: React.Ref<any>
  editorArea: React.ReactNode
  handleSurfaceFileDrop: (file: File | null | undefined) => boolean
  requestQuillLoad: () => void
  focusQuill: () => void
  anchorModalVisible: boolean
  anchorValue: string
  anchorInputRef: React.RefObject<any>
  setAnchorValue: (value: string) => void
  focusAnchorInput: () => void
  onAnchorCancel: () => void
  onAnchorConfirm: () => void
  linkModalVisible: boolean
  linkValue: string
  linkInputRef: React.RefObject<any>
  setLinkValue: (value: string) => void
  focusLinkInput: () => void
  onLinkCancel: () => void
  onLinkConfirm: () => void
}> = ({
  colors,
  dynamicStyles,
  isCompactViewport,
  isImageUploading,
  isManualSaving,
  isWeb,
  label,
  onManualSave,
  toolbarActions,
  editorViewportRef,
  editorArea,
  handleSurfaceFileDrop,
  requestQuillLoad,
  focusQuill,
  anchorModalVisible,
  anchorValue,
  anchorInputRef,
  setAnchorValue,
  focusAnchorInput,
  onAnchorCancel,
  onAnchorConfirm,
  linkModalVisible,
  linkValue,
  linkInputRef,
  setLinkValue,
  focusLinkInput,
  onLinkCancel,
  onLinkConfirm,
}) => (
  <>
    <ArticleEditorToolbar
      colors={colors}
      dynamicStyles={dynamicStyles}
      isCompactViewport={isCompactViewport}
      isImageUploading={isImageUploading}
      isManualSaving={isManualSaving}
      isWeb={isWeb}
      label={label}
      onManualSave={onManualSave}
      actions={toolbarActions}
    />
    <View
      ref={editorViewportRef}
      style={dynamicStyles.editorArea}
      {...(isWeb
        ? ({
            'data-editor-surface': 'article-editor',
            onDragEnter: (e: any) => {
              if (!hasSurfaceDraggedFiles(e)) return
              e.preventDefault()
            },
            onDragOver: (e: any) => {
              if (!hasSurfaceDraggedFiles(e)) return
              e.preventDefault()
              try {
                e.dataTransfer.dropEffect = 'copy'
              } catch {
                // noop
              }
            },
            onDrop: (e: any) => {
              const file = e?.dataTransfer?.files?.[0] ?? null
              const accepted = handleSurfaceFileDrop(file)
              if (!accepted) return
              e.preventDefault()
              e.stopPropagation?.()
            },
            onFocusCapture: () => {
              requestQuillLoad()
            },
            onPointerDown: () => {
              requestQuillLoad()
            },
            onClickCapture: () => {
              requestQuillLoad()
            },
            onMouseDown: (e: any) => {
              requestQuillLoad()
              const target = e?.target as HTMLElement | null
              if (target?.closest?.('.ql-editor')) return
              focusQuill()
            },
            onTouchStart: (e: any) => {
              requestQuillLoad()
              const target = e?.target as HTMLElement | null
              if (target?.closest?.('.ql-editor')) return
              focusQuill()
            },
          } as any)
        : null)}
    >
      {editorArea}
    </View>
    <ArticleEditorAnchorModal
      colors={colors}
      dynamicStyles={dynamicStyles}
      visible={anchorModalVisible}
      value={anchorValue}
      inputRef={anchorInputRef}
      onChangeText={setAnchorValue}
      onShow={focusAnchorInput}
      onCancel={onAnchorCancel}
      onConfirm={onAnchorConfirm}
    />

    <ArticleEditorLinkModal
      colors={colors}
      dynamicStyles={dynamicStyles}
      visible={linkModalVisible}
      value={linkValue}
      inputRef={linkInputRef}
      onChangeText={setLinkValue}
      onShow={focusLinkInput}
      onCancel={onLinkCancel}
      onConfirm={onLinkConfirm}
    />
  </>
)
