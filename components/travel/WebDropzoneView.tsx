import React, { useCallback, useRef } from 'react';
import { ActivityIndicator, Pressable, View, Text } from 'react-native';
import type { useDropzone as UseDropzoneHook } from 'react-dropzone';
import Feather from '@expo/vector-icons/Feather';
import Button from '@/components/ui/Button';
import type { useThemedColors } from '@/hooks/useTheme';
import { WEB_SUPPORTED_UPLOAD_EXTENSIONS } from '@/components/travel/gallery/utils';
import { translate as i18nT } from '@/i18n';

// #1148: web-вью загрузчика фото с dropzone-зоной, вынесен из
// PhotoUploadWithPreview. Модуль экспортирует ФАБРИКУ: useDropzone приходит из
// `@/utils/dropzoneVendor`, который родитель грузит в React.lazy-фабрике
// параллельно с этим модулем. Sync-импорта react-dropzone здесь нет намеренно:
// этот чанк и чанк WebGalleryDropzoneControls — разные async-корни, и общий
// sync-подграф Metro хойстил бы в web-__common (прежний require(...) внутри
// компонента прятал вендора от native-рантайма — F-24, — но для Metro оставался
// статическим ребром web-графа).

export type WebDropzoneViewProps = {
  disabled: boolean;
  isMobileWeb: boolean;
  placeholder: string;
  maxSizeMB: number;
  colors: ReturnType<typeof useThemedColors>;
  styles: any;
  loading: boolean;
  uploadProgress: number;
  error: string | null;
  uploadMessage: string | null;
  hasValidImage: boolean;
  currentDisplayUrl: string | undefined;
  validateFile: (file: File) => string | null;
  handleUploadImage: (file: any) => Promise<void>;
  handleRemovePress: () => void;
  handleImageLoadCheck: (img: HTMLImageElement) => void;
  handleImageError: () => void;
};

