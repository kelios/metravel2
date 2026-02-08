/**
 * User Point Popup - popup content for user's points
 * Extracted from PointsMap.tsx (was 300+ lines inline)
 * Uses LazyPopup for performance
 * @module components/UserPoints/UserPointPopup
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';
import type { ImportedPoint } from '@/types/userPoints';
import { showToast } from '@/utils/toast';
import ImageCardMedia from '@/components/ui/ImageCardMedia';
import Feather from '@expo/vector-icons/Feather';

interface UserPointPopupProps {
  /**
   * User point data
   */
  point: ImportedPoint;

  /**
   * Drive info (distance, duration from user location)
   */
  driveInfo?: {
    status: 'loading' | 'ok' | 'error';
    distanceKm?: number;
    durationMin?: number;
  };

  /**
   * Edit handler
   */
  onEdit?: (point: ImportedPoint) => void;

  /**
   * Delete handler
   */
  onDelete?: (point: ImportedPoint) => void;

  /**
   * Copy coordinates handler
   */
  onCopyCoords?: () => void;
}

/**
 * Popup content for user's points
 *
 * Features:
 * - Compact and readable UI
 * - Photo preview
 * - Drive info (distance, time)
 * - Quick actions (edit, delete, share)
 * - External map links
 * - Copy coordinates
 *
 * @example
 * ```typescript
 * <UserPointPopup
 *   point={userPoint}
 *   driveInfo={{ status: 'ok', distanceKm: 15, durationMin: 20 }}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 * />
 * ```
 */
export const UserPointPopup: React.FC<UserPointPopupProps> = ({
  point,
  driveInfo,
  onEdit,
  onDelete,
  onCopyCoords,
}) => {
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Extract data
  const lat = Number(point.latitude);
  const lng = Number(point.longitude);

  const coordsText = useMemo(() => {
    return Number.isFinite(lat) && Number.isFinite(lng)
      ? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
      : '';
  }, [lat, lng]);

  const categoryLabel = useMemo(() => {
    return point.category || '';
  }, [point]);

  const photoUrl = useMemo(() => {
    return point.photo || '';
  }, [point]);

  // Handlers
  const handleCopyCoords = useCallback(() => {
    if (!coordsText) return;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(coordsText);
        void showToast({
          type: 'success',
          text1: 'Скопировано',
          position: 'bottom'
        });
      }
    } catch {
      // noop
    }

    onCopyCoords?.();
  }, [coordsText, onCopyCoords]);

  const handleShareTelegram = useCallback(() => {
    if (!coordsText) return;

    try {
      const text = point.name || coordsText;
      const url = `https://www.google.com/maps?q=${encodeURIComponent(coordsText)}`;
      const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

      if (typeof window !== 'undefined') {
        window.open(tgUrl, '_blank', 'noopener,noreferrer');
      }
    } catch {
      // noop
    }
  }, [coordsText, point.name]);

  const openExternalMap = useCallback((mapUrl: string) => {
    try {
      if (typeof window !== 'undefined') {
        window.open(mapUrl, '_blank', 'noopener,noreferrer');
      }
    } catch {
      // noop
    }
  }, []);

  const mapLinks = useMemo(() => [
    {
      key: 'Google',
      url: `https://www.google.com/maps?q=${encodeURIComponent(coordsText)}`
    },
    {
      key: 'Apple',
      url: `https://maps.apple.com/?q=${encodeURIComponent(coordsText)}`
    },
    {
      key: 'Яндекс',
      url: `https://yandex.ru/maps/?pt=${encodeURIComponent(`${lng},${lat}`)}&z=16&l=map`
    },
    {
      key: 'OSM',
      url: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`
    },
  ], [coordsText, lat, lng]);

  const markerColor = point.color || colors.backgroundTertiary;

  return (
    <View style={styles.container}>
      {/* Header with color accent */}
      <View style={[styles.header, { borderLeftColor: markerColor }]}>
        {/* Photo */}
        {photoUrl ? (
          <ImageCardMedia
            source={{ uri: photoUrl }}
            style={styles.photo}
          />
        ) : null}

        <View style={styles.headerContent}>
          {/* Title */}
          <Text style={styles.title} numberOfLines={2}>
            {point.name || 'Без названия'}
          </Text>

          {/* Category */}
          {categoryLabel ? (
            <Text style={styles.category} numberOfLines={1}>
              {categoryLabel}
            </Text>
          ) : null}

          {/* Address */}
          {point.address ? (
            <Text style={styles.address} numberOfLines={2}>
              {point.address}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Drive info */}
      {driveInfo?.status === 'ok' && (
        <View style={styles.driveInfo}>
          <Feather name="navigation" size={14} color={colors.primary} />
          <Text style={styles.driveText}>
            {driveInfo.distanceKm?.toFixed(1)} км • {driveInfo.durationMin} мин
          </Text>
        </View>
      )}

      {/* Coordinates */}
      <Pressable onPress={handleCopyCoords} style={styles.coordsRow}>
        <Text style={styles.coordsText}>{coordsText}</Text>
        <Feather name="copy" size={14} color={colors.textMuted} />
      </Pressable>

      {/* Actions */}
      <View style={styles.actions}>
        {onEdit && (
          <Pressable
            onPress={() => onEdit(point)}
            style={[styles.actionButton, styles.editButton]}
          >
            <Feather name="edit-2" size={16} color={colors.primary} />
            <Text style={styles.actionText}>Редактировать</Text>
          </Pressable>
        )}

        {onDelete && (
          <Pressable
            onPress={() => onDelete(point)}
            style={[styles.actionButton, styles.deleteButton]}
          >
            <Feather name="trash-2" size={16} color={colors.danger} />
            <Text style={[styles.actionText, { color: colors.danger }]}>Удалить</Text>
          </Pressable>
        )}
      </View>

      {/* External maps */}
      <View style={styles.mapLinks}>
        <Text style={styles.mapLinksTitle}>Открыть в:</Text>
        <View style={styles.mapLinksRow}>
          {mapLinks.map(link => (
            <Pressable
              key={link.key}
              onPress={() => openExternalMap(link.url)}
              style={styles.mapLink}
            >
              <Text style={styles.mapLinkText}>{link.key}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Share */}
      <Pressable onPress={handleShareTelegram} style={styles.shareButton}>
        <Feather name="send" size={14} color={colors.primary} />
        <Text style={[styles.actionText, { color: colors.primaryText }]}>
          Поделиться в Telegram
        </Text>
      </Pressable>
    </View>
  );
};

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    width: 300,
    padding: 12,
  },
  header: {
    borderLeftWidth: 4,
    paddingLeft: 12,
    marginBottom: 12,
  },
  photo: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
  },
  headerContent: {
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600' as any,
    color: colors.text,
  },
  category: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  address: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  driveInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    backgroundColor: colors.surface,
    borderRadius: 6,
    marginBottom: 8,
  },
  driveText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500' as any,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: colors.surface,
    borderRadius: 6,
    marginBottom: 12,
  },
  coordsText: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  editButton: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  deleteButton: {
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500' as any,
    color: colors.text,
  },
  mapLinks: {
    marginBottom: 12,
  },
  mapLinksTitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 6,
  },
  mapLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  mapLink: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapLinkText: {
    fontSize: 11,
    color: colors.primaryText,
    fontWeight: '500' as any,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
});

export default React.memo(UserPointPopup);
