import React, { useState, useEffect, useCallback, useRef, useMemo, useContext } from 'react'
import {
  View,
  Platform,
  useWindowDimensions,
} from 'react-native'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { QueryClientContext } from '@tanstack/react-query'

import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { uploadImage, deleteImage, reorderGallery } from '@/api/misc'
import { ApiError } from '@/api/client'
import { devError } from '@/utils/logger'
import { queryKeys } from '@/queryKeys'
import { useThemedColors } from '@/hooks/useTheme'
import { validateImageFile } from '@/utils/aiValidation'
import { prepareWebImageFileForUpload } from '@/utils/webImageUpload'

import type { GalleryItem, ImageGalleryComponentProps } from './types'
import { GalleryControls } from './GalleryControls'
import { GalleryGrid } from './GalleryGrid'
import { DeleteAction } from './DeleteAction'
import { createGalleryStyles } from './styles'
import {
  buildApiPrefixedUrl,
  canonicalizeUrlForDedupe,
  dedupeGalleryItems,
  extractBackendImageIdFromUrl,
  isBackendImageId,
  normalizeDisplayUrl,
} from './utils'

interface UploadImageResponse {
  url?: unknown
  path?: unknown
  file_url?: unknown
  id?: unknown
  caption?: unknown
  data?: { url?: unknown; id?: unknown; caption?: unknown }
  [key: string]: unknown
}

const WEB_SUPPORTED_UPLOAD_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
])

const WEB_SUPPORTED_UPLOAD_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif', '.heics', '.heifs']

const WEB_GALLERY_DROPZONE_ACCEPT = {
  'image/*': WEB_SUPPORTED_UPLOAD_EXTENSIONS,
  'image/heic': ['.heic', '.heics'],
  'image/heif': ['.heif', '.heifs'],
  'image/heic-sequence': ['.heics'],
  'image/heif-sequence': ['.heifs'],
}

const createRejectedGalleryItem = (
  file: File,
  index: number,
  fallbackMessage = 'Этот файл не удалось добавить в галерею.',
): GalleryItem => {
  const tempId = `invalid-${Date.now()}-${index}-${String(file.name || 'file')}`

  return {
    id: tempId,
    stableKey: tempId,
    url: '',
    isUploading: false,
    uploadProgress: 0,
    error: fallbackMessage,
    hasLoaded: false,
  }
}

const getDropRejectionError = (rejection: FileRejection): string => {
  if (rejection.errors.some((error) => error.code === 'file-invalid-type')) {
    return 'Этот формат пока не загружается в веб-галерею. Используйте JPG, PNG, WEBP, GIF или HEIC.'
  }

  if (rejection.errors.some((error) => error.code === 'file-too-large')) {
    const validation = validateImageFile(rejection.file)
    return validation.error || 'Файл слишком большой для загрузки.'
  }

  const validation = validateImageFile(rejection.file)
  return validation.error || 'Этот файл не удалось добавить в галерею.'
}

