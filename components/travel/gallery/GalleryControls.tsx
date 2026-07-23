import React from 'react'
import { Pressable, Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import Button from '@/components/ui/Button'
import { translate as i18nT } from '@/i18n'


export type GalleryControlsStyles = {
  container: any
  headerContainer: any
  titleRow: any
  galleryTitle: any
  imageCount: any
  highlight: any
  dropzone: any
  activeDropzone: any
  dropzoneText: any
  batchProgressContainer: any
  batchProgressBar: any
  batchProgressFill: any
  batchProgressText: any
  errorBanner: any
  errorBannerText: any
  batchActionsRow: any
  batchActionButton: any
  batchDeleteButton: any
  batchActionButtonText: any
  mobileActions: any
  mobileAction: any
}

export const GalleryControls: React.FC<{
  styles: GalleryControlsStyles
  colors: any
  imagesCount: number
  maxImages: number
  isDragActive: boolean
  isMobileWeb: boolean
  dropzone: { rootProps: any; tabIndex?: 0 | -1 }
  inputProps: any
  galleryInputRef: React.RefObject<HTMLInputElement | null>
  cameraInputRef: React.RefObject<HTMLInputElement | null>
  onMobileFilesSelected: (event: React.ChangeEvent<HTMLInputElement>) => void
  batchUploadProgress: { current: number; total: number } | null
  hasErrors: boolean
  selectableCount: number
  selectedCount: number
  allSelected: boolean
  onToggleSelectAll: () => void
  onDeleteSelected: () => void
}> = ({
  styles,
  colors,
  imagesCount,
  maxImages,
  isDragActive,
  isMobileWeb,
  dropzone,
  inputProps,
  galleryInputRef,
  cameraInputRef,
  onMobileFilesSelected,
  batchUploadProgress,
  hasErrors,
  selectableCount,
  selectedCount,
  allSelected,
  onToggleSelectAll,
  onDeleteSelected,
}) => {
  return (
    <>
      <View style={[styles.headerContainer, { borderBottomColor: colors.borderLight }]}
      >
        <View style={styles.titleRow}>
          <Feather name="camera" size={20} color={colors.text} />
          <Text style={[styles.galleryTitle, { color: colors.text }]}>{i18nT('travel:components.travel.gallery.GalleryControls.galereya_16f9feaf')}</Text>
        </View>
        <Text style={[styles.imageCount, { color: colors.textMuted }]}>
          {i18nT('travel:components.travel.gallery.GalleryControls.zagruzheno_4681bcc7')}<Text style={[styles.highlight, { color: colors.primaryText }]}>{imagesCount}</Text> {i18nT('travel:components.travel.gallery.GalleryControls.iz_75be492c')}{' '}
          {maxImages}
        </Text>
      </View>

      {selectableCount > 0 ? (
        <View style={styles.batchActionsRow}>
          <Pressable
            onPress={onToggleSelectAll}
            style={styles.batchActionButton}
            accessibilityRole="button"
            testID="gallery-select-all-button"
          >
            <Feather
              name={allSelected ? 'square' : 'check-square'}
              size={16}
              color={colors.text}
            />
            <Text style={[styles.batchActionButtonText, { color: colors.text }]}>
              {allSelected
                ? i18nT('travel:components.travel.gallery.GalleryControls.deselectAll')
                : i18nT('travel:components.travel.gallery.GalleryControls.selectAll')}
            </Text>
          </Pressable>

          {selectedCount > 0 ? (
            <Pressable
              onPress={onDeleteSelected}
              style={[styles.batchActionButton, styles.batchDeleteButton]}
              accessibilityRole="button"
              testID="gallery-delete-selected-button"
            >
              <Feather name="trash-2" size={16} color={colors.danger} />
              <Text style={[styles.batchActionButtonText, { color: colors.danger }]}>
                {i18nT('travel:components.travel.gallery.GalleryControls.deleteSelected', { value1: selectedCount })}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {isMobileWeb ? (
        imagesCount < maxImages ? (
          <View style={styles.mobileActions}>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              data-testid="gallery-mobile-gallery-input"
              style={{ display: 'none' }}
              onChange={onMobileFilesSelected}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              data-testid="gallery-mobile-camera-input"
              style={{ display: 'none' }}
              onChange={onMobileFilesSelected}
            />
            <View style={styles.mobileAction}>
              <Button
                variant="primary"
                fullWidth
                onPress={() => galleryInputRef.current?.click()}
                icon={<Feather name="image" size={18} color={colors.textOnPrimary} />}
                label={i18nT('travel:components.travel.ImageGalleryComponent.vybrat_iz_galerei_fbf8b2e6')}
                testID="gallery-mobile-gallery-button"
              />
            </View>
            <View style={styles.mobileAction}>
              <Button
                variant="outline"
                fullWidth
                onPress={() => cameraInputRef.current?.click()}
                icon={<Feather name="camera" size={18} color={colors.text} />}
                label={i18nT('travel:components.travel.ImageGalleryComponent.sdelat_foto_79fec14d')}
                testID="gallery-mobile-camera-button"
              />
            </View>
          </View>
        ) : null
      ) : (
        <div
          {...(dropzone.rootProps as any)}
          tabIndex={dropzone.tabIndex}
          style={{ width: '100%', display: 'flex' }}
        >
          <input {...inputProps} />
          <View
            style={[
              styles.dropzone,
              isDragActive && styles.activeDropzone,
              {
                backgroundColor: colors.backgroundSecondary,
                borderColor: colors.primary,
              },
            ]}
          >
            <Text style={[styles.dropzoneText, { color: colors.textMuted }]}>
              {isDragActive ? i18nT('travel:components.travel.gallery.GalleryControls.otpustite_fayly_5db5ec62') : i18nT('travel:components.travel.gallery.GalleryControls.peretaschite_syuda_izobrazheniya_261e6560')}
            </Text>
          </View>
        </div>
      )}

      {batchUploadProgress && (
        <View
          style={[
            styles.batchProgressContainer,
            {
              backgroundColor: colors.infoSoft,
              borderColor: colors.infoLight,
            },
          ]}
        >
          <View style={[styles.batchProgressBar, { backgroundColor: colors.infoLight }]}>
            <View
              style={[
                styles.batchProgressFill,
                {
                  width: `${(batchUploadProgress.current / batchUploadProgress.total) * 100}%`,
                  backgroundColor: colors.info,
                },
              ]}
            />
          </View>
          <Text style={[styles.batchProgressText, { color: colors.infoDark }]}
          >
            {i18nT('travel:components.travel.gallery.GalleryControls.zagruzka_aefa6291')}{batchUploadProgress.current} {i18nT('travel:components.travel.gallery.GalleryControls.iz_03953c46')}{batchUploadProgress.total}
          </Text>
        </View>
      )}

      {hasErrors && (
        <View
          style={[
            styles.errorBanner,
            {
              backgroundColor: colors.warningSoft,
              borderColor: colors.warningLight,
            },
          ]}
        >
          <Feather name="alert-triangle" size={18} color={colors.warningDark} />
          <Text style={[styles.errorBannerText, { color: colors.warningDark }]}
          >
            {i18nT('travel:components.travel.gallery.GalleryControls.nekotorye_izobrazheniya_ne_udalos_zagruzit_u_81ccc07b')}</Text>
        </View>
      )}
    </>
  )
}
