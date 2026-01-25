import React from 'react'
import { Text, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'

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
          <Text style={[styles.galleryTitle, { color: colors.text }]}>Галерея</Text>
        </View>
        <Text style={[styles.imageCount, { color: colors.textMuted }]}>
          Загружено <Text style={[styles.highlight, { color: colors.primary }]}>{imagesCount}</Text> из{' '}
          {maxImages}
        </Text>
      </View>

      <View
        {...(dropzone.rootProps as any)}
        tabIndex={dropzone.tabIndex}
        style={[
          styles.dropzone,
          isDragActive && styles.activeDropzone,
          {
            backgroundColor: colors.backgroundSecondary,
            borderColor: colors.primary,
          },
        ]}
      >
        <input {...inputProps} />
        <Text style={[styles.dropzoneText, { color: colors.textMuted }]}>
          {isDragActive ? 'Отпустите файлы...' : 'Перетащите сюда изображения'}
        </Text>
      </View>

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
            Загрузка {batchUploadProgress.current} из {batchUploadProgress.total}
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
            Некоторые изображения не удалось загрузить. Удалите их и попробуйте снова.
          </Text>
        </View>
      )}
    </>
  )
}
