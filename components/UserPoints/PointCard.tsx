import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Pressable, Linking, Share, Alert, ActionSheetIOS } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import type { ImportedPoint } from '@/types/userPoints';
import { STATUS_LABELS } from '@/types/userPoints';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

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
  const WebClickable = View as any;
  const markerColor = String(point.color || '').trim() || colors.backgroundTertiary;
  const hasCoords = Number.isFinite(point.latitude) && Number.isFinite(point.longitude);
  const coordsText = hasCoords
    ? `${Number(point.latitude).toFixed(6)}, ${Number(point.longitude).toFixed(6)}`
    : '';
  const categoryLabel = String((point as any)?.category ?? '').trim();
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
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const showActions = !selectionMode && (typeof onEdit === 'function' || typeof onDelete === 'function');

  const statusLabel = String((STATUS_LABELS as any)?.[point.status] ?? '').trim();

  const WebAction = ({
    label,
    icon,
    onActivate,
  }: {
    label: string;
    icon: 'edit-2' | 'trash-2' | 'copy' | 'map' | 'map-pin' | 'navigation' | 'send';
    onActivate?: () => void;
  }) => {
    if (Platform.OS === 'web') {
      const activate = (e?: any) => {
        try {
          e?.preventDefault?.();
          e?.stopPropagation?.();
        } catch {
          // noop
        }
        onActivate?.();
      };

      return (
        <WebClickable
          style={styles.webActionButton}
          accessibilityRole="button"
          accessibilityLabel={label}
          {...({
            role: 'button',
            tabIndex: 0,
            title: label,
            'data-card-action': 'true',
          } as any)}
          onClick={activate}
          onPress={activate}
          onKeyDown={(e: any) => {
            if (e?.key !== 'Enter' && e?.key !== ' ') return;
            activate(e);
          }}
        >
          <Feather name={icon} size={16} color={colors.text} />
        </WebClickable>
      );
    }

    return (
      <Pressable
        style={styles.webActionButton}
        accessibilityRole="button"
        accessibilityLabel={label}
        {...({
          role: 'button',
          tabIndex: 0,
          title: label,
          'data-card-action': 'true',
        } as any)}
        onPress={(e) => {
          try {
            (e as any)?.preventDefault?.();
            (e as any)?.stopPropagation?.();
          } catch {
            // noop
          }
          onActivate?.();
        }}
      >
        <Feather name={icon} size={16} color={colors.text} />
      </Pressable>
    );
  };

  const WebChip = ({
    label,
    onActivate,
  }: {
    label: string;
    onActivate?: () => void;
  }) => {
    if (Platform.OS === 'web') {
      const activate = (e?: any) => {
        try {
          e?.preventDefault?.();
          e?.stopPropagation?.();
        } catch {
          // noop
        }
        onActivate?.();
      };

      return (
        <WebClickable
          style={styles.webChipButton}
          accessibilityRole="button"
          accessibilityLabel={label}
          {...({
            role: 'button',
            tabIndex: 0,
            title: label,
            'data-card-action': 'true',
          } as any)}
          onClick={activate}
          onPress={activate}
          onKeyDown={(e: any) => {
            if (e?.key !== 'Enter' && e?.key !== ' ') return;
            activate(e);
          }}
        >
          <Text style={styles.webChipText}>{label}</Text>
        </WebClickable>
      );
    }

    return (
      <Pressable
        style={styles.webChipButton}
        accessibilityRole="button"
        accessibilityLabel={label}
        {...({
          role: 'button',
          tabIndex: 0,
          title: label,
          'data-card-action': 'true',
        } as any)}
        onPress={(e) => {
          try {
            (e as any)?.preventDefault?.();
            (e as any)?.stopPropagation?.();
          } catch {
            // noop
          }
          onActivate?.();
        }}
      >
        <Text style={styles.webChipText}>{label}</Text>
      </Pressable>
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
        return;
      }

      await Clipboard.setStringAsync(text);
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

  const openExternalUrl = React.useCallback(async (url: string) => {
    try {
      if (Platform.OS === 'web') {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }

      await Linking.openURL(url);
    } catch {
      // ignore
    }
  }, []);

  const openInMaps = React.useCallback(async () => {
    if (!mapUrls) return;

    if (Platform.OS === 'web') {
      await openExternalUrl(mapUrls.google);
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Google Maps', 'Яндекс.Карты', 'OpenStreetMap', 'Отмена'],
          cancelButtonIndex: 3,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) void openExternalUrl(mapUrls.google);
          if (buttonIndex === 1) void openExternalUrl(mapUrls.yandex);
          if (buttonIndex === 2) void openExternalUrl(mapUrls.osm);
        }
      );
      return;
    }

    Alert.alert('Открыть в картах', undefined, [
      { text: 'Google Maps', onPress: () => void openExternalUrl(mapUrls.google) },
      { text: 'Яндекс.Карты', onPress: () => void openExternalUrl(mapUrls.yandex) },
      { text: 'OpenStreetMap', onPress: () => void openExternalUrl(mapUrls.osm) },
      { text: 'Отмена', style: 'cancel' },
    ]);
  }, [mapUrls, openExternalUrl]);

  const shareToTelegram = React.useCallback(async () => {
    if (!hasCoords) return;

    const text = String(point?.name ?? '') || coordsText;
    const url = `https://www.google.com/maps?q=${encodeURIComponent(coordsText)}`;
    const tg = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

    try {
      if (Platform.OS === 'web') {
        window.open(tg, '_blank', 'noopener,noreferrer');
        return;
      }

      // Try native share first; fall back to opening Telegram share URL.
      try {
        await Share.share({ message: `${text}\n${url}` });
        return;
      } catch {
        // noop
      }

      await Linking.openURL(tg);
    } catch {
      // ignore
    }
  }, [coordsText, hasCoords, point?.name]);

  return (
    <TouchableOpacity
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
            {statusLabel ? (
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{statusLabel}</Text>
              </View>
            ) : null}
          </View>

          {showActions ? (
            <View style={styles.headerActions}>
              {typeof onEdit === 'function' ? (
                Platform.OS === 'web' ? (
                  <WebAction label="Редактировать" icon="edit-2" onActivate={() => onEdit(point)} />
                ) : (
                  <TouchableOpacity
                    style={styles.actionButton}
                    accessibilityRole="button"
                    accessibilityLabel="Редактировать"
                    onPress={() => onEdit(point)}
                  >
                    <Feather name="edit-2" size={16} color={colors.text} />
                  </TouchableOpacity>
                )
              ) : null}

              {typeof onDelete === 'function' ? (
                Platform.OS === 'web' ? (
                  <WebAction label="Удалить" icon="trash-2" onActivate={() => onDelete(point)} />
                ) : (
                  <TouchableOpacity
                    style={styles.actionButton}
                    accessibilityRole="button"
                    accessibilityLabel="Удалить"
                    onPress={() => onDelete(point)}
                  >
                    <Feather name="trash-2" size={16} color={colors.text} />
                  </TouchableOpacity>
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
          {countryLabel ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{countryLabel}</Text>
            </View>
          ) : null}
        </View>
        
        {point.address && (
          <Text style={styles.address} numberOfLines={1}>
            {point.address}
          </Text>
        )}

        {hasCoords ? (
          <View>
            <View style={styles.sectionDivider} />

            <View style={styles.coordsRow}>
              <View style={styles.coordsBox}>
                <Text style={styles.coordsText} numberOfLines={2}>
                  {coordsText}
                </Text>
              </View>

              {Platform.OS === 'web' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 } as any}>
                  <WebAction label="Копировать координаты" icon="copy" onActivate={copyCoords} />
                  <WebAction label="Поделиться в Telegram" icon="send" onActivate={() => void shareToTelegram()} />
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity
                    style={styles.copyButton}
                    accessibilityRole="button"
                    accessibilityLabel="Копировать координаты"
                    onPress={(e) => {
                      try {
                        (e as any)?.preventDefault?.();
                        (e as any)?.stopPropagation?.();
                      } catch {
                        // noop
                      }
                      void copyCoords();
                    }}
                  >
                    <Feather name="copy" size={16} color={colors.textMuted} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.copyButton}
                    accessibilityRole="button"
                    accessibilityLabel="Поделиться в Telegram"
                    onPress={(e) => {
                      try {
                        (e as any)?.preventDefault?.();
                        (e as any)?.stopPropagation?.();
                      } catch {
                        // noop
                      }
                      void shareToTelegram();
                    }}
                  >
                    <Feather name="send" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {Platform.OS === 'web' && mapUrls ? (
              <View style={{ marginTop: 10 } as any}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' } as any}>
                  <WebChip label="Google" onActivate={() => void openExternalUrl(mapUrls.google)} />
                  <WebChip label="Apple" onActivate={() => void openExternalUrl(mapUrls.apple)} />
                  <WebChip label="Яндекс" onActivate={() => void openExternalUrl(mapUrls.yandex)} />
                  <WebChip label="OSM" onActivate={() => void openExternalUrl(mapUrls.osm)} />
                </View>
              </View>
            ) : null}

            {Platform.OS !== 'web' && mapUrls ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                <TouchableOpacity
                  style={styles.copyButton}
                  accessibilityRole="button"
                  accessibilityLabel="Открыть в картах"
                  onPress={(e) => {
                    try {
                      (e as any)?.preventDefault?.();
                      (e as any)?.stopPropagation?.();
                    } catch {
                      // noop
                    }
                    void openInMaps();
                  }}
                >
                  <Feather name="map-pin" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            ) : null}
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
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  webActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: colors.primarySoft,
    borderRadius: DESIGN_TOKENS.radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  statusPillText: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '600' as any,
    color: colors.text,
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
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: DESIGN_TOKENS.spacing.sm,
    marginBottom: DESIGN_TOKENS.spacing.sm,
    opacity: 0.8,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: DESIGN_TOKENS.spacing.xs,
  },
  coordsBox: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: DESIGN_TOKENS.spacing.sm,
  },
  coordsText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    flexShrink: 1,
  },
  copyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: DESIGN_TOKENS.spacing.xs,
  },
  webChipButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  webChipText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.text,
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
