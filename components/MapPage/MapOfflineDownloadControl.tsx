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
import { translate as i18nT } from '@/i18n'


interface MapOfflineDownloadControlProps {
  bbox: OfflineBBox | null;
  /** Отступ снизу под safe-area/floating-контролы. */
  bottomInset?: number;
}

const MIN_Z = 10;
const MAX_Z = 16;

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return i18nT('map:components.MapPage.MapOfflineDownloadControl.0_mb_29612170');
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return i18nT('map:components.MapPage.MapOfflineDownloadControl.value1_kb_f05a2351', { value1: Math.max(1, Math.round(bytes / 1024)) });
  return i18nT('map:components.MapPage.MapOfflineDownloadControl.value1_mb_9aa814d9', { value1: mb.toFixed(mb < 10 ? 1 : 0) });
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
        accessibilityLabel={i18nT('map:components.MapPage.MapOfflineDownloadControl.skachat_etu_oblast_karty_dlya_oflayna_41a4b025')}
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
              <Text style={styles.title}>{i18nT('map:components.MapPage.MapOfflineDownloadControl.oflayn_karta_343c6379')}</Text>
              <Pressable
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel={i18nT('map:components.MapPage.MapOfflineDownloadControl.zakryt_d59d2d32')}
                hitSlop={10}
              >
                <Feather name="x" size={22} color={colors.text} />
              </Pressable>
            </View>

            <Text style={styles.subtitle}>{i18nT('map:components.MapPage.MapOfflineDownloadControl.tekuschaya_oblast_23bbcebd')}</Text>
            <View style={styles.estimateRow}>
              <Feather name="layers" size={15} color={colors.textMuted} />
              <Text style={styles.estimateText}>
                {bbox ? i18nT('map:components.MapPage.MapOfflineDownloadControl.value1_taylov_value2_4fa1ad44', { value1: tileCount, value2: sizeLabel }) : i18nT('map:components.MapPage.MapOfflineDownloadControl.oblast_nedostupna_b5e1348d')}
              </Text>
            </View>
            {tooLarge && (
              <Text style={styles.warn}>
                {i18nT('map:components.MapPage.MapOfflineDownloadControl.oblast_slishkom_bolshaya_priblizte_kartu_i_p_38e406f5')}</Text>
            )}

            {isBusy ? (
              <>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  {state === 'estimating'
                    ? i18nT('map:components.MapPage.MapOfflineDownloadControl.podgotovka_7266bee4')
                    : `${progress.done} / ${progress.total}`}
                </Text>
                <Pressable
                  style={[styles.actionBtn, styles.cancelBtn]}
                  onPress={cancel}
                  accessibilityRole="button"
                  accessibilityLabel={i18nT('map:components.MapPage.MapOfflineDownloadControl.otmenit_zagruzku_118163e4')}
                >
                  <ActivityIndicator size="small" color={colors.text} />
                  <Text style={styles.cancelText}>{i18nT('map:components.MapPage.MapOfflineDownloadControl.otmenit_a622bf87')}</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={[styles.actionBtn, styles.primaryBtn, (!bbox || tooLarge) && styles.disabledBtn]}
                onPress={handleDownload}
                disabled={!bbox || tooLarge}
                accessibilityRole="button"
                accessibilityLabel={i18nT('map:components.MapPage.MapOfflineDownloadControl.skachat_etu_oblast_ef068bfc')}
              >
                <Feather name="download" size={16} color={colors.textOnPrimary} />
                <Text style={styles.primaryText}>
                  {state === 'done' ? i18nT('map:components.MapPage.MapOfflineDownloadControl.skachano_ac9deca5') : i18nT('map:components.MapPage.MapOfflineDownloadControl.skachat_etu_oblast_ef068bfc')}
                </Text>
              </Pressable>
            )}

            {state === 'error' && (
              <Text style={styles.warn}>{i18nT('map:components.MapPage.MapOfflineDownloadControl.ne_udalos_skachat_oblast_proverte_set_7d6c909b')}</Text>
            )}

            {regions.length > 0 && (
              <>
                <Text style={[styles.subtitle, styles.regionsHeader]}>{i18nT('map:components.MapPage.MapOfflineDownloadControl.sohranennye_oblasti_c5e7250b')}</Text>
                <ScrollView style={styles.regionsList}>
                  {regions.map((region) => (
                    <View key={region.id} style={styles.regionRow}>
                      <View style={styles.regionInfo}>
                        <Text style={styles.regionName} numberOfLines={1}>
                          {region.name}
                        </Text>
                        <Text style={styles.regionMeta}>
                          {region.tileCount} {i18nT('map:components.MapPage.MapOfflineDownloadControl.taylov_f0091788')}{formatBytes(region.bytes)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleDelete(region.id)}
                        accessibilityRole="button"
                        accessibilityLabel={i18nT('map:components.MapPage.MapOfflineDownloadControl.udalit_oblast_value1_0e5a7ce5', { value1: region.name })}
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
