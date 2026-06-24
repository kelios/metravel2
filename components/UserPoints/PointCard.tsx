import React from 'react';
import { View, Text, Platform, Share, ActionSheetIOS, useWindowDimensions } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import type { ImportedPoint } from '@/types/userPoints';
import { useThemedColors } from '@/hooks/useTheme';
import { createStyles } from './PointCard.styles';
import IconButton from '@/components/ui/IconButton';
import CardActionPressable from '@/components/ui/CardActionPressable';
import UnifiedTravelCard from '@/components/ui/UnifiedTravelCard';
import OpenInMapsSheet, { type OpenInMapsAction } from '@/components/navigation/OpenInMapsSheet';
import { showToast } from '@/utils/toast';
import { openExternalUrl, openExternalUrlInNewTab } from '@/utils/externalLinks';
import { buildGoogleMapsUrl, buildOrganicMapsUrl, buildWazeUrl, buildYandexNaviUrl } from '@/components/MapPage/Map/mapLinks';
import {
  getNavigationActionVisual,
  NAVIGATION_ACTION_LABELS,
} from '@/components/navigation/navigationActionMeta';

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
  const [showOpenInMapsSheet, setShowOpenInMapsSheet] = React.useState(false);
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

  const ActionButton = ({
    label,
    icon,
    onActivate,
  }: {
    label: string;
    icon: React.ComponentProps<typeof Feather>['name'];
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

  const ActionChip = ({
    accessibilityLabel,
    icon,
    iconColor,
    label,
    onActivate,
    tintBg,
    title,
  }: {
    accessibilityLabel: string;
    icon: React.ComponentProps<typeof Feather>['name'];
    iconColor: string;
    label: string;
    onActivate: () => void;
    tintBg: string;
    title: string;
  }) => {
    return (
      <CardActionPressable
        accessibilityLabel={accessibilityLabel}
        onPress={onActivate}
        title={title}
        style={({ pressed }) => [
          styles.quickActionChip,
          pressed ? styles.quickActionChipPressed : null,
        ]}
      >
        <View style={[styles.quickActionIconBubble, { backgroundColor: tintBg }]}>
          <Feather name={icon} size={16} color={iconColor} />
        </View>
        <Text style={styles.quickActionLabel} numberOfLines={1}>
          {label}
        </Text>
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

    const google = buildGoogleMapsUrl(coordsText);
    const organic = buildOrganicMapsUrl(coordsText);
    const waze = buildWazeUrl(coordsText);
    const yandexNavi = buildYandexNaviUrl(coordsText);

    return {
      google,
      organic,
      waze,
      yandexMaps: `https://yandex.ru/maps/?pt=${encodeURIComponent(`${lng},${lat}`)}&z=16&l=map`,
      yandexNavi,
      osm: `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(lat))}&mlon=${encodeURIComponent(String(lng))}#map=16/${encodeURIComponent(String(lat))}/${encodeURIComponent(String(lng))}`,
      apple: `https://maps.apple.com/?q=${encodeURIComponent(`${lat},${lng}`)}`,
    };
  }, [coordsText, hasCoords, point.latitude, point.longitude]);

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
          options: ['Google Maps', 'Organic Maps', 'Waze', 'Яндекс.Навигатор', 'OpenStreetMap', 'Отмена'],
          cancelButtonIndex: 5,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) void openExternalLink(mapUrls.google);
          if (buttonIndex === 1) void openExternalLink(mapUrls.organic);
          if (buttonIndex === 2) void openExternalLink(mapUrls.waze);
          if (buttonIndex === 3) void openExternalLink(mapUrls.yandexNavi);
          if (buttonIndex === 4) void openExternalLink(mapUrls.osm);
        }
      );
      return;
    }

    // Android: системный Alert надёжно держит только 3 кнопки — 6 пунктов
    // обрезались (кривая вёрстка, пропадала «Отмена», #547). Открываем
    // управляемый bottom-sheet с явной кнопкой закрытия и safe-area.
    setShowOpenInMapsSheet(true);
  }, [mapUrls, openExternalLink]);

  const openInMapsActions = React.useMemo<OpenInMapsAction[]>(() => {
    if (!mapUrls) return [];
    return [
      {
        key: 'google',
        label: 'Google Maps',
        accessibilityLabel: 'Открыть в Google Maps',
        onPress: () => void openExternalLink(mapUrls.google),
      },
      {
        key: 'organic',
        label: 'Organic Maps',
        accessibilityLabel: 'Открыть в Organic Maps',
        onPress: () => void openExternalLink(mapUrls.organic),
      },
      {
        key: 'waze',
        label: 'Waze',
        accessibilityLabel: 'Проложить маршрут в Waze',
        onPress: () => void openExternalLink(mapUrls.waze),
      },
      {
        key: 'yandex',
        label: 'Яндекс.Навигатор',
        accessibilityLabel: 'Проложить маршрут в Яндекс Навигаторе',
        onPress: () => void openExternalLink(mapUrls.yandexNavi),
      },
      {
        key: 'osm',
        label: 'OpenStreetMap',
        accessibilityLabel: 'Открыть в OpenStreetMap',
        onPress: () => void openExternalLink(mapUrls.osm),
      },
    ];
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

  const webQuickActions = React.useMemo<Array<{
    key: string;
    accessibilityLabel: string;
    label: string;
    icon: React.ComponentProps<typeof Feather>['name'];
    iconColor: string;
    tintBg: string;
    onActivate: () => void;
    title: string;
  }>>(
    () => (mapUrls
      ? [
          {
            key: 'google',
            accessibilityLabel: 'Открыть в Google Maps',
            label: NAVIGATION_ACTION_LABELS.google,
            ...getNavigationActionVisual('google', colors),
            onActivate: () => void openExternalLink(mapUrls.google),
            title: 'Открыть в Google Maps',
          },
          {
            key: 'organic',
            accessibilityLabel: 'Открыть в Organic Maps',
            label: NAVIGATION_ACTION_LABELS.organic,
            ...getNavigationActionVisual('organic', colors),
            onActivate: () => void openExternalLink(mapUrls.organic),
            title: 'Открыть в Organic Maps',
          },
          {
            key: 'waze',
            accessibilityLabel: 'Проложить маршрут в Waze',
            label: NAVIGATION_ACTION_LABELS.waze,
            ...getNavigationActionVisual('waze', colors),
            onActivate: () => void openExternalLink(mapUrls.waze),
            title: 'Проложить маршрут в Waze',
          },
          {
            key: 'yandex',
            accessibilityLabel: 'Проложить маршрут в Яндекс Навигаторе',
            label: NAVIGATION_ACTION_LABELS.yandex,
            ...getNavigationActionVisual('yandex', colors),
            onActivate: () => void openExternalLink(mapUrls.yandexNavi),
            title: 'Проложить маршрут в Яндекс Навигаторе',
          },
          {
            key: 'telegram',
            accessibilityLabel: 'Поделиться в Telegram',
            label: NAVIGATION_ACTION_LABELS.telegram,
            ...getNavigationActionVisual('telegram', colors),
            onActivate: () => void shareToTelegram(),
            title: 'Поделиться в Telegram',
          },
        ]
      : []),
    [
      colors,
      mapUrls,
      openExternalLink,
      shareToTelegram,
    ]
  );

  const actionsHoverStyle = Platform.OS === 'web' ? {
    opacity: 1,
  } : {};

  const handleCardPress = React.useCallback(() => {
    if (selectionMode) {
      onToggleSelect?.(point);
      return;
    }
    onPress?.(point);
  }, [onPress, onToggleSelect, point, selectionMode]);

  const mediaOverlay = (
    <>
      <View testID="color-indicator" style={[styles.colorIndicator, { backgroundColor: markerColor }]} />
      {categoryLabel ? (
        <View style={styles.imageOverlay}>
          <View style={styles.imageBadge}>
            <Text style={styles.imageBadgeText}>{categoryLabel}</Text>
          </View>
        </View>
      ) : null}
    </>
  );

  const contentSlot = (
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

      {/* Без фото категорию/цвет показываем инлайн темо-зависимым чипом —
          вместо нечитаемой пилюли поверх пустого изображения. */}
      {!photoUrl && (categoryLabel || (point.color && String(point.color).trim())) ? (
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
          <View style={[styles.headerActions, isNarrowLayout ? styles.headerActionsNarrow : null, actionsHoverStyle]}>
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

      {displaySubtitle ? (
        <Text style={styles.address} numberOfLines={1}>
          {displaySubtitle}
        </Text>
      ) : !isSitePoint && countryLabel ? (
        <Text style={styles.address} numberOfLines={1}>
          {countryLabel}
        </Text>
      ) : null}
      
      {point.description && (
        <Text style={styles.description} numberOfLines={2}>
          {point.description}
        </Text>
      )}

      {hasCoords ? (
        Platform.OS === 'web' ? (
          <View style={styles.coordsBlock}>
            <View style={[styles.coordsSurface, isNarrowLayout ? styles.coordsSurfaceNarrow : null]}>
              <Feather name="map-pin" size={14} color={colors.textMuted} />
              <Text style={styles.coordsText} numberOfLines={isNarrowLayout ? 2 : 1}>
                {coordsText}
              </Text>
              <ActionButton label="Копировать координаты" icon="copy" onActivate={copyCoords} />
            </View>
            <View style={styles.quickActionsGrid}>
              {webQuickActions.map((action) => (
                <ActionChip
                  key={action.key}
                  accessibilityLabel={action.accessibilityLabel}
                  icon={action.icon}
                  iconColor={action.iconColor}
                  label={action.label}
                  onActivate={action.onActivate}
                  tintBg={action.tintBg}
                  title={action.title}
                />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.coordsRow}>
            <Text style={styles.coordsText} numberOfLines={isNarrowLayout ? 2 : 1}>
              {coordsText}
            </Text>
            <View style={[styles.coordsActionsRow as any, isNarrowLayout ? styles.coordsActionsRowNarrow : null]}>
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
                  icon={<Feather name="map-pin" size={14} color={colors.textMuted} />}
                  label="Открыть в картах"
                  onPress={() => void openInMaps()}
                  size="sm"
                />
              ) : null}
            </View>
          </View>
        )
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
  );

  return (
    <>
    <UnifiedTravelCard
      testID={point?.id != null ? `userpoints-point-card-${String(point.id)}` : undefined}
      title={point.name}
      imageUrl={photoUrl}
      onPress={handleCardPress}
      // Без фото не резервируем пустую область изображения (imageHeight 0 скрывает её).
      imageHeight={photoUrl ? (layout === 'grid' ? 160 : 140) : 0}
      mediaFit="contain"
      contentSlot={contentSlot}
      containerOverlaySlot={photoUrl ? mediaOverlay : undefined}
      contentContainerStyle={styles.contentContainer}
      style={[
        styles.container,
        layout === 'grid' ? styles.containerGrid : null,
        compact ? styles.containerCompact : null,
        active ? styles.containerActive : null,
      ]}
      mediaProps={{
        blurBackground: !!photoUrl,
        blurRadius: 16,
        allowCriticalWebBlur: true,
      }}
      webHoverScale={false}
    />
    {Platform.OS === 'android' ? (
      <OpenInMapsSheet
        visible={showOpenInMapsSheet}
        actions={openInMapsActions}
        onClose={() => setShowOpenInMapsSheet(false)}
      />
    ) : null}
    </>
  );
});
