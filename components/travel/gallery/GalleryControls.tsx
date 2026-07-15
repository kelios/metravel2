import React from 'react'
import { Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
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
}

export const GalleryControls: React.FC<{
  styles: GalleryControlsStyles
  colors: any
  imagesCount: number
  maxImages: number
  isDragActive: boolean
  dropzone: { rootProps: any; tabIndex?: 0 | -1 }
  inputProps: any
  batchUploadProgress: { current: number; total: number } | null
  hasErrors: boolean
}> = ({
  styles,
  colors,
  imagesCount,
  maxImages,
  isDragActive,
  dropzone,
  inputProps,
  batchUploadProgress,
  hasErrors,
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
