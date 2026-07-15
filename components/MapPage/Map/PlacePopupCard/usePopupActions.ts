import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import type Feather from '@expo/vector-icons/Feather';

import type { ThemedColors } from '@/hooks/useTheme';
import {
  getNavigationActionVisual,
  NAVIGATION_ACTION_LABELS,
  SEMANTIC_ACTION_ICON,
} from '@/components/navigation/navigationActionMeta';

import { getPopupTooltips } from './constants';
import { isInternalArticleHref } from './domEvents';
import { translate as i18nT } from '@/i18n'


type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

// Расстояние, за которым авто-ETA перестаёт иметь смысл (тысячи км → тысячи минут).
const DRIVE_ETA_MAX_KM = 1000;

type PrimaryActionOverride = {
  label: string;
  icon: FeatherIcon;
  onPress: () => void;
  accessibilityLabel?: string;
  tooltip?: string;
};

type UsePopupActionsArgs = {
  colors: ThemedColors;
  coord?: string | null;
  articleHref?: string | null;
  drivingDistanceMeters?: number | null;
  drivingDurationSeconds?: number | null;
  onOpenArticle?: () => void;
  onOpenGoogleMaps?: () => void;
  onOpenAppleMaps?: () => void;
  onOpenOrganicMaps?: () => void;
  onOpenWaze?: () => void;
  onOpenYandexMaps?: () => void;
  onOpenYandexNavi?: () => void;
  onOpenOpenStreetMap?: () => void;
  onShareTelegram?: () => void;
  onBuildRoute?: () => void;
  primaryActionOverride?: PrimaryActionOverride;
};