export const createWebDropzoneView = (
  useDropzone: typeof UseDropzoneHook,
): React.FC<WebDropzoneViewProps> => {
  const WebDropzoneView: React.FC<WebDropzoneViewProps> = ({
  disabled, isMobileWeb, placeholder, maxSizeMB, colors, styles,
  loading, uploadProgress, error, uploadMessage, hasValidImage, currentDisplayUrl,
  validateFile, handleUploadImage, handleRemovePress, handleImageLoadCheck, handleImageError,
}) => {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploadWebFile = useCallback(async (file?: File) => {
    if (disabled || !file) return;
    const validationError = validateFile(file);
    if (validationError) return;
    await handleUploadImage(file);
  }, [disabled, handleUploadImage, validateFile]);

  const { getRootProps, getInputProps, isDragActive, open: openFilePicker } = useDropzone({
    onDrop: async (acceptedFiles, rejectedFiles) => {
      if (disabled) return;
      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        // Validation handled by the hook, but show dropzone-specific errors
        if (rejection.errors.some(e => e.code === 'file-too-large')) return;
        if (rejection.errors.some(e => e.code === 'file-invalid-type')) return;
        return;
      }
      await uploadWebFile(acceptedFiles[0]);
    },
    // Тот же список расширений, что у галереи: обложка отклоняла .heics/.heifs,
    // которые галерея принимает — расхождение без причины (см. gallery/utils.ts).
    accept: { 'image/*': WEB_SUPPORTED_UPLOAD_EXTENSIONS },
    maxSize: maxSizeMB * 1024 * 1024,
    multiple: false,
    disabled,
    noClick: isMobileWeb,
    noKeyboard: isMobileWeb,
    noDrag: isMobileWeb,
  });

  const handleCameraInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    void uploadWebFile(file);
  }, [uploadWebFile]);

  const { onBeforeInput, ...rootProps } = getRootProps();
  void onBeforeInput;

  const preview = hasValidImage ? (
    <View style={[styles.previewContainer, isMobileWeb && styles.mobileWebState]}>
      <img src={currentDisplayUrl} alt="" aria-hidden referrerPolicy="no-referrer" style={styles.previewBlur} />
      <img
        src={currentDisplayUrl} alt={i18nT('travel:components.travel.PhotoUploadWithPreview.predprosmotr_cd9c2eff')} referrerPolicy="no-referrer"
        style={styles.previewImage}
        onLoad={(e) => handleImageLoadCheck(e.currentTarget as HTMLImageElement)}
        onError={() => handleImageError()}
      />
      {!disabled && (
        <Pressable style={styles.removeButton} onPress={handleRemovePress} accessibilityLabel={i18nT('travel:components.travel.PhotoUploadWithPreview.udalit_izobrazhenie_0c6f4255')}>
          <Feather name="x" size={18} color={colors.textOnPrimary} />
        </Pressable>
      )}
    </View>
  ) : null;

  const loadingState = loading ? (
    <View style={[styles.loadingContainer, isMobileWeb && styles.mobileWebState]}>
      <ActivityIndicator size="large" color={colors.primaryDark} />
      {uploadProgress > 0 && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
          <Text style={styles.progressText}>{uploadProgress}%</Text>
        </View>
      )}
    </View>
  ) : null;

  if (isMobileWeb) {
    return (
      <View style={styles.container}>
        <input {...getInputProps()} data-testid="photo-upload-mobile-gallery-input" />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleCameraInputChange}
          disabled={disabled || loading}
          data-testid="photo-upload-mobile-camera-input"
          style={{ display: 'none' }}
        />
        <View style={styles.nativeActions}>
          <View style={styles.nativeAction}>
            <Button
              variant="primary"
              fullWidth
              onPress={openFilePicker}
              disabled={disabled}
              loading={loading}
              icon={<Feather name="image" size={16} color={colors.textOnPrimary} />}
              label={i18nT('travel:components.travel.ImageGalleryComponent.vybrat_iz_galerei_fbf8b2e6')}
              labelNumberOfLines={2}
              testID="photo-upload-mobile-gallery-button"
            />
          </View>
          <View style={styles.nativeAction}>
            <Button
              variant="outline"
              fullWidth
              onPress={() => cameraInputRef.current?.click()}
              disabled={disabled || loading}
              icon={<Feather name="camera" size={16} color={colors.text} />}
              label={i18nT('travel:components.travel.ImageGalleryComponent.sdelat_foto_79fec14d')}
              labelNumberOfLines={2}
              testID="photo-upload-mobile-camera-button"
            />
          </View>
        </View>
        {loadingState || preview}
        {error && !currentDisplayUrl && (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={14} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {uploadMessage && !error && (
          <View style={styles.successContainer}>
            <Feather name="check-circle" size={14} color={colors.success} />
            <Text style={styles.successText}>{uploadMessage}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <div {...rootProps} style={{
        ...styles.dropzone,
        ...(isDragActive ? styles.dropzoneActive : {}),
        ...(disabled ? styles.dropzoneDisabled : {}),
      }}>
        <input {...getInputProps()} />
        {loading ? loadingState : hasValidImage ? (
          preview
        ) : (
          <View style={styles.placeholderContainer}>
            <Feather name="upload-cloud" size={40} color={colors.primaryDark} />
            <Text style={styles.placeholderText}>{placeholder}</Text>
            <Text style={styles.placeholderSubtext}>{i18nT('travel:components.travel.PhotoUploadWithPreview.ili_nazhmite_dlya_vybora_fayla_8e7a14a9')}</Text>
            <Text style={styles.placeholderHint}>{i18nT('travel:components.travel.PhotoUploadWithPreview.maks_razmer_3c63e70c')}{maxSizeMB}{i18nT('travel:components.travel.PhotoUploadWithPreview.mb_18863aeb')}</Text>
          </View>
        )}
      </div>
      {error && !currentDisplayUrl && (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={14} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {uploadMessage && !error && (
        <View style={styles.successContainer}>
          <Feather name="check-circle" size={14} color={colors.success} />
          <Text style={styles.successText}>{uploadMessage}</Text>
        </View>
      )}
    </View>
  );
  };
  return WebDropzoneView;
};
