import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Stack, type Href, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import EmptyState from '@/components/ui/EmptyState';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useAuth } from '@/context/AuthContext';
import { useOfflineCatalog } from '@/hooks/useOfflineCatalog';
import { useThemedColors } from '@/hooks/useTheme';
import { formatDate, formatInteger, formatNumber, selectPlural } from '@/i18n/format';
import { useTranslation } from '@/i18n/LocaleProvider';
import type { OfflineContentType, OfflinePackageManifest } from '@/services/offline/types';
import { deleteMapRegionOffline } from '@/services/offline/mapOfflineAdapter';
import { confirmAction } from '@/utils/confirmAction';
import { webTouchScrollStyle } from '@/utils';

type Filter = 'all' | OfflineContentType;

const FILTERS: Array<{ value: Filter; labelKey: 'all' | 'travels' | 'articles' | 'quests' | 'maps' }> = [
  { value: 'all', labelKey: 'all' },
  { value: 'travel', labelKey: 'travels' },
  { value: 'article', labelKey: 'articles' },
  { value: 'quest', labelKey: 'quests' },
  { value: 'map-region', labelKey: 'maps' },
];

export default function OfflineLibraryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { userId } = useAuth();
  const {
    items,
    summary,
    operations,
    isLoading,
    remove,
    setPinned,
    cancelOperation,
    retryOperation,
    clearOperation,
  } = useOfflineCatalog(userId);
  const [filter, setFilter] = useState<Filter>('all');

  const operationKeys = useMemo(() => new Set(operations.map((item) => item.key)), [operations]);
  const filtered = useMemo(
    () => items.filter(
      (item) => !operationKeys.has(item.key) && (filter === 'all' || item.type === filter),
    ),
    [filter, items, operationKeys],
  );
  const filteredOperations = operations.filter(
    (item) => filter === 'all' || item.type === filter,
  );
  const pinned = filtered.filter((item) => item.pinned);
  const recent = filtered.filter((item) => !item.pinned);
  const objectLabel = selectPlural(summary.packageCount, {
    one: t('offline:objectOne'),
    few: t('offline:objectFew'),
    many: t('offline:objectMany'),
    other: t('offline:objectOther'),
  });
  const filterLabels = useMemo(() => ({
    all: t('offline:all'),
    travels: t('offline:travels'),
    articles: t('offline:articles'),
    quests: t('offline:quests'),
    maps: t('offline:maps'),
  }), [t]);

  const formatBytes = useCallback((bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return t('offline:megabytes', {
        value: formatNumber(bytes / (1024 * 1024), { maximumFractionDigits: 1 }),
      });
    }
    if (bytes >= 1024) {
      return t('offline:kilobytes', { value: formatInteger(bytes / 1024) });
    }
    return t('offline:bytes', { value: formatInteger(bytes) });
  }, [t]);

  const handleRemove = useCallback(async (item: OfflinePackageManifest) => {
    const confirmed = await confirmAction({
      title: t('offline:removeTitle'),
      message: t('offline:removeDescription'),
      confirmText: t('offline:remove'),
      cancelText: t('offline:cancel'),
    });
    if (confirmed) {
      if (item.type === 'map-region') await deleteMapRegionOffline(item.sourceId);
      else await remove(item.key);
    }
  }, [remove, t]);

  const renderSection = (title: string, sectionItems: OfflinePackageManifest[]) => {
    if (!sectionItems.length) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {sectionItems.map((item) => (
          <View key={item.key} style={styles.card} testID={`offline-item-${item.key}`}>
            <View style={styles.cardIcon}>
              <Feather
                name={item.type === 'map-region' ? 'map' : item.type === 'quest' ? 'flag' : item.type === 'article' ? 'book-open' : 'navigation'}
                size={20}
                color={colors.primaryDark}
              />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
              {item.status === 'ready' ? (
                <Text style={styles.cardMeta}>
                  {item.pinned ? t('offline:availableOffline') : t('offline:recentAvailable')}
                  {' · '}{formatBytes(item.bytes)}
                </Text>
              ) : (
                <Text style={[styles.cardMeta, item.status === 'failed' && { color: colors.danger }]}>
                  {item.status === 'failed' ? t('offline:saveFailed') : t('offline:saving')}
                </Text>
              )}
              <Text style={styles.cardMeta}>
                {t('offline:updated', {
                  date: formatDate(item.updatedAt ?? item.savedAt, { day: 'numeric', month: 'short' }),
                })}
              </Text>
              <View style={styles.actions}>
                {item.status === 'ready' ? (
                  <>
                    <Button
                      label={t('offline:open')}
                      variant="secondary"
                      size="sm"
                      onPress={() => router.push(item.route as Href)}
                      icon={<Feather name="arrow-right" size={16} color={colors.primaryDark} />}
                    />
                    <Button
                      label={t('offline:update')}
                      variant="ghost"
                      size="sm"
                      onPress={() => router.push(item.route as Href)}
                    />
                    <Button
                      label={item.pinned ? t('offline:unpin') : t('offline:pin')}
                      variant="ghost"
                      size="sm"
                      onPress={() => setPinned(item.key, !item.pinned)}
                    />
                  </>
                ) : (
                  <Button
                    label={t('offline:retry')}
                    variant="secondary"
                    size="sm"
                    onPress={() => router.push(item.route as Href)}
                    icon={<Feather name="refresh-cw" size={16} color={colors.primaryDark} />}
                  />
                )}
                <Button
                  label={t('offline:remove')}
                  variant="danger-outline"
                  size="sm"
                  onPress={() => handleRemove(item)}
                />
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderOperations = () => {
    if (!filteredOperations.length) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('offline:downloads')}</Text>
        {filteredOperations.map((operation) => (
          <View key={operation.key} style={styles.card} testID={`offline-operation-${operation.key}`}>
            <View style={styles.cardIcon}>
              <Feather
                name={operation.status === 'failed' ? 'alert-circle' : 'download-cloud'}
                size={20}
                color={operation.status === 'failed' ? colors.danger : colors.primaryDark}
              />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={2}>{operation.title}</Text>
              <Text style={[styles.cardMeta, operation.status === 'failed' && { color: colors.danger }]}>
                {operation.status === 'failed'
                  ? operation.errorCode === 'OFFLINE_STORAGE_FULL'
                    ? t('offline:storageFull')
                    : t('offline:saveFailed')
                  : t('offline:progress', {
                    done: formatInteger(operation.done),
                    total: formatInteger(operation.total),
                  })}
              </Text>
              <View style={styles.actions}>
                {operation.status === 'failed' ? (
                  <>
                    <Button
                      label={t('offline:retry')}
                      variant="secondary"
                      size="sm"
                      onPress={() => {
                        void retryOperation(operation.key).catch(() => undefined);
                      }}
                    />
                    <Button
                      label={t('offline:remove')}
                      variant="danger-outline"
                      size="sm"
                      onPress={() => clearOperation(operation.key)}
                    />
                  </>
                ) : (
                  <Button
                    label={t('offline:cancel')}
                    variant="ghost"
                    size="sm"
                    onPress={() => cancelOperation(operation.key)}
                  />
                )}
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <Stack.Screen options={{ title: t('offline:title') }} />
      <ScrollView style={webTouchScrollStyle} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t('offline:title')}</Text>
            <Text style={styles.subtitle}>
              {t('offline:summary', {
                count: formatInteger(summary.packageCount),
                objects: objectLabel,
                size: formatBytes(summary.bytes),
              })}
            </Text>
          </View>
          <View style={styles.storageBadge}>
            <Feather name="hard-drive" size={16} color={colors.textMuted} />
            <Text style={styles.storageText}>{t('offline:storage', { size: formatBytes(summary.bytes) })}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((item) => (
            <Chip
              key={item.value}
              label={filterLabels[item.labelKey]}
              selected={filter === item.value}
              onPress={() => setFilter(item.value)}
            />
          ))}
        </ScrollView>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primaryDark} />
            <Text style={styles.cardMeta}>{t('offline:loading')}</Text>
          </View>
        ) : filtered.length === 0 && filteredOperations.length === 0 ? (
          <EmptyState
            icon="download-cloud"
            title={t('offline:emptyTitle')}
            description={t('offline:emptyDescription')}
            variant="empty"
          />
        ) : (
          <>
            {renderOperations()}
            {renderSection(t('offline:saved'), pinned)}
            {renderSection(t('offline:recent'), recent)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.mutedBackground },
  content: {
    width: '100%',
    maxWidth: 840,
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    paddingVertical: DESIGN_TOKENS.spacing.lg,
    paddingBottom: Platform.OS === 'web' ? DESIGN_TOKENS.spacing.xxxl : 120,
    gap: DESIGN_TOKENS.spacing.lg,
    ...Platform.select({
      web: { marginLeft: 'auto', marginRight: 'auto' },
    }),
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  storageBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44,
    paddingHorizontal: 12, borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  storageText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  filters: { gap: DESIGN_TOKENS.spacing.sm, paddingRight: DESIGN_TOKENS.spacing.lg },
  loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 12 },
  section: { gap: DESIGN_TOKENS.spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  card: {
    flexDirection: 'row', gap: 12, padding: 14, borderRadius: DESIGN_TOKENS.radii.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  cardIcon: {
    width: 44, height: 44, borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { flex: 1, minWidth: 0, gap: 3 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cardMeta: { color: colors.textMuted, fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
});
