// components/travel/ImageGalleryComponent.ios.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import ConfirmDialog from '@/components/ConfirmDialog';
import { uploadImage, deleteImage } from '@/src/api/misc';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

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
}

interface ImageGalleryComponentProps {
  collection: string;
  idTravel: string;
  initialImages: GalleryItem[];
  maxImages?: number;
}

const ImageGalleryComponentIOS: React.FC<ImageGalleryComponentProps> = ({
  collection,
  idTravel,
  initialImages,
  maxImages = 10,
}) => {
  // ✅ УЛУЧШЕНИЕ: поддержка тем через useThemedColors
  const colors = useThemedColors();

  const [images, setImages] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState<boolean[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);


  useEffect(() => {
    if (initialImages?.length) {
      setImages(initialImages.map((img) => ({ ...img, url: ensureAbsoluteUrl(img.url) })));
      setLoading(initialImages.map(() => false));
    }
    setIsInitialLoading(false);
  }, [initialImages]);

  const handleUploadImages = useCallback(
    async (assets: ImagePicker.ImagePickerAsset[]) => {
      if (images.length + assets.length > maxImages) {
        Alert.alert('Лимит', `Максимум ${maxImages} изображений`);
        return;
      }

      setIsUploading(true);
      const newLoading = [...loading];

      const uploads = assets.map(async (asset, index) => {
        const currentIndex = images.length + index;
        newLoading[currentIndex] = true;
        setLoading([...newLoading]);

        try {
          const formData = new FormData();
          const uri = asset.uri;
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

          const response = await uploadImage(formData);
          const uploadedUrlRaw =
            (response as any)?.url ||
            (response as any)?.data?.url ||
            (response as any)?.path ||
            (response as any)?.file_url;
          const uploadedId =
            (response as any)?.id ||
            (response as any)?.data?.id ||
            filename;

          if (uploadedUrlRaw) {
            setImages((prev) => [
              ...prev,
              { id: String(uploadedId), url: ensureAbsoluteUrl(String(uploadedUrlRaw)) },
            ]);
          }
        } catch (error) {
          console.error('Upload error:', error);
          Alert.alert('Ошибка', 'Не удалось загрузить изображение');
        } finally {
          newLoading[currentIndex] = false;
          setLoading([...newLoading]);
        }
      });

      await Promise.all(uploads);
      setIsUploading(false);
    },
    [images, loading, collection, idTravel, maxImages]
  );

  const handlePickImages = useCallback(async () => {
    if (images.length >= maxImages) {
      Alert.alert('Лимит', `Максимум ${maxImages} изображений`);
      return;
    }

    try {
      // Запрос разрешения
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Разрешение', 'Необходим доступ к галерее');
        return;
      }

      // Выбор изображений
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: maxImages - images.length,
      });

      if (!result.canceled && result.assets.length > 0) {
        await handleUploadImages(result.assets);
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Ошибка', 'Не удалось выбрать изображения');
    }
  }, [handleUploadImages, images.length, maxImages]);

  const handleTakePhoto = useCallback(async () => {
    if (images.length >= maxImages) {
      Alert.alert('Лимит', `Максимум ${maxImages} изображений`);
      return;
    }

    try {
      // Запрос разрешения на камеру
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Разрешение', 'Необходим доступ к камере');
        return;
      }

      // Сделать фото
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await handleUploadImages([result.assets[0]]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Ошибка', 'Не удалось сделать фото');
    }
  }, [handleUploadImages, images.length, maxImages]);

  const handleDeleteImage = (imageId: string) => {
    setSelectedImageId(imageId);
    setDialogVisible(true);
  };

  const confirmDeleteImage = async () => {
    if (!selectedImageId) return;
    try {
      await deleteImage(selectedImageId);
      setImages((prev) => prev.filter((img) => img.id !== selectedImageId));
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось удалить изображение');
      console.error('Error deleting image:', error);
    } finally {
      setDialogVisible(false);
      setSelectedImageId(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerContainer}>
        <Text style={[styles.galleryTitle, { color: colors.text }]}>📷 Галерея</Text>
        <Text style={[styles.imageCount, { color: colors.textMuted }]}>
          Загружено <Text style={[styles.highlight, { color: colors.primary }]}>{images.length}</Text> из {maxImages}
        </Text>
      </View>

      {/* Кнопки добавления изображений */}
      {images.length < maxImages && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handlePickImages}
            style={[styles.addButton, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            disabled={isUploading}
          >
            <Text style={styles.addButtonIcon}>🖼️</Text>
            <Text style={[styles.addButtonText, { color: colors.textInverse }]}>
              Выбрать из галереи
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleTakePhoto}
            style={[styles.addButton, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            disabled={isUploading}
          >
            <Text style={styles.addButtonIcon}>📷</Text>
            <Text style={[styles.addButtonText, { color: colors.textInverse }]}>
              Сделать фото
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isInitialLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : images.length > 0 ? (
        <View style={styles.galleryGrid}>
          {images.map((image, index) => (
            <View key={image.id} style={[styles.imageWrapper, { backgroundColor: colors.surfaceMuted }]}>
              {loading[index] ? (
                <ActivityIndicator size="large" color={colors.textInverse} />
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
                    onPress={() => handleDeleteImage(image.id)}
                    style={[styles.deleteButton, { backgroundColor: colors.danger }]}
                  >
                    <Text style={[styles.deleteButtonText, { color: colors.textOnPrimary }]}>✖</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.noImagesText, { color: colors.textMuted }]}>
          Нет загруженных изображений
        </Text>
      )}

      {isUploading && (
        <View style={[styles.uploadingOverlay, { backgroundColor: colors.overlay }]}>
          <ActivityIndicator size="large" color={colors.textInverse} />
          <Text style={[styles.uploadingText, { color: colors.textInverse }]}>Загружаются изображения...</Text>
        </View>
      )}

      <ConfirmDialog
        visible={dialogVisible}
        onClose={() => setDialogVisible(false)}
        onConfirm={confirmDeleteImage}
        title="Удаление изображения"
        message="Вы уверены, что хотите удалить это изображение?"
        confirmText="Удалить"
        cancelText="Отмена"
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
  galleryTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.xl,
    fontWeight: 'bold',
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
  addButtonIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  addButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600',
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: DESIGN_TOKENS.spacing.md,
  },
  imageWrapper: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f0f0f0',
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
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
