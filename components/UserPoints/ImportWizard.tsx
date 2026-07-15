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
import { translate as i18nT, type TranslationKey } from '@/i18n'


type ImportStep = 'intro' | 'preview' | 'progress' | 'complete';

const PREVIEW_STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  visited: 'map:components.UserPoints.ImportWizard.posescheno_95b24d76',
  want_to_visit: 'map:components.UserPoints.ImportWizard.hochu_posetit_8b29ed38',
  planning: 'map:components.UserPoints.ImportWizard.planiruyu_80ecf688',
  planned: 'map:components.UserPoints.ImportWizard.planiruyu_80ecf688',
  archived: 'map:components.UserPoints.ImportWizard.arhiv_e18e1d5c',
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
          : i18nT('map:components.UserPoints.ImportWizard.ne_udalos_razobrat_fayl_podderzhivayutsya_km_4d0757b1')
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
          i18nT('map:components.UserPoints.ImportWizard.import_na_servere_zavershilsya_bez_sozdannyh_61347363')
        );
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : i18nT('map:components.UserPoints.ImportWizard.oshibka_importa_87808563'));
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
      setError(err instanceof Error ? err.message : i18nT('map:components.UserPoints.ImportWizard.oshibka_vybora_fayla_e55310c2'));
    }
  };

  const renderIntro = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>{i18nT('map:components.UserPoints.ImportWizard.import_tochek_0a76b9d2')}</Text>
      <Text style={styles.subtitle}>
        {i18nT('map:components.UserPoints.ImportWizard.podderzhivaemye_formaty_eec72024')}
        {'KML, KMZ, GPX, GeoJSON, JSON (Google Takeout)'}
      </Text>

      <Button
        label={isLoading ? i18nT('map:components.UserPoints.ImportWizard.otkryvaem_3cd3b931') : i18nT('map:components.UserPoints.ImportWizard.import_tochek_0a76b9d2')}
        onPress={pickDocument}
        disabled={isLoading}
        fullWidth
      />

      {file ? (
        <Text style={[styles.subtitle, { marginTop: DESIGN_TOKENS.spacing.md }]}>{i18nT('map:components.UserPoints.ImportWizard.vybran_eb1f6ef5')}{file.name}</Text>
      ) : null}

      {isLoading && <ActivityIndicator size="large" style={styles.loader} />}
      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <Button
        label={i18nT('map:components.UserPoints.ImportWizard.otmena_f80d9fde')}
        onPress={onCancel}
        variant="ghost"
        fullWidth
        style={styles.cancelButton}
      />
    </View>
  );

  const renderPreviewDetails = (point: ImportPreviewPoint) => {
    const statusLabelKey = PREVIEW_STATUS_LABEL_KEYS[point.status];
    const statusLabel = statusLabelKey ? i18nT(statusLabelKey) : point.status;
    const category = point.categoryIds.length > 0 ? point.categoryIds.join(', ') : '';
    return [category, statusLabel].filter(Boolean).join(' • ');
  };

  const renderPreview = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>{i18nT('map:components.UserPoints.ImportWizard.predprosmotr_dannyh_2ffa6e9f')}</Text>
      <Text style={styles.subtitle}>
        {i18nT('map:components.UserPoints.ImportWizard.naydeno_tochek_bc25057d')}{previewPoints.length}
        {preview?.source ? i18nT('map:components.UserPoints.ImportWizard.format_value1_5fc29aa2', { value1: preview.source }) : ''}
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
            {i18nT('map:components.UserPoints.ImportWizard.i_esche_e623fbb3')}{previewPoints.length - 10} {i18nT('map:components.UserPoints.ImportWizard.tochek_12a5d808')}</Text>
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
          label={i18nT('map:components.UserPoints.ImportWizard.nazad_ec1e4298')}
          onPress={() => setStep('intro')}
          variant="secondary"
          style={styles.buttonFlex}
        />
        <Button
          label={isLoading ? i18nT('map:components.UserPoints.ImportWizard.import_749459c8') : i18nT('map:components.UserPoints.ImportWizard.importirovat_0ee7724f')}
          onPress={handleImport}
          disabled={isLoading}
          style={styles.buttonFlex}
        />
      </View>
    </View>
  );

  const renderProgress = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>{i18nT('map:components.UserPoints.ImportWizard.import_dannyh_4bac58f5')}</Text>
      <ActivityIndicator size="large" style={styles.loader} />
      <Text style={styles.subtitle}>{i18nT('map:components.UserPoints.ImportWizard.pozhaluysta_podozhdite_36472eaa')}</Text>
    </View>
  );

  const renderComplete = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>{i18nT('map:components.UserPoints.ImportWizard.import_zavershen_13bec714')}</Text>
      <Text style={styles.subtitle}>
        {i18nT('map:components.UserPoints.ImportWizard.sozdano_5a7310b7')}{importResult?.created ?? 0} {i18nT('map:components.UserPoints.ImportWizard.tochek_12a5d808')}{typeof importResult?.updated === 'number' ? i18nT('map:components.UserPoints.ImportWizard.obnovleno_value1_346dbca5', { value1: importResult.updated }) : ''}
        {importResult?.skipped ? i18nT('map:components.UserPoints.ImportWizard.propuscheno_value1_8a402a35', { value1: importResult.skipped }) : ''}
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {importResult?.errors?.length ? (
        <Text style={styles.errorText}>{i18nT('map:components.UserPoints.ImportWizard.oshibki_a939e151')}{importResult.errors.length}</Text>
      ) : null}

      <Button label={i18nT('map:components.UserPoints.ImportWizard.gotovo_4585c81e')} onPress={onComplete} fullWidth />
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
