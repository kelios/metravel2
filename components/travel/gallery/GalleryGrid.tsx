import React from 'react'
import { Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { ShimmerOverlay } from '@/components/ui/ShimmerOverlay'

import type { GalleryItem } from './types'

export const GalleryGrid: React.FC<{
  styles: any
  colors: any
  isInitialLoading: boolean
  images: GalleryItem[]
  onDelete: (stableKey: string) => void
  onMove: (stableKey: string, direction: -1 | 1) => void
  onImageError: (stableKey: string, url: string) => void
  onImageLoad: (stableKey: string) => void
  DeleteAction: React.ComponentType<{
    onActivate: () => void
    style?: any
    testID?: string
    accessibilityLabel?: string
    children: React.ReactNode
  }>
}> = ({
  styles,
  colors,
  isInitialLoading,
  images,
  onDelete,
  onMove,
  onImageError,
  onImageLoad,
  DeleteAction,
}) => {
  if (isInitialLoading) {
    return (
      <View style={styles.galleryGrid}>
        {[...Array(3)].map((_, i) => (
          <View key={`skeleton-${i}`} style={styles.imageWrapper}>
            <View style={[styles.skeleton, { backgroundColor: colors.surfaceMuted }]} />
          </View>
        ))}
      </View>
    )
  }

  if (!images.length) {
    return (
      <View style={styles.emptyGalleryContainer}>
        <Feather name="image" size={48} color={colors.textMuted} style={{ opacity: 0.5 }} />
        <Text style={[styles.noImagesText, { color: colors.textMuted }]}>
          Нет загруженных изображений
        </Text>
        <Text style={[styles.emptyGalleryHint, { color: colors.textMuted }]}>
          Перетащите файлы или нажмите на зону выше
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.galleryGrid}>
      {images.map((image, index) => {
        const stableKey = image.stableKey ?? image.id
        const canMoveLeft = index > 0 && !image.isUploading
        const canMoveRight = index < images.length - 1 && !image.isUploading
        const moveButtonColor = colors.textInverse
        const disabledMoveButtonColor = colors.textMuted
        const renderMoveControls = () => (
          <View style={styles.moveControls}>
            <DeleteAction
              onActivate={() => canMoveLeft && onMove(stableKey, -1)}
              style={[styles.moveButton, !canMoveLeft && styles.moveButtonDisabled]}
              testID="gallery-move-left-button"
              accessibilityLabel="Переместить фото левее"
            >
              <Feather name="arrow-left" size={16} color={canMoveLeft ? moveButtonColor : disabledMoveButtonColor} />
            </DeleteAction>
            <DeleteAction
              onActivate={() => canMoveRight && onMove(stableKey, 1)}
              style={[styles.moveButton, !canMoveRight && styles.moveButtonDisabled]}
              testID="gallery-move-right-button"
              accessibilityLabel="Переместить фото правее"
            >
              <Feather name="arrow-right" size={16} color={canMoveRight ? moveButtonColor : disabledMoveButtonColor} />
            </DeleteAction>
          </View>
        )

        return (
          <View key={stableKey} style={styles.imageWrapper} testID="gallery-image">
            {image.isUploading ? (
              <View style={styles.uploadingImageContainer}>
                <ShimmerOverlay />
                <View style={styles.uploadingOverlayImage}>
                  <Text style={[styles.uploadingImageText, { color: colors.textInverse }]}>Загрузка...</Text>
                </View>
                <DeleteAction
                  onActivate={() => onDelete(stableKey)}
                  style={styles.deleteButton}
                  testID="delete-image-button"
                >
                  <Feather name="x" size={18} color={colors.textInverse} />
                </DeleteAction>
                {renderMoveControls()}
              </View>
            ) : image.error ? (
              <View style={styles.errorImageContainer}>
                <ImageCardMedia
                  src={image.url}
                  fit="contain"
                  blurBackground
                  allowCriticalWebBlur
                  loading="lazy"
                  alt={`Изображение галереи ${index + 1}`}
                  style={[styles.image, styles.errorImage]}
                  onError={() => onImageError(stableKey, image.url)}
                  onLoad={() => onImageLoad(stableKey)}
                />
                <View style={styles.errorOverlay}>
                  <Feather name="alert-triangle" size={24} color={colors.warningDark} />
                  <Text style={[styles.errorOverlaySubtext, { color: colors.warningDark }]}>{image.error}</Text>
                  <DeleteAction
                    onActivate={() => onDelete(stableKey)}
                    style={[styles.errorActionButton, { backgroundColor: colors.primary }]}
                    testID="delete-image-button"
                  >
                    <Text style={[styles.errorActionText, { color: colors.textInverse }]}>Удалить</Text>
                  </DeleteAction>
                </View>
                <DeleteAction
                  onActivate={() => onDelete(stableKey)}
                  style={styles.deleteButton}
                  testID="delete-image-button"
                >
                  <Feather name="x" size={18} color={colors.textInverse} />
                </DeleteAction>
                {renderMoveControls()}
              </View>
            ) : !image.url ? (
              <View style={styles.uploadingImageContainer}>
                <ShimmerOverlay />
                <DeleteAction
                  onActivate={() => onDelete(stableKey)}
                  style={[styles.deleteButton, { backgroundColor: 'rgba(255,255,255,0.9)' }]}
                  testID="delete-image-button"
                >
                  <Feather name="x" size={18} color={colors.text} />
                </DeleteAction>
                {renderMoveControls()}
              </View>
            ) : (
              <>
                {!image.hasLoaded && (
                  <ShimmerOverlay style={{ zIndex: 0, pointerEvents: 'none' } as any} />
                )}
                <ImageCardMedia
                  src={image.url}
                  fit="contain"
                  blurBackground
                  allowCriticalWebBlur
                  loading="lazy"
                  alt={`Изображение галереи ${index + 1}`}
                  style={[styles.image, !image.hasLoaded && ({ opacity: 0 } as any)]}
                  onError={() => onImageError(stableKey, image.url)}
                  onLoad={() => onImageLoad(stableKey)}
                />
                <DeleteAction
                  onActivate={() => onDelete(stableKey)}
                  style={styles.deleteButton}
                  testID="delete-image-button"
                >
                  <Feather name="x" size={18} color={colors.textInverse} />
                </DeleteAction>
                {renderMoveControls()}
              </>
            )}
          </View>
        )
      })}
    </View>
  )
}
