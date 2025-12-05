// components/MapUploadComponent.ios.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { uploadImage } from '@/src/api/misc';
import { Feather } from '@expo/vector-icons';

interface MapUploadComponentProps {
  collection: string;
  idTravel: string;
}

const MapUploadComponentIOS: React.FC<MapUploadComponentProps> = ({ collection, idTravel }) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Поддерживаемые форматы карт
  const supportedFormats = ['.gpx', '.kml', '.kmz', '.geojson'];

  // Функция для выбора файла
  const pickFile = async () => {
    try {
      setError(null);
      setUploadMessage(null);

      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
        copyTo: 'cachesDirectory',
      });

      if (!result || result.length === 0) {
        return;
      }

      const file = result[0];
      if (!file) {
        return;
      }

      const { name, uri, type } = file;
      
      if (!name || !uri) {
        setError('Не удалось получить информацию о файле');
        return;
      }
      
      setFileName(name);

      // Проверка формата файла
      const isSupported = supportedFormats.some((format) => name.toLowerCase().endsWith(format));
      
      if (!isSupported) {
        setError(`Неподдерживаемый формат файла. Разрешены: ${supportedFormats.join(', ')}`);
        setFileName(null);
        return;
      }

      // Загрузка файла
      await handleUploadFile({
        uri,
        name,
        type: type || 'application/octet-stream',
      });
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        // User cancelled
        return;
      }
      console.error('Error picking file:', err);
      setError('Ошибка при выборе файла');
    }
  };

  // Функция для загрузки файла на сервер
  const handleUploadFile = async (file: { uri: string; name: string; type: string }) => {
    try {
      setLoading(true);
      setError(null);
      setUploadMessage(null);

      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);
      formData.append('collection', collection);
      formData.append('id', idTravel);

      const response = await uploadImage(formData);

      if (response?.data?.url || response?.url) {
        const url = response?.data?.url || response?.url;
        setUploadMessage(`Карта успешно загружена: ${url}`);
        Alert.alert('Успех', 'Карта успешно загружена');
      } else {
        throw new Error('No URL in response');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError('Произошла ошибка при загрузке');
      Alert.alert('Ошибка', 'Не удалось загрузить карту');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Заголовок */}
        <View style={styles.header}>
          <Feather name="map" size={24} color="#4b7c6f" />
          <Text style={styles.title}>Загрузка файла карты</Text>
        </View>

        {/* Описание */}
        <Text style={styles.description}>
          Поддерживаемые форматы: {supportedFormats.join(', ')}
        </Text>

        {/* Кнопка выбора файла */}
        <TouchableOpacity
          style={[styles.uploadButton, loading && styles.uploadButtonDisabled]}
          onPress={pickFile}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="upload-cloud" size={20} color="#fff" />
              <Text style={styles.uploadButtonText}>
                {fileName ? 'Выбрать другой файл' : 'Выбрать файл карты'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Отображение выбранного файла */}
        {fileName && !loading && (
          <View style={styles.fileInfo}>
            <Feather name="file" size={16} color="#4b7c6f" />
            <Text style={styles.fileName} numberOfLines={1}>
              {fileName}
            </Text>
          </View>
        )}

        {/* Сообщение об успехе */}
        {uploadMessage && !error && (
          <View style={styles.successContainer}>
            <Feather name="check-circle" size={16} color="#10b981" />
            <Text style={styles.successText}>{uploadMessage}</Text>
          </View>
        )}

        {/* Сообщение об ошибке */}
        {error && (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Инструкция */}
        {!fileName && !loading && (
          <View style={styles.instructionContainer}>
            <Text style={styles.instructionText}>
              Нажмите кнопку выше, чтобы выбрать файл карты из хранилища вашего устройства
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  uploadButton: {
    backgroundColor: '#4b7c6f',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#4b7c6f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0.1,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  fileName: {
    fontSize: 14,
    color: '#0369a1',
    flex: 1,
    fontWeight: '500',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
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
    lineHeight: 18,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
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
    lineHeight: 18,
  },
  instructionContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  instructionText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    textAlign: 'center',
  },
});

export default MapUploadComponentIOS;
