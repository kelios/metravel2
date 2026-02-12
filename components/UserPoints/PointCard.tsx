import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Share, Alert, ActionSheetIOS } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import type { ImportedPoint } from '@/types/userPoints';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';
import IconButton from '@/components/ui/IconButton';
import CardActionPressable from '@/components/ui/CardActionPressable';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import { showToast } from '@/utils/toast';
import { openExternalUrl, openExternalUrlInNewTab } from '@/utils/externalLinks';

interface PointCardProps {
  point: ImportedPoint;
  onPress?: (point: ImportedPoint) => void;
  onEdit?: (point: ImportedPoint) => void;
  onDelete?: (point: ImportedPoint) => void;
  layout?: 'list' | 'grid';
  selectionMode?: boolean;
  selected?: boolean;
  active?: boolean;
  driveInfo?:
    | null
    | { status: 'loading' }
    | { status: 'ok'; distanceKm: number; durationMin: number }
    | { status: 'error' };
  onToggleSelect?: (point: ImportedPoint) => void;
}

export const PointCard: React.FC<PointCardProps> = React.memo(({
  point,
  onPress,
  onEdit,
  onDelete,
  layout = 'list',
  selectionMode,
  selected,
  active,
  driveInfo,
  onToggleSelect,
}) => {
  const colors = useThemedColors();
  const isSitePoint = React.useMemo(() => {
    const tags = (point as any)?.tags;
    return Boolean(String(tags?.travelUrl ?? '').trim() || String(tags?.articleUrl ?? '').trim());
  }, [point]);
  const markerColor = String(point.color || '').trim() || colors.backgroundTertiary;
  const hasCoords = Number.isFinite(point.latitude) && Number.isFinite(point.longitude);
  const coordsText = hasCoords
    ? `${Number(point.latitude).toFixed(6)}, ${Number(point.longitude).toFixed(6)}`
    : '';
  const countryLabel = React.useMemo(() => {
    try {
      const direct = String((point as any)?.country ?? '').trim();
      if (direct) return direct;
      const address = String((point as any)?.address ?? '').trim();
      if (!address) return '';
      const parts = address
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2) return parts[parts.length - 1];
      return '';
    } catch {
      return '';
    }
  }, [point]);
  const categoryLabel = React.useMemo(() => {
    const names = (point as any)?.categoryNames;
    if (Array.isArray(names) && names.length > 0) {
      const cleaned = names
        .map((v: any) => String(v).trim())
        .filter(Boolean)
        .filter((name) => !countryLabel || name.localeCompare(countryLabel, undefined, { sensitivity: 'accent' }) !== 0);
      return cleaned.join(', ');
    }
    const ids = (point as any)?.categoryIds;
    if (Array.isArray(ids) && ids.length > 0) {
      const cleaned = ids
        .map((v: any) => String(v).trim())
        .filter(Boolean)
        .filter((name) => !countryLabel || name.localeCompare(countryLabel, undefined, { sensitivity: 'accent' }) !== 0);
      return cleaned.join(', ');
    }
    const legacy = String((point as any)?.category ?? '').trim();
    if (!legacy) return '';
    if (countryLabel && legacy.localeCompare(countryLabel, undefined, { sensitivity: 'accent' }) === 0) {
      return '';
    }
    return legacy;
  }, [countryLabel, point]);
  const showAddress = React.useMemo(() => {
    const addr = String(point.address ?? '').trim();
    if (!addr) return false;
    const name = String(point.name ?? '').trim();
    if (!name) return true;
    const addrLower = addr.toLowerCase();
    const nameLower = name.toLowerCase();
    if (addrLower.startsWith(nameLower) || nameLower.startsWith(addrLower)) return false;
    return true;
  }, [point.address, point.name]);
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const photoUrl = React.useMemo(() => {
    const v = (point as any)?.photo;
    const s = typeof v === 'string' ? v.trim() : '';
    if (s) return s;

    const legacy = (point as any)?.photos;
    if (typeof legacy === 'string' && legacy.trim()) return legacy.trim();
    if (legacy && typeof legacy === 'object') {
      const knownKeys = ['url', 'src', 'photo', 'image', 'thumb', 'thumbnail', 'travelImageThumbUrl'];
      for (const k of knownKeys) {
        const val = (legacy as any)?.[k];
        if (typeof val === 'string' && val.trim()) return val.trim();
      }
      for (const val of Object.values(legacy as Record<string, unknown>)) {
        if (typeof val === 'string' && val.trim()) return val.trim();
      }
    }

    return null;
  }, [point]);

  const showActions = !selectionMode && (typeof onEdit === 'function' || typeof onDelete === 'function');

  const ActionButton = ({
    label,
    icon,
    onActivate,
  }: {
    label: string;
    icon: 'edit-2' | 'trash-2' | 'copy' | 'map' | 'map-pin' | 'navigation' | 'send';
    onActivate?: () => void;
  }) => {
    return (
      <CardActionPressable
        style={styles.webActionButton}
        accessibilityLabel={label}
        onPress={onActivate}
        title={label}
      >
        <Feather name={icon} size={14} color={colors.text} />
      </CardActionPressable>
    );
  };

  const copyCoords = React.useCallback(async () => {
    if (!hasCoords) return;

    const text = coordsText;
    try {
      if (
        Platform.OS === 'web' &&
        typeof window !== 'undefined' &&
        (window as any).navigator?.clipboard?.writeText
      ) {
        await (window as any).navigator.clipboard.writeText(text);
        void showToast({ type: 'success', text1: 'Скопировано', position: 'bottom' });
        return;
      }

      await Clipboard.setStringAsync(text);
      void showToast({ type: 'success', text1: 'Скопировано', position: 'bottom' });
    } catch {
      // ignore
    }
  }, [coordsText, hasCoords]);

  const mapUrls = React.useMemo(() => {
    if (!hasCoords) return null;
    const lat = Number(point.latitude);
    const lng = Number(point.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      google: `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`,
      yandex: `https://yandex.ru/maps/?pt=${encodeURIComponent(`${lng},${lat}`)}&z=16&l=map`,
      osm: `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(lat))}&mlon=${encodeURIComponent(String(lng))}#map=16/${encodeURIComponent(String(lat))}/${encodeURIComponent(String(lng))}`,
      apple: `https://maps.apple.com/?q=${encodeURIComponent(`${lat},${lng}`)}`,
    };
  }, [hasCoords, point.latitude, point.longitude]);

  const openExternalLink = React.useCallback(async (url: string) => {
    try {
      if (Platform.OS === 'web') {
        await openExternalUrlInNewTab(url);
        return;
      }

      await openExternalUrl(url);
    } catch {
      // ignore
    }
  }, []);

  const openInMaps = React.useCallback(async () => {
    if (!mapUrls) return;

    if (Platform.OS === 'web') {
      await openExternalLink(mapUrls.google);
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Google Maps', 'Яндекс.Карты', 'OpenStreetMap', 'Отмена'],
          cancelButtonIndex: 3,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) void openExternalLink(mapUrls.google);
          if (buttonIndex === 1) void openExternalLink(mapUrls.yandex);
          if (buttonIndex === 2) void openExternalLink(mapUrls.osm);
        }
      );
      return;
    }

    Alert.alert('Открыть в картах', undefined, [
      { text: 'Google Maps', onPress: () => void openExternalLink(mapUrls.google) },
      { text: 'Яндекс.Карты', onPress: () => void openExternalLink(mapUrls.yandex) },
      { text: 'OpenStreetMap', onPress: () => void openExternalLink(mapUrls.osm) },
      { text: 'Отмена', style: 'cancel' },
    ]);
  }, [mapUrls, openExternalLink]);

  const shareToTelegram = React.useCallback(async () => {
    if (!hasCoords) return;

    const text = String(point?.name ?? '') || coordsText;
    const url = `https://www.google.com/maps?q=${encodeURIComponent(coordsText)}`;
    const tg = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

    try {
      if (Platform.OS === 'web') {
        await openExternalUrlInNewTab(tg);
        return;
      }

      // Try native share first; fall back to opening Telegram share URL.
      try {
        await Share.share({ message: `${text}\n${url}` });
        return;
      } catch {
        // noop
      }

      await openExternalUrl(tg);
    } catch {
      // ignore
    }
  }, [coordsText, hasCoords, point?.name]);

  return (
    <TouchableOpacity
      testID={point?.id != null ? `userpoints-point-card-${String(point.id)}` : undefined}
      style={[
        styles.container,
        layout === 'grid' ? styles.containerGrid : null,
        active ? styles.containerActive : null,
      ]}
      onPress={() => {
        if (selectionMode) {
          onToggleSelect?.(point);
          return;
        }
        onPress?.(point);
      }}
      activeOpacity={0.7}
    >
      <View testID="color-indicator" style={[styles.colorIndicator, { backgroundColor: markerColor }]} />

      {photoUrl ? (
        <View style={[styles.photoWrap, layout === 'grid' ? styles.photoWrapGrid : null]}>
          <ImageCardMedia
            src={photoUrl}
            height={layout === 'grid' ? 120 : 84}
            width={layout === 'grid' ? '100%' : 84}
            borderRadius={DESIGN_TOKENS.radii.md}
            fit="contain"
            blurBackground
            blurRadius={12}
          />
        </View>
      ) : null}

      <View
        style={[
          styles.content,
          selectionMode ? styles.contentSelectionMode : null,
        ]}
      >
        {selectionMode ? (
          <View style={[styles.selectionBadge, selected ? styles.selectionBadgeSelected : styles.selectionBadgeUnselected]}>
            <Feather
              name={selected ? 'check-circle' : 'circle'}
              size={18}
              color={selected ? colors.textOnPrimary : colors.textMuted}
            />
          </View>
        ) : null}

        <View style={styles.headerRow}>
          <View style={styles.headerMain}>
            <Text style={styles.name} numberOfLines={2}>
              {point.name}
            </Text>
          </View>

          {showActions ? (
            <View style={styles.headerActions}>
              {typeof onEdit === 'function' ? (
                Platform.OS === 'web' ? (
                  <ActionButton label="Редактировать" icon="edit-2" onActivate={() => onEdit(point)} />
                ) : (
                  <IconButton
                    icon={<Feather name="edit-2" size={16} color={colors.text} />}
                    label="Редактировать"
                    onPress={() => onEdit(point)}
                    size="sm"
                  />
                )
              ) : null}

              {typeof onDelete === 'function' ? (
                Platform.OS === 'web' ? (
                  <ActionButton label="Удалить" icon="trash-2" onActivate={() => onDelete(point)} />
                ) : (
                  <IconButton
                    icon={<Feather name="trash-2" size={16} color={colors.text} />}
                    label="Удалить"
                    onPress={() => onDelete(point)}
                    size="sm"
                  />
                )
              ) : null}
            </View>
          ) : null}
        </View>
        
        {point.description && (
          <Text style={styles.description} numberOfLines={2}>
            {point.description}
          </Text>
        )}

        <View style={styles.metadata}>
          {hasCoords && categoryLabel ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{categoryLabel}</Text>
            </View>
          ) : null}
          {!isSitePoint && countryLabel ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{countryLabel}</Text>
            </View>
          ) : null}
        </View>
        
        {showAddress ? (
          <Text style={styles.address} numberOfLines={1}>
            {point.address}
          </Text>
        ) : null}

        {hasCoords ? (
          <View style={styles.coordsRow}>
            <Text style={styles.coordsText} numberOfLines={1}>
              {coordsText}
            </Text>

            <View style={styles.coordsActionsRow as any}>
              {Platform.OS === 'web' ? (
                <>
                  <ActionButton label="Копировать координаты" icon="copy" onActivate={copyCoords} />
                  <ActionButton label="Поделиться в Telegram" icon="send" onActivate={() => void shareToTelegram()} />
                  {mapUrls ? (
                    <ActionButton label="Открыть в картах" icon="navigation" onActivate={() => void openExternalLink(mapUrls.google)} />
                  ) : null}
                </>
              ) : (
                <>
                  <IconButton
                    icon={<Feather name="copy" size={14} color={colors.textMuted} />}
                    label="Копировать координаты"
                    onPress={() => void copyCoords()}
                    size="sm"
                  />
                  <IconButton
                    icon={<Feather name="send" size={14} color={colors.textMuted} />}
                    label="Поделиться в Telegram"
                    onPress={() => void shareToTelegram()}
                    size="sm"
                  />
                  {mapUrls ? (
                    <IconButton
                      icon={<Feather name="navigation" size={14} color={colors.textMuted} />}
                      label="Открыть в картах"
                      onPress={() => void openInMaps()}
                      size="sm"
                    />
                  ) : null}
                </>
              )}
            </View>
          </View>
        ) : null}
        
        {typeof point.rating === 'number' && Number.isFinite(point.rating) && (
          <Text style={styles.rating}>
            {point.rating.toFixed(1)}
          </Text>
        )}

        {active && !selectionMode && driveInfo?.status === 'ok' ? (
          <View style={styles.driveInfoRow}>
            <Text style={styles.driveInfoText}>
              На машине: {driveInfo.distanceKm} км · ~{driveInfo.durationMin} мин
            </Text>
          </View>
        ) : active && !selectionMode && driveInfo?.status === 'loading' ? (
          <View style={styles.driveInfoRow}>
            <Text style={styles.driveInfoText}>Считаю маршрут…</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    marginHorizontal: DESIGN_TOKENS.spacing.lg,
    marginBottom: DESIGN_TOKENS.spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...(Platform.OS === 'web' ? ({ boxShadow: DESIGN_TOKENS.shadows.card } as any) : null),
  },
  containerActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  containerGrid: {
    marginHorizontal: 0,
    marginBottom: 0,
    flex: 1,
    alignSelf: 'stretch',
  },
  colorIndicator: {
    width: 6,
  },
  photoWrap: {
    width: 84,
    padding: DESIGN_TOKENS.spacing.sm,
  },
  photoWrapGrid: {
    width: 140,
    padding: DESIGN_TOKENS.spacing.sm,
  },
  content: {
    flex: 1,
    padding: DESIGN_TOKENS.spacing.md,
  },
  contentSelectionMode: {
    paddingRight: DESIGN_TOKENS.spacing.md + 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
    flexShrink: 0,
  },
  webActionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  selectionBadge: {
    position: 'absolute',
    top: DESIGN_TOKENS.spacing.sm,
    right: DESIGN_TOKENS.spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectionBadgeSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectionBadgeUnselected: {
    backgroundColor: colors.surface,
  },
  name: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '700' as any,
    color: colors.text,
    lineHeight: 24,
  },
  description: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: DESIGN_TOKENS.spacing.sm,
    lineHeight: 20,
  },
  metadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  badge: {
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 4,
    borderRadius: DESIGN_TOKENS.radii.sm,
    marginRight: DESIGN_TOKENS.spacing.xs,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  badgeText: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: colors.textMuted,
  },
  address: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: DESIGN_TOKENS.spacing.xs,
    gap: 6,
  },
  coordsActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  coordsText: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: colors.textMuted,
    flex: 1,
    minWidth: 0,
  },
  rating: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
  },
  driveInfoRow: {
    marginTop: DESIGN_TOKENS.spacing.sm,
    paddingTop: DESIGN_TOKENS.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    opacity: 0.95,
  },
  driveInfoText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
  },
});
