import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import type Feather from '@expo/vector-icons/Feather';

import type { ThemedColors } from '@/hooks/useTheme';
import {
  getNavigationActionVisual,
  NAVIGATION_ACTION_LABELS,
} from '@/components/navigation/navigationActionMeta';

import { POPUP_TOOLTIPS } from './constants';
import { isInternalArticleHref } from './domEvents';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

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
    const mins = Math.max(1, Math.round(drivingDurationSeconds! / 60));
    const kmLabel = km >= 10 ? `${Math.round(km)} км` : `${km.toFixed(1)} км`;
    return `${kmLabel} · ${mins} мин`;
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
        label: 'Маршрут сюда',
        icon: 'corner-up-right' as const,
        onPress: onBuildRoute,
        tooltip: POPUP_TOOLTIPS.buildRoute,
        accessibilityLabel: 'Построить маршрут сюда',
      };
    }

    if (hasArticle) {
      return {
        label: 'Открыть страницу',
        icon: 'arrow-right' as const,
        onPress: onOpenArticle!,
        tooltip: POPUP_TOOLTIPS.openArticle,
        accessibilityLabel: 'Открыть статью о точке',
      };
    }

    if (hasCoord && onOpenGoogleMaps) {
      return {
        label: 'Google Maps',
        icon: 'map' as const,
        onPress: onOpenGoogleMaps,
        tooltip: POPUP_TOOLTIPS.openGoogleMaps,
        accessibilityLabel: 'Открыть точку в Google Maps',
      };
    }

    return null;
  }, [hasArticle, hasCoord, onBuildRoute, onOpenArticle, onOpenGoogleMaps, primaryActionOverride]);

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
        accessibilityLabel: 'Google Maps',
        label: NAVIGATION_ACTION_LABELS.google,
        ...getNavigationActionVisual('google', colors),
        onPress: onOpenGoogleMaps,
        title: POPUP_TOOLTIPS.openGoogleMaps,
      });
    }

    if (hasCoord && onOpenAppleMaps) {
      items.push({
        key: 'apple',
        accessibilityLabel: 'Apple Maps',
        label: NAVIGATION_ACTION_LABELS.apple,
        ...getNavigationActionVisual('apple', colors),
        onPress: onOpenAppleMaps,
        title: POPUP_TOOLTIPS.openAppleMaps,
      });
    }

    if (hasCoord && onOpenOrganicMaps) {
      items.push({
        key: 'organic',
        accessibilityLabel: 'Organic Maps',
        label: NAVIGATION_ACTION_LABELS.organic,
        ...getNavigationActionVisual('organic', colors),
        onPress: onOpenOrganicMaps,
        title: POPUP_TOOLTIPS.openOrganicMaps,
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
        accessibilityLabel: 'Открыть статью',
        label: 'Статья',
        icon: 'book-open',
        iconColor: colors.primary,
        tintBg: colors.primarySoft,
        onPress: onOpenArticle,
        title: POPUP_TOOLTIPS.openArticle,
      });
    }

    if (hasCoord && onOpenWaze) {
      items.push({
        key: 'waze',
        accessibilityLabel: 'Waze',
        label: NAVIGATION_ACTION_LABELS.waze,
        ...getNavigationActionVisual('waze', colors),
        onPress: onOpenWaze,
        title: POPUP_TOOLTIPS.openWaze,
      });
    }

    if (hasCoord && onOpenYandexMaps) {
      items.push({
        key: 'yandex-maps',
        accessibilityLabel: 'Яндекс Карты',
        label: NAVIGATION_ACTION_LABELS['yandex-maps'],
        ...getNavigationActionVisual('yandex-maps', colors),
        onPress: onOpenYandexMaps,
        title: POPUP_TOOLTIPS.openYandexMaps,
      });
    }

    if (hasCoord && onOpenYandexNavi) {
      items.push({
        key: 'yandex',
        accessibilityLabel: 'Яндекс Навигатор',
        label: NAVIGATION_ACTION_LABELS.yandex,
        ...getNavigationActionVisual('yandex', colors),
        onPress: onOpenYandexNavi,
        title: POPUP_TOOLTIPS.openYandexNavi,
      });
    }

    if (hasCoord && onOpenOpenStreetMap) {
      items.push({
        key: 'osm',
        accessibilityLabel: 'OpenStreetMap',
        label: NAVIGATION_ACTION_LABELS.osm,
        ...getNavigationActionVisual('osm', colors),
        onPress: onOpenOpenStreetMap,
        title: POPUP_TOOLTIPS.openOpenStreetMap,
      });
    }

    if (hasCoord && onShareTelegram) {
      items.push({
        key: 'telegram',
        accessibilityLabel: 'Поделиться в Telegram',
        label: NAVIGATION_ACTION_LABELS.telegram,
        ...getNavigationActionVisual('telegram', colors),
        onPress: onShareTelegram,
        title: POPUP_TOOLTIPS.shareTelegram,
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
