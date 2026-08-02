import React from 'react'

import { GalleryControls } from './GalleryControls'
import type { GalleryControlsStyles } from './GalleryControls'

// #1148: состояние контролов галереи, пока грузится ленивый dropzone-чанк.
// Живёт в синхронном графе (react-dropzone не импортирует) и держит ту же
// геометрию, что и загруженные контролы. Занят только выбор файлов —
// `isSelectBusy` вместо общего `isUploading`, иначе гасла бы и съёмка, которая
// работает сразу: её input принадлежит ImageGallery, а не ленивому чанку.
// Зона гасит dragover/drop — иначе брошенный в этот момент файл открылся бы
// в самом браузере.

type GalleryControlsFallbackProps = {
  styles: GalleryControlsStyles
  colors: any
  imagesCount: number
  maxImages: number
  isMobileWeb: boolean
  batchUploadProgress: { current: number; total: number } | null
  hasErrors: boolean
  selectableCount: number
  selectedCount: number
  allSelected: boolean
  onTakePhoto: () => void
  onToggleSelectAll: () => void
  onDeleteSelected: () => void
}

const swallowDropEvent = (event: any) => event?.preventDefault?.()

export const GalleryControlsFallback: React.FC<GalleryControlsFallbackProps> = ({
  styles,
  colors,
  imagesCount,
  maxImages,
  isMobileWeb,
  batchUploadProgress,
  hasErrors,
  selectableCount,
  selectedCount,
  allSelected,
  onTakePhoto,
  onToggleSelectAll,
  onDeleteSelected,
}) => (
  <GalleryControls
    styles={styles}
    colors={colors}
    imagesCount={imagesCount}
    maxImages={maxImages}
    isMobileWeb={isMobileWeb}
    isDragActive={false}
    isUploading={batchUploadProgress !== null}
    isSelectBusy
    dropzone={{ rootProps: { onDragOver: swallowDropEvent, onDrop: swallowDropEvent } }}
    inputProps={{ type: 'file', style: { display: 'none' }, tabIndex: -1 }}
    batchUploadProgress={batchUploadProgress}
    hasErrors={hasErrors}
    selectableCount={selectableCount}
    selectedCount={selectedCount}
    allSelected={allSelected}
    onSelectFromGallery={() => {}}
    onTakePhoto={onTakePhoto}
    onToggleSelectAll={onToggleSelectAll}
    onDeleteSelected={onDeleteSelected}
  />
)

export default GalleryControlsFallback
