// components/trips/planning/RouteBuilderMapFirst.tsx
// #1495: мобильная раскладка вкладки «Маршрут» — карта на весь экран, панель
// маршрута выезжает снизу шторкой с тремя положениями.
//
// Почему не переиспользуется `components/MapPage/MapBottomSheet`: там шторка
// прибита к вьюпорту (`position: fixed` на web, `@gorhom/bottom-sheet` на native)
// и на web пишет высоту в глобальный `bottomSheetStore`, который читают контролы
// /map. В планировщике панель обязана жить внутри своей сцены: экран поездки —
// один общий ScrollView с шапкой и табами, и шторка, приклеенная к вьюпорту,
// осталась бы висеть над вкладками «Люди»/«Экспорт» после ухода со вкладки
// «Маршрут». Поэтому сцена и шторка здесь свои, а снап-логика — та же тройка
// положений, что на /map.
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { RoutingState, RouteSummary, TripTransport } from '@/api/plannedTrips';
import {
  TRANSPORT_ICON_NAME,
  TRANSPORT_LABEL,
  formatDistance,
  formatDuration,
  isRouteApproximate,
} from '@/components/trips/planning/tripPlanFormatting';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { LAYOUT } from '@/constants/layout';
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n/LocaleProvider';
import { webViewStyle } from '@/utils/webProps';

export type RouteSheetSnap = 'summary' | 'points' | 'full';

const SNAP_ORDER: RouteSheetSnap[] = ['summary', 'points', 'full'];

// Свёрнутое положение = ручка (44dp тач-таргет) + строка итога.
const SHEET_COLLAPSED_HEIGHT = 112;
const SHEET_POINTS_RATIO = 0.52;
const SHEET_FULL_RATIO = 0.88;
const SNAP_ANIMATION_MS = 220;
const DRAG_ACTIVATION_PX = 4;

// Сцена занимает вьюпорт без чужого хрома: шапка приложения сверху, нижний док
// и полоса вкладок планировщика над самой сценой — их прятать нельзя, иначе с
// вкладки «Маршрут» будет некуда уйти.
const STAGE_CHROME_RESERVE = LAYOUT.headerHeight + LAYOUT.tabBarHeight + 56;
const STAGE_MIN_HEIGHT = 380;
const STAGE_MAX_HEIGHT = 900;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

interface Props {
  /** Карта конструктора в режиме `fill` — фон всей сцены. */
  mapSlot: React.ReactNode;
  /** Движок превью маршрута: монтируется всегда, независимо от шторки. */
  engineSlot?: React.ReactNode;
  transportSlot: React.ReactNode;
  pointsSlot: React.ReactNode;
  summarySlot: React.ReactNode;
  toolsSlot: React.ReactNode;
  summary: RouteSummary | null;
  routingState?: RoutingState | null;
  transport: TripTransport;
  /**
   * Подсказка поверх карты. В `fill`-режиме карта отдаёт свою шапку сцене, а
   * вместе с ней и строку «нажмите на карту, чтобы добавить точку» — на пустом
   * маршруте её показывает сцена, иначе тап по карте нечем обнаружить.
   */
  mapHint?: string | null;
  /** Индекс открытой формы правки точки: она поднимает шторку к инструментам. */
  editingIndex: number | null;
  /** Растёт на каждый тап по точке в списке: карта центруется, шторка — на половину. */
  focusToken: number;
  /** Положение шторки наружу: точка наблюдения для тестов и будущих потребителей. */
  onSnapChange?: (snap: RouteSheetSnap) => void;
  testID?: string;
}

