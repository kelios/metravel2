// components/trips/planning/RouteBuilderMobile.tsx
// Мобильная раскладка вкладки «Маршрут»: карта фиксированной высоты обычным
// блоком в потоке страницы, панель маршрута — контент под ней.
//
// Почему не шторка (#1495): шторка жила ВНУТРИ страничного ScrollView экрана
// поездки, поэтому давала третий вложенный скролл. Замер на 390×844: сцена
// карты 676px при видимом окне страницы 672px (100% скроллпорта), внутреннее
// окно шторки 23px в свёрнутом положении и 506px в развёрнутом при контенте
// 2269px — до «Добавить точку» и «Сохранить маршрут» приходилось прокручивать
// ~2000px в окне высотой в пятую часть экрана. Здесь скролл ровно один —
// страничный, а карта остаётся первым элементом вкладки.
import React, { useMemo } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import MapIcon from '@/components/MapPage/MapIcon';

import type { RoutingState, RouteSummary, TripTransport } from '@/api/plannedTrips';
import {
  TRANSPORT_ICON_NAME,
  TRANSPORT_LABEL,
  formatDistance,
  formatDuration,
  isRouteApproximate,
} from '@/components/trips/planning/tripPlanFormatting';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n/LocaleProvider';
import { webViewStyle } from '@/utils/webProps';

// Карта занимает верхнюю часть вкладки, но обязана оставлять на первом экране
// начало списка точек — иначе список снова прячется «где-то ниже».
const MAP_HEIGHT_RATIO = 0.42;
const MAP_MIN_HEIGHT = 260;
const MAP_MAX_HEIGHT = 420;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

interface Props {
  /** Карта конструктора в режиме `fill` — заполняет блок фиксированной высоты. */
  mapSlot: React.ReactNode;
  /** Движок превью маршрута: монтируется всегда, независимо от раскладки. */
  engineSlot?: React.ReactNode;
  /**
   * Подсказка поверх карты. В `fill`-режиме карта отдаёт свою шапку раскладке, а
   * вместе с ней и строку «нажмите на карту, чтобы добавить точку».
   */
  mapHint?: string | null;
  summary: RouteSummary | null;
  routingState?: RoutingState | null;
  transport: TripTransport;
  /** Секции панели маршрута в мобильном порядке. */
  children: React.ReactNode;
  testID?: string;
}

function RouteBuilderMobile({
  mapSlot,
  engineSlot,
  mapHint,
  summary,
  routingState,
  transport,
  children,
  testID = 'route-builder',
}: Props) {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { height: windowHeight } = useWindowDimensions();

  const mapHeight = useMemo(
    () => clamp(Math.round(windowHeight * MAP_HEIGHT_RATIO), MAP_MIN_HEIGHT, MAP_MAX_HEIGHT),
    [windowHeight],
  );

  const approximate = isRouteApproximate(routingState);
  const summaryLine = summary
    ? `${formatDistance(summary.distanceKm)} · ${formatDuration(summary.durationMin)}`
    : t('tripsStatic:plan.mapFirst.emptySummary');

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={[styles.mapBlock, { height: mapHeight }]} testID="route-mobile-map">
        {mapSlot}
        {mapHint ? (
          // Подсказка лежит поверх карты и обязана пропускать тап сквозь себя:
          // иначе она сама съедала бы добавление точки в своей полосе.
          <View style={styles.hintPill} pointerEvents="none" testID="route-map-hint">
            <Feather name="info" size={12} color={colors.textSecondary} />
            <Text style={styles.hintText} numberOfLines={2}>
              {mapHint}
            </Text>
          </View>
        ) : null}
      </View>
      {engineSlot}

      <View style={styles.summaryRow} testID="route-mobile-summary">
        <MapIcon
          name={TRANSPORT_ICON_NAME[transport]}
          size={16}
          color={colors.primaryDark}
        />
        <Text style={styles.summaryText} numberOfLines={1}>
          {TRANSPORT_LABEL[transport]}
        </Text>
        <View style={styles.summaryDivider} />
        <Feather
          name={approximate ? 'alert-triangle' : 'navigation'}
          size={14}
          color={approximate ? colors.warningDark : colors.primaryDark}
        />
        <Text style={styles.summaryText} numberOfLines={1}>
          {summaryLine}
        </Text>
      </View>

      {children}
    </View>
  );
}

export default React.memo(RouteBuilderMobile);

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    wrap: { gap: 12 },
    mapBlock: {
      position: 'relative',
      width: '100%',
      overflow: 'hidden',
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    hintPill: {
      position: 'absolute',
      left: 10,
      right: 10,
      bottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.surface,
      opacity: 0.94,
      zIndex: 1200,
    },
    hintText: { flexShrink: 1, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 40,
      paddingHorizontal: 12,
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surfaceMuted,
      ...Platform.select({
        web: webViewStyle({ boxShadow: DESIGN_TOKENS.shadows.light }),
        default: DESIGN_TOKENS.shadowsNative.light,
      }),
    },
    summaryText: { flexShrink: 1, fontSize: 13, fontWeight: '700', color: colors.text },
    summaryDivider: {
      width: 1,
      height: 16,
      marginHorizontal: 2,
      backgroundColor: colors.border,
    },
  });
