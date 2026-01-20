import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { GoogleMapsParser } from '@/src/api/parsers/googleMapsParser';
import { OSMParser } from '@/src/api/parsers/osmParser';
import { userPointsApi } from '@/src/api/userPoints';
import type { ImportPointsResult, ParsedPoint } from '@/types/userPoints';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

type ImportStep = 'intro' | 'preview' | 'progress' | 'complete';

export const ImportWizard: React.FC<{ onComplete: () => void; onCancel: () => void }> = ({ 
  onComplete, 
  onCancel 
}) => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<ImportStep>('intro');
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [parsedPoints, setParsedPoints] = useState<ParsedPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportPointsResult | null>(null);

  const colors = useThemedColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const detectAndParse = async (selectedFile: DocumentPicker.DocumentPickerAsset) => {
    let googleError: unknown = null;
    let osmError: unknown = null;
    try {
      const points = await GoogleMapsParser.parse(selectedFile);
      return { points };
    } catch (err) {
      googleError = err;
    }

    try {
      const points = await OSMParser.parse(selectedFile);
      return { points };
    } catch (err) {
      osmError = err;
    }

    const baseMessage =
      'Не удалось распознать формат файла. Поддерживаются: JSON (Google Takeout), GeoJSON, GPX, KML, KMZ.';

    const googleMsg = googleError instanceof Error ? googleError.message : '';
    const osmMsg = osmError instanceof Error ? osmError.message : '';
    const details = [googleMsg && `Google: ${googleMsg}`, osmMsg && `OSM: ${osmMsg}`].filter(Boolean).join(' | ');

    throw new Error(details ? `${baseMessage} (${details})` : baseMessage);
  };

  const handleFileSelect = async (selectedFile: DocumentPicker.DocumentPickerAsset) => {
    setFile(selectedFile);
    setIsLoading(true);
    setError(null);

    try {
      const { points } = await detectAndParse(selectedFile);
      setParsedPoints(points);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка парсинга файла');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setStep('progress');

    try {
      const result = await userPointsApi.importPoints(file);
      setImportResult(result);
      setStep('complete');

      await queryClient.invalidateQueries({ queryKey: ['userPointsAll'] });

      const importedCount = (result?.created ?? 0) + (result?.updated ?? 0);
      if (parsedPoints.length > 0 && importedCount === 0) {
        setError(
          'Импорт на сервере завершился без созданных точек. Возможно, файл слишком большой или сервер не смог распознать данные. Попробуйте JSON из Google Takeout или разделите файл на части.'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка импорта');
      setStep('preview');
    } finally {
      setIsLoading(false);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/json',
          'application/geo+json',
          'application/gpx+xml',
          'application/vnd.google-earth.kml+xml',
          'application/vnd.google-earth.kmz',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        handleFileSelect(result.assets[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка выбора файла');
    }
  };

  const renderIntro = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Импорт точек</Text>
      <Text style={styles.subtitle}>
        Поддерживаемые форматы:\n
        Google Maps: JSON (Google Takeout), KML, KMZ\n
        OpenStreetMap: GeoJSON, GPX
      </Text>

      <TouchableOpacity
        style={styles.importButton}
        onPress={pickDocument}
        disabled={isLoading}
      >
        <Text style={styles.importButtonText}>
          {isLoading ? 'Открываем…' : 'Импорт точек'}
        </Text>
      </TouchableOpacity>

      {file ? (
        <Text style={[styles.subtitle, { marginTop: DESIGN_TOKENS.spacing.md }]}>Выбран: {file.name}</Text>
      ) : null}

      {isLoading && <ActivityIndicator size="large" style={styles.loader} />}
      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelButtonText}>Отмена</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPreview = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Предпросмотр данных</Text>
      <Text style={styles.subtitle}>
        Найдено точек: {parsedPoints.length}
      </Text>

      <ScrollView style={styles.previewList}>
        {parsedPoints.slice(0, 10).map((point, index) => (
          <View key={index} style={styles.previewItem}>
            <Text style={styles.previewName}>{point.name}</Text>
            <Text style={styles.previewDetails}>
              {Array.isArray((point as any)?.categoryIds) && (point as any).categoryIds.length > 0
                ? (point as any).categoryIds.join(', ')
                : ''}{' '}
              • {point.color}
            </Text>
          </View>
        ))}
        {parsedPoints.length > 10 && (
          <Text style={styles.moreText}>
            ... и еще {parsedPoints.length - 10} точек
          </Text>
        )}
      </ScrollView>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep('intro')}>
          <Text style={styles.backButtonText}>Назад</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.importButton} 
          onPress={handleImport}
          disabled={isLoading}
        >
          <Text style={styles.importButtonText}>
            {isLoading ? 'Импорт...' : 'Импортировать'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderProgress = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Импорт данных</Text>
      <ActivityIndicator size="large" style={styles.loader} />
      <Text style={styles.subtitle}>Пожалуйста, подождите...</Text>
    </View>
  );

  const renderComplete = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Импорт завершен!</Text>
      <Text style={styles.subtitle}>
        Создано: {importResult?.created ?? 0} точек
        {typeof importResult?.updated === 'number' ? `\nОбновлено: ${importResult.updated}` : ''}
        {importResult?.skipped ? `\nПропущено: ${importResult.skipped}` : ''}
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {importResult?.errors?.length ? (
        <Text style={styles.errorText}>Ошибки: {importResult.errors.length}</Text>
      ) : null}

      <TouchableOpacity style={styles.importButton} onPress={onComplete}>
        <Text style={styles.importButtonText}>Готово</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {step === 'intro' && renderIntro()}
      {step === 'preview' && renderPreview()}
      {step === 'progress' && renderProgress()}
      {step === 'complete' && renderComplete()}
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  stepContainer: {
    padding: DESIGN_TOKENS.spacing.lg,
  },
  title: {
    fontSize: DESIGN_TOKENS.typography.sizes.xl,
    fontWeight: '700' as any,
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  subtitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: DESIGN_TOKENS.spacing.lg,
  },
  sourceCard: {
    backgroundColor: colors.backgroundSecondary,
    padding: DESIGN_TOKENS.spacing.lg,
    borderRadius: DESIGN_TOKENS.radii.md,
    marginBottom: DESIGN_TOKENS.spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sourceTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '600' as any,
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.xxs,
  },
  sourceDescription: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  sourceFormats: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  previewList: {
    maxHeight: 300,
    marginBottom: DESIGN_TOKENS.spacing.lg,
  },
  previewItem: {
    padding: DESIGN_TOKENS.spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: DESIGN_TOKENS.radii.sm,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  previewName: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.text,
  },
  previewDetails: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    marginTop: DESIGN_TOKENS.spacing.xs,
  },
  moreText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: DESIGN_TOKENS.spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: DESIGN_TOKENS.spacing.lg,
  },
  importButton: {
    backgroundColor: colors.primary,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    flex: 1,
    alignItems: 'center',
  },
  importButtonText: {
    color: colors.textOnPrimary,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600' as any,
  },
  backButton: {
    backgroundColor: colors.backgroundSecondary,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    marginRight: DESIGN_TOKENS.spacing.md,
    flex: 1,
    alignItems: 'center',
  },
  backButtonText: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600' as any,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    alignItems: 'center',
    marginTop: DESIGN_TOKENS.spacing.md,
  },
  cancelButtonText: {
    color: colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
  },
  uploadButton: {
    padding: DESIGN_TOKENS.spacing.xl,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginVertical: DESIGN_TOKENS.spacing.lg,
  },
  uploadText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: colors.primary,
    fontWeight: '600' as any,
  },
  loader: {
    marginVertical: DESIGN_TOKENS.spacing.xl,
  },
  errorText: {
    color: colors.danger,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    marginTop: DESIGN_TOKENS.spacing.md,
  },
});