function RouteBuilderMapFirst({
  mapSlot,
  engineSlot,
  transportSlot,
  pointsSlot,
  summarySlot,
  toolsSlot,
  summary,
  routingState,
  transport,
  mapHint,
  editingIndex,
  focusToken,
  onSnapChange,
  testID = 'route-builder',
}: Props) {
  const { t } = useTranslation();
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { height: windowHeight } = useWindowDimensions();

  const stageHeight = useMemo(
    () => clamp(windowHeight - STAGE_CHROME_RESERVE, STAGE_MIN_HEIGHT, STAGE_MAX_HEIGHT),
    [windowHeight],
  );
  const snapHeights = useMemo<Record<RouteSheetSnap, number>>(
    () => ({
      summary: SHEET_COLLAPSED_HEIGHT,
      points: Math.round(stageHeight * SHEET_POINTS_RATIO),
      full: Math.round(stageHeight * SHEET_FULL_RATIO),
    }),
    [stageHeight],
  );
  // PanResponder создаётся один раз, поэтому актуальные высоты он берёт из ref,
  // а не из замыкания: иначе после поворота экрана тянулся бы старый снап.
  const snapHeightsRef = useRef(snapHeights);
  snapHeightsRef.current = snapHeights;

  const [snap, setSnap] = useState<RouteSheetSnap>('summary');
  const snapRef = useRef<RouteSheetSnap>('summary');
  snapRef.current = snap;

  const heightAnim = useRef(new Animated.Value(SHEET_COLLAPSED_HEIGHT)).current;
  const heightRef = useRef(SHEET_COLLAPSED_HEIGHT);
  useEffect(() => {
    const id = heightAnim.addListener(({ value }) => {
      heightRef.current = value;
    });
    return () => heightAnim.removeListener(id);
  }, [heightAnim]);

  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});

  const registerSection = useCallback(
    (key: string) => (event: LayoutChangeEvent) => {
      sectionOffsets.current[key] = event.nativeEvent.layout.y;
    },
    [],
  );

  const scrollToSection = useCallback((key: string) => {
    const y = sectionOffsets.current[key];
    scrollRef.current?.scrollTo({ y: Math.max(0, (y ?? 0) - 8), animated: true });
  }, []);

  const snapTo = useCallback(
    (next: RouteSheetSnap) => {
      setSnap(next);
      snapRef.current = next;
      onSnapChange?.(next);
      Animated.timing(heightAnim, {
        toValue: snapHeightsRef.current[next],
        duration: SNAP_ANIMATION_MS,
        useNativeDriver: false,
      }).start();
    },
    [heightAnim, onSnapChange],
  );

  // Поворот экрана меняет высоту сцены: подгоняем шторку без анимации, чтобы она
  // не «прыгала» вслед за раскладкой.
  useEffect(() => {
    heightAnim.setValue(snapHeights[snapRef.current]);
  }, [heightAnim, snapHeights]);

  const cycleSnap = useCallback(() => {
    const index = SNAP_ORDER.indexOf(snapRef.current);
    snapTo(SNAP_ORDER[(index + 1) % SNAP_ORDER.length]);
  }, [snapTo]);

  const nearestSnap = useCallback((height: number): RouteSheetSnap => {
    const heights = snapHeightsRef.current;
    return SNAP_ORDER.reduce((best, candidate) =>
      Math.abs(heights[candidate] - height) < Math.abs(heights[best] - height) ? candidate : best,
    );
  }, []);

  const dragStartHeightRef = useRef(SHEET_COLLAPSED_HEIGHT);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Простой тап уходит кнопке ручки: ответчиком становимся только на
        // вертикальном движении, иначе a11y-нажатие перестало бы работать.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dy) > DRAG_ACTIVATION_PX && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          dragStartHeightRef.current = heightRef.current;
        },
        onPanResponderMove: (_event, gesture) => {
          const heights = snapHeightsRef.current;
          heightAnim.setValue(
            clamp(dragStartHeightRef.current - gesture.dy, heights.summary, heights.full),
          );
        },
        onPanResponderRelease: (_event, gesture) => {
          const heights = snapHeightsRef.current;
          const released = clamp(
            dragStartHeightRef.current - gesture.dy,
            heights.summary,
            heights.full,
          );
          snapTo(nearestSnap(released));
        },
        onPanResponderTerminate: () => {
          snapTo(snapRef.current);
        },
      }),
    [heightAnim, nearestSnap, snapTo],
  );

  // Точка, добавленная тапом по карте, и правка точки из списка открывают одну и
  // ту же форму — без подъёма шторки она осталась бы под картой (#1495 п.5).
  const previousEditingRef = useRef<number | null>(editingIndex);
  useEffect(() => {
    const previous = previousEditingRef.current;
    previousEditingRef.current = editingIndex;
    if (editingIndex == null || editingIndex === previous) return;
    snapTo('full');
    scrollToSection('tools');
  }, [editingIndex, scrollToSection, snapTo]);

  // Тап по точке центрует карту: шторку опускаем на половину, иначе центр уедет
  // под развёрнутую панель. Сравниваем сам токен, а не «первый ли это запуск
  // эффекта»: `snapTo` меняет идентичность вслед за `onSnapChange`, и на новой
  // ссылке колбэка эффект иначе схлопывал бы шторку без единого тапа.
  const appliedFocusRef = useRef(focusToken);
  useEffect(() => {
    if (appliedFocusRef.current === focusToken) return;
    appliedFocusRef.current = focusToken;
    if (snapRef.current === 'full') snapTo('points');
  }, [focusToken, snapTo]);

  const openSection = useCallback(
    (key: 'transport' | 'summary') => {
      snapTo('full');
      // Раскладка секции известна только после снапа — скроллим следующим кадром.
      requestAnimationFrame(() => scrollToSection(key));
    },
    [scrollToSection, snapTo],
  );

  const summaryLine = summary
    ? `${formatDistance(summary.distanceKm)} · ${formatDuration(summary.durationMin)}`
    : t('tripsStatic:plan.mapFirst.emptySummary');
  // Свёрнутая шторка — единственное, что видно поверх карты: приблизительная
  // линия обязана быть отмечена и здесь, а не только в развёрнутой сводке.
  const approximate = isRouteApproximate(routingState);
  const summaryIcon = approximate ? 'alert-triangle' : 'navigation';
  const summaryIconColor = approximate ? colors.warningDark : colors.primaryDark;
  const sheetLabel = t('tripsStatic:plan.mapFirst.sheet');
  const handleLabel =
    snap === 'full'
      ? t('tripsStatic:plan.mapFirst.collapse')
      : t('tripsStatic:plan.mapFirst.expand');

  return (
    <View style={[styles.stage, { height: stageHeight }]} testID={testID}>
      <View style={styles.mapLayer}>{mapSlot}</View>
      {engineSlot}

      <View style={styles.chipsRow} pointerEvents="box-none" testID="route-map-chips">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('tripsStatic:plan.mapFirst.transportChip', {
            value: TRANSPORT_LABEL[transport],
          })}
          onPress={() => openSection('transport')}
          style={styles.chip}
          testID="route-map-chip-transport"
        >
          <Feather
            name={TRANSPORT_ICON_NAME[transport] as never}
            size={14}
            color={colors.primaryDark}
          />
          <Text style={styles.chipText} numberOfLines={1}>
            {TRANSPORT_LABEL[transport]}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('tripsStatic:plan.mapFirst.summaryChip')}
          onPress={() => openSection('summary')}
          style={styles.chip}
          testID="route-map-chip-summary"
        >
          <Feather name={summaryIcon} size={14} color={summaryIconColor} />
          <Text style={styles.chipText} numberOfLines={1}>
            {summaryLine}
          </Text>
        </Pressable>
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

      <Animated.View
        style={[styles.sheet, { height: heightAnim }]}
        accessibilityLabel={sheetLabel}
        testID="route-sheet"
      >
        <View style={styles.handleArea} {...panResponder.panHandlers}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={handleLabel}
            accessibilityState={{ expanded: snap !== 'summary' }}
            onPress={cycleSnap}
            style={styles.handleHit}
            testID="route-sheet-handle"
          >
            <View style={styles.handleBar} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('tripsStatic:plan.mapFirst.summaryChip')}
          onPress={() => snapTo(snap === 'summary' ? 'points' : 'summary')}
          style={styles.peekRow}
          testID="route-sheet-peek"
        >
          <Feather name={summaryIcon} size={15} color={summaryIconColor} />
          <Text style={styles.peekText} numberOfLines={1}>
            {summaryLine}
          </Text>
          <Feather
            name={snap === 'summary' ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textSecondary}
          />
        </Pressable>

        <ScrollView
          ref={scrollRef}
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetContent}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          testID="route-sheet-scroll"
        >
          <View onLayout={registerSection('transport')} testID="route-sheet-section-transport">
            {transportSlot}
          </View>
          <View onLayout={registerSection('points')} testID="route-sheet-section-points">
            {pointsSlot}
          </View>
          <View onLayout={registerSection('summary')} testID="route-sheet-section-summary">
            {summarySlot}
          </View>
          <View onLayout={registerSection('tools')} testID="route-sheet-section-tools">
            {toolsSlot}
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

