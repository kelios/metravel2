import { useCallback, useMemo, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Button from '@/components/ui/Button';
import { fetchOfflineMapPoints } from '@/api/mapOffline';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useOfflineCatalog } from '@/hooks/useOfflineCatalog';
import { useThemedColors } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n/LocaleProvider';
import {
  buildMapRegionId,
  deleteMapRegionOffline,
  readMapRegionOffline,
  saveMapRegionOffline,
} from '@/services/offline/mapOfflineAdapter';
import type { OfflineBBox, OfflineRegion } from '@/utils/mapTileCache';

interface MapOfflineDownloadControlProps {
  bbox: OfflineBBox | null;
  bottomInset?: number;
}

const WEB_MIN_Z = 0;
const WEB_MAX_Z = 0;

function MapOfflineDownloadControlWeb({
  bbox,
  bottomInset = 0,
}: MapOfflineDownloadControlProps) {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { items } = useOfflineCatalog();
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<'idle' | 'downloading' | 'done' | 'error'>('idle');
  const [pointCount, setPointCount] = useState(0);
  const savedRegions = items.filter((item) => item.type === 'map-region' && item.status === 'ready');

  const save = useCallback(async () => {
    if (!bbox || state === 'downloading') return;
    setState('downloading');
    try {
      const id = buildMapRegionId(bbox, WEB_MIN_Z, WEB_MAX_Z);
      const previous = await readMapRegionOffline(id);
      const pointIndex = await fetchOfflineMapPoints(bbox, {
        etag: previous?.etag,
        cachedPoints: previous?.points,
      });
      const now = Date.now();
      const region: OfflineRegion = {
        id,
        name: t('offline:mapRegionTitle'),
        bbox,
        minZ: WEB_MIN_Z,
        maxZ: WEB_MAX_Z,
        // Mobile web keeps the point index in IndexedDB inside the loaded
        // shell. It does not promise tile/HTML reload caching without a Service
        // Worker, so its truthful tile inventory is zero.
        tileCount: 0,
        bytes: 0,
        savedAt: now,
      };
      await saveMapRegionOffline(region, pointIndex.points, pointIndex.etag);
      setPointCount(pointIndex.points.length);
      setState('done');
    } catch {
      setState('error');
    }
  }, [bbox, state, t]);

  return (
    <>
      <Pressable
        style={[styles.fab, { bottom: bottomInset + DESIGN_TOKENS.spacing.md }]}
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={t('offline:saveMapRegion')}
        testID="map-offline-download-fab"
      >
        <Feather name="download-cloud" size={20} color={colors.textOnPrimary} />
      </Pressable>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>{t('offline:mapRegionTitle')}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('offline:close')}
                onPress={() => setVisible(false)}
                style={styles.close}
              >
                <Feather name="x" size={22} color={colors.text} />
              </Pressable>
            </View>
            <Text style={styles.description}>{t('offline:webMapRegionDescription')}</Text>
            {state === 'done' ? (
              <Text style={styles.success}>
                {t('offline:mapPointsSaved', { count: pointCount })}
              </Text>
            ) : null}
            {state === 'error' ? (
              <Text style={styles.error}>{t('offline:saveFailed')}</Text>
            ) : null}
            <Button
              testID="map-offline-download-submit"
              label={state === 'done' ? t('offline:update') : t('offline:saveMapRegion')}
              onPress={() => void save()}
              loading={state === 'downloading'}
              disabled={!bbox}
              icon={<Feather name="download" size={16} color={colors.textOnPrimary} />}
            />
            {!bbox ? <Text style={styles.error}>{t('offline:mapRegionUnavailable')}</Text> : null}
            {savedRegions.length ? (
              <View style={styles.savedList}>
                <Text style={styles.savedTitle}>{t('offline:savedRegions')}</Text>
                {savedRegions.map((item) => (
                  <View key={item.key} style={styles.savedRow}>
                    <View style={styles.savedText}>
                      <Text style={styles.savedName} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.description}>{t('offline:availableOffline')}</Text>
                    </View>
                    <Button
                      label={t('offline:remove')}
                      variant="danger-outline"
                      size="sm"
                      onPress={() => {
                        void deleteMapRegionOffline(item.sourceId);
                      }}
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

export const MapOfflineDownloadControl = MapOfflineDownloadControlWeb;
export default MapOfflineDownloadControlWeb;

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  fab: {
    position: 'absolute',
    right: DESIGN_TOKENS.spacing.md,
    width: 44,
    height: 44,
    borderRadius: DESIGN_TOKENS.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    zIndex: 1010,
    ...colors.shadows.medium,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: DESIGN_TOKENS.radii.xl,
    borderTopRightRadius: DESIGN_TOKENS.radii.xl,
    padding: DESIGN_TOKENS.spacing.lg,
    gap: DESIGN_TOKENS.spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  description: { color: colors.textMuted, fontSize: 13 },
  success: { color: colors.success, fontSize: 13, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 13 },
  savedList: { gap: DESIGN_TOKENS.spacing.sm },
  savedTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  savedRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: DESIGN_TOKENS.spacing.sm,
  },
  savedText: { flex: 1, minWidth: 0 },
  savedName: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
