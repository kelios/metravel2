import React from 'react'
import { Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

import ImageCardMedia from '@/components/ui/ImageCardMedia'
import { ShimmerOverlay } from '@/components/ui/ShimmerOverlay'
import type { ThemedColors } from '@/hooks/useTheme'

import type { GalleryItem } from './types'
import type { createGalleryStyles } from './styles'
import type { DeleteActionStyle } from './DeleteAction'
import { GalleryCaptionEditor } from './GalleryCaptionEditor'
import { translate as i18nT } from '@/i18n'


type GalleryStyles = ReturnType<typeof createGalleryStyles>

export const GalleryGrid: React.FC<{
  styles: GalleryStyles
  colors: ThemedColors
  isInitialLoading: boolean
  isMobileWeb: boolean
  images: GalleryItem[]
  onDelete: (stableKey: string) => void
  onMove: (stableKey: string, direction: -1 | 1) => void
  onImageError: (stableKey: string, url: string) => void
  onImageLoad: (stableKey: string) => void
  onCaptionChange: (stableKey: string, caption: string) => void
  selectedKeys: Set<string>
  onToggleSelect: (stableKey: string) => void
  DeleteAction: React.ComponentType<{
    onActivate: () => void
    style?: DeleteActionStyle
    testID?: string
    accessibilityLabel?: string
    children: React.ReactNode
  }>
}> = ({
  styles,
  colors,
  isInitialLoading,
  isMobileWeb,
  images,
  onDelete,
  onMove,
  onImageError,
  onImageLoad,
  onCaptionChange,
  selectedKeys,
  onToggleSelect,
  DeleteAction,
}) => {
  if (isInitialLoading) {
    return (
      <View style={styles.galleryGrid}>
        {[...Array(3)].map((_, i) => (
          <View key={`skeleton-${i}`} style={styles.imageWrapper}>
            <View style={styles.imageFrame}>
              <View style={[styles.skeleton, { backgroundColor: colors.surfaceMuted }]} />
            </View>
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
          {i18nT('travel:components.travel.gallery.GalleryGrid.net_zagruzhennyh_izobrazheniy_d6199483')}</Text>
        <Text style={[styles.emptyGalleryHint, { color: colors.textMuted }]}>
          {isMobileWeb
            ? i18nT('travel:components.travel.gallery.mobileAddHint')
            : i18nT('travel:components.travel.gallery.GalleryGrid.peretaschite_fayly_ili_nazhmite_na_zonu_vysh_beb2acf5')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.galleryGrid}>
      {images.map((image, index) => {
        const stableKey = image.stableKey ?? image.id
        const isSelected = selectedKeys.has(stableKey)
        const isSelectable = !image.isUploading
        const canMoveLeft = index > 0 && !image.isUploading
        const canMoveRight = index < images.length - 1 && !image.isUploading
        const moveButtonColor = colors.textOnDark
        const disabledMoveButtonColor = colors.textMuted
        const renderMoveControls = () => (
          <View style={styles.moveControls}>
            <DeleteAction
              onActivate={() => canMoveLeft && onMove(stableKey, -1)}
              style={[styles.moveButton, !canMoveLeft && styles.moveButtonDisabled]}
              testID="gallery-move-left-button"
              accessibilityLabel={i18nT('travel:components.travel.gallery.GalleryGrid.peremestit_foto_levee_80430f4e')}
            >
              <Feather
                name="arrow-left"
                size={16}
                color={canMoveLeft ? moveButtonColor : disabledMoveButtonColor}
                testID="gallery-move-left-icon"
              />
            </DeleteAction>
            <DeleteAction
              onActivate={() => canMoveRight && onMove(stableKey, 1)}
              style={[styles.moveButton, !canMoveRight && styles.moveButtonDisabled]}
              testID="gallery-move-right-button"
              accessibilityLabel={i18nT('travel:components.travel.gallery.GalleryGrid.peremestit_foto_pravee_b568179e')}
            >
              <Feather
                name="arrow-right"
                size={16}
                color={canMoveRight ? moveButtonColor : disabledMoveButtonColor}
                testID="gallery-move-right-icon"
              />
            </DeleteAction>
          </View>
        )

        return (
          <View
            key={stableKey}
            style={[styles.imageWrapper, isSelected && styles.imageWrapperSelected]}
            testID="gallery-image"
          >
            <View style={styles.imageFrame}>
              {isSelectable ? (
                <DeleteAction
                  onActivate={() => onToggleSelect(stableKey)}
                  style={[styles.selectCheckbox, isSelected && styles.selectCheckboxActive]}
                  testID="gallery-select-checkbox"
                  accessibilityLabel={i18nT('travel:components.travel.gallery.GalleryGrid.selectPhoto')}
                >
                  <Feather
                    name="check"
                    size={20}
                    color={isSelected ? colors.textInverse : 'transparent'}
                  />
                </DeleteAction>
              ) : null}
              {image.isUploading ? (
                <View style={styles.uploadingImageContainer}>
                <ShimmerOverlay />
                <View style={styles.uploadingOverlayImage}>
                  <Text style={[styles.uploadingImageText, { color: colors.textInverse }]}>{i18nT('travel:components.travel.gallery.GalleryGrid.zagruzka_048d94b8')}</Text>
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
                  alt={i18nT('travel:components.travel.gallery.GalleryGrid.izobrazhenie_galerei_value1_57b84c61', { value1: index + 1 })}
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
                    <Text style={[styles.errorActionText, { color: colors.textInverse }]}>{i18nT('travel:components.travel.gallery.GalleryGrid.udalit_d2e753de')}</Text>
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
                  alt={i18nT('travel:components.travel.gallery.GalleryGrid.izobrazhenie_galerei_value1_57b84c61', { value1: index + 1 })}
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
            {!image.isUploading && /^\d+$/.test(String(image.id)) ? (
              <GalleryCaptionEditor
                imageId={String(image.id)}
                caption={image.caption ?? ''}
                onCaptionChange={(caption) => onCaptionChange(stableKey, caption)}
              />
            ) : null}
          </View>
        )
      })}
    </View>
  )
}