export default React.memo(RouteBuilderMapFirst);

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    stage: {
      position: 'relative',
      width: '100%',
      overflow: 'hidden',
      borderRadius: DESIGN_TOKENS.radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    mapLayer: { flex: 1, minHeight: 0 },
    chipsRow: {
      position: 'absolute',
      top: 10,
      left: 10,
      // Кнопки карты («Слои», «Развернуть») стоят справа — чипам оставляем место.
      right: 108,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      zIndex: 1250,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      maxWidth: '100%',
      paddingHorizontal: 12,
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: webViewStyle({ boxShadow: DESIGN_TOKENS.shadows.light }),
        default: DESIGN_TOKENS.shadowsNative.light,
      }),
    },
    chipText: { flexShrink: 1, fontSize: 13, fontWeight: '700', color: colors.text },
    hintPill: {
      flexBasis: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: DESIGN_TOKENS.radii.sm,
      backgroundColor: colors.surface,
      opacity: 0.94,
    },
    hintText: { flexShrink: 1, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1260,
      overflow: 'hidden',
      borderTopLeftRadius: DESIGN_TOKENS.radii.lg,
      borderTopRightRadius: DESIGN_TOKENS.radii.lg,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: webViewStyle({ boxShadow: DESIGN_TOKENS.shadows.heavy }),
        default: DESIGN_TOKENS.shadowsNative.medium,
      }),
    },
    handleArea: { alignItems: 'center', justifyContent: 'center' },
    handleHit: {
      minHeight: 44,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    handleBar: {
      width: 40,
      height: 4,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: colors.borderStrong,
    },
    peekRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 44,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    peekText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
    sheetScroll: { flex: 1, minHeight: 0 },
    sheetContent: {
      gap: 16,
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 32,
    },
  });
