import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

import { Button } from '@/ui/paper';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import {
  deleteTravelRouteFile,
  downloadTravelRouteFileBlob,
  listTravelRouteFiles,
  uploadTravelRouteFile,
} from '@/api/travelRoutes';
import type { ParsedRoutePoint, ParsedRoutePreview, TravelRouteFile } from '@/types/travelRoutes';
import { downloadTravelRouteFile } from '@/utils/travelRouteDownload';
import { parseRouteFilePreview } from '@/utils/routeFileParser';

type Props = {
  travelId?: string | number | null;
  allowUpload?: boolean;
  title?: string;
  onPreviewPointsChange?: (points: ParsedRoutePoint[]) => void;
  onPreviewDataChange?: (data: ParsedRoutePreview) => void;
  onRoutesChange?: (files: TravelRouteFile[]) => void;
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

const getRouteFileExt = (fileName: string): string =>
  String(fileName.split('.').pop() ?? '').toLowerCase();

export default function TravelRouteFilesPanel({
  travelId,
  allowUpload = false,
  title = 'Файлы маршрута (GPX, KML)',
  onPreviewPointsChange,
  onPreviewDataChange,
  onRoutesChange,
}: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [routes, setRoutes] = useState<TravelRouteFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingRouteFile, setIsDraggingRouteFile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const webInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<View | null>(null);
  const lastPreviewRouteIdRef = useRef<number | null>(null);

  const canManage = Boolean(allowUpload && travelId);

  const loadRoutes = useCallback(async () => {
    if (!travelId) {
      setRoutes([]);
      onRoutesChange?.([]);
      onPreviewPointsChange?.([]);
      onPreviewDataChange?.({ linePoints: [], elevationProfile: [] });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const loaded = await listTravelRouteFiles(travelId);
      setRoutes(loaded);
      onRoutesChange?.(loaded);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось загрузить файлы маршрута';
      setError(message);
      onRoutesChange?.([]);
    } finally {
      setIsLoading(false);
    }
  }, [travelId, onPreviewPointsChange, onPreviewDataChange, onRoutesChange]);

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
        const uploaded = await uploadTravelRouteFile(travelId, file);
        if (uploaded) {
          setRoutes((currentRoutes) => {
            return [
              uploaded,
              ...currentRoutes.filter((route) => route.id !== uploaded.id),
            ];
          });
        }
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

  const handleWebFileSelected = useCallback(
    async (file: File | null) => {
      if (!file) return;

      const ext = getRouteFileExt(file.name);
      if (!SUPPORTED_EXTENSIONS.has(ext)) {
        setError('Поддерживаются только файлы .gpx и .kml');
        return;
      }

      await handleUpload(file);
    },
    [handleUpload],
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
      await handleWebFileSelected(file);
      if (event?.target) {
        event.target.value = '';
      }
    },
    [handleWebFileSelected],
  );

  const handleWebDragEvent = useCallback((event: any, isActive: boolean) => {
    if (!canManage || Platform.OS !== 'web') return;

    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (event?.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    setIsDraggingRouteFile(isActive);
  }, [canManage]);

  const handleWebDrop = useCallback(
    async (event: any) => {
      if (!canManage || Platform.OS !== 'web') return;
      if (event?.__metravelRouteDropHandled) return;
      event.__metravelRouteDropHandled = true;

      event?.preventDefault?.();
      event?.stopPropagation?.();
      setIsDraggingRouteFile(false);

      const file = (event?.dataTransfer?.files?.[0] as File | undefined) ?? null;
      await handleWebFileSelected(file);
    },
    [canManage, handleWebFileSelected],
  );

  useEffect(() => {
    if (!canManage || Platform.OS !== 'web') return;

    const node = containerRef.current as any;
    if (!node || typeof node.addEventListener !== 'function') return;

    const onDragEnter = (event: DragEvent) => handleWebDragEvent(event, true);
    const onDragOver = (event: DragEvent) => handleWebDragEvent(event, true);
    const onDragLeave = (event: DragEvent) => handleWebDragEvent(event, false);
    const onDrop = (event: DragEvent) => {
      void handleWebDrop(event);
    };

    node.addEventListener('dragenter', onDragEnter);
    node.addEventListener('dragover', onDragOver);
    node.addEventListener('dragleave', onDragLeave);
    node.addEventListener('drop', onDrop);

    return () => {
      node.removeEventListener('dragenter', onDragEnter);
      node.removeEventListener('dragover', onDragOver);
      node.removeEventListener('dragleave', onDragLeave);
      node.removeEventListener('drop', onDrop);
    };
  }, [canManage, handleWebDragEvent, handleWebDrop]);

  const webDropProps = Platform.OS === 'web' && canManage
    ? {
        onDragEnter: (event: any) => handleWebDragEvent(event, true),
        onDragOver: (event: any) => handleWebDragEvent(event, true),
        onDragLeave: (event: any) => handleWebDragEvent(event, false),
        onDrop: handleWebDrop,
      }
    : null;

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

      try {
        const started = await downloadTravelRouteFile(travelId, file);
        if (!started) {
          setError('Не удалось скачать файл маршрута');
        }
      } catch {
        setError('Не удалось скачать файл маршрута');
      }
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
    <View
      ref={containerRef}
      testID="travel-route-files-panel"
      style={[styles.container, isDraggingRouteFile && styles.containerDragActive]}
      {...(webDropProps as any)}
    >
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

      {canManage && Platform.OS === 'web' ? (
        <Text style={styles.hint}>Перетащите GPX/KML файл сюда или используйте кнопку загрузки.</Text>
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
              <Text numberOfLines={1} style={styles.itemTitle}>{file.original_name || `route-${file.id}.${ext.toLowerCase()}`}</Text>
              <Text style={styles.itemMeta}>{ext || 'FILE'} • {formatSize(file.size)}</Text>
            </View>

            <View style={styles.actionsRow}>
              <Pressable onPress={() => handleDownload(file)} style={styles.actionButton}>
                <Text style={styles.actionText}>Скачать</Text>
              </Pressable>

              {canPreview ? (
                <Pressable onPress={() => void loadPreviewPoints(file)} style={styles.actionButton}>
                  <Text style={styles.actionText}>На карте</Text>
                </Pressable>
              ) : null}

              {canManage ? (
                <Pressable onPress={() => void handleDelete(file)} style={styles.actionButton}>
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
    containerDragActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
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
      color: colors.primaryText,
      fontWeight: '600',
    },
  });
