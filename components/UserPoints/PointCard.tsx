import React from 'react';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';

import PlaceListCard from '@/components/places/PlaceListCard';
import {
  buildAppleMapsUrl,
  buildGoogleMapsUrl,
  buildOpenStreetMapUrl,
  buildOrganicMapsUrl,
  buildTelegramShareUrl,
  buildWazeUrl,
  buildYandexMapsUrl,
  buildYandexNaviUrl,
} from '@/components/MapPage/Map/mapLinks';
import { NAVIGATION_ACTION_LABELS } from '@/components/navigation/navigationActionMeta';
import {
  getNativeCardImageHeight,
  getNativeCardWidth,
  getWebCardWidth,
} from '@/components/MapPage/AddressListItem/utils';
import { PLACE_CARD_STYLE } from '@/components/MapPage/AddressListItem/constants';
import type { ImportedPoint } from '@/types/userPoints';
import { useThemedColors } from '@/hooks/useTheme';
import { openExternalUrlInNewTab } from '@/utils/externalLinks';
import { getSiteBaseUrl } from '@/utils/seo';
import { showToast } from '@/utils/toast';

type ActionChip = {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  accessibilityLabel?: string;
  title?: string;
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

const isWebPlatform = () => Platform.OS === 'web';

const looksLikeFullAddress = (value: string): boolean => {
  const parts = value.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length >= 3;
};

const firstMeaningfulSegment = (value: string): string => {
  const parts = value.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return value.trim();
  if (/^\d+[A-Za-zА-Яа-я]?$/.test(parts[0]) && parts[1]) {
    return `${parts[0]}, ${parts[1]}`;
  }
  return parts[0];
};

const getPointPhotoUrl = (point: ImportedPoint): string | null => {
  const pointRecord = point as unknown as Record<string, unknown>;
  const direct = typeof point.photo === 'string' ? point.photo.trim() : '';
  if (direct) return direct;

  const legacy = pointRecord.photos;
  if (typeof legacy === 'string' && legacy.trim()) return legacy.trim();
  if (!legacy || typeof legacy !== 'object') return null;

  const knownKeys = ['url', 'src', 'photo', 'image', 'thumb', 'thumbnail', 'travelImageThumbUrl'];
  for (const key of knownKeys) {
    const value = (legacy as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  for (const value of Object.values(legacy as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

const getCountryLabel = (point: ImportedPoint): string => {
  const direct = String((point as unknown as Record<string, unknown>).country ?? '').trim();
  if (direct) return direct;
  const address = String(point.address ?? '').trim();
  if (!address) return '';
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 1] ?? '' : '';
};

const getCategoryLabel = (point: ImportedPoint, countryLabel: string): string => {
  const clean = (values: unknown[]) =>
    values
      .map((value) => String(value).trim())
      .filter(Boolean)
      .filter((name) => !countryLabel || name.localeCompare(countryLabel, undefined, { sensitivity: 'accent' }) !== 0)
      .join(', ');

  const names = (point as unknown as Record<string, unknown>).categoryNames;
  if (Array.isArray(names) && names.length > 0) return clean(names);

  const ids = point.categoryIds ?? point.category_ids;
  if (Array.isArray(ids) && ids.length > 0) return clean(ids);

  const legacy = String(point.category ?? '').trim();
  if (!legacy) return '';
  if (countryLabel && legacy.localeCompare(countryLabel, undefined, { sensitivity: 'accent' }) === 0) return '';
  return legacy;
};

const getPointTitle = (point: ImportedPoint): string => {
  const name = String(point.name ?? '').trim();
  if (name) return looksLikeFullAddress(name) ? firstMeaningfulSegment(name) : name;
  const address = String(point.address ?? '').trim();
  if (address) return looksLikeFullAddress(address) ? firstMeaningfulSegment(address) : address;
  return 'Точка';
};

const getPointSubtitle = (point: ImportedPoint, title: string): string => {
  const name = String(point.name ?? '').trim();
  const address = String(point.address ?? '').trim();
  const fullFromName = name && looksLikeFullAddress(name) && name !== title ? name : '';
  const source = fullFromName || address;
  if (!source || source.toLowerCase() === title.toLowerCase()) return '';
  return source;
};

const openPointUrl = async (url: string) => {
  const opened = await openExternalUrlInNewTab(url, {
    allowRelative: true,
    baseUrl: getSiteBaseUrl(),
  });
  if (!opened) {
    void showToast({ type: 'info', text1: 'Не удалось открыть ссылку', position: 'bottom' });
  }
};

const openMapUrl = async (url: string) => {
  const opened = await openExternalUrlInNewTab(url);
  if (!opened) {
    void showToast({ type: 'info', text1: 'Не удалось открыть карту', position: 'bottom' });
  }
};

const openShareUrl = async (url: string) => {
  const opened = await openExternalUrlInNewTab(url);
  if (!opened) {
    void showToast({ type: 'info', text1: 'Не удалось поделиться', position: 'bottom' });
  }
};

export const PointCard: React.FC<PointCardProps> = React.memo(({
  point,
  onPress,
  onEdit,
  onDelete,
  layout = 'list',
  selectionMode,
  selected,
  active,
  compact = true,
  driveInfo,
  onToggleSelect,
}) => {
  const colors = useThemedColors();
  const { width: viewportWidth } = useWindowDimensions();

  const title = React.useMemo(() => getPointTitle(point), [point]);
  const subtitle = React.useMemo(() => getPointSubtitle(point, title), [point, title]);
  const countryLabel = React.useMemo(() => getCountryLabel(point), [point]);
  const categoryLabel = React.useMemo(() => getCategoryLabel(point, countryLabel), [point, countryLabel]);
  const imageUrl = React.useMemo(() => getPointPhotoUrl(point), [point]);
  const hasCoords = Number.isFinite(point.latitude) && Number.isFinite(point.longitude);
  const coord = hasCoords
    ? `${Number(point.latitude).toFixed(6)}, ${Number(point.longitude).toFixed(6)}`
    : '';
  const tags = (point.tags ?? {}) as Record<string, unknown>;
  const articleUrl = String(tags.articleUrl ?? '').trim();
  const travelUrl = String(tags.travelUrl ?? '').trim();
  const relatedPageUrl = articleUrl || travelUrl;

  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const cardWidth = React.useMemo(() => {
    if (layout === 'grid') return undefined;
    return isWebPlatform() ? getWebCardWidth(viewportWidth) : getNativeCardWidth(viewportWidth);
  }, [layout, viewportWidth]);
  const imageHeight = React.useMemo(() => {
    if (layout === 'grid') return 220;
    return isWebPlatform()
      ? Math.round(Math.max(128, Math.min(188, (cardWidth ?? getWebCardWidth(viewportWidth)) * 0.48)))
      : getNativeCardImageHeight(viewportWidth);
  }, [cardWidth, layout, viewportWidth]);

  const copyCoords = React.useCallback(async () => {
    if (!coord) return;
    try {
      if (
        Platform.OS === 'web' &&
        typeof window !== 'undefined' &&
        (window as unknown as { navigator?: { clipboard?: { writeText?: (text: string) => Promise<void> } } }).navigator?.clipboard?.writeText
      ) {
        await (window as unknown as { navigator: { clipboard: { writeText: (text: string) => Promise<void> } } }).navigator.clipboard.writeText(coord);
      } else {
        await Clipboard.setStringAsync(coord);
      }
      void showToast({ type: 'success', text1: 'Скопировано', position: 'bottom' });
    } catch {
      void showToast({ type: 'info', text1: 'Не удалось скопировать', position: 'bottom' });
    }
  }, [coord]);

  const handleCardPress = React.useCallback(() => {
    if (selectionMode) {
      onToggleSelect?.(point);
      return;
    }
    onPress?.(point);
  }, [onPress, onToggleSelect, point, selectionMode]);

  const badges = React.useMemo(() => {
    const result: string[] = [];
    if (subtitle) result.push(subtitle);
    if (point.description) result.push(String(point.description));
    if (driveInfo?.status === 'ok') result.push(`${driveInfo.distanceKm} км · ~${driveInfo.durationMin} мин`);
    if (driveInfo?.status === 'loading') result.push('Считаю маршрут…');
    if (typeof point.rating === 'number' && Number.isFinite(point.rating)) result.push(point.rating.toFixed(1));
    return result;
  }, [driveInfo, point.description, point.rating, subtitle]);

  const mapActions = React.useMemo<ActionChip[]>(() => {
    if (!coord) return [];
    const base: ActionChip[] = [
      {
        key: 'google',
        label: isWebPlatform() ? 'Google Maps' : NAVIGATION_ACTION_LABELS.google,
        icon: 'map-pin',
        onPress: () => void openMapUrl(buildGoogleMapsUrl(coord)),
        title: 'Открыть в Google Maps',
      },
      {
        key: 'organic',
        label: isWebPlatform() ? 'Organic Maps' : NAVIGATION_ACTION_LABELS.organic,
        icon: 'compass',
        onPress: () => void openMapUrl(buildOrganicMapsUrl(coord, title)),
        title: 'Открыть в Organic Maps',
      },
      {
        key: 'waze',
        label: NAVIGATION_ACTION_LABELS.waze,
        icon: 'navigation',
        onPress: () => void openMapUrl(buildWazeUrl(coord)),
        title: 'Проложить маршрут в Waze',
      },
      {
        key: 'yandex',
        label: isWebPlatform() ? 'Яндекс.Навигатор' : NAVIGATION_ACTION_LABELS.yandex,
        icon: 'navigation-2',
        onPress: () => void openMapUrl(buildYandexNaviUrl(coord)),
        title: 'Проложить маршрут в Яндекс Навигаторе',
      },
    ];
    if (isWebPlatform()) return base;
    return [
      base[0]!,
      {
        key: 'apple',
        label: NAVIGATION_ACTION_LABELS.apple,
        icon: 'map',
        onPress: () => void openMapUrl(buildAppleMapsUrl(coord)),
        title: 'Открыть в Apple Maps',
      },
      base[1]!,
      base[2]!,
      {
        key: 'yandex-maps',
        label: NAVIGATION_ACTION_LABELS['yandex-maps'],
        icon: 'map',
        onPress: () => void openMapUrl(buildYandexMapsUrl(coord)),
        title: 'Открыть в Яндекс Картах',
      },
      base[3]!,
      {
        key: 'osm',
        label: NAVIGATION_ACTION_LABELS.osm,
        icon: 'map',
        onPress: () => void openMapUrl(buildOpenStreetMapUrl(coord)),
        title: 'Открыть в OpenStreetMap',
      },
    ];
  }, [coord, title]);

  const inlineActions = React.useMemo<ActionChip[]>(() => {
    const result: ActionChip[] = [];
    if (selectionMode) {
      result.push({
        key: 'select',
        label: selected ? 'Выбрано' : 'Выбрать',
        icon: selected ? 'check-circle' : 'circle',
        onPress: () => onToggleSelect?.(point),
        accessibilityLabel: selected ? 'Точка выбрана' : 'Выбрать точку',
        title: selected ? 'Точка выбрана' : 'Выбрать точку',
      });
      return result;
    }
    if (relatedPageUrl) {
      result.push({
        key: 'article',
        label: 'Страница',
        icon: 'book-open',
        onPress: () => void openPointUrl(relatedPageUrl),
        accessibilityLabel: 'Открыть страницу',
        title: 'Открыть страницу',
      });
    }
    if (onEdit) {
      result.push({
        key: 'edit',
        label: 'Изменить',
        icon: 'edit-2',
        onPress: () => onEdit(point),
        accessibilityLabel: 'Редактировать',
        title: 'Редактировать',
      });
    }
    if (onDelete) {
      result.push({
        key: 'delete',
        label: 'Удалить',
        icon: 'trash-2',
        onPress: () => onDelete(point),
        accessibilityLabel: 'Удалить',
        title: 'Удалить',
      });
    }
    return result;
  }, [onDelete, onEdit, onToggleSelect, point, relatedPageUrl, selected, selectionMode]);

  return (
    <PlaceListCard
      title={title}
      imageUrl={imageUrl}
      categoryLabel={categoryLabel || undefined}
      coord={coord || undefined}
      badges={badges}
      onCardPress={handleCardPress}
      onMediaPress={relatedPageUrl && !selectionMode ? () => void openPointUrl(relatedPageUrl) : undefined}
      onCopyCoord={coord ? copyCoords : undefined}
      onShare={coord ? () => void openShareUrl(buildTelegramShareUrl(coord)) : undefined}
      mapActions={mapActions}
      inlineActions={inlineActions}
      showAddButton={false}
      imageHeight={imageHeight}
      width={cardWidth}
      style={[
        PLACE_CARD_STYLE,
        layout === 'grid' ? styles.gridCard : null,
        compact ? styles.compactCard : null,
        active ? styles.activeCard : null,
        selected ? styles.selectedCard : null,
      ]}
      compact={compact}
      popupAligned
      titleLayout="content"
      titleNumberOfLines={2}
      testID={point?.id != null ? `userpoints-point-card-${String(point.id)}` : undefined}
    />
  );
});

const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  compactCard: {
    marginHorizontal: 0,
  },
  gridCard: {
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
  },
  activeCard: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.primarySoft,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: `0 0 0 3px ${colors.primaryAlpha30}, ${colors.boxShadows.hover}` } as any)
      : null),
  },
  selectedCard: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
});
