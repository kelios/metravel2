import { Alert } from 'react-native'

import { uploadImage } from '@/api/misc'
import { normalizeMediaUrl } from '@/utils/mediaUrl'
import {
  buildInstagramEmbedHtmlFromUrl,
  buildYoutubeEmbedHtmlFromUrl,
  extractArticleEditorUploadUrl,
} from './articleEditorConfig'
import type { ArticleEditorSelection } from './articleEditor.types'

type FireChange = (
  val: string,
  selection?: ArticleEditorSelection | null,
  markUserEdited?: boolean,
) => void

export const readImageDimensions = async ({
  file,
  isWeb,
  hasWindow,
}: {
  file: File
  isWeb: boolean
  hasWindow: boolean
}) => {
  if (
    !isWeb ||
    !hasWindow ||
    typeof Image === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return null
  }

  return await new Promise<{ width: number; height: number } | null>((resolve) => {
    let objectUrl = ''
    try {
      objectUrl = URL.createObjectURL(file)
    } catch {
      resolve(null)
      return
    }

    const image = new Image()
    const finalize = (value: { width: number; height: number } | null) => {
      try {
        if (objectUrl) URL.revokeObjectURL(objectUrl)
      } catch {
        // noop
      }
      resolve(value)
    }

    image.onload = () => {
      const width = Number((image as any).naturalWidth || image.width || 0)
      const height = Number((image as any).naturalHeight || image.height || 0)
      if (width > 0 && height > 0) {
        finalize({ width, height })
        return
      }
      finalize(null)
    }

    image.onerror = () => finalize(null)
    image.src = objectUrl
  })
}

export const insertImageIntoEditor = ({
  editor,
  url,
  dimensions,
  fireChange,
}: {
  editor: any
  url: string
  dimensions?: { width: number; height: number } | null
  fireChange: FireChange
}) => {
  if (!editor) return

  const range = editor.getSelection() || { index: editor.getLength(), length: 0 }
  const width = Number(dimensions?.width ?? 0)
  const height = Number(dimensions?.height ?? 0)

  if (width > 0 && height > 0 && editor.clipboard?.dangerouslyPasteHTML) {
    if (range.length > 0 && typeof editor.deleteText === 'function') {
      editor.deleteText(range.index, range.length, 'user')
    }
    const safeUrl = String(url).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    const htmlSnippet = `<img src="${safeUrl}" width="${width}" height="${height}" style="display:block;width:100%;max-width:100%;height:auto;max-height:55vh;object-fit:contain;object-position:center;margin:6px 0 26px;" />`
    editor.clipboard.dangerouslyPasteHTML(range.index, htmlSnippet, 'user')
  } else {
    editor.insertEmbed(range.index, 'image', url, 'user')
  }

  editor.setSelection(range.index + 1, 0, 'silent')
  fireChange(editor.root.innerHTML, { index: range.index + 1, length: 0 })
}

export const uploadImageAndInsert = async ({
  file,
  idTravel,
  isAuthenticated,
  setIsImageUploading,
  getEditor,
  insertImage,
  readDimensions,
}: {
  file: File
  idTravel?: string
  isAuthenticated: boolean
  setIsImageUploading: (value: boolean) => void
  getEditor: () => any
  insertImage: (url: string, dimensions?: { width: number; height: number } | null) => void
  readDimensions: (file: File) => Promise<{ width: number; height: number } | null>
}) => {
  if (!isAuthenticated) {
    if (__DEV__) {
      console.info('[ArticleEditor] upload blocked: not authenticated')
    }
    Alert.alert('Авторизация', 'Войдите, чтобы загружать изображения')
    return
  }

  if (__DEV__) {
    console.info('[ArticleEditor] upload start', {
      name: file?.name,
      type: file?.type,
      size: file?.size,
      idTravel,
    })
  }

  const selectionSnapshot = (() => {
    try {
      const editor = getEditor()
      if (!editor) return null
      const sel =
        typeof editor.getSelection === 'function'
          ? (() => {
              try {
                return editor.getSelection(true)
              } catch {
                return editor.getSelection()
              }
            })()
          : null
      if (sel && typeof sel.index === 'number') return sel
    } catch {
      // noop
    }
    return null
  })()

  try {
    setIsImageUploading(true)
    const form = new FormData()
    form.append('file', file)
    form.append('collection', 'description')
    if (idTravel) form.append('id', String(idTravel))
    const [res, imageDimensions] = await Promise.all([uploadImage(form), readDimensions(file)])
    if (__DEV__) {
      console.info('[ArticleEditor] upload response', res)
    }
    const uploadedUrlRaw = extractArticleEditorUploadUrl(res)
    const imageUrl = uploadedUrlRaw ? normalizeMediaUrl(uploadedUrlRaw) : null
    if (!imageUrl) {
      if (__DEV__) {
        console.warn('[ArticleEditor] Upload response missing url:', res)
      }
      throw new Error('no url in response')
    }
    if (selectionSnapshot) {
      try {
        const editor = getEditor()
        editor?.setSelection?.(selectionSnapshot, 'silent')
      } catch {
        // noop
      }
    }
    insertImage(imageUrl, imageDimensions)
  } catch (err) {
    if (__DEV__) {
      console.error('[ArticleEditor] Image upload failed:', err)
    }
    Alert.alert('Ошибка', 'Не удалось загрузить изображение')
  } finally {
    setIsImageUploading(false)
  }
}

