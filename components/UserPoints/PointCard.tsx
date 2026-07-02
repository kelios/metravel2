import React from 'react';
import { View, Text, Platform, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import type { ImportedPoint } from '@/types/userPoints';
import { useThemedColors } from '@/hooks/useTheme';
import { createStyles } from './PointCard.styles';
import IconButton from '@/components/ui/IconButton';
import CardActionPressable from '@/components/ui/CardActionPressable';
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import PointNavigationMenu from '@/components/navigation/PointNavigationMenu';
import { showToast } from '@/utils/toast';

// Точки, импортированные через обратный геокодинг, иногда приходят с name,
// равным полному адресу Nominatim ("3, Рыночная площадь, Old Town, Краков, ...").
// Для заголовка карточки берём первый осмысленный сегмент такого адреса,
// а полную строку показываем вторичной строкой.
const looksLikeFullAddress = (value: string): boolean => {
  const parts = value.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length >= 3;
};

const firstMeaningfulSegment = (value: string): string => {
  const parts = value.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return value.trim();
  // Ведущий номер дома ("3, Рыночная площадь") сам по себе не заголовок —
  // склеиваем его со следующим сегментом.
  if (/^\d+[A-Za-zА-Яа-я]?$/.test(parts[0]) && parts[1]) {
    return `${parts[0]}, ${parts[1]}`;
  }
  return parts[0];
};

interface PointCardProps {
  point: ImportedPoint;
  onPress?: (point: ImportedPoint) => void;
  onEdit?: (point: ImportedPoint) => void;
  onDelete?: (point: ImportedPoint) => void;
  layout?: 'list' | 'grid';
  selectionMode?: boolean;
  selected?: boolean;
  active?: boolean;
  compact?: boolean;
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
  compact,
  driveInfo,
  onToggleSelect,
}) => {
  const colors = useThemedColors();
  const { width: viewportWidth } = useWindowDimensions();
  const isNarrowLayout = viewportWidth <= 430;
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
  const displayName = React.useMemo(() => {
    const name = String(point.name ?? '').trim();
    if (!name) return '';
    if (looksLikeFullAddress(name)) return firstMeaningfulSegment(name);
    return name;
  }, [point.name]);
  const displaySubtitle = React.useMemo(() => {
    const name = String(point.name ?? '').trim();
    const addr = String(point.address ?? '').trim();
    // Если имя оказалось сырым адресом — полную строку показываем вторичной.
    const fullFromName = name && looksLikeFullAddress(name) && name !== displayName ? name : '';
    const source = fullFromName || addr;
    if (!source) return '';
    if (source.toLowerCase() === displayName.toLowerCase()) return '';
    return source;
  }, [point.name, point.address, displayName]);
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
  const navTestIdPrefix = React.useMemo(
    () => `userpoints-point-navigation-${coordsText.replace(/[^a-zA-Z0-9_-]+/g, '-')}`,
    [coordsText],
  );

  const secondaryLabel = displaySubtitle || (!isSitePoint && countryLabel ? countryLabel : '');

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

  const handleCardPress = React.useCallback(() => {
    if (selectionMode) {
      onToggleSelect?.(point);
      return;
    }
    onPress?.(point);
  }, [onPress, onToggleSelect, point, selectionMode]);

  const driveInfoNode =
    active && !selectionMode && driveInfo?.status === 'ok' ? (
      <Text numberOfLines={1}>
        На машине: {driveInfo.distanceKm} км · ~{driveInfo.durationMin} мин
      </Text>
    ) : active && !selectionMode && driveInfo?.status === 'loading' ? (
      <Text numberOfLines={1}>Считаю маршрут…</Text>
    ) : null;

  // ── Overlay corner controls (select checkbox / edit-delete) over the photo ──
  const selectionBadge = selectionMode ? (
    <View
      style={[
        styles.selectionBadge,
        selected ? styles.selectionBadgeSelected : styles.selectionBadgeUnselected,
      ]}
    >
      <Feather
        name={selected ? 'check-circle' : 'circle'}
        size={18}
        color={selected ? colors.textOnPrimary : colors.textOnDark}
      />
    </View>
  ) : null;

  const cornerActions = showActions ? (
    <View style={styles.cornerActionsRow}>
      {typeof onEdit === 'function' ? (
        <CardActionPressable
          style={styles.cornerActionBtn}
          accessibilityLabel="Редактировать"
          title="Редактировать"
          onPress={() => onEdit(point)}
        >
          <Feather name="edit-2" size={16} color={colors.textOnDark} />
        </CardActionPressable>
      ) : null}
      {typeof onDelete === 'function' ? (
        <CardActionPressable
          style={styles.cornerActionBtn}
          accessibilityLabel="Удалить"
          title="Удалить"
          onPress={() => onDelete(point)}
        >
          <Feather name="trash-2" size={16} color={colors.textOnDark} />
        </CardActionPressable>
      ) : null}
    </View>
  ) : null;

  // ── Photo-dominant bottom scrim overlay (parity with travel/PointCard) ──
  const photoOverlay = (
    <View style={styles.overlayBottom} pointerEvents="box-none">
      <Text
        style={[styles.overlayTitle, showActions && styles.overlayTitleWithActions]}
        numberOfLines={2}
      >
        {displayName}
      </Text>

      {secondaryLabel ? (
        <Text style={styles.overlaySubtitle} numberOfLines={1}>
          {secondaryLabel}
        </Text>
      ) : null}

      {hasCoords ? (
        <View style={styles.overlayCoordRow}>
          <Feather name="map-pin" size={14} color={colors.textOnDark} />
          <Text style={styles.overlayCoordText} numberOfLines={1}>
            {coordsText}
          </Text>
          <CardActionPressable
            style={styles.overlayCoordCopyBtn}
            accessibilityLabel="Копировать координаты"
            title="Копировать координаты"
            onPress={() => void copyCoords()}
          >
            <Feather name="copy" size={15} color={colors.textOnDark} />
          </CardActionPressable>
        </View>
      ) : null}

      {hasCoords ? (
        <View style={styles.overlayNavigationMenu}>
          <PointNavigationMenu
            coord={coordsText}
            label="Открыть в навигаторе"
            testIDPrefix={navTestIdPrefix}
          />
        </View>
      ) : null}

      {categoryLabel ? (
        <View style={styles.overlayCategoryRow}>
          <View style={styles.overlayCategoryChip}>
            <Text style={styles.overlayCategoryText} numberOfLines={1}>
              {categoryLabel}
            </Text>
          </View>
        </View>
      ) : null}

      {driveInfoNode ? (
        <View style={styles.overlayDriveInfo}>
          <Text style={styles.overlayDriveInfoText} numberOfLines={1}>
            {driveInfoNode.props.children}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const overlaySlot = (
    <>
      <View testID="color-indicator" style={[styles.colorIndicator, { backgroundColor: markerColor }]} />
      {photoOverlay}
    </>
  );

  const overlayImageHeight = layout === 'grid' ? 240 : 220;

  if (photoUrl) {
    return (
      <UnifiedTravelCard
        testID={point?.id != null ? `userpoints-point-card-${String(point.id)}` : undefined}
        title={point.name}
        imageUrl={photoUrl}
        onPress={handleCardPress}
        imageHeight={overlayImageHeight}
        mediaFit="contain"
        containerOverlaySlot={overlaySlot}
        leftTopSlot={selectionBadge}
        rightTopSlot={cornerActions}
        contentContainerStyle={styles.contentContainer}
        style={[
          styles.container,
          layout === 'grid' ? styles.containerGrid : null,
          compact ? styles.containerCompact : null,
          active ? styles.containerActive : null,
        ]}
        mediaProps={{
          blurBackground: true,
          blurRadius: 16,
          allowCriticalWebBlur: true,
        }}
        webHoverScale={false}
      />
    );
  }

  // ── No-photo fallback: overlay-on-photo needs a photo, so points without one
  // fall back to a compact content-below card (inline meta stays readable). ──
  const noPhotoContent = (
    <View style={[styles.content, selectionMode ? styles.contentSelectionMode : null]}>
      {selectionMode ? (
        <View
          style={[
            styles.noPhotoSelectionBadge,
            selected ? styles.selectionBadgeSelected : null,
          ]}
        >
          <Feather
            name={selected ? 'check-circle' : 'circle'}
            size={18}
            color={selected ? colors.textOnPrimary : colors.textMuted}
          />
        </View>
      ) : null}

      {(categoryLabel || (point.color && String(point.color).trim())) ? (
        <View style={styles.noPhotoMetaRow}>
          <View testID="color-indicator" style={[styles.noPhotoColorDot, { backgroundColor: markerColor }]} />
          {categoryLabel ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText} numberOfLines={1}>{categoryLabel}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.headerRow, isNarrowLayout ? styles.headerRowNarrow : null]}>
        <View style={[styles.headerMain, isNarrowLayout ? styles.headerMainNarrow : null]}>
          <Text style={styles.name} numberOfLines={2}>
            {displayName}
          </Text>
        </View>

        {showActions ? (
          <View style={[styles.headerActions, isNarrowLayout ? styles.headerActionsNarrow : null]}>
            {typeof onEdit === 'function' ? (
              Platform.OS === 'web' ? (
                <CardActionPressable
                  style={styles.webActionButton}
                  accessibilityLabel="Редактировать"
                  title="Редактировать"
                  onPress={() => onEdit(point)}
                >
                  <Feather name="edit-2" size={14} color={colors.text} />
                </CardActionPressable>
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
                <CardActionPressable
                  style={styles.webActionButton}
                  accessibilityLabel="Удалить"
                  title="Удалить"
                  onPress={() => onDelete(point)}
                >
                  <Feather name="trash-2" size={14} color={colors.text} />
                </CardActionPressable>
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

      {secondaryLabel ? (
        <Text style={styles.address} numberOfLines={1}>
          {secondaryLabel}
        </Text>
      ) : null}

      {point.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {point.description}
        </Text>
      ) : null}

      {hasCoords ? (
        <View style={styles.coordsRow}>
          <Text style={styles.coordsText} numberOfLines={isNarrowLayout ? 2 : 1}>
            {coordsText}
          </Text>
          <View style={[styles.coordsActionsRow, isNarrowLayout ? styles.coordsActionsRowNarrow : null]}>
            <IconButton
              icon={<Feather name="copy" size={14} color={colors.textMuted} />}
              label="Копировать координаты"
              onPress={() => void copyCoords()}
              size="sm"
            />
          </View>
        </View>
      ) : null}

      {hasCoords ? (
        <View style={styles.noPhotoNavigationMenu}>
          <PointNavigationMenu
            coord={coordsText}
            label="Открыть в навигаторе"
            testIDPrefix={navTestIdPrefix}
          />
        </View>
      ) : null}

      {typeof point.rating === 'number' && Number.isFinite(point.rating) ? (
        <Text style={styles.rating}>{point.rating.toFixed(1)}</Text>
      ) : null}

      {driveInfoNode ? (
        <View style={styles.driveInfoRow}>
          <Text style={styles.driveInfoText}>{driveInfoNode.props.children}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <UnifiedTravelCard
      testID={point?.id != null ? `userpoints-point-card-${String(point.id)}` : undefined}
      title={point.name}
      imageUrl={null}
      onPress={handleCardPress}
      imageHeight={0}
      mediaFit="contain"
      contentSlot={noPhotoContent}
      contentContainerStyle={styles.contentContainer}
      style={[
        styles.container,
        layout === 'grid' ? styles.containerGrid : null,
        compact ? styles.containerCompact : null,
        active ? styles.containerActive : null,
      ]}
      webHoverScale={false}
    />
  );
});
