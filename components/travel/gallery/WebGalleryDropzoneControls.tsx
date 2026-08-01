import React from 'react'
import type { FileRejection, useDropzone as UseDropzoneHook } from 'react-dropzone'

import { GalleryControls } from './GalleryControls'
import type { GalleryControlsStyles } from './GalleryControls'
import { WEB_SUPPORTED_UPLOAD_EXTENSIONS } from './utils'

// #1148: dropzone-контролы галереи без собственного sync-импорта вендора.
// Модуль экспортирует ФАБРИКУ: хук useDropzone приходит из
// `@/utils/dropzoneVendor`, который родитель (ImageGallery) грузит в
// React.lazy-фабрике параллельно с этим модулем. Sync-импорт react-dropzone
// здесь вернул бы вендора в web-__common: этот чанк и чанк WebDropzoneView —
// разные async-корни, и общий sync-подграф Metro хойстит в __common.
// Хук вызывается внутри компонента безусловно — правила хуков соблюдены.

const WEB_GALLERY_DROPZONE_ACCEPT = {
  'image/*': WEB_SUPPORTED_UPLOAD_EXTENSIONS,
  'image/heic': ['.heic', '.heics'],
  'image/heif': ['.heif', '.heifs'],
  'image/heic-sequence': ['.heics'],
  'image/heif-sequence': ['.heifs'],
}

export type WebGalleryDropzoneControlsProps = {
  styles: GalleryControlsStyles
  colors: any
  imagesCount: number
  maxImages: number
  isMobileWeb: boolean
  isUploading: boolean
  batchUploadProgress: { current: number; total: number } | null
  hasErrors: boolean
  selectableCount: number
  selectedCount: number
  allSelected: boolean
  onFilesAccepted: (files: File[]) => void
  onFilesRejected: (rejections: FileRejection[]) => void
  onTakePhoto: () => void
  onToggleSelectAll: () => void
  onDeleteSelected: () => void
}

export const createWebGalleryDropzoneControls = (
  useDropzone: typeof UseDropzoneHook,
): React.FC<WebGalleryDropzoneControlsProps> => {
  const WebGalleryDropzoneControls: React.FC<WebGalleryDropzoneControlsProps> = ({
    styles,
    colors,
    imagesCount,
    maxImages,
    isMobileWeb,
    isUploading,
    batchUploadProgress,
    hasErrors,
    selectableCount,
    selectedCount,
    allSelected,
    onFilesAccepted,
    onFilesRejected,
    onTakePhoto,
    onToggleSelectAll,
    onDeleteSelected,
  }) => {
    const { getRootProps, getInputProps, isDragActive, open: openFilePicker } = useDropzone({
      accept: WEB_GALLERY_DROPZONE_ACCEPT,
      multiple: true,
      noClick: isMobileWeb,
      noKeyboard: isMobileWeb,
      noDrag: isMobileWeb,
      onDrop: (acceptedFiles, fileRejections) => {
        const rejections = Array.isArray(fileRejections) ? fileRejections : []
        if (rejections.length > 0) onFilesRejected(rejections)
        if (acceptedFiles.length > 0) onFilesAccepted(acceptedFiles)
      },
    })

    // tabIndex из getRootProps уходит отдельным полем: GalleryControls применяет
    // его к своему контейнеру, не смешивая с остальными DOM-пропсами зоны.
    const { tabIndex, ...rootProps } = getRootProps()
    const normalizedTabIndex: 0 | -1 | undefined = tabIndex === 0
      ? 0
      : tabIndex === -1
        ? -1
        : undefined
    const dropzone = {
      rootProps,
      tabIndex: normalizedTabIndex,
    }

    return (
      <GalleryControls
        styles={styles}
        colors={colors}
        imagesCount={imagesCount}
        maxImages={maxImages}
        isMobileWeb={isMobileWeb}
        isDragActive={isDragActive}
        isUploading={isUploading}
        dropzone={dropzone}
        inputProps={getInputProps()}
        batchUploadProgress={batchUploadProgress}
        hasErrors={hasErrors}
        selectableCount={selectableCount}
        selectedCount={selectedCount}
        allSelected={allSelected}
        onSelectFromGallery={openFilePicker}
        onTakePhoto={onTakePhoto}
        onToggleSelectAll={onToggleSelectAll}
        onDeleteSelected={onDeleteSelected}
      />
    )
  }
  return WebGalleryDropzoneControls
}
