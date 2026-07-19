// components/travel/ImageGalleryComponent.ios.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { ShimmerOverlay } from '@/components/ui/ShimmerOverlay';
import { uploadImage, deleteImage } from '@/api/misc';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import { compressTravelPhoto } from '@/utils/imageCompressor';
import { UploadProgressBar } from '@/components/ui/UploadProgressBar';
import type { GalleryValueItem } from '@/components/travel/gallery/types';
import { GalleryCaptionEditor } from '@/components/travel/gallery/GalleryCaptionEditor';
import { translate as i18nT } from '@/i18n'


const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL || (process.env.NODE_ENV === 'test' ? 'https://example.test/api' : '');

const safeEncodeUrl = (value: string): string => {
  try {
    return encodeURI(decodeURI(value));
  } catch {
    return encodeURI(value);
  }
};

const ensureAbsoluteUrl = (value: string): string => {
  if (!value) return value;

  try {
    return safeEncodeUrl(new URL(value).toString());
  } catch {
    const base = API_BASE_URL ? API_BASE_URL.replace(/\/api\/?$/, '') : undefined;
    if (!base) return value;
    try {
      return safeEncodeUrl(new URL(value, base).toString());
    } catch {
      return safeEncodeUrl(value);
    }
  }
};

interface GalleryItem {
  id: string;
  url: string;
  caption?: string;
}

interface ImageGalleryComponentProps {
  collection: string;
  idTravel: string;
  initialImages: GalleryItem[];
  maxImages?: number;
  onChange?: (items: GalleryValueItem[]) => void;
}

