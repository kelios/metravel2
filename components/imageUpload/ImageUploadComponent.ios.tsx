// components/imageUpload/ImageUploadComponent.ios.tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Pressable,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '@/src/api/misc';
import { FontAwesome, Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';

interface ImageUploadComponentProps {
  collection: string;
  idTravel: string;
  oldImage?: string;
  onUpload?: (imageUrl: string) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ImageUploadComponentIOS: React.FC<ImageUploadComponentProps> = ({
  collection,
  idTravel,
  oldImage,
  onUpload,
}) => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isManuallySelected, setIsManuallySelected] = useState(false);

  useEffect(() => {
    if (oldImage && !isManuallySelected) {
      setImageUri(oldImage);
    }
    if (!oldImage && !isManuallySelected) {
      setImageUri(null);
    }
  }, [oldImage, isManuallySelected]);

  const handleUploadImage = async (file: { uri: string; name: string; type: string }) => {
    try {
      setError(null);
      setUploadMessage(null);
      setLoading(true);

      const normalizedId = (idTravel ?? '').toString();
      if (!normalizedId || normalizedId === 'null' || normalizedId === 'undefined') {
        setError('Сначала сохраните точку маршрута, затем попробуйте загрузить фото.');
        return;
      }

      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);
      formData.append('collection', collection);
      formData.append('id', normalizedId);

      const response = await uploadImage(formData);

      if (response?.url) {
        setImageUri(response.url);
        setUploadMessage('Фотография успешно загружена');
        onUpload?.(response.url);
        setIsManuallySelected(true);
      } else {
        throw new Error('No URL in response');
      }
    } catch (error) {
      console.error('Ошибка при загрузке:', error);
      setError('Произошла ошибка при загрузке');
      Alert.alert('Ошибка', 'Не удалось загрузить изображение');
    } finally {
      setLoading(false);
    }
  };

  const pickImageFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Разрешение', 'Необходим доступ к галерее');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        await handleUploadImage({
          uri: asset.uri,
          name: asset.fileName || 'photo.jpg',
          type: asset.type === 'image' ? 'image/jpeg' : 'image/jpeg',
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Ошибка', 'Не удалось выбрать изображение');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Разрешение', 'Необходим доступ к камере');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        await handleUploadImage({
          uri: asset.uri,
          name: `photo_${Date.now()}.jpg`,
          type: 'image/jpeg',
        });
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Ошибка', 'Не удалось сделать фото');
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Выберите действие',
      'Откуда вы хотите загрузить изображение?',
      [
        {
          text: 'Галерея',
          onPress: pickImageFromGallery,
        },
        {
          text: 'Камера',
          onPress: takePhoto,
        },
        {
          text: 'Отмена',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const handleRemoveImage = () => {
    Alert.alert(
      'Удалить изображение?',
      'Вы уверены, что хотите удалить текущее изображение?',
      [
        {
          text: 'Отмена',
          style: 'cancel',
        },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            setImageUri(null);
            setIsManuallySelected(false);
            setUploadMessage(null);
            setError(null);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={DESIGN_TOKENS.colors.primary} />
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      ) : imageUri ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
          <View style={styles.imageActions}>
            <Pressable style={styles.actionButton} onPress={showImageOptions}>
              <Feather name="edit-2" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Заменить</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={handleRemoveImage}>
              <Feather name="trash-2" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>Удалить</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.placeholderContainer}>
          <FontAwesome name="image" size={60} color={DESIGN_TOKENS.colors.primary} />
          <Text style={styles.placeholderText}>Нет изображения</Text>
          <Text style={styles.placeholderSubtext}>
            Нажмите кнопку ниже, чтобы загрузить фото
          </Text>
          <Text style={styles.placeholderHint}>
            Макс. размер: {(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB
          </Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={pickImageFromGallery}
              disabled={loading}
            >
              <FontAwesome name="photo" size={18} color="#fff" />
              <Text style={styles.uploadButtonText}>Из галереи</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.uploadButton, styles.cameraButton]}
              onPress={takePhoto}
              disabled={loading}
            >
              <FontAwesome name="camera" size={18} color="#fff" />
              <Text style={styles.uploadButtonText}>Сделать фото</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {uploadMessage && !error && (
        <View style={styles.successContainer}>
          <Feather name="check-circle" size={16} color="#10b981" />
          <Text style={styles.successText}>{uploadMessage}</Text>
        </View>
      )}
    </View>
  );
};

const palette = DESIGN_TOKENS.colors;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    minHeight: 280,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 240,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: palette.textMuted,
    marginTop: 8,
  },
  imageContainer: {
    width: '100%',
    minHeight: 240,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 240,
    borderRadius: 8,
  },
  imageActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: palette.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.text,
    marginTop: 12,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: palette.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  placeholderHint: {
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  uploadButton: {
    flex: 1,
    backgroundColor: palette.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cameraButton: {
    backgroundColor: '#059669',
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    fontSize: 13,
    color: '#dc2626',
    flex: 1,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#d1fae5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  successText: {
    fontSize: 13,
    color: '#059669',
    flex: 1,
  },
});

export default ImageUploadComponentIOS;
