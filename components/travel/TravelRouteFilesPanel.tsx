import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as DocumentPicker from 'expo-document-picker';

import { Button } from '@/ui/paper';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import {
  buildTravelRouteDownloadPath,
  deleteTravelRouteFile,
  downloadTravelRouteFileBlob,
  listTravelRouteFiles,
  uploadTravelRouteFile,
} from '@/api/travelRoutes';
import type { ParsedRoutePoint, ParsedRoutePreview, TravelRouteFile } from '@/types/travelRoutes';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';
import { parseRouteFilePreview } from '@/utils/routeFileParser';

type Props = {
  travelId?: string | number | null;
  allowUpload?: boolean;
  title?: string;
  onPreviewPointsChange?: (points: ParsedRoutePoint[]) => void;
  onPreviewDataChange?: (data: ParsedRoutePreview) => void;
};

const SUPPORTED_EXTENSIONS = new Set(['gpx', 'kml']);

const formatSize = (bytes?: number): string => {
  if (!Number.isFinite(bytes)) return '—';
  const value = Number(bytes);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const resolveFileExt = (file: TravelRouteFile): string => {
  const ext = String(file.ext ?? '').toLowerCase().replace(/^\./, '');
  if (ext) return ext;
  const fromName = String(file.original_name ?? '').split('.').pop() ?? '';
  return fromName.toLowerCase();
};

const isSupportedRoute = (file: TravelRouteFile): boolean => SUPPORTED_EXTENSIONS.has(resolveFileExt(file));

export default function TravelRouteFilesPanel({
  travelId,
  allowUpload = false,
  title = 'Файлы маршрута (GPX, KML)',
  onPreviewPointsChange,
  onPreviewDataChange,
}: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [routes, setRoutes] = useState<TravelRouteFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const webInputRef = useRef<HTMLInputElement | null>(null);
  const lastPreviewRouteIdRef = useRef<number | null>(null);

  const canManage = Boolean(allowUpload && travelId);

  const loadRoutes = useCallback(async () => {
    if (!travelId) {
      setRoutes([]);
      onPreviewPointsChange?.([]);
      onPreviewDataChange?.({ linePoints: [], elevationProfile: [] });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const loaded = await listTravelRouteFiles(travelId);
      setRoutes(loaded);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось загрузить файлы маршрута';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [travelId, onPreviewPointsChange, onPreviewDataChange]);

  useEffect(() => {
    void loadRoutes();
  }, [loadRoutes]);

  const loadPreviewPoints = useCallback(
    async (file: TravelRouteFile) => {
      if (!travelId || (!onPreviewPointsChange && !onPreviewDataChange) || !isSupportedRoute(file)) return;

      try {
        const response = await downloadTravelRouteFileBlob(travelId, file.id);
        const parsed = parseRouteFilePreview(response.text, resolveFileExt(file));
        onPreviewPointsChange?.(parsed.linePoints);
        onPreviewDataChange?.(parsed);
      } catch {
        onPreviewPointsChange?.([]);
        onPreviewDataChange?.({ linePoints: [], elevationProfile: [] });
      }
    },
    [travelId, onPreviewPointsChange, onPreviewDataChange],
  );

  useEffect(() => {
    if (!onPreviewPointsChange && !onPreviewDataChange) return;

    const previewCandidate = routes.find(isSupportedRoute) ?? null;
    if (!previewCandidate) {
      lastPreviewRouteIdRef.current = null;
      onPreviewPointsChange?.([]);
      onPreviewDataChange?.({ linePoints: [], elevationProfile: [] });
      return;
    }

    if (lastPreviewRouteIdRef.current === previewCandidate.id) {
      return;
    }

    lastPreviewRouteIdRef.current = previewCandidate.id;
    void loadPreviewPoints(previewCandidate);
  }, [routes, onPreviewPointsChange, onPreviewDataChange, loadPreviewPoints]);

  const handleUpload = useCallback(
    async (file: File | { uri: string; name: string; type?: string } | null) => {
      if (!travelId || !file) return;

      setIsUploading(true);
      setError(null);

      try {
        await uploadTravelRouteFile(travelId, file);
        await loadRoutes();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Не удалось загрузить файл маршрута';
        setError(message);
      } finally {
        setIsUploading(false);
      }
    },
    [travelId, loadRoutes],
  );

  const pickNativeFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/gpx+xml', 'application/vnd.google-earth.kml+xml', 'text/xml', '*/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.length) return;
    const picked = result.assets[0];
    const name = String(picked.name ?? 'route-file').trim();
    const ext = name.split('.').pop()?.toLowerCase();
    if (!ext || !SUPPORTED_EXTENSIONS.has(ext)) {
      setError('Поддерживаются только файлы .gpx и .kml');
      return;
    }

    await handleUpload({
      uri: picked.uri,
      name,
      type: picked.mimeType ?? (ext === 'gpx' ? 'application/gpx+xml' : 'application/vnd.google-earth.kml+xml'),
    });
  }, [handleUpload]);

  const handleWebInputChange = useCallback(
    async (event: any) => {
      const file = (event?.target?.files?.[0] as File | undefined) ?? null;
      if (!file) return;

      const ext = String(file.name.split('.').pop() ?? '').toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(ext)) {
        setError('Поддерживаются только файлы .gpx и .kml');
        return;
      }

      await handleUpload(file);
      if (event?.target) {
        event.target.value = '';
      }
    },
    [handleUpload],
  );

  const handlePickUpload = useCallback(async () => {
    if (!canManage) return;

    if (Platform.OS === 'web') {
      webInputRef.current?.click();
      return;
    }

    await pickNativeFile();
  }, [canManage, pickNativeFile]);

  const handleDownload = useCallback(
    async (file: TravelRouteFile) => {
      if (!travelId) return;
      const rawUrl = String(file.download_url ?? '').trim() || buildTravelRouteDownloadPath(travelId, file.id);
      await openExternalUrlInNewTab(rawUrl, {
        allowRelative: true,
        baseUrl:
          Platform.OS === 'web' && typeof window !== 'undefined'
            ? window.location.origin
            : (process.env.EXPO_PUBLIC_API_URL as string) || undefined,
      });
    },
    [travelId],
  );

  const handleDelete = useCallback(
    async (file: TravelRouteFile) => {
      if (!travelId || !canManage) return;
      setError(null);
      try {
        await deleteTravelRouteFile(travelId, file.id);
        await loadRoutes();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Не удалось удалить файл';
        setError(message);
      }
    },
    [travelId, canManage, loadRoutes],
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        {canManage ? (
          <Button
            mode="outlined"
            onPress={handlePickUpload}
            disabled={isUploading}
            icon="upload"
            compact
          >
            {isUploading ? 'Загрузка...' : 'Загрузить'}
          </Button>
        ) : null}
      </View>

      {canManage && Platform.OS === 'web' ? (
        <input
          ref={webInputRef}
          type="file"
          accept=".gpx,.kml,application/gpx+xml,application/vnd.google-earth.kml+xml,text/xml"
          onChange={handleWebInputChange}
          style={{ display: 'none' } as any}
        />
      ) : null}

      {!travelId ? (
        <Text style={styles.hint}>Сначала сохраните черновик путешествия, затем загрузите GPX/KML файл маршрута.</Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isLoading ? <Text style={styles.hint}>Загружаем файлы маршрута...</Text> : null}

      {!isLoading && travelId && routes.length === 0 ? (
        <Text style={styles.hint}>Файлы маршрута пока не добавлены.</Text>
      ) : null}

      {routes.map((file) => {
        const ext = resolveFileExt(file).toUpperCase();
        const canPreview = isSupportedRoute(file) && Boolean(onPreviewPointsChange);

        return (
          <View key={file.id} style={styles.item}>
            <View style={styles.itemInfo}>
              <View style={styles.itemTitleRow}>
                <Feather name="map" size={14} color={colors.textMuted} />
                <Text numberOfLines={1} style={styles.itemTitle}>{file.original_name || `route-${file.id}.${ext.toLowerCase()}`}</Text>
              </View>
              <Text style={styles.itemMeta}>{ext || 'FILE'} • {formatSize(file.size)}</Text>
            </View>

            <View style={styles.actionsRow}>
              <Pressable onPress={() => handleDownload(file)} style={styles.actionButton}>
                <Feather name="download" size={14} color={colors.primary} />
                <Text style={styles.actionText}>Скачать</Text>
              </Pressable>

              {canPreview ? (
                <Pressable onPress={() => void loadPreviewPoints(file)} style={styles.actionButton}>
                  <Feather name="navigation" size={14} color={colors.primary} />
                  <Text style={styles.actionText}>На карте</Text>
                </Pressable>
              ) : null}

              {canManage ? (
                <Pressable onPress={() => void handleDelete(file)} style={styles.actionButton}>
                  <Feather name="trash-2" size={14} color={colors.danger} />
                  <Text style={[styles.actionText, { color: colors.danger }]}>Удалить</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) =>
  StyleSheet.create({
    container: {
      marginTop: DESIGN_TOKENS.spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: colors.surface,
      padding: DESIGN_TOKENS.spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: DESIGN_TOKENS.spacing.sm,
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    title: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    hint: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    error: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.danger,
      marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    item: {
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      paddingTop: DESIGN_TOKENS.spacing.sm,
      marginTop: DESIGN_TOKENS.spacing.sm,
      gap: DESIGN_TOKENS.spacing.xs,
    },
    itemInfo: {
      gap: 2,
    },
    itemTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    itemTitle: {
      fontSize: DESIGN_TOKENS.typography.sizes.sm,
      color: colors.text,
      flex: 1,
    },
    itemMeta: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.textMuted,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: DESIGN_TOKENS.spacing.md,
      flexWrap: 'wrap',
    },
    actionButton: {
      minHeight: 32,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    actionText: {
      fontSize: DESIGN_TOKENS.typography.sizes.xs,
      color: colors.primary,
      fontWeight: '600',
    },
  });