const ImageGalleryComponentIOS: React.FC<ImageGalleryComponentProps> = ({
  collection,
  idTravel,
  initialImages,
  maxImages = 10,
  onChange,
}) => {
  const colors = useThemedColors();

  const [images, setImages] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState<boolean[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  // AND-15: Upload progress tracking
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadCurrent, setUploadCurrent] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);

  const lastReportedUrlsRef = useRef<string>('');

  const isBackendImageId = useCallback((value: string | null | undefined): boolean => {
    if (!value) return false;
    return /^\d+$/.test(String(value));
  }, []);

  useEffect(() => {
    const normalizedInitialImages = Array.isArray(initialImages)
      ? initialImages.map((img) => ({ ...img, url: ensureAbsoluteUrl(img.url) }))
      : [];
    setImages(normalizedInitialImages);
    setLoading(normalizedInitialImages.map(() => false));
    setIsInitialLoading(false);
  }, [initialImages]);

  useEffect(() => {
    if (!onChange) return;
    const items = images
      .map((img) => ({ id: img.id, url: img.url, caption: img.caption ?? '' }))
      .filter((img) => typeof img.url === 'string' && img.url.trim().length > 0);
    const signature = items.map((img) => `${String(img.id ?? '')}:${img.url}:${img.caption}`).join('|');
    if (signature === lastReportedUrlsRef.current) return;
    lastReportedUrlsRef.current = signature;
    onChange(items);
  }, [images, onChange]);

  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const present = new Set(images.map((img) => img.id));
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (present.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [images]);

  const handleUploadImages = useCallback(
    async (assets: ImagePicker.ImagePickerAsset[]) => {
      if (images.length + assets.length > maxImages) {
        Alert.alert(
          i18nT('travel:components.travel.ImageGalleryComponent.limitTitle'),
          i18nT('travel:components.travel.ImageGalleryComponent.maxImagesMessage', { max: maxImages }),
        );
        return;
      }

      setIsUploading(true);
      // AND-15: Reset progress tracking
      setUploadTotal(assets.length);
      setUploadCurrent(0);
      setUploadProgress(0);
      const newLoading = [...loading];

      let completedCount = 0;
      for (let index = 0; index < assets.length; index += 1) {
        const asset = assets[index];
        if (!asset) continue;
        const currentIndex = images.length + index;
        newLoading[currentIndex] = true;
        setLoading([...newLoading]);

        try {
          const formData = new FormData();
          // AND-15: Compress image before upload (max 1920px, quality 0.8)
          const compressed = await compressTravelPhoto(asset.uri);
          const uri = compressed.uri || asset.uri;
          const filename = uri.split('/').pop() || 'image.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const extRaw = match ? match[1].toLowerCase() : '';
          const ext = extRaw === 'jpg' ? 'jpeg' : extRaw;
          const type = ext ? `image/${ext}` : 'image/jpeg';

          formData.append('file', {
            uri,
            name: filename,
            type,
          } as any);
          formData.append('collection', collection);
          formData.append('id', idTravel);

          const response = await uploadImage(formData, (pct) => {
            // AND-15: Per-file progress combined with overall progress
            const overall = (completedCount + pct) / assets.length;
            setUploadProgress(overall);
          });
          const uploadedUrlRaw =
            (response as any)?.url ||
            (response as any)?.data?.url ||
            (response as any)?.path ||
            (response as any)?.file_url;
          const uploadedId =
            (response as any)?.id ||
            (response as any)?.data?.id ||
            filename;
          const uploadedCaption =
            typeof (response as any)?.caption === 'string'
              ? (response as any).caption
              : typeof (response as any)?.data?.caption === 'string'
                ? (response as any).data.caption
                : '';

          if (uploadedUrlRaw) {
            setImages((prev) => [
              ...prev,
              {
                id: String(uploadedId),
                url: ensureAbsoluteUrl(String(uploadedUrlRaw)),
                caption: uploadedCaption,
              },
            ]);
          }
        } catch (error) {
          console.error('Upload error:', error);
          Alert.alert(
            i18nT('travel:components.travel.ImageGalleryComponent.errorTitle'),
            i18nT('travel:components.travel.ImageGalleryComponent.uploadFailed'),
          );
        } finally {
          newLoading[currentIndex] = false;
          setLoading([...newLoading]);
          completedCount++;
          setUploadCurrent(completedCount);
          setUploadProgress(completedCount / assets.length);
        }
      }

      setIsUploading(false);
    },
    [images, loading, collection, idTravel, maxImages]
  );

  const handlePickImages = useCallback(async () => {
    if (images.length >= maxImages) {
      Alert.alert(
        i18nT('travel:components.travel.ImageGalleryComponent.limitTitle'),
        i18nT('travel:components.travel.ImageGalleryComponent.maxImagesMessage', { max: maxImages }),
      );
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          i18nT('travel:components.travel.ImageGalleryComponent.permissionTitle'),
          i18nT('travel:components.travel.ImageGalleryComponent.galleryPermissionMessage'),
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        exif: false,
        selectionLimit: maxImages - images.length,
      });

      if (!result.canceled && result.assets.length > 0) {
        await handleUploadImages(result.assets);
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert(
        i18nT('travel:components.travel.ImageGalleryComponent.errorTitle'),
        i18nT('travel:components.travel.ImageGalleryComponent.selectImagesFailed'),
      );
    }
  }, [handleUploadImages, images.length, maxImages]);

  const handleTakePhoto = useCallback(async () => {
    if (images.length >= maxImages) {
      Alert.alert(
        i18nT('travel:components.travel.ImageGalleryComponent.limitTitle'),
        i18nT('travel:components.travel.ImageGalleryComponent.maxImagesMessage', { max: maxImages }),
      );
      return;
    }

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          i18nT('travel:components.travel.ImageGalleryComponent.permissionTitle'),
          i18nT('travel:components.travel.ImageGalleryComponent.cameraPermissionMessage'),
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await handleUploadImages([result.assets[0]]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert(
        i18nT('travel:components.travel.ImageGalleryComponent.errorTitle'),
        i18nT('travel:components.travel.ImageGalleryComponent.takePhotoFailed'),
      );
    }
  }, [handleUploadImages, images.length, maxImages]);

  const handleDeleteImage = (imageId: string) => {
    setSelectedImageId(imageId);
    setDialogVisible(true);
  };

  const handleToggleSelect = useCallback((imageId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (images.length > 0 && images.every((img) => prev.has(img.id))) {
        return new Set();
      }
      return new Set(images.map((img) => img.id));
    });
  }, [images]);

  const deleteImageById = useCallback(
    async (imageId: string) => {
      const imageToDelete = images.find((img) => img.id === imageId);
      if (imageToDelete && isBackendImageId(imageToDelete.id)) {
        await deleteImage(imageToDelete.id);
      }
      setImages((prev) => prev.filter((img) => img.id !== imageId));
    },
    [images, isBackendImageId],
  );

  const performDeleteSelected = useCallback(async () => {
    const ids = Array.from(selectedIds);
    try {
      for (const id of ids) {
        await deleteImageById(id);
      }
    } catch (error) {
      Alert.alert(
        i18nT('travel:components.travel.ImageGalleryComponent.errorTitle'),
        i18nT('travel:components.travel.ImageGalleryComponent.deleteFailed'),
      );
      console.error('Error deleting images:', error);
    } finally {
      setSelectedIds(new Set());
    }
  }, [deleteImageById, selectedIds]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      i18nT('travel:components.travel.ImageGalleryComponent.batchDeleteTitle'),
      i18nT('travel:components.travel.ImageGalleryComponent.batchDeleteMessage', { value1: selectedIds.size }),
      [
        { text: i18nT('travel:components.travel.ImageGalleryComponent.otmena_03c4d548'), style: 'cancel' },
        {
          text: i18nT('travel:components.travel.ImageGalleryComponent.udalit_4f0a77b6'),
          style: 'destructive',
          onPress: () => { void performDeleteSelected(); },
        },
      ],
    );
  }, [performDeleteSelected, selectedIds.size]);

  const handleMoveImage = useCallback((imageId: string, direction: -1 | 1) => {
    setImages((prev) => {
      const fromIndex = prev.findIndex((img) => img.id === imageId);
      if (fromIndex < 0) return prev;

      const toIndex = fromIndex + direction;
      if (toIndex < 0 || toIndex >= prev.length) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const handleCaptionChange = useCallback((imageId: string, caption: string) => {
    setImages((prev) => prev.map((img) => (
      img.id === imageId ? { ...img, caption } : img
    )));
  }, []);

  const confirmDeleteImage = async () => {
    if (!selectedImageId) return;
    const imageToDelete = images.find((img) => img.id === selectedImageId);
    try {
      if (imageToDelete && isBackendImageId(imageToDelete.id)) {
        await deleteImage(imageToDelete.id);
      }
      setImages((prev) => prev.filter((img) => img.id !== selectedImageId));
    } catch (error) {
      Alert.alert(
        i18nT('travel:components.travel.ImageGalleryComponent.errorTitle'),
        i18nT('travel:components.travel.ImageGalleryComponent.deleteFailed'),
      );
      console.error('Error deleting image:', error);
    } finally {
      setDialogVisible(false);
      setSelectedImageId(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerContainer}>
        <View style={styles.titleRow}>
          <Feather name="camera" size={20} color={colors.text} />
          <Text style={[styles.galleryTitle, { color: colors.text }]}>{i18nT('travel:components.travel.ImageGalleryComponent.galereya_394a39e3')}</Text>
        </View>
        <Text style={[styles.imageCount, { color: colors.textMuted }]}>
          {i18nT('travel:components.travel.ImageGalleryComponent.zagruzheno_3283e913')}<Text style={[styles.highlight, { color: colors.primaryText }]}>{images.length}</Text> {i18nT('travel:components.travel.ImageGalleryComponent.iz_9fa7e764')}{maxImages}
        </Text>
      </View>

      {images.length < maxImages && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handlePickImages}
            style={[styles.addButton, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            disabled={isUploading}
            testID="gallery-ios.pick"
          >
            <Feather name="image" size={18} color={colors.textInverse} />
            <Text style={[styles.addButtonText, { color: colors.textInverse }]}>{i18nT('travel:components.travel.ImageGalleryComponent.vybrat_iz_galerei_fbf8b2e6')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleTakePhoto}
            style={[styles.addButton, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            disabled={isUploading}
            testID="gallery-ios.camera"
          >
            <Feather name="camera" size={18} color={colors.textInverse} />
            <Text style={[styles.addButtonText, { color: colors.textInverse }]}>{i18nT('travel:components.travel.ImageGalleryComponent.sdelat_foto_79fec14d')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {images.length > 0 && !isInitialLoading ? (
        <View style={styles.batchActionsRow}>
          <TouchableOpacity
            onPress={handleToggleSelectAll}
            style={[styles.batchActionButton, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            testID="gallery-ios.select-all"
          >
            <Feather
              name={images.every((img) => selectedIds.has(img.id)) ? 'square' : 'check-square'}
              size={16}
              color={colors.text}
            />
            <Text style={[styles.batchActionButtonText, { color: colors.text }]}>
              {images.every((img) => selectedIds.has(img.id))
                ? i18nT('travel:components.travel.ImageGalleryComponent.deselectAll')
                : i18nT('travel:components.travel.ImageGalleryComponent.selectAll')}
            </Text>
          </TouchableOpacity>

          {selectedIds.size > 0 ? (
            <TouchableOpacity
              onPress={handleDeleteSelected}
              style={[styles.batchActionButton, { borderColor: colors.danger, backgroundColor: colors.dangerSoft }]}
              testID="gallery-ios.delete-selected"
            >
              <Feather name="trash-2" size={16} color={colors.danger} />
              <Text style={[styles.batchActionButtonText, { color: colors.danger }]}>
                {i18nT('travel:components.travel.ImageGalleryComponent.deleteSelected', { value1: selectedIds.size })}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {isInitialLoading ? (
        <View style={styles.loader}>
          <ShimmerOverlay />
        </View>
      ) : images.length > 0 ? (
        <View style={styles.galleryGrid}>
          {images.map((image, index) => (
            <View
              key={`${image.id}:${image.url}:${index}`}
              style={[styles.imageCard, selectedIds.has(image.id) && { borderWidth: 2, borderColor: colors.primary }]}
            >
              <View style={[styles.imageFrame, { backgroundColor: colors.surfaceMuted }]}>
                {loading[index] ? (
                  <ShimmerOverlay />
                ) : (
                  <>
                  <ImageCardMedia
                    src={image.url}
                    fit="contain"
                    blurBackground
                    loading="lazy"
                    alt={`Gallery image ${index + 1}`}
                    style={styles.image}
                  />
                  <TouchableOpacity
                    onPress={() => handleToggleSelect(image.id)}
                    style={[
                      styles.selectCheckbox,
                      { backgroundColor: selectedIds.has(image.id) ? colors.primary : colors.overlay },
                    ]}
                    testID={`gallery-ios.select:${image.id}`}
                    accessibilityLabel={i18nT('travel:components.travel.ImageGalleryComponent.selectPhoto')}
                  >
                    <Feather name="check" size={20} color={selectedIds.has(image.id) ? colors.textInverse : 'transparent'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteImage(image.id)}
                    style={[styles.deleteButton, { backgroundColor: colors.danger }]}
                    testID={`gallery-ios.delete:${image.id}`}
                  >
                    <Feather name="x" size={18} color={colors.textOnPrimary} />
                  </TouchableOpacity>
                  <View style={styles.moveControls}>
                    <TouchableOpacity
                      onPress={() => handleMoveImage(image.id, -1)}
                      style={[styles.moveButton, { backgroundColor: colors.overlay }, index === 0 && styles.moveButtonDisabled]}
                      disabled={index === 0}
                      testID={`gallery-ios.move-left:${image.id}`}
                      accessibilityLabel={i18nT('travel:components.travel.ImageGalleryComponent.peremestit_foto_levee_4a235bb8')}
                    >
                      <Feather name="arrow-left" size={15} color={index === 0 ? colors.textMuted : colors.textInverse} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleMoveImage(image.id, 1)}
                      style={[
                        styles.moveButton,
                        { backgroundColor: colors.overlay },
                        index === images.length - 1 && styles.moveButtonDisabled,
                      ]}
                      disabled={index === images.length - 1}
                      testID={`gallery-ios.move-right:${image.id}`}
                      accessibilityLabel={i18nT('travel:components.travel.ImageGalleryComponent.peremestit_foto_pravee_85b5a0ad')}
                    >
                      <Feather name="arrow-right" size={15} color={index === images.length - 1 ? colors.textMuted : colors.textInverse} />
                    </TouchableOpacity>
                  </View>
                  </>
                )}
              </View>
              {!loading[index] ? (
                <GalleryCaptionEditor
                  imageId={image.id}
                  caption={image.caption ?? ''}
                  disabled={!isBackendImageId(image.id)}
                  onCaptionChange={(caption) => handleCaptionChange(image.id, caption)}
                />
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.noImagesText, { color: colors.textMuted }]}>{i18nT('travel:components.travel.ImageGalleryComponent.net_zagruzhennyh_izobrazheniy_c0f0d207')}</Text>
      )}

      {isUploading && (
        <View style={[styles.uploadingOverlay, { backgroundColor: colors.overlay }]}>
          <ActivityIndicator size="large" color={colors.textInverse} />
          <UploadProgressBar
            progress={uploadProgress}
            label={uploadTotal > 1 ? `${uploadCurrent}/${uploadTotal}` : undefined}
            visible
          />
        </View>
      )}

      <ConfirmDialog
        visible={dialogVisible}
        onClose={() => setDialogVisible(false)}
        onConfirm={confirmDeleteImage}
        title={i18nT('travel:components.travel.ImageGalleryComponent.udalenie_izobrazheniya_fe89ef6a')}
        message={i18nT('travel:components.travel.ImageGalleryComponent.vy_uvereny_chto_hotite_udalit_eto_izobrazhen_c41049cb')}
        confirmText={i18nT('travel:components.travel.ImageGalleryComponent.udalit_4f0a77b6')}
        cancelText={i18nT('travel:components.travel.ImageGalleryComponent.otmena_03c4d548')}
      />
    </View>
  );
};

export default ImageGalleryComponentIOS;

const styles = StyleSheet.create({
  container: {
    padding: DESIGN_TOKENS.spacing.xl,
    width: '100%',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  galleryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  imageCount: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
  },
  highlight: {
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.md,
    marginBottom: DESIGN_TOKENS.spacing.lg,
  },
  batchActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  batchActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    minHeight: 44,
  },
  batchActionButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
  },
  selectCheckbox: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: DESIGN_TOKENS.spacing.md,
  },
  imageCard: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
  },
  imageFrame: {
    width: '100%',
    aspectRatio: 1,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  deleteButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    borderRadius: 22,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moveControls: {
    position: 'absolute',
    left: 5,
    bottom: 5,
    flexDirection: 'row',
    gap: 6,
  },
  moveButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveButtonDisabled: {
    opacity: 0.45,
  },
  noImagesText: {
    textAlign: 'center',
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    marginTop: DESIGN_TOKENS.spacing.xl,
  },
  loader: {
    marginTop: DESIGN_TOKENS.spacing.xl,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  uploadingText: {
    marginTop: DESIGN_TOKENS.spacing.md,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
  },
});
