import { Platform, StyleSheet } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { ThemedColors } from '@/hooks/useTheme'

/** Диаметр видимого круга кнопки. */
const BUTTON_SIZE = 38
/**
 * Тач-таргет кнопки тулбара — минимум Material/Android accessibility.
 *
 * Раньше кликабельной была ровно видимая окружность 38dp, а «добор» до нормы
 * приписывали `hitSlop`. На Android это не работает: RN ищет цель, спускаясь по
 * дереву, и в потомка попадает только если точка уже внутри РОДИТЕЛЯ. Ряд
 * `toolbar` обтягивает кнопки вплотную, поэтому hitSlop за его границы не
 * выходил — тап на 3dp ниже кнопки не срабатывал (проверено tap-пробой на
 * устройстве). Поэтому таргет задан реальным размером вью, а видимый круг
 * остаётся 38dp внутри прозрачной рамки.
 */
export const MAP_TOOLBAR_TOUCH_TARGET_SIZE = 48
/** Прозрачные поля вокруг видимого круга — по ним и добирается тач-таргет. */
export const MAP_TOOLBAR_TOUCH_PADDING = (MAP_TOOLBAR_TOUCH_TARGET_SIZE - BUTTON_SIZE) / 2

/** Видимый круг «скрыть сводку маршрута» — размер не меняется. */
const ROUTE_SUMMARY_CLOSE_SIZE = 26
/**
 * Тач-таргет того же крестика. Тот же приём, что и у тулбара: кликабельна
 * прозрачная рамка, а не видимый круг. Рамка вынесена в отрицательные поля,
 * поэтому шапка карточки маршрута остаётся прежней высоты (26dp).
 */
const ROUTE_SUMMARY_CLOSE_TOUCH_SIZE = MAP_TOOLBAR_TOUCH_TARGET_SIZE
const ROUTE_SUMMARY_CLOSE_TOUCH_INSET =
  (ROUTE_SUMMARY_CLOSE_TOUCH_SIZE - ROUTE_SUMMARY_CLOSE_SIZE) / 2

/**
 * Минимальный тач-таргет для элементов, высоту которых задаёт их собственный
 * контейнер (пилюли выбора старта, действие в подсказке маршрута). 48dp сюда
 * не влезает без роста контейнера, 44dp — принятый в проекте floor.
 */
const ROUTE_CONTROL_TOUCH_TARGET_SIZE = 44
/** Вертикальные поля плашки подсказки — их же компенсирует действие. */
const ROUTE_HINT_PADDING_VERTICAL = 6

const shadowWeb = {
  boxShadow: '0 2px 10px rgba(15,23,42,0.12)',
} as const

const shadowNative = {
  shadowColor: DESIGN_TOKENS.colors.text,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 6,
  elevation: 4,
} as const

export const getMapMobileTopOverlayStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    root: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1500,
      // Отступ уменьшен на прозрачные поля тач-таргета, чтобы видимые круги
      // остались на прежних 10dp от края экрана.
      paddingHorizontal: 10 - MAP_TOOLBAR_TOUCH_PADDING,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      // Правая группа остаётся однострочной даже на узких телефонах: видимая
      // кнопка 38dp, а промежуток между кругами дают прозрачные поля соседних
      // тач-таргетов (по 5dp), поэтому собственного gap у ряда нет — иначе
      // кнопки разъехались бы. Локация вынесена в левый край root.
      gap: 0,
      // Ширину ряда ограничивает компонент по реальному вьюпорту; на экранах
      // уже ~345dp (режим маршрута — 6 кнопок) таргеты ужимаются к видимому
      // кругу, вместо того чтобы уехать за правый край.
      minWidth: 0,
    },
    toolbarStack: {
      alignItems: 'flex-end' as const,
      gap: 6,
    },
    routeToolbar: {
      flexDirection: 'row',
      alignItems: 'center' as const,
      gap: 0,
      flexShrink: 1,
      minWidth: 0,
    },
    // Ряд чипов активных фильтров под тулбаром (radius-режим).
    activeFiltersRow: {
      alignSelf: 'flex-end' as const,
      minWidth: 0,
      // Компенсация уменьшенного padding у root: ряд остаётся на 10dp от края.
      marginRight: MAP_TOOLBAR_TOUCH_PADDING,
    },
    routeStartSelector: {
      minHeight: ROUTE_CONTROL_TOUCH_TARGET_SIZE,
      // Компенсация уменьшенного padding у root (см. activeFiltersRow).
      marginRight: MAP_TOOLBAR_TOUCH_PADDING,
      // Ширину задаёт компонент по реальной свободной ширине вьюпорта; прежний
      // жёсткий maxWidth 292 был уже содержимого и обрезал «На карте».
      maxWidth: 340,
      flexDirection: 'row',
      alignItems: 'center' as const,
      gap: 4,
      // Вертикального поля нет: иначе пилюли внутри не могут занять все 44dp,
      // а селектор вырос бы до 52dp. Горизонтальный инсет сохранён.
      paddingVertical: 0,
      paddingHorizontal: 4,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...(Platform.OS === 'web' ? shadowWeb : shadowNative),
    },
    routeStartSelectorLabel: {
      flexShrink: 0,
      paddingLeft: 6,
      paddingRight: 2,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700' as const,
      color: colors.textMuted,
    },
    routeStartOption: {
      // Тач-таргет = высота самой пилюли: hitSlop за границы плотного селектора
      // не выходит (#1274).
      minHeight: ROUTE_CONTROL_TOUCH_TARGET_SIZE,
      // На узких экранах опции ужимаются и текст усекается многоточием, вместо
      // того чтобы уезжать за правый край вьюпорта.
      flexShrink: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 4,
      paddingHorizontal: 8,
      borderRadius: 18,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as object) : null),
    },
    routeStartOptionActive: {
      backgroundColor: colors.primarySoft,
    },
    routeStartOptionText: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '600' as const,
      color: colors.textMuted,
    },
    routeStartOptionTextActive: {
      color: colors.primaryDark,
      fontWeight: '700' as const,
    },
    // Кликабельная область: 48×48dp прозрачной рамки вокруг видимого круга.
    iconButtonTouch: {
      width: MAP_TOOLBAR_TOUCH_TARGET_SIZE,
      height: MAP_TOOLBAR_TOUCH_TARGET_SIZE,
      // На узком экране ряд ужимается до видимого круга, а не обрезается.
      flexShrink: 1,
      minWidth: BUTTON_SIZE,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    // Видимый круг кнопки — размер не менялся, чтобы тулбар не раздувался.
    iconButton: {
      width: BUTTON_SIZE,
      height: BUTTON_SIZE,
      borderRadius: BUTTON_SIZE / 2,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      // Статичный «фрост»-фон (правило проекта: без живого blur на мобиле).
      backgroundColor: colors.surface,
      ...(Platform.OS === 'web' ? shadowWeb : shadowNative),
    },
    iconButtonPressed: {
      opacity: 0.85,
    },
    iconButtonActive: {
      backgroundColor: colors.primarySoft,
    },
    badge: {
      position: 'absolute' as const,
      top: -3,
      right: -3,
      minWidth: 18,
      height: 16,
      paddingHorizontal: 4,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderWidth: 1.5,
      borderColor: colors.surface,
    },
    routeProgressBadge: {
      position: 'absolute' as const,
      top: -3,
      right: -6,
      minWidth: 24,
      height: 16,
      paddingHorizontal: 4,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderWidth: 1.5,
      borderColor: colors.surface,
    },
    badgeText: {
      fontSize: 9,
      lineHeight: 11,
      fontWeight: '700' as const,
      color: colors.textOnPrimary,
    },
    routeHint: {
      position: 'absolute' as const,
      top: BUTTON_SIZE + 54,
      left: 10,
      right: 10,
      flexDirection: 'row',
      alignItems: 'center' as const,
      // Без flexWrap: действие живёт в той же строке, что и текст, поэтому
      // плашка занимает один ярус, а не два (раньше ~82px и наезжала на «Старт»).
      gap: 6,
      paddingVertical: ROUTE_HINT_PADDING_VERTICAL,
      paddingHorizontal: 10,
      borderRadius: 10,
      // Статичный «фрост»-фон (правило проекта: без живого blur на мобиле).
      backgroundColor: colors.surfaceMuted,
      ...(Platform.OS === 'web' ? shadowWeb : shadowNative),
    },
    routeHintText: {
      flex: 1,
      minWidth: 0,
      fontSize: 12,
      lineHeight: 15,
      fontWeight: '600' as const,
      color: colors.text,
    },
    routeHintActionPrimary: {
      // 44dp собственной высоты вместо 32 + hitSlop. Отрицательные вертикальные
      // поля съедают padding плашки, поэтому она остаётся одноярусной (44dp) и
      // не наезжает на «Старт».
      minHeight: ROUTE_CONTROL_TOUCH_TARGET_SIZE,
      marginVertical: -ROUTE_HINT_PADDING_VERTICAL,
      flexShrink: 0,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingHorizontal: 12,
      borderRadius: 9,
      backgroundColor: colors.primary,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    routeHintActionPressed: {
      opacity: 0.75,
    },
    routeHintActionPrimaryText: {
      fontSize: 12,
      lineHeight: 14,
      fontWeight: '700' as const,
      color: colors.textOnPrimary,
    },
    routeSummaryCard: {
      width: 244,
      maxWidth: '100%' as any,
      // Компенсация уменьшенного padding у root (см. activeFiltersRow).
      marginRight: MAP_TOOLBAR_TOUCH_PADDING,
      paddingVertical: 9,
      paddingHorizontal: 11,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...(Platform.OS === 'web' ? shadowWeb : shadowNative),
    },
    routeSummaryHeader: {
      flexDirection: 'row',
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: 8,
      marginBottom: 7,
    },
    routeSummaryTitleRow: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center' as const,
      gap: 6,
    },
    routeSummaryTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: 12,
      lineHeight: 15,
      fontWeight: '700' as const,
      color: colors.text,
    },
    // Кликабельная область крестика: прозрачная рамка 48×48dp. Отрицательные
    // поля возвращают шапке прежнюю высоту, поэтому карточка не выросла.
    routeSummaryCloseTouch: {
      width: ROUTE_SUMMARY_CLOSE_TOUCH_SIZE,
      height: ROUTE_SUMMARY_CLOSE_TOUCH_SIZE,
      margin: -ROUTE_SUMMARY_CLOSE_TOUCH_INSET,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      flexShrink: 0,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
    },
    // Видимый круг — размер не менялся.
    routeSummaryClose: {
      width: ROUTE_SUMMARY_CLOSE_SIZE,
      height: ROUTE_SUMMARY_CLOSE_SIZE,
      borderRadius: ROUTE_SUMMARY_CLOSE_SIZE / 2,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: colors.surfaceMuted,
    },
    routeSummaryClosePressed: {
      opacity: 0.75,
    },
    routeSummaryMetrics: {
      flexDirection: 'row',
      alignItems: 'center' as const,
      flexWrap: 'wrap' as const,
      gap: 6,
    },
    routeSummaryMetric: {
      minHeight: 28,
      flexDirection: 'row',
      alignItems: 'center' as const,
      gap: 5,
      paddingVertical: 5,
      paddingHorizontal: 8,
      borderRadius: 9,
      backgroundColor: colors.primarySoft,
      flexShrink: 0,
    },
    routeSummaryMetricText: {
      fontSize: 12,
      lineHeight: 14,
      fontWeight: '700' as const,
      color: colors.primaryDark,
    },
    routeSummaryNote: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '600' as const,
      color: colors.textMuted,
    },
  })
