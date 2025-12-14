// components/travel/ImageGalleryComponent.ios.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import OptimizedImage from '@/components/ui/OptimizedImage';
import ConfirmDialog from '@/components/ConfirmDialog';
import { uploadImage, deleteImage } from '@/src/api/misc';
import { DESIGN_TOKENS } from '@/constants/designSystem';

const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL || (process.env.NODE_ENV === 'test' ? 'https://example.test/api' : '');

const ensureAbsoluteUrl = (value: string): string => {
  if (!value) return value;

  try {
    return new URL(value).toString();
  } catch {
    const base = API_BASE_URL ? API_BASE_URL.replace(/\/api\/?$/, '') : undefined;
    if (!base) return value;
    try {
      return new URL(value, base).toString();
    } catch {
      return value;
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
  const [images, setImages] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState<boolean[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

  const theme = useColorScheme();
  const isDarkMode = theme === 'dark';

  useEffect(() => {
    if (initialImages?.length) {
      setImages(initialImages.map((img) => ({ ...img, url: ensureAbsoluteUrl(img.url) })));
      setLoading(initialImages.map(() => false));
    }
    setIsInitialLoading(false);
  }, [initialImages]);

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
  }, [images.length, maxImages]);

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
  }, [images.length, maxImages]);

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
          const type = match ? `image/${match[1]}` : 'image/jpeg';

          formData.append('file', {
            uri,
            name: filename,
            type,
          } as any);
          formData.append('collection', collection);
          formData.append('id', idTravel);

          const response = await uploadImage(formData);
          if (response?.url) {
            setImages((prev) => [
              ...prev,
              { id: response.id, url: ensureAbsoluteUrl(String(response.url)) },
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
    } finally {
      setDialogVisible(false);
      setSelectedImageId(null);
    }
  };

  return (
    <View style={[styles.container, isDarkMode && styles.darkContainer]}>
      <View style={styles.headerContainer}>
        <Text style={[styles.galleryTitle, isDarkMode && styles.darkText]}>📷 Галерея</Text>
        <Text style={[styles.imageCount, isDarkMode && styles.darkText]}>
          Загружено <Text style={styles.highlight}>{images.length}</Text> из {maxImages}
        </Text>
      </View>

      {/* Кнопки добавления изображений */}
      {images.length < maxImages && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handlePickImages}
            style={[styles.addButton, isDarkMode && styles.darkButton]}
            disabled={isUploading}
          >
            <Text style={styles.addButtonIcon}>🖼️</Text>
            <Text style={[styles.addButtonText, isDarkMode && styles.darkText]}>
              Выбрать из галереи
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleTakePhoto}
            style={[styles.addButton, isDarkMode && styles.darkButton]}
            disabled={isUploading}
          >
            <Text style={styles.addButtonIcon}>📷</Text>
            <Text style={[styles.addButtonText, isDarkMode && styles.darkText]}>
              Сделать фото
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isInitialLoading ? (
        <ActivityIndicator size="large" color="#4b7c6f" style={styles.loader} />
      ) : images.length > 0 ? (
        <View style={styles.galleryGrid}>
          {images.map((image, index) => (
            <View key={image.id} style={styles.imageWrapper}>
              {loading[index] ? (
                <ActivityIndicator size="large" color="#ffffff" />
              ) : (
                <>
                  <OptimizedImage
                    source={{ uri: image.url }}
                    style={styles.image}
                    contentFit="cover"
                    loading="lazy"
                    alt={`Gallery image ${index + 1}`}
                  />
                  <TouchableOpacity
                    onPress={() => handleDeleteImage(image.id)}
                    style={styles.deleteButton}
                  >
                    <Text style={styles.deleteButtonText}>✖</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.noImagesText, isDarkMode && styles.darkText]}>
          Нет загруженных изображений
        </Text>
      )}

      {isUploading && (
        <View style={styles.uploadingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.uploadingText}>Загружаются изображения...</Text>
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
  darkContainer: {
    backgroundColor: '#222',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  galleryTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.xl,
    fontWeight: 'bold',
    color: '#333',
  },
  imageCount: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: '#666',
  },
  highlight: {
    fontWeight: 'bold',
    color: '#4b7c6f',
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
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4b7c6f',
    borderStyle: 'dashed',
  },
  darkButton: {
    backgroundColor: '#333',
    borderColor: '#4b7c6f',
  },
  addButtonIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  addButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600',
    color: '#4b7c6f',
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
    color: '#999',
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    marginTop: DESIGN_TOKENS.spacing.xl,
  },
  darkText: {
    color: '#e0e0e0',
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
    color: '#fff',
    marginTop: DESIGN_TOKENS.spacing.md,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
  },
});
