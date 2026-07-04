import React, { useEffect, useRef, useState } from 'react';
import { Platform, View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { userPointsApi } from '@/api/userPoints';
import { queryKeys } from '@/api/queryKeys';
import type {
  ImportPointsResult,
  ImportPreviewResult,
  ImportPreviewPoint,
} from '@/types/userPoints';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import Button from '@/components/ui/Button';

type ImportStep = 'intro' | 'preview' | 'progress' | 'complete';

const PREVIEW_STATUS_LABELS: Record<string, string> = {
  visited: 'Посещено',
  want_to_visit: 'Хочу посетить',
  planning: 'Планирую',
  planned: 'Планирую',
  archived: 'Архив',
};

export const ImportWizard: React.FC<{ onComplete: () => void; onCancel: () => void }> = ({ 
  onComplete, 
  onCancel 
}) => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<ImportStep>('intro');
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportPointsResult | null>(null);

  const colors = useThemedColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const isMountedRef = useRef(true);
  const selectTokenRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const previewPoints = preview?.points ?? [];

  const handleFileSelect = async (selectedFile: DocumentPicker.DocumentPickerAsset) => {
    const token = ++selectTokenRef.current;

    setFile(selectedFile);
    setPreview(null);
    setIsLoading(true);
    setError(null);

    try {
      // Server-side preview: backend parses + validates (KML/KMZ/GPX/GeoJSON/JSON)
      // and returns points_preview + summary without writing anything.
      const result = await userPointsApi.previewImport(selectedFile);
      if (!isMountedRef.current || token !== selectTokenRef.current) return;

      if (result.points.length === 0 && result.summary.errors.length > 0) {
        setError(result.summary.errors.join('\n'));
        return;
      }

      setPreview(result);
      setStep('preview');
    } catch (err) {
      if (!isMountedRef.current || token !== selectTokenRef.current) return;
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось разобрать файл. Поддерживаются: KML, KMZ, GPX, GeoJSON, JSON (Google Takeout).'
      );
    } finally {
      if (isMountedRef.current && token === selectTokenRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleImport = async () => {
    if (isLoading) return;
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setStep('progress');

    try {
      const result = await userPointsApi.importPoints(file, {
        dedupePolicy: preview?.dedupePolicy,
      });
      if (!isMountedRef.current) return;
      setImportResult(result);
      setStep('complete');

      await queryClient.invalidateQueries({ queryKey: queryKeys.userPointsAll() });
      if (!isMountedRef.current) return;

      const serverHandled =
        (result?.created ?? 0) + (result?.updated ?? 0) + (result?.skipped ?? 0);

      if (previewPoints.length > 0 && serverHandled === 0) {
        setError(
          'Импорт на сервере завершился без созданных точек. Возможно, файл слишком большой или сервер не смог сохранить данные. Попробуйте разделить файл на части.'
        );
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Ошибка импорта');
      setStep('preview');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const pickDocument = async () => {
    if (isLoading) return;
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
        await handleFileSelect(result.assets[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка выбора файла');
    }
  };

  const renderIntro = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Импорт точек</Text>
      <Text style={styles.subtitle}>
        {'Поддерживаемые форматы:\n'}
        {'KML, KMZ, GPX, GeoJSON, JSON (Google Takeout)'}
      </Text>

      <Button
        label={isLoading ? 'Открываем…' : 'Импорт точек'}
        onPress={pickDocument}
        disabled={isLoading}
        fullWidth
      />

      {file ? (
        <Text style={[styles.subtitle, { marginTop: DESIGN_TOKENS.spacing.md }]}>Выбран: {file.name}</Text>
      ) : null}

      {isLoading && <ActivityIndicator size="large" style={styles.loader} />}
      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <Button
        label="Отмена"
        onPress={onCancel}
        variant="ghost"
        fullWidth
        style={styles.cancelButton}
      />
    </View>
  );

  const renderPreviewDetails = (point: ImportPreviewPoint) => {
    const statusLabel = PREVIEW_STATUS_LABELS[point.status] ?? point.status;
    const category = point.categoryIds.length > 0 ? point.categoryIds.join(', ') : '';
    return [category, statusLabel].filter(Boolean).join(' • ');
  };

  const renderPreview = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Предпросмотр данных</Text>
      <Text style={styles.subtitle}>
        Найдено точек: {previewPoints.length}
        {preview?.source ? ` • формат: ${preview.source}` : ''}
      </Text>

      <ScrollView style={styles.previewList}>
        {previewPoints.slice(0, 10).map((point, index) => (
          <View key={index} style={styles.previewItem}>
            <Text style={styles.previewName}>{point.name}</Text>
            <Text style={styles.previewDetails}>{renderPreviewDetails(point)}</Text>
          </View>
        ))}
        {previewPoints.length > 10 && (
          <Text style={styles.moreText}>
            ... и еще {previewPoints.length - 10} точек
          </Text>
        )}
      </ScrollView>

      {preview?.summary.warnings.length ? (
        <Text style={styles.warningText}>
          {preview.summary.warnings.slice(0, 5).join('\n')}
        </Text>
      ) : null}

      {preview?.summary.errors.length ? (
        <Text style={styles.errorText}>
          {preview.summary.errors.slice(0, 5).join('\n')}
        </Text>
      ) : null}

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.buttonRow}>
        <Button
          label="Назад"
          onPress={() => setStep('intro')}
          variant="secondary"
          style={styles.buttonFlex}
        />
        <Button
          label={isLoading ? 'Импорт...' : 'Импортировать'}
          onPress={handleImport}
          disabled={isLoading}
          style={styles.buttonFlex}
        />
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

      <Button label="Готово" onPress={onComplete} fullWidth />
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
    alignItems: 'center',
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    paddingVertical: DESIGN_TOKENS.spacing.xl,
  },
  stepContainer: {
    width: '100%',
    maxWidth: 720,
    padding: DESIGN_TOKENS.spacing.lg,
    borderRadius: DESIGN_TOKENS.radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: (colors as any).boxShadows?.card ?? '0 8px 30px rgba(0,0,0,0.08)',
        } as any)
      : null),
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
    width: '100%',
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
    gap: DESIGN_TOKENS.spacing.md,
    marginTop: DESIGN_TOKENS.spacing.lg,
  },
  buttonFlex: {
    flex: 1,
  },
  cancelButton: {
    marginTop: DESIGN_TOKENS.spacing.md,
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
    color: colors.primaryText,
    fontWeight: '600' as any,
  },
  loader: {
    marginVertical: DESIGN_TOKENS.spacing.xl,
    alignSelf: 'center',
  },
  errorText: {
    color: colors.danger,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    marginTop: DESIGN_TOKENS.spacing.md,
  },
  warningText: {
    color: colors.warning ?? colors.textMuted,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    marginTop: DESIGN_TOKENS.spacing.md,
  },
});
