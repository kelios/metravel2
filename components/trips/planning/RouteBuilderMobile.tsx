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
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import MapIcon from '@/components/MapPage/MapIcon';
import { usePlannerPageScrollTo } from '@/components/trips/planning/PlannerPageScrollView';
import { scrollPlannerNodeIntoView } from '@/components/trips/planning/scrollPlannerNodeIntoView';

import type { RoutingState, RouteSummary, TripTransport } from '@/api/plannedTrips';
import SavedRouteRetryButton from '@/components/trips/planning/SavedRouteRetryButton';
import type { SavedRouteRetryState } from '@/components/trips/planning/useSavedRouteRetry';
import {
  TRANSPORT_ICON_NAME,
  TRANSPORT_LABEL,
  isRouteApproximate,
  routeMetricsLine,
  routingStateHint,
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
   * #2058: `[⌖]` в заголовке дня. Каждый рост счётчика поднимает страницу к
   * карте — подгонку кадра под день карта делает сама по `focusIndices`.
   */
  mapRevealToken?: number;
  /**
   * Подсказка поверх карты. В `fill`-режиме карта отдаёт свою шапку раскладке, а
   * вместе с ней и строку «нажмите на карту, чтобы добавить точку».
   */
  mapHint?: string | null;
  summary: RouteSummary | null;
  routingState?: RoutingState | null;
  transport: TripTransport;
  /** #2065: «Повторить» рядом с причиной деградации сохранённого маршрута. */
  retry?: SavedRouteRetryState | null;
  /** Секции панели маршрута в мобильном порядке. */
  children: React.ReactNode;
  testID?: string;
}

function RouteBuilderMobile({
  mapSlot,
  engineSlot,
  mapRevealToken = 0,
  mapHint,
  summary,
  routingState,
  transport,
  retry,
  children,
  testID = 'route-builder',
}: Props) {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { height: windowHeight } = useWindowDimensions();
  const mapBlockRef = useRef<View>(null);
  const scrollPageTo = usePlannerPageScrollTo();
  // Счётчик живёт в RouteBuilder и переживает эту раскладку: смена ширины окна
  // desktop ↔ mobile монтирует её заново с прежним значением — это не `[⌖]`.
  const revealedTokenRef = useRef(mapRevealToken);

  useEffect(() => {
    if (mapRevealToken === revealedTokenRef.current) return;
    revealedTokenRef.current = mapRevealToken;
    if (Platform.OS === 'web') {
      scrollPlannerNodeIntoView(mapBlockRef.current, { block: 'start', behavior: 'smooth' });
    } else {
      scrollPageTo?.(mapBlockRef.current);
    }
  }, [mapRevealToken, scrollPageTo]);

  const mapHeight = useMemo(
    () => clamp(Math.round(windowHeight * MAP_HEIGHT_RATIO), MAP_MIN_HEIGHT, MAP_MAX_HEIGHT),
    [windowHeight],
  );

  const approximate = isRouteApproximate(routingState);
  const summaryLine = summary ? routeMetricsLine(summary) : t('tripsStatic:plan.mapFirst.emptySummary');
  // #2057: карта в этой раскладке отдаёт свою шапку, поэтому причина
  // приблизительной линии живёт здесь и только здесь — «Итог маршрута»
  // показывает чип, «Файл маршрута» — строку про экспорт (макет §2).
  const reason = routingStateHint(routingState, transport);

  return (
    <View style={styles.wrap} testID={testID}>
      <View ref={mapBlockRef} style={[styles.mapBlock, { height: mapHeight }]} testID="route-mobile-map">
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

      <View style={styles.summaryBlock}>
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
        {reason ? (
          <View style={styles.summaryReasonRow}>
            <Text style={styles.summaryReason} testID="route-mobile-summary-reason">
              {reason}
            </Text>
            <SavedRouteRetryButton retry={retry} testID="route-mobile-summary-retry" />
          </View>
        ) : null}
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
    summaryBlock: { gap: 6 },
    summaryReasonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      paddingHorizontal: 12,
      columnGap: 10,
      rowGap: 6,
    },
    summaryReason: {
      flexShrink: 1,
      minWidth: 160,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
      color: colors.warningDark,
    },
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