export const openWebImagePicker = ({
  hasWindow,
  createInput,
  onFile,
}: {
  hasWindow: boolean
  createInput: () => HTMLInputElement
  onFile: (file: File) => void
}) => {
  if (!hasWindow) return
  const input = createInput()
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const file = input.files?.[0]
    if (file) onFile(file)
  }
  input.click()
}

export const hasSurfaceDraggedFiles = (event: any) => {
  const types = event?.dataTransfer?.types
  if (!types) return false
  if (typeof types.includes === 'function') return types.includes('Files')
  return Array.from(types).includes('Files')
}

export const handleSurfaceFileDrop = ({
  file,
  shouldLoadQuill,
  hasEditor,
  uploadAndInsert,
  storePendingFile,
  requestQuillLoad,
}: {
  file: File | null | undefined
  shouldLoadQuill: boolean
  hasEditor: boolean
  uploadAndInsert: (file: File) => Promise<void> | void
  storePendingFile: (file: File) => void
  requestQuillLoad: () => void
}) => {
  if (!file) return false
  if (typeof file.type !== 'string' || !file.type.startsWith('image/')) return false
  if (shouldLoadQuill && hasEditor) {
    void uploadAndInsert(file)
    return true
  }
  storePendingFile(file)
  requestQuillLoad()
  return true
}

export const resolvePastePayload = (clipboardData?: DataTransfer | null) => {
  const fileFromFiles = Array.from(clipboardData?.files ?? [])[0]
  const fileFromItems = Array.from(clipboardData?.items ?? [])
    .map((item) => {
      if (!item || typeof item.kind !== 'string' || item.kind !== 'file') return null
      if (typeof item.type !== 'string' || !item.type.startsWith('image/')) return null
      try {
        return item.getAsFile?.() ?? null
      } catch {
        return null
      }
    })
    .find((candidate): candidate is File => !!candidate)

  const file = fileFromFiles ?? fileFromItems
  const pastedHtml = clipboardData?.getData('text/html') ?? ''
  const pastedText = clipboardData?.getData('text/plain') ?? ''
  const instagramEmbedHtml = buildInstagramEmbedHtmlFromUrl(pastedText)
  const youtubeEmbedHtml = buildYoutubeEmbedHtmlFromUrl(pastedText)
  const knownEmbedHtml = instagramEmbedHtml ?? youtubeEmbedHtml
  const cleanedHtml =
    pastedHtml && /src\s*=\s*["']data:/i.test(pastedHtml)
      ? pastedHtml.replace(/<img\s[^>]*src\s*=\s*["']data:[^"']+["'][^>]*\/?>/gi, '')
      : pastedHtml

  return {
    fileFromFiles,
    fileFromItems,
    file,
    pastedHtml,
    knownEmbedHtml,
    cleanedHtml,
  }
}

export const pasteHtmlIntoEditor = ({
  editor,
  html,
}: {
  editor: any
  html: string
}) => {
  if (!editor || typeof editor.clipboard?.dangerouslyPasteHTML !== 'function') return false
  const range = editor.getSelection() || { index: editor.getLength(), length: 0 }
  if (range.length > 0) editor.deleteText(range.index, range.length, 'silent')
  editor.clipboard.dangerouslyPasteHTML(range.index, html, 'user')
  return true
}
