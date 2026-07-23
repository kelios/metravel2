// E5: Refactored — state/logic extracted to usePhotoUpload hook
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ActivityIndicator, Pressable, View, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import Button from '@/components/ui/Button';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { useThemedColors } from '@/hooks/useTheme';
import { useResponsiveWidth } from '@/hooks/useResponsive';
import { usePhotoUpload, chooseFallbackUrl, type NativeUploadFile } from '@/hooks/usePhotoUpload';
import { translate as i18nT } from '@/i18n'


interface PhotoUploadWithPreviewProps {
  collection: string;
  idTravel?: string | null;
  oldImage?: string | null;
  onUpload?: (imageUrl: string) => void;
  onPreviewChange?: (previewUrl: string | null) => void;
  onRequestRemove?: () => void;
  onUploadStateChange?: (isUploading: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
  maxSizeMB?: number;
}

export { chooseFallbackUrl };

// useDropzone — web-only хук (DOM): выносим в отдельный компонент, чтобы на native
// он не вызывался вовсе (вызов на Android валит рендер шага «Медиа» визарда).
type WebDropzoneViewProps = {
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

const WebDropzoneView: React.FC<WebDropzoneViewProps> = ({
  disabled, isMobileWeb, placeholder, maxSizeMB, colors, styles,
  loading, uploadProgress, error, uploadMessage, hasValidImage, currentDisplayUrl,
  validateFile, handleUploadImage, handleRemovePress, handleImageLoadCheck, handleImageError,
}) => {
  // react-dropzone — DOM-only пакет: require лениво внутри web-only компонента,
  // чтобы он не вычислялся в native-рантайме (на Android top-level import валит
  // рендер шага «Медиа» визарда — F-24). WebDropzoneView рендерится только на web.
  const { useDropzone } = require('react-dropzone') as typeof import('react-dropzone');
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
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.heic', '.heif'] },
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

const PhotoUploadWithPreview: React.FC<PhotoUploadWithPreviewProps> = ({
  collection, idTravel, oldImage, onUpload, onPreviewChange, onRequestRemove,
  onUploadStateChange,
  disabled = false, placeholder = i18nT('travel:components.travel.PhotoUploadWithPreview.peretaschite_syuda_izobrazhenie_2109990b'), maxSizeMB = 10,
}) => {
  const colors = useThemedColors();
  const viewportWidth = useResponsiveWidth();
  const isMobileWeb = Platform.OS === 'web' && viewportWidth <= 767;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const {
    loading, uploadProgress, error, uploadMessage,
    hasValidImage, currentDisplayUrl,
    handleUploadImage, handleRemovePress, validateFile,
    handleImageLoadCheck, handleImageError,
  } = usePhotoUpload({ collection, idTravel, oldImage, onUpload, onPreviewChange, onRequestRemove, disabled, maxSizeMB });

  useEffect(() => {
    onUploadStateChange?.(loading);
    return () => {
      if (loading) onUploadStateChange?.(false);
    };
  }, [loading, onUploadStateChange]);

  const uploadPickedAsset = useCallback(async (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.uri) return;
    const file: NativeUploadFile = {
      uri: asset.uri,
      name: asset.fileName || 'photo.jpg',
      type: asset.mimeType || 'image/jpeg',
      size: asset.fileSize,
    };
    await handleUploadImage(file);
  }, [handleUploadImage]);

  const pickImageFromGallery = async () => {
    if (disabled) return;
    if (Platform.OS === 'web') return;
    try {
      setPickerError(null);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPickerError(i18nT('travel:components.travel.ImageGalleryComponent.galleryPermissionMessage'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        exif: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (asset) await uploadPickedAsset(asset);
    } catch {
      setPickerError(i18nT('shared:hooks.usePhotoUpload.proizoshla_oshibka_pri_zagruzke_cc3f9675'));
    }
  };

  const takePhoto = async () => {
    if (disabled || Platform.OS === 'web') return;
    try {
      setPickerError(null);
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setPickerError(i18nT('travel:components.travel.ImageGalleryComponent.cameraPermissionMessage'));
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        exif: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (asset) await uploadPickedAsset(asset);
    } catch {
      setPickerError(i18nT('travel:components.travel.ImageGalleryComponent.takePhotoFailed'));
    }
  };

  if (Platform.OS === 'web') {
    return (
      <WebDropzoneView
        disabled={disabled}
        isMobileWeb={isMobileWeb}
        placeholder={placeholder}
        maxSizeMB={maxSizeMB}
        colors={colors}
        styles={styles}
        loading={loading}
        uploadProgress={uploadProgress}
        error={error}
        uploadMessage={uploadMessage}
        hasValidImage={hasValidImage}
        currentDisplayUrl={currentDisplayUrl}
        validateFile={validateFile}
        handleUploadImage={handleUploadImage}
        handleRemovePress={handleRemovePress}
        handleImageLoadCheck={handleImageLoadCheck}
        handleImageError={handleImageError}
      />
    );
  }

  // Native (iOS/Android)
  return (
    <View style={styles.container}>
      <View style={styles.nativeActions}>
        <View style={styles.nativeAction}>
          <Button
            variant="primary"
            fullWidth
            onPress={pickImageFromGallery}
            disabled={disabled}
            loading={loading}
            icon={<Feather name="image" size={16} color={colors.textOnPrimary} />}
            label={i18nT('travel:components.travel.ImageGalleryComponent.vybrat_iz_galerei_fbf8b2e6')}
            labelNumberOfLines={2}
            testID="photo-upload-gallery-button"
          />
        </View>
        <View style={styles.nativeAction}>
          <Button
            variant="outline"
            fullWidth
            onPress={takePhoto}
            disabled={disabled || loading}
            icon={<Feather name="camera" size={16} color={colors.text} />}
            label={i18nT('travel:components.travel.ImageGalleryComponent.sdelat_foto_79fec14d')}
            labelNumberOfLines={2}
            testID="photo-upload-camera-button"
          />
        </View>
      </View>
      {currentDisplayUrl ? (
        <View style={styles.nativePreviewContainer}>
          <ImageCardMedia src={currentDisplayUrl} fit="contain" blurBackground loading="lazy" priority="low" style={styles.nativePreviewImage} />
          {!disabled && (
            <Pressable style={styles.nativeRemoveButton} onPress={handleRemovePress}>
              <Feather name="trash-2" size={14} color={colors.danger} />
              <Text style={styles.nativeRemoveText}>{i18nT('travel:components.travel.PhotoUploadWithPreview.udalit_752b7703')}</Text>
            </Pressable>
          )}
        </View>
      ) : null}
      {(error || pickerError) && (
        <View style={styles.errorContainer}><Feather name="alert-circle" size={14} color={colors.danger} /><Text style={styles.errorText}>{error || pickerError}</Text></View>
      )}
      {uploadMessage && !error && (
        <View style={styles.successContainer}><Feather name="check-circle" size={14} color={colors.success} /><Text style={styles.successText}>{uploadMessage}</Text></View>
      )}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>): any => ({
  container: { width: '100%' },
  dropzone: {
    border: `2px dashed ${colors.border}`, borderRadius: DESIGN_TOKENS.radii.md,
    padding: DESIGN_TOKENS.spacing.lg, textAlign: 'center', cursor: 'pointer',
    transition: 'all 0.2s ease', backgroundColor: colors.backgroundSecondary,
    minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  dropzoneActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  dropzoneDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  loadingContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: DESIGN_TOKENS.spacing.md },
  progressContainer: {
    width: '100%', maxWidth: 200, height: 24, backgroundColor: colors.backgroundSecondary,
    borderRadius: DESIGN_TOKENS.radii.pill, overflow: 'hidden', position: 'relative',
  },
  progressBar: { height: '100%', backgroundColor: colors.primary, transition: 'width 0.3s ease' },
  progressText: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: '600', color: colors.text,
  },
  previewContainer: {
    position: 'relative', width: '100%', height: 180, minHeight: 180,
    overflow: 'hidden', borderRadius: DESIGN_TOKENS.radii.md,
  },
  previewBlur: {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
    objectFit: 'cover', filter: 'blur(18px)', transform: 'scale(1.08)', pointerEvents: 'none',
  },
  previewImage: { display: 'block', width: '100%', height: '100%', objectFit: 'contain', position: 'relative', zIndex: 1 },
  removeButton: {
    position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: DESIGN_TOKENS.radii.pill, width: 44, height: 44, minWidth: 44, minHeight: 44,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  placeholderContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xs },
  placeholderText: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: DESIGN_TOKENS.spacing.sm },
  placeholderSubtext: { fontSize: 12, color: colors.textMuted },
  placeholderHint: { fontSize: 11, color: colors.textTertiary, marginTop: DESIGN_TOKENS.spacing.xs },
  errorContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: DESIGN_TOKENS.spacing.sm,
    padding: DESIGN_TOKENS.spacing.sm, backgroundColor: colors.dangerSoft,
    borderRadius: DESIGN_TOKENS.radii.sm, borderWidth: 1, borderColor: colors.dangerLight,
  },
  errorText: { fontSize: 12, color: colors.danger, flex: 1 },
  successContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: DESIGN_TOKENS.spacing.sm,
    padding: DESIGN_TOKENS.spacing.sm, backgroundColor: colors.successSoft,
    borderRadius: DESIGN_TOKENS.radii.sm, borderWidth: 1, borderColor: colors.successLight,
  },
  successText: { fontSize: 12, color: colors.success, flex: 1 },
  nativePreviewContainer: {
    marginTop: DESIGN_TOKENS.spacing.md, borderRadius: DESIGN_TOKENS.radii.md,
    overflow: 'hidden', borderWidth: 1, borderColor: colors.border,
  },
  nativePreviewImage: { width: '100%', height: 200, objectFit: 'contain' },
  nativeRemoveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: DESIGN_TOKENS.spacing.sm, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border, minHeight: Platform.OS === 'android' ? 48 : 44,
  },
  nativeRemoveText: { fontSize: 13, color: colors.danger, fontWeight: '500' },
  nativeActions: { gap: DESIGN_TOKENS.spacing.sm },
  nativeAction: { width: '100%' },
  mobileWebState: { marginTop: DESIGN_TOKENS.spacing.md },
});

export default React.memo(PhotoUploadWithPreview);
