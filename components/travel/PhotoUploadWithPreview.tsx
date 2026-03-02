// E5: Refactored — state/logic extracted to usePhotoUpload hook
import React, { useMemo } from 'react';
import { Platform, ActivityIndicator, Pressable, View, Text } from 'react-native';
import * as ImagePicker from 'react-native-image-picker';
import { useDropzone } from 'react-dropzone';
import Feather from '@expo/vector-icons/Feather';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { useThemedColors } from '@/hooks/useTheme';
import { usePhotoUpload, chooseFallbackUrl } from '@/hooks/usePhotoUpload';

interface PhotoUploadWithPreviewProps {
  collection: string;
  idTravel?: string | null;
  oldImage?: string | null;
  onUpload?: (imageUrl: string) => void;
  onPreviewChange?: (previewUrl: string | null) => void;
  onRequestRemove?: () => void;
  disabled?: boolean;
  placeholder?: string;
  maxSizeMB?: number;
}

export { chooseFallbackUrl };

const PhotoUploadWithPreview: React.FC<PhotoUploadWithPreviewProps> = ({
  collection, idTravel, oldImage, onUpload, onPreviewChange, onRequestRemove,
  disabled = false, placeholder = 'Перетащите сюда изображение', maxSizeMB = 10,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    loading, uploadProgress, error, uploadMessage,
    hasValidImage, currentDisplayUrl,
    handleUploadImage, handleRemovePress, validateFile,
    handleImageLoadCheck, handleImageError,
  } = usePhotoUpload({ collection, idTravel, oldImage, onUpload, onPreviewChange, onRequestRemove, disabled, maxSizeMB });

  const pickImageFromGallery = async () => {
    if (disabled) return;
    if (Platform.OS === 'web') return;
    ImagePicker.launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, async (response) => {
      if (response.didCancel || response.errorCode) return;
      const asset = response.assets?.[0];
      if (!asset?.uri) return;
      await handleUploadImage({ uri: asset.uri, name: asset.fileName || 'photo.jpg', type: asset.type || 'image/jpeg' });
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles, rejectedFiles) => {
      if (disabled) return;
      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        // Validation handled by the hook, but show dropzone-specific errors
        if (rejection.errors.some(e => e.code === 'file-too-large')) return;
        if (rejection.errors.some(e => e.code === 'file-invalid-type')) return;
        return;
      }
      const file = acceptedFiles[0];
      if (file) {
        const validationError = validateFile(file);
        if (validationError) return;
        await handleUploadImage(file);
      }
    },
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.heic', '.heif'] },
    maxSize: maxSizeMB * 1024 * 1024,
    multiple: false,
    disabled,
  });

  if (Platform.OS === 'web') {
    const { onBeforeInput, ...rootProps } = getRootProps();
    void onBeforeInput;
    return (
      <View style={styles.container as any}>
        <div {...rootProps} style={{
          ...(styles.dropzone as any),
          ...(isDragActive ? (styles.dropzoneActive as any) : {}),
          ...(disabled ? (styles.dropzoneDisabled as any) : {}),
        }}>
          <input {...getInputProps()} />
          {loading ? (
            <View style={styles.loadingContainer as any}>
              <ActivityIndicator size="large" color={colors.primary} />
              {uploadProgress > 0 && (
                <View style={styles.progressContainer as any}>
                  <View style={[styles.progressBar as any, { width: `${uploadProgress}%` } as any] as any} />
                  <Text style={styles.progressText as any}>{uploadProgress}%</Text>
                </View>
              )}
            </View>
          ) : hasValidImage ? (
            <View style={styles.previewContainer as any}>
              <img src={currentDisplayUrl} alt="" aria-hidden referrerPolicy="no-referrer" style={styles.previewBlur as any} />
              <img
                src={currentDisplayUrl} alt="Предпросмотр" referrerPolicy="no-referrer"
                style={styles.previewImage as any}
                onLoad={(e) => handleImageLoadCheck(e.currentTarget as HTMLImageElement)}
                onError={() => handleImageError()}
              />
              {!disabled && (
                <Pressable style={styles.removeButton as any} onPress={handleRemovePress} accessibilityLabel="Удалить изображение">
                  <Feather name="x" size={18} color={colors.textOnPrimary} />
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.placeholderContainer as any}>
              <Feather name="upload-cloud" size={40} color={colors.primary} />
              <Text style={styles.placeholderText as any}>{placeholder}</Text>
              <Text style={styles.placeholderSubtext as any}>или нажмите для выбора файла</Text>
              <Text style={styles.placeholderHint as any}>Макс. размер: {maxSizeMB}MB</Text>
            </View>
          )}
        </div>
        {error && !currentDisplayUrl && (
          <View style={styles.errorContainer as any}>
            <Feather name="alert-circle" size={14} color={colors.danger} />
            <Text style={styles.errorText as any}>{error}</Text>
          </View>
        )}
        {uploadMessage && !error && (
          <View style={styles.successContainer as any}>
            <Feather name="check-circle" size={14} color={colors.success} />
            <Text style={styles.successText as any}>{uploadMessage}</Text>
          </View>
        )}
      </View>
    );
  }

  // Native (iOS/Android)
  return (
    <View style={styles.container}>
      <Pressable style={[styles.uploadButton, disabled && styles.uploadButtonDisabled]} onPress={pickImageFromGallery} disabled={loading || disabled}>
        {loading ? <ActivityIndicator color={colors.textOnPrimary} /> : (
          <>
            <Feather name="upload-cloud" size={16} color={colors.textOnPrimary} />
            <Text style={styles.uploadButtonText}>{currentDisplayUrl ? 'Заменить фото' : 'Загрузить фото'}</Text>
          </>
        )}
      </Pressable>
      {currentDisplayUrl ? (
        <View style={styles.nativePreviewContainer}>
          <ImageCardMedia src={currentDisplayUrl} fit="contain" blurBackground loading="lazy" priority="low" style={styles.nativePreviewImage as any} />
          {!disabled && (
            <Pressable style={styles.nativeRemoveButton} onPress={handleRemovePress}>
              <Feather name="trash-2" size={14} color={colors.danger} />
              <Text style={styles.nativeRemoveText}>Удалить</Text>
            </Pressable>
          )}
        </View>
      ) : null}
      {error && (
        <View style={styles.errorContainer}><Feather name="alert-circle" size={14} color={colors.danger} /><Text style={styles.errorText}>{error}</Text></View>
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
  uploadButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: DESIGN_TOKENS.spacing.xs,
    backgroundColor: colors.primary, padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md, minHeight: 44,
  },
  uploadButtonDisabled: { opacity: 0.5 },
  uploadButtonText: { color: colors.textOnPrimary, fontSize: 14, fontWeight: '600' },
  nativePreviewContainer: {
    marginTop: DESIGN_TOKENS.spacing.md, borderRadius: DESIGN_TOKENS.radii.md,
    overflow: 'hidden', borderWidth: 1, borderColor: colors.border,
  },
  nativePreviewImage: { width: '100%', height: 200, objectFit: 'contain' },
  nativeRemoveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: DESIGN_TOKENS.spacing.sm, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  nativeRemoveText: { fontSize: 13, color: colors.danger, fontWeight: '500' },
});

export default React.memo(PhotoUploadWithPreview);
