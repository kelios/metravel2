// components/MapPage/MapOfflineDownloadControl.tsx
// Native-only контрол «Скачать эту область» для главной карты. Импортируется
// только из Map.ios.tsx → в web-бандл не попадает. Использует чистые RN-примитивы
// (RN-Web-safe). Триггер — icon-only (правило шапки ≤20%, подпись в
// accessibilityLabel); детали открываются в модалке.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { useOfflineTileDownload } from '@/hooks/map/useOfflineTileDownload';
import {
  deleteRegion,
  listRegions,
  type OfflineBBox,
  type OfflineRegion,
} from '@/utils/mapTileCache';

interface MapOfflineDownloadControlProps {
  bbox: OfflineBBox | null;
  /** Отступ снизу под safe-area/floating-контролы. */
  bottomInset?: number;
}

const MIN_Z = 10;
const MAX_Z = 16;

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 МБ';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} МБ`;
};

const MapOfflineDownloadControlInner: React.FC<MapOfflineDownloadControlProps> = ({
  bbox,
  bottomInset = 0,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [regions, setRegions] = useState<OfflineRegion[]>([]);
  const {
    state,
    progress,
    estimateBytes,
    estimateTileCount,
    maxTiles,
    downloadCurrentRegion,
    cancel,
    reset,
  } = useOfflineTileDownload();

  const refreshRegions = useCallback(() => {
    void listRegions().then(setRegions);
  }, []);

  useEffect(() => {
    if (open) refreshRegions();
  }, [open, refreshRegions]);

  useEffect(() => {
    if (state === 'done') refreshRegions();
  }, [state, refreshRegions]);

  const tileCount = useMemo(
    () => (bbox ? estimateTileCount(bbox, MIN_Z, MAX_Z) : 0),
    [bbox, estimateTileCount],
  );
  const sizeLabel = useMemo(
    () => (bbox ? formatBytes(estimateBytes(bbox, MIN_Z, MAX_Z)) : '—'),
    [bbox, estimateBytes],
  );
  const tooLarge = tileCount > maxTiles;

  const handleDownload = useCallback(() => {
    if (!bbox || tooLarge) return;
    void downloadCurrentRegion(bbox, { minZ: MIN_Z, maxZ: MAX_Z });
  }, [bbox, tooLarge, downloadCurrentRegion]);

  const handleDelete = useCallback(
    (id: string) => {
      void deleteRegion(id).then(refreshRegions);
    },
    [refreshRegions],
  );

  const handleClose = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  const isBusy = state === 'estimating' || state === 'downloading';
  const pct = progress.total > 0 ? Math.min(1, progress.done / progress.total) : 0;

  return (
    <>
      <Pressable
        style={[styles.fab, { bottom: bottomInset + 16 }]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Скачать эту область карты для офлайна"
        testID="map-offline-download-fab"
        hitSlop={8}
      >
        <Feather name="download-cloud" size={20} color={colors.textOnPrimary} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.title}>Офлайн-карта</Text>
              <Pressable
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Закрыть"
                hitSlop={10}
              >
                <Feather name="x" size={22} color={colors.text} />
              </Pressable>
            </View>

            <Text style={styles.subtitle}>Текущая область</Text>
            <View style={styles.estimateRow}>
              <Feather name="layers" size={15} color={colors.textMuted} />
              <Text style={styles.estimateText}>
                {bbox ? `~${tileCount} тайлов · ${sizeLabel}` : 'Область недоступна'}
              </Text>
            </View>
            {tooLarge && (
              <Text style={styles.warn}>
                Область слишком большая. Приблизьте карту и попробуйте снова.
              </Text>
            )}

            {isBusy ? (
              <>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  {state === 'estimating'
                    ? 'Подготовка…'
                    : `${progress.done} / ${progress.total}`}
                </Text>
                <Pressable
                  style={[styles.actionBtn, styles.cancelBtn]}
                  onPress={cancel}
                  accessibilityRole="button"
                  accessibilityLabel="Отменить загрузку"
                >
                  <ActivityIndicator size="small" color={colors.text} />
                  <Text style={styles.cancelText}>Отменить</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={[styles.actionBtn, styles.primaryBtn, (!bbox || tooLarge) && styles.disabledBtn]}
                onPress={handleDownload}
                disabled={!bbox || tooLarge}
                accessibilityRole="button"
                accessibilityLabel="Скачать эту область"
              >
                <Feather name="download" size={16} color={colors.textOnPrimary} />
                <Text style={styles.primaryText}>
                  {state === 'done' ? 'Скачано ✓' : 'Скачать эту область'}
                </Text>
              </Pressable>
            )}

            {state === 'error' && (
              <Text style={styles.warn}>Не удалось скачать область. Проверьте сеть.</Text>
            )}

            {regions.length > 0 && (
              <>
                <Text style={[styles.subtitle, styles.regionsHeader]}>Сохранённые области</Text>
                <ScrollView style={styles.regionsList}>
                  {regions.map((region) => (
                    <View key={region.id} style={styles.regionRow}>
                      <View style={styles.regionInfo}>
                        <Text style={styles.regionName} numberOfLines={1}>
                          {region.name}
                        </Text>
                        <Text style={styles.regionMeta}>
                          {region.tileCount} тайлов · {formatBytes(region.bytes)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleDelete(region.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Удалить область ${region.name}`}
                        hitSlop={8}
                        style={styles.deleteBtn}
                      >
                        <Feather name="trash-2" size={16} color={colors.danger} />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const getStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    fab: {
      position: 'absolute',
      right: 16,
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      zIndex: 1010,
      ...colors.shadows.medium,
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 28,
      maxHeight: '80%',
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 6,
    },
    regionsHeader: {
      marginTop: 18,
    },
    estimateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    estimateText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    warn: {
      fontSize: 13,
      color: colors.danger,
      marginBottom: 10,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 4,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
    },
    disabledBtn: {
      opacity: 0.5,
    },
    primaryText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textOnPrimary,
    },
    cancelBtn: {
      backgroundColor: colors.surfaceMuted,
    },
    cancelText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    progressTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      overflow: 'hidden',
      marginTop: 6,
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    progressText: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 6,
      marginBottom: 4,
      textAlign: 'center',
    },
    regionsList: {
      maxHeight: 200,
    },
    regionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    regionInfo: {
      flex: 1,
      marginRight: 12,
    },
    regionName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    regionMeta: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    deleteBtn: {
      padding: 6,
    },
  });

export const MapOfflineDownloadControl = React.memo(MapOfflineDownloadControlInner);

export default MapOfflineDownloadControl;
