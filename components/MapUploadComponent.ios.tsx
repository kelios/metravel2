// components/MapUploadComponent.ios.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { uploadImage } from '@/src/api/misc';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';

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
          <Feather name="map" size={24} color={DESIGN_TOKENS.colors.primary} />
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
            <ActivityIndicator color={DESIGN_TOKENS.colors.textOnPrimary} />
          ) : (
            <>
              <Feather name="upload-cloud" size={20} color={DESIGN_TOKENS.colors.textOnPrimary} />
              <Text style={styles.uploadButtonText}>
                {fileName ? 'Выбрать другой файл' : 'Выбрать файл карты'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Отображение выбранного файла */}
        {fileName && !loading && (
          <View style={styles.fileInfo}>
            <Feather name="file" size={16} color={DESIGN_TOKENS.colors.primary} />
            <Text style={styles.fileName} numberOfLines={1}>
              {fileName}
            </Text>
          </View>
        )}

        {/* Сообщение об успехе */}
        {uploadMessage && !error && (
          <View style={styles.successContainer}>
            <Feather name="check-circle" size={16} color={DESIGN_TOKENS.colors.success} />
            <Text style={styles.successText}>{uploadMessage}</Text>
          </View>
        )}

        {/* Сообщение об ошибке */}
        {error && (
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={16} color={DESIGN_TOKENS.colors.danger} />
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
    backgroundColor: DESIGN_TOKENS.colors.surface,
    borderRadius: 16,
    padding: 20,
    ...DESIGN_TOKENS.shadowsNative.medium,
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
    color: DESIGN_TOKENS.colors.text,
  },
  description: {
    fontSize: 14,
    color: DESIGN_TOKENS.colors.textMuted,
    marginBottom: 20,
    lineHeight: 20,
  },
  uploadButton: {
    backgroundColor: DESIGN_TOKENS.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...DESIGN_TOKENS.shadowsNative.medium,
  },
  uploadButtonDisabled: {
    backgroundColor: DESIGN_TOKENS.colors.disabled,
    shadowOpacity: 0.1,
  },
  uploadButtonText: {
    color: DESIGN_TOKENS.colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: DESIGN_TOKENS.colors.infoLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.info,
  },
  fileName: {
    fontSize: 14,
    color: DESIGN_TOKENS.colors.infoDark,
    flex: 1,
    fontWeight: '500',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: DESIGN_TOKENS.colors.successLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.success,
  },
  successText: {
    fontSize: 13,
    color: DESIGN_TOKENS.colors.successDark,
    flex: 1,
    lineHeight: 18,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: DESIGN_TOKENS.colors.dangerLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.danger,
  },
  errorText: {
    fontSize: 13,
    color: DESIGN_TOKENS.colors.dangerDark,
    flex: 1,
    lineHeight: 18,
  },
  instructionContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: DESIGN_TOKENS.colors.cardMuted,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.border,
  },
  instructionText: {
    fontSize: 13,
    color: DESIGN_TOKENS.colors.textMuted,
    lineHeight: 18,
    textAlign: 'center',
  },
});

export default MapUploadComponentIOS;