export function usePopupActions({
  colors,
  coord,
  articleHref,
  drivingDistanceMeters,
  drivingDurationSeconds,
  onOpenArticle,
  onOpenGoogleMaps,
  onOpenAppleMaps,
  onOpenOrganicMaps,
  onOpenWaze,
  onOpenYandexMaps,
  onOpenYandexNavi,
  onOpenOpenStreetMap,
  onShareTelegram,
  onBuildRoute,
  primaryActionOverride,
}: UsePopupActionsArgs) {
  const popupTooltips = useMemo(getPopupTooltips, []);
  const hasCoord = !!coord;

  const normalizedArticleHref = useMemo(() => {
    const rawHref = String(articleHref ?? '').trim();
    if (!rawHref) return null;
    if (isInternalArticleHref(rawHref)) return rawHref;

    if (/^https?:\/\//i.test(rawHref)) {
      try {
        const parsed = new URL(rawHref);
        if (isInternalArticleHref(parsed.pathname)) {
          return `${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
      } catch {
        return null;
      }
    }

    return null;
  }, [articleHref]);
  const hasArticle = !!normalizedArticleHref && typeof onOpenArticle === 'function';

  const hasDrivingInfo =
    typeof drivingDistanceMeters === 'number' &&
    Number.isFinite(drivingDistanceMeters) &&
    typeof drivingDurationSeconds === 'number' &&
    Number.isFinite(drivingDurationSeconds);

  const drivingText = useMemo(() => {
    if (!hasDrivingInfo) return null;
    const km = drivingDistanceMeters! / 1000;
    const kmLabel = km >= 10 ? i18nT('map:components.MapPage.Map.PlacePopupCard.usePopupActions.value1_km_cbb88f64', { value1: Math.round(km) }) : i18nT('map:components.MapPage.Map.PlacePopupCard.usePopupActions.value1_km_cbb88f64', { value1: km.toFixed(1) });
    // За пределами разумной автопоездки ETA теряет смысл (тысячи км → тысячи минут) —
    // показываем только расстояние.
    if (km > DRIVE_ETA_MAX_KM) return kmLabel;
    const totalMins = Math.max(1, Math.round(drivingDurationSeconds! / 60));
    const durationLabel =
      totalMins < 60 ? i18nT('map:components.MapPage.Map.PlacePopupCard.usePopupActions.value1_min_a48c9273', { value1: totalMins }) : i18nT('map:components.MapPage.Map.PlacePopupCard.usePopupActions.value1_ch_value2_min_dc78275e', { value1: Math.floor(totalMins / 60), value2: totalMins % 60 });
    return `${kmLabel} · ${durationLabel}`;
  }, [drivingDistanceMeters, drivingDurationSeconds, hasDrivingInfo]);

  const primaryAction = useMemo(() => {
    if (primaryActionOverride) {
      return {
        label: primaryActionOverride.label,
        icon: primaryActionOverride.icon,
        onPress: primaryActionOverride.onPress,
        tooltip: primaryActionOverride.tooltip ?? primaryActionOverride.label,
        accessibilityLabel: primaryActionOverride.accessibilityLabel ?? primaryActionOverride.label,
      };
    }
    if (onBuildRoute) {
      return {
        label: i18nT('map:components.MapPage.Map.PlacePopupCard.usePopupActions.marshrut_ot_menya_a5fe179b'),
        icon: SEMANTIC_ACTION_ICON.buildRoute,
        onPress: onBuildRoute,
        tooltip: popupTooltips.buildRoute,
        accessibilityLabel: i18nT('map:components.MapPage.Map.PlacePopupCard.usePopupActions.postroit_marshrut_ot_moego_mestopolozheniya_aae59049'),
      };
    }

    if (hasArticle) {
      return {
        label: i18nT('map:components.MapPage.Map.PlacePopupCard.usePopupActions.otkryt_stranitsu_787ed124'),
        icon: 'arrow-right' as const,
        onPress: onOpenArticle!,
        tooltip: popupTooltips.openArticle,
        accessibilityLabel: i18nT('map:components.MapPage.Map.PlacePopupCard.usePopupActions.otkryt_statyu_o_tochke_f64d1e1b'),
      };
    }

    if (hasCoord && onOpenGoogleMaps) {
      return {
        label: i18nT('map:components.MapPage.Map.PlacePopupCard.usePopupActions.google_maps_990f5f39'),
        icon: 'map' as const,
        onPress: onOpenGoogleMaps,
        tooltip: popupTooltips.openGoogleMaps,
        accessibilityLabel: i18nT('map:components.MapPage.Map.PlacePopupCard.usePopupActions.otkryt_tochku_v_google_maps_fd3ee635'),
      };
    }

    return null;
  }, [hasArticle, hasCoord, onBuildRoute, onOpenArticle, onOpenGoogleMaps, popupTooltips, primaryActionOverride]);

  const saveActionVisual = useMemo(
    () => getNavigationActionVisual('save', colors),
    [colors],
  );

  const secondaryActions = useMemo(() => {
    const items: Array<{
      key: string;
      accessibilityLabel: string;
      label: string;
      icon: FeatherIcon;
      iconColor: string;
      tintBg: string;
      onPress: () => void;
      title: string;
    }> = [];

    if (hasCoord && onOpenGoogleMaps) {
      items.push({
        key: 'google',
        accessibilityLabel: i18nT('map:components.MapPage.Map.PlacePopupCard.usePopupActions.google_maps_990f5f39'),
        label: NAVIGATION_ACTION_LABELS.google,
        ...getNavigationActionVisual('google', colors),
        onPress: onOpenGoogleMaps,
        title: popupTooltips.openGoogleMaps,
      });
    }

    if (hasCoord && onOpenAppleMaps) {
      items.push({
        key: 'apple',
        accessibilityLabel: i18nT('map:components.MapPage.Map.PlacePopupCard.usePopupActions.apple_maps_e8038c05'),
        label: NAVIGATION_ACTION_LABELS.apple,
        ...getNavigationActionVisual('apple', colors),
        onPress: onOpenAppleMaps,
        title: popupTooltips.openAppleMaps,
      });
    }

    if (hasCoord && onOpenOrganicMaps) {
      items.push({
        key: 'organic',
        accessibilityLabel: i18nT('map:components.MapPage.Map.PlacePopupCard.usePopupActions.organic_maps_d417caeb'),
        label: NAVIGATION_ACTION_LABELS.organic,
        ...getNavigationActionVisual('organic', colors),
        onPress: onOpenOrganicMaps,
        title: popupTooltips.openOrganicMaps,
      });
    }

    // Skip the "Статья" chip on web when the inline "Открыть страницу" link is rendered
    // (avoids duplicating the same destination right above the action grid).
    const inlineArticleLinkVisible = Platform.OS === 'web' && !!normalizedArticleHref && primaryAction?.onPress !== onOpenArticle;
    if (
      hasArticle &&
      primaryAction?.onPress !== onOpenArticle &&
      onOpenArticle &&
      !inlineArticleLinkVisible
    ) {
      items.push({
        key: 'article',
        accessibilityLabel: i18nT('map:components.MapPage.Map.PlacePopupCard.usePopupActions.otkryt_statyu_875cc7b3'),
        label: i18nT('map:components.MapPage.Map.PlacePopupCard.usePopupActions.statya_07e31f72'),
        icon: 'book-open',
        iconColor: colors.primary,
        tintBg: colors.primarySoft,
        onPress: onOpenArticle,
        title: popupTooltips.openArticle,
      });
    }

    if (hasCoord && onOpenWaze) {
      items.push({
        key: 'waze',
        accessibilityLabel: i18nT('map:components.MapPage.Map.PlacePopupCard.usePopupActions.waze_3b6c0cbd'),
        label: NAVIGATION_ACTION_LABELS.waze,
        ...getNavigationActionVisual('waze', colors),
        onPress: onOpenWaze,
        title: popupTooltips.openWaze,
      });
    }

    if (hasCoord && onOpenYandexMaps) {
      items.push({
        key: 'yandex-maps',
        accessibilityLabel: i18nT('map:components.MapPage.Map.PlacePopupCard.usePopupActions.yandeks_karty_cded233a'),
        label: NAVIGATION_ACTION_LABELS['yandex-maps'],
        ...getNavigationActionVisual('yandex-maps', colors),
        onPress: onOpenYandexMaps,
        title: popupTooltips.openYandexMaps,
      });
    }

    if (hasCoord && onOpenYandexNavi) {
      items.push({
        key: 'yandex',
        accessibilityLabel: i18nT('map:components.MapPage.Map.PlacePopupCard.usePopupActions.yandeks_navigator_27676798'),
        label: NAVIGATION_ACTION_LABELS.yandex,
        ...getNavigationActionVisual('yandex', colors),
        onPress: onOpenYandexNavi,
        title: popupTooltips.openYandexNavi,
      });
    }

    if (hasCoord && onOpenOpenStreetMap) {
      items.push({
        key: 'osm',
        accessibilityLabel: i18nT('map:components.MapPage.Map.PlacePopupCard.usePopupActions.openstreetmap_0af5d0cd'),
        label: NAVIGATION_ACTION_LABELS.osm,
        ...getNavigationActionVisual('osm', colors),
        onPress: onOpenOpenStreetMap,
        title: popupTooltips.openOpenStreetMap,
      });
    }

    if (hasCoord && onShareTelegram) {
      items.push({
        key: 'telegram',
        accessibilityLabel: i18nT('map:components.MapPage.Map.PlacePopupCard.usePopupActions.podelitsya_v_telegram_533c8b62'),
        label: NAVIGATION_ACTION_LABELS.telegram,
        ...getNavigationActionVisual('telegram', colors),
        onPress: onShareTelegram,
        title: popupTooltips.shareTelegram,
      });
    }

    return items;
  }, [
    colors,
    hasArticle,
    hasCoord,
    normalizedArticleHref,
    onOpenGoogleMaps,
    onOpenOrganicMaps,
    onOpenArticle,
    onOpenAppleMaps,
    onOpenWaze,
    onOpenYandexMaps,
    onOpenYandexNavi,
    onOpenOpenStreetMap,
    onShareTelegram,
    popupTooltips,
    primaryAction,
  ]);

  return {
    hasCoord,
    hasArticle,
    normalizedArticleHref,
    hasDrivingInfo,
    drivingText,
    primaryAction,
    saveActionVisual,
    secondaryActions,
  };
}
