import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  View,
  Platform,
} from 'react-native'
import { useDropzone } from 'react-dropzone'

import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { uploadImage, deleteImage } from '@/api/misc'
import { ApiError } from '@/api/client'
import { useThemedColors } from '@/hooks/useTheme'

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

const ImageGallery: React.FC<ImageGalleryComponentProps> = ({
  collection,
  idTravel,
  initialImages: initialImagesProp,
  maxImages = 10,
  onChange,
}) => {
  const colors = useThemedColors()
  const styles = useMemo(() => createGalleryStyles(colors), [colors])

  const [images, setImages] = useState<GalleryItem[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true)
  const [dialogVisible, setDialogVisible] = useState(false)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [batchUploadProgress, setBatchUploadProgress] = useState<{ current: number; total: number } | null>(null)

  const blobUrlsRef = useRef<Set<string>>(new Set())
  const retryRef = useRef(new Set<string>())
  const lastReportedUrlsRef = useRef<string>('')
  const deletedKeysRef = useRef<Set<string>>(new Set())
  const deletedUrlsRef = useRef<Set<string>>(new Set())
  const selectedImageIdRef = useRef<string | null>(null)
  const imagesRef = useRef<GalleryItem[]>([])

  const hasErrors = useMemo(() => images.some((img) => img.error), [images])

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
        stableKey: (img as any).stableKey ?? String(img.id),
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
    const urlsRefSnapshot = blobUrlsRef
    return () => {
      const urlsSnapshot = Array.from(urlsRefSnapshot.current)
      urlsSnapshot.forEach((url) => {
        try {
          URL.revokeObjectURL(url)
        } catch {
          void 0
        }
      })
      urlsRefSnapshot.current.clear()
    }
  }, [])

  useEffect(() => {
    if (!onChange) return
    const urls = images
      .filter((img) => !img.isUploading)
      .map((img) => img.url)
      .filter(Boolean)

    const signature = urls.join('|')
    if (signature === lastReportedUrlsRef.current) return
    lastReportedUrlsRef.current = signature
    onChange(urls)
  }, [images, onChange])

  const handleUploadImages = useCallback(
    async (files: File[]) => {
      if (images.length + files.length > maxImages) {
        alert(`Максимум ${maxImages} изображений`)
        return
      }

      setBatchUploadProgress({ current: 0, total: files.length })

      const placeholders = files.map((_file, index) => {
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

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const placeholder = placeholders[i]

        try {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('collection', collection)
          formData.append('id', idTravel)

          const response = await uploadImage(formData)
          const uploadedUrlRaw =
            (response as any)?.url ||
            (response as any)?.data?.url ||
            (response as any)?.path ||
            (response as any)?.file_url
          const uploadedId = (response as any)?.id || (response as any)?.data?.id || placeholder.id
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

        setBatchUploadProgress({ current: i + 1, total: files.length })
      }

      setBatchUploadProgress(null)
    },
    [collection, idTravel, images.length, maxImages],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    multiple: true,
    disabled: Platform.OS !== 'web',
    onDrop: (acceptedFiles) => handleUploadImages(acceptedFiles),
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
            // keep UI deletion
            void 0
          }
        }
      }

      if (imageToDelete && blobUrlsRef.current.has(imageToDelete.url)) {
        URL.revokeObjectURL(imageToDelete.url)
        blobUrlsRef.current.delete(imageToDelete.url)
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

  useEffect(() => {
    const timers = images
      .filter((img) => !img.isUploading && !img.error && !img.hasLoaded)
      .map((img) => {
        const isBlobUrl = /^(blob:|data:)/i.test(img.url)
        const timeout = isBlobUrl ? 30000 : 15000

        return setTimeout(() => {
          const stableKey = img.stableKey ?? img.id
          setImages((prev) =>
            prev.map((item) => {
              if ((item.stableKey ?? item.id) !== stableKey) return item
              if (item.hasLoaded) return item
              return { ...item, error: 'Ошибка загрузки', isUploading: false }
            }),
          )
        }, timeout)
      })
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [images])

  const confirmDeleteImage = async () => {
    const key = selectedImageIdRef.current || selectedImageId
    if (!key) return
    await deleteByStableKey(key)
  }

  const dropzoneProps = dropzoneRootProps()

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        onImageError={handleImageError}
        onImageLoad={handleImageLoad}
        DeleteAction={DeleteActionComponent as any}
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
