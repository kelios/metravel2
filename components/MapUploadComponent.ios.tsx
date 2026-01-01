// components/MapUploadComponent.ios.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { uploadImage } from '@/src/api/misc';
import { Feather } from '@expo/vector-icons';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

interface MapUploadComponentProps {
  collection: string;
  idTravel: string;
}

const MapUploadComponentIOS: React.FC<MapUploadComponentProps> = ({ collection, idTravel }) => {
  // ✅ УЛУЧШЕНИЕ: поддержка тем через useThemedColors
  const colors = useThemedColors();

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
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        {/* Заголовок */}
        <View style={styles.header}>
          <Feather name="map" size={24} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>Загрузка файла карты</Text>
        </View>

        {/* Описание */}
        <Text style={[styles.description, { color: colors.textMuted }]}>
          Поддерживаемые форматы: {supportedFormats.join(', ')}
        </Text>

        {/* Кнопка выбора файла */}
        <TouchableOpacity
          style={[
            styles.uploadButton,
            { backgroundColor: colors.primary },
            loading && { backgroundColor: colors.disabled }
          ]}
          onPress={pickFile}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <>
              <Feather name="upload-cloud" size={20} color={colors.textInverse} />
              <Text style={[styles.uploadButtonText, { color: colors.textInverse }]}>
                {fileName ? 'Выбрать другой файл' : 'Выбрать файл карты'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Отображение выбранного файла */}
        {fileName && !loading && (
          <View style={[styles.fileInfo, {
            backgroundColor: colors.infoSoft,
            borderColor: colors.info
          }]}>
            <Feather name="file" size={16} color={colors.primary} />
            <Text style={[styles.fileName, { color: colors.infoDark }]} numberOfLines={1}>
              {fileName}
            </Text>
          </View>
        )}

        {/* Сообщение об успехе */}
        {uploadMessage && !error && (
          <View style={[styles.successContainer, {
            backgroundColor: colors.successSoft,
            borderColor: colors.success
          }]}>
            <Feather name="check-circle" size={16} color={colors.success} />
            <Text style={[styles.successText, { color: colors.successDark }]}>{uploadMessage}</Text>
          </View>
        )}

        {/* Сообщение об ошибке */}
        {error && (
          <View style={[styles.errorContainer, {
            backgroundColor: colors.dangerSoft,
            borderColor: colors.danger
          }]}>
            <Feather name="alert-circle" size={16} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.dangerDark }]}>{error}</Text>
          </View>
        )}

        {/* Инструкция */}
        {!fileName && !loading && (
          <View style={[styles.instructionContainer, {
            backgroundColor: colors.backgroundSecondary,
            borderColor: colors.border
          }]}>
            <Text style={[styles.instructionText, { color: colors.textMuted }]}>
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
    padding: DESIGN_TOKENS.spacing.lg,
  },
  card: {
    borderRadius: DESIGN_TOKENS.radii.xl,
    padding: DESIGN_TOKENS.spacing.xl,
    ...DESIGN_TOKENS.shadowsNative.medium,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.md,
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  title: {
    fontSize: DESIGN_TOKENS.typography.sizes.xl,
    fontWeight: '700',
  },
  description: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    marginBottom: DESIGN_TOKENS.spacing.xl,
    lineHeight: 20,
  },
  uploadButton: {
    paddingVertical: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    borderRadius: DESIGN_TOKENS.radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    ...DESIGN_TOKENS.shadowsNative.medium,
  },
  uploadButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '600',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    marginTop: DESIGN_TOKENS.spacing.lg,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.sm,
    borderWidth: 1,
  },
  fileName: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    flex: 1,
    fontWeight: '500',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    marginTop: DESIGN_TOKENS.spacing.lg,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.sm,
    borderWidth: 1,
  },
  successText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    flex: 1,
    lineHeight: 18,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    marginTop: DESIGN_TOKENS.spacing.lg,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.sm,
    borderWidth: 1,
  },
  errorText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    flex: 1,
    lineHeight: 18,
  },
  instructionContainer: {
    marginTop: DESIGN_TOKENS.spacing.lg,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.sm,
    borderWidth: 1,
  },
  instructionText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    lineHeight: 18,
    textAlign: 'center',
  },
});

export default MapUploadComponentIOS;