const ImageGallery: React.FC<ImageGalleryComponentProps> = ({
  collection,
  idTravel,
  initialImages: initialImagesProp,
  maxImages = 10,
  onChange,
}) => {
  const colors = useThemedColors()
  const { width: viewportWidth } = useWindowDimensions()
  const queryClient = useContext(QueryClientContext)
  const isMobileWeb = Platform.OS === 'web' && viewportWidth <= 767
  const styles = useMemo(
    () => createGalleryStyles(colors, isMobileWeb),
    [colors, isMobileWeb],
  )

  const [images, setImages] = useState<GalleryItem[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true)
  const [dialogVisible, setDialogVisible] = useState(false)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [batchUploadProgress, setBatchUploadProgress] = useState<{ current: number; total: number } | null>(null)

  const retryRef = useRef(new Set<string>())
  const lastReportedUrlsRef = useRef<string>('')
  const deletedKeysRef = useRef<Set<string>>(new Set())
  const deletedUrlsRef = useRef<Set<string>>(new Set())
  const selectedImageIdRef = useRef<string | null>(null)
  const imagesRef = useRef<GalleryItem[]>([])
  const reorderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const reorderAbortRef = useRef<AbortController | null>(null)

  const hasErrors = useMemo(() => images.some((img) => img.error), [images])

  const reportGalleryItems = useCallback(
    (nextImages: GalleryItem[]) => {
      if (!onChange) return

      const items = nextImages
        .filter((img) => !img.isUploading)
        .map((img) => ({
          id: img.id,
          url: img.url,
          caption: img.caption ?? '',
        }))
        .filter((img) => typeof img.url === 'string' && img.url.trim().length > 0)

      const signature = items.map((img) => `${String(img.id ?? '')}:${img.url}:${img.caption}`).join('|')
      if (signature === lastReportedUrlsRef.current) return
      lastReportedUrlsRef.current = signature
      onChange(items)
    },
    [onChange],
  )

  const persistGalleryOrder = useCallback(() => {
    if (collection !== 'gallery') return

    const numericTravelId = Number(idTravel)
    if (!Number.isInteger(numericTravelId) || numericTravelId <= 0) return

    const orderedIds = imagesRef.current
      .filter((img) => !img.isUploading && !img.error)
      .map((img) =>
        isBackendImageId(img.id) ? String(img.id) : extractBackendImageIdFromUrl(img.url),
      )
      .filter((id): id is string => Boolean(id))

    if (orderedIds.length < 2) return

    reorderAbortRef.current?.abort()
    const controller = new AbortController()
    reorderAbortRef.current = controller

    void reorderGallery(numericTravelId, orderedIds, controller.signal)
      .then(() => {
        void queryClient?.invalidateQueries?.({ queryKey: queryKeys.travel(numericTravelId) })
      })
      .catch((error) => {
        // Порядок также сохраняется при сохранении путешествия — игнорируем сбой запроса.
        devError('Gallery reorder request failed:', error)
      })
  }, [collection, idTravel, queryClient])

  const scheduleGalleryReorder = useCallback(() => {
    if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current)
    reorderTimerRef.current = setTimeout(() => {
      reorderTimerRef.current = null
      persistGalleryOrder()
    }, 700)
  }, [persistGalleryOrder])

  useEffect(() => {
    return () => {
      if (reorderTimerRef.current) {
        clearTimeout(reorderTimerRef.current)
        reorderTimerRef.current = null
        persistGalleryOrder()
      }
    }
  }, [persistGalleryOrder])

  const validateUploadFile = useCallback((file: File): string | null => {
    const validation = validateImageFile(file)
    if (!validation.valid) {
      return validation.error || 'Ошибка загрузки'
    }

    const normalizedType = String(file.type || '').toLowerCase()
    const normalizedName = String(file.name || '').toLowerCase()
    const hasSupportedExtension = WEB_SUPPORTED_UPLOAD_EXTENSIONS.some((ext) => normalizedName.endsWith(ext))

    if (Platform.OS === 'web' && normalizedType && !WEB_SUPPORTED_UPLOAD_TYPES.has(normalizedType) && !hasSupportedExtension) {
      return 'Этот формат пока не загружается в веб-галерею. Используйте JPG, PNG, WEBP, GIF или HEIC.'
    }

    return null
  }, [])

  useEffect(() => {
    setImages((prev) => {
      const prevBackendByUrl = new Map<string, GalleryItem>()
      const prevLoadedByUrl = new Map<string, boolean>()
      for (const item of prev) {
        if (!item?.url) continue
        const canonical = canonicalizeUrlForDedupe(item.url)
        if (item.hasLoaded) {
          prevLoadedByUrl.set(canonical, true)
        }
        if (isBackendImageId(item.id)) {
          prevBackendByUrl.set(canonical, item)
        }
      }

      const uploading = prev.filter((img) => img.isUploading)
      const nextFromProps = (initialImagesProp ?? []).map((img) => ({
        ...img,
        stableKey: img.stableKey ?? String(img.id),
        url: normalizeDisplayUrl(img.url),
        isUploading: false,
        uploadProgress: 0,
        error: null,
        hasLoaded: prevLoadedByUrl.get(canonicalizeUrlForDedupe(normalizeDisplayUrl(img.url))) ?? false,
      }))

      const upgradedFromProps = nextFromProps.map((img) => {
        if (isBackendImageId(img.id)) return img
        const known = prevBackendByUrl.get(canonicalizeUrlForDedupe(img.url))
        if (!known) return img
        return {
          ...img,
          id: known.id,
          stableKey: known.stableKey ?? known.id,
        }
      })

      const filteredFromProps = upgradedFromProps.filter((img) => {
        const key = String(img.stableKey ?? img.id)
        if (deletedKeysRef.current.has(key)) return false
        const canonical = canonicalizeUrlForDedupe(img.url)
        if (canonical && deletedUrlsRef.current.has(canonical)) return false
        return true
      })

      const propUrls = new Set(filteredFromProps.map((img) => img.url))
      const preservedUploading = uploading.filter((img) => !propUrls.has(img.url))

      return dedupeGalleryItems([...filteredFromProps, ...preservedUploading])
    })
    setIsInitialLoading(false)
  }, [initialImagesProp])

  useEffect(() => {
    imagesRef.current = images
  }, [images])

  useEffect(() => {
    reportGalleryItems(images)
  }, [images, reportGalleryItems])

  const handleUploadImages = useCallback(
    async (files: File[]) => {
      // Читаем актуальную длину из ref, а не из захваченного в замыкании images.length:
      // два быстрых дропа подряд видели бы одинаковое устаревшее значение и могли
      // превысить maxImages.
      if (imagesRef.current.length + files.length > maxImages) {
        alert(`Максимум ${maxImages} изображений`)
        return
      }

      const invalidFiles = files
        .map((file, index) => {
          const error = validateUploadFile(file)
          if (!error) return null
          const tempId = `invalid-${Date.now()}-${index}`
          return {
            id: tempId,
            stableKey: tempId,
            url: '',
            isUploading: false,
            uploadProgress: 0,
            error,
            hasLoaded: false,
          }
        })
        .filter(Boolean) as GalleryItem[]

      if (invalidFiles.length > 0) {
        setImages((prev) => dedupeGalleryItems([...prev, ...invalidFiles]))
      }

      const validFiles = files.filter((file) => !validateUploadFile(file))
      if (validFiles.length === 0) {
        return
      }

      setBatchUploadProgress({ current: 0, total: validFiles.length })

      const placeholders = validFiles.map((_file, index) => {
        const tempId = `temp-${Date.now()}-${index}`
        return {
          id: tempId,
          stableKey: tempId,
          url: '',
          isUploading: true,
          uploadProgress: 0,
          error: null,
        }
      })

      setImages((prev) => dedupeGalleryItems([...prev, ...placeholders]))

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i]
        const placeholder = placeholders[i]

        try {
          const uploadableFile =
            Platform.OS === 'web' ? await prepareWebImageFileForUpload(file) : file

          const formData = new FormData()
          formData.append('file', uploadableFile)
          formData.append('collection', collection)
          formData.append('id', idTravel)

          const response: UploadImageResponse = await uploadImage(formData)
          const uploadedUrlRaw =
            response?.url ||
            response?.data?.url ||
            response?.path ||
            response?.file_url
          const uploadedId = response?.id || response?.data?.id || placeholder.id
          const uploadedCaption = typeof response?.caption === 'string'
            ? response.caption
            : typeof response?.data?.caption === 'string'
              ? response.data.caption
              : ''
          if (uploadedUrlRaw) {
            const finalUrl = normalizeDisplayUrl(String(uploadedUrlRaw))

            setImages((prev) => {
              const idx = prev.findIndex((img) => img.stableKey === placeholder.stableKey)
              if (idx >= 0) {
                return dedupeGalleryItems(
                  prev.map((img) =>
                    img.stableKey === placeholder.stableKey
                      ? {
                          ...img,
                          id: String(uploadedId),
                          url: finalUrl,
                          isUploading: false,
                          uploadProgress: 100,
                          error: null,
                          hasLoaded: false,
                          caption: uploadedCaption,
                        }
                      : img,
                  ),
                )
              }

              return dedupeGalleryItems([
                ...prev,
                {
                  ...placeholder,
                  id: String(uploadedId),
                  url: finalUrl,
                  isUploading: false,
                  uploadProgress: 100,
                  error: null,
                  hasLoaded: false,
                  caption: uploadedCaption,
                },
              ])
            })
          } else {
            throw new Error('No URL in response')
          }
        } catch (_error) {
          setImages((prev) =>
            prev.map((img) =>
              img.stableKey === placeholder.stableKey ? { ...img, isUploading: false, error: 'Ошибка загрузки' } : img,
            ),
          )
        }

        setBatchUploadProgress({ current: i + 1, total: validFiles.length })
      }

      setBatchUploadProgress(null)
    },
    [collection, idTravel, maxImages, validateUploadFile],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: WEB_GALLERY_DROPZONE_ACCEPT,
    multiple: true,
    disabled: Platform.OS !== 'web',
    onDrop: (acceptedFiles, fileRejections) => {
      const rejections = Array.isArray(fileRejections) ? fileRejections : []

      if (rejections.length > 0) {
        const rejectedItems = rejections.map((rejection, index) =>
          createRejectedGalleryItem(rejection.file, index, getDropRejectionError(rejection)),
        )
        setImages((prev) => dedupeGalleryItems([...prev, ...rejectedItems]))
      }

      if (acceptedFiles.length > 0) {
        void handleUploadImages(acceptedFiles)
      }
    },
  })

  const dropzoneRootProps = useCallback(() => {
    const props = getRootProps()
    const { tabIndex, ...rest } = props as any
    return {
      rootProps: rest,
      tabIndex: tabIndex as 0 | -1 | undefined,
    }
  }, [getRootProps])

  const deleteByStableKey = useCallback(async (stableKey: string) => {
    const snapshot = imagesRef.current
    const imageToDelete = snapshot.find((img) => (img.stableKey ?? img.id) === stableKey) ?? null

    setImages((prev) => prev.filter((img) => (img.stableKey ?? img.id) !== stableKey))

    try {
      deletedKeysRef.current.add(String(stableKey))
      if (imageToDelete?.url) {
        deletedUrlsRef.current.add(canonicalizeUrlForDedupe(String(imageToDelete.url)))
      }
    } catch {
      void 0
    }

    try {
      const deleteId =
        (imageToDelete && isBackendImageId(imageToDelete.id) ? String(imageToDelete.id) : null) ||
        (imageToDelete ? extractBackendImageIdFromUrl(imageToDelete.url) : null)

      if (deleteId) {
        try {
          await deleteImage(deleteId)
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) {
            void 0
          } else {
            // keep UI deletion; порядок/ссылки также сохраняются при сохранении путешествия
            devError('Gallery delete request failed:', error)
          }
        }
      }
    } finally {
      setDialogVisible(false)
      setSelectedImageId(null)
      selectedImageIdRef.current = null
    }
  }, [])

  const handleDeleteImage = (stableKey: string) => {
    const isJest = !!process.env.JEST_WORKER_ID
    const shouldDeleteImmediatelyOnWeb = Platform.OS === 'web' && !isJest

    if (shouldDeleteImmediatelyOnWeb) {
      try {
        ;(globalThis as any).__e2e_last_gallery_delete = String(stableKey)
      } catch {
        void 0
      }
      try {
        deletedKeysRef.current.add(String(stableKey))
        const current = images.find((img) => (img.stableKey ?? img.id) === stableKey)
        if (current?.url) {
          deletedUrlsRef.current.add(canonicalizeUrlForDedupe(String(current.url)))
        }
      } catch {
        void 0
      }

      setImages((prev) => prev.filter((img) => (img.stableKey ?? img.id) !== stableKey))
      void deleteByStableKey(stableKey)
      return
    }

    selectedImageIdRef.current = stableKey
    setSelectedImageId(stableKey)
    setDialogVisible(true)
  }

  const handleMoveImage = useCallback((stableKey: string, direction: -1 | 1) => {
    const current = imagesRef.current
    const fromIndex = current.findIndex((img) => (img.stableKey ?? img.id) === stableKey)
    if (fromIndex < 0) return

    const toIndex = fromIndex + direction
    if (toIndex < 0 || toIndex >= current.length) return

    const next = [...current]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)

    imagesRef.current = next
    reportGalleryItems(next)
    setImages(next)
    scheduleGalleryReorder()
  }, [reportGalleryItems, scheduleGalleryReorder])

  const handleCaptionChange = useCallback((stableKey: string, caption: string) => {
    const next = imagesRef.current.map((img) =>
      (img.stableKey ?? img.id) === stableKey ? { ...img, caption } : img,
    )
    imagesRef.current = next
    setImages(next)
    reportGalleryItems(next)
  }, [reportGalleryItems])

  const DeleteActionComponent = useMemo(() => DeleteAction, [])

  const handleImageError = useCallback((stableKey: string, currentUrl: string) => {
    if (retryRef.current.has(stableKey)) {
      setImages((prev) =>
        prev.map((img) =>
          (img.stableKey ?? img.id) === stableKey ? { ...img, isUploading: false, error: 'Ошибка загрузки' } : img,
        ),
      )
      return
    }

    const fallback = buildApiPrefixedUrl(currentUrl)
    if (fallback) {
      retryRef.current.add(stableKey)
      setImages((prev) =>
        prev.map((img) =>
          (img.stableKey ?? img.id) === stableKey ? { ...img, url: fallback, isUploading: false, error: null } : img,
        ),
      )
      return
    }

    retryRef.current.add(stableKey)
    setImages((prev) =>
      prev.map((img) =>
        (img.stableKey ?? img.id) === stableKey ? { ...img, isUploading: false, error: 'Ошибка загрузки' } : img,
      ),
    )
  }, [])

  const handleImageLoad = useCallback((stableKey: string) => {
    retryRef.current.delete(stableKey)
    setImages((prev) =>
      prev.map((img) =>
        (img.stableKey ?? img.id) === stableKey ? { ...img, error: null, isUploading: false, hasLoaded: true } : img,
      ),
    )
  }, [])

  // Per-stableKey load-timeout: создаём таймер только для элементов, у которых его
  // ещё нет, и чистим индивидуально, когда элемент загрузился/ошибся/удалён.
  // Раньше эффект пересоздавал ВСЕ таймеры на любое изменение images, бесконечно
  // перезапуская 45/60с отсчёт — медленная картинка могла никогда не таймаутить.
  useEffect(() => {
    const timers = loadTimeoutsRef.current
    const pendingKeys = new Set<string>()

    images
      .filter((img) => !img.isUploading && !img.error && !img.hasLoaded)
      .forEach((img) => {
        const stableKey = img.stableKey ?? img.id
        pendingKeys.add(stableKey)
        if (timers.has(stableKey)) return

        const isBlobUrl = /^(blob:|data:)/i.test(img.url)
        const timeout = isBlobUrl ? 60000 : 45000

        const timer = setTimeout(() => {
          timers.delete(stableKey)
          setImages((prev) =>
            prev.map((item) => {
              if ((item.stableKey ?? item.id) !== stableKey) return item
              if (item.hasLoaded) return item
              return { ...item, error: 'Ошибка загрузки', isUploading: false }
            }),
          )
        }, timeout)
        timers.set(stableKey, timer)
      })

    // Снимаем таймеры для элементов, которые больше не «в ожидании» (загрузились/ошиблись/удалены).
    timers.forEach((timer, key) => {
      if (!pendingKeys.has(key)) {
        clearTimeout(timer)
        timers.delete(key)
      }
    })
  }, [images])

  useEffect(() => {
    const timers = loadTimeoutsRef.current
    return () => {
      timers.forEach(clearTimeout)
      timers.clear()
    }
  }, [])

  const confirmDeleteImage = async () => {
    const key = selectedImageIdRef.current || selectedImageId
    if (!key) return
    await deleteByStableKey(key)
  }

  const dropzoneProps = dropzoneRootProps()

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? (
        <GalleryControls
          styles={styles}
          colors={colors}
          imagesCount={images.length}
          maxImages={maxImages}
          isDragActive={isDragActive}
          dropzone={dropzoneProps}
          inputProps={getInputProps()}
          batchUploadProgress={batchUploadProgress}
          hasErrors={hasErrors}
        />
      ) : null}

      <GalleryGrid
        styles={styles}
        colors={colors}
        isInitialLoading={isInitialLoading}
        images={images}
        onDelete={handleDeleteImage}
        onMove={handleMoveImage}
        onImageError={handleImageError}
        onImageLoad={handleImageLoad}
        onCaptionChange={handleCaptionChange}
        DeleteAction={DeleteActionComponent}
      />

      <ConfirmDialog
        visible={dialogVisible}
        onClose={() => {
          setDialogVisible(false)
          setSelectedImageId(null)
          selectedImageIdRef.current = null
        }}
        onConfirm={confirmDeleteImage}
        title="Удаление изображения"
        message="Вы уверены, что хотите удалить это изображение?"
        confirmText="Удалить"
        cancelText="Отмена"
        confirmTestID="confirm-delete"
        cancelTestID="cancel-delete"
      />
    </View>
  )
}

export default React.memo(ImageGallery)
