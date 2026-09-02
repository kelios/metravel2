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
 * поэтому она не раздувает ряд сводки: по вертикали таргет ограничен высотой
 * самого ряда (ROUTE_CONTROL_TOUCH_TARGET_SIZE — принятый floor 44dp, тот же,
 * что у пилюль выбора старта), по горизонтали работают все 48dp.
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
/** Зазор между ярусами правого стека (`toolbarStack`). */
const TOOLBAR_STACK_GAP = 6
/**
 * #1699 — под тулбаром живёт РОВНО один ярус маршрута: выбор старта, пока
 * заданы не оба конца, и сводка, как только маршрут построен. Раньше ярусов
 * было два (селектор 44dp + карточка сводки 68dp), и вместе с зазором они
 * съедали 118dp полотна карты. На столько же поповеры и подсказка уезжают вниз,
 * когда ярус занят; значение считается из высоты ряда и зазора стека, чтобы у
 * вертикали был один источник правды (тот же приём, что в `mapFilterChips.ts`).
 */
export const MAP_ROUTE_ROW_STACK_OFFSET = ROUTE_CONTROL_TOUCH_TARGET_SIZE + TOOLBAR_STACK_GAP
/**
 * Ряд маршрута стоит справа, слева от него — круглая кнопка локации (38px) +
 * отступы root (10+10). Прежний хардкод 292px был УЖЕ содержимого ряда (~302px
 * при 390px вьюпорта), поэтому «На карте» уезжало за правый край. Считаем
 * реально доступную ширину; на совсем узких экранах содержимое ужимается
 * (flexShrink) вместо обрезки. Для сводки это ПОТОЛОК, а не ширина: готовая
 * строка короче ряда выбора старта и закрывает меньше карты.
 */
export const MAP_ROUTE_ROW_RESERVED = 62
export const MAP_ROUTE_ROW_MAX_WIDTH = 340
export const MAP_ROUTE_ROW_MIN_WIDTH = 200
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
      gap: TOOLBAR_STACK_GAP,
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
    // #1699 — сводка живёт в том же одном ярусе, что и селектор старта: строка
    // высотой ROUTE_CONTROL_TOUCH_TARGET_SIZE вместо карточки в два яруса (68dp).
    // Ширину даёт содержимое (компонент ограничивает её тем же максимумом, что
    // и у селектора): готовая сводка короче ряда выбора старта, поэтому пилюля
    // закрывает меньше карты, чем фиксированная ширина.
    routeSummaryCard: {
      minHeight: ROUTE_CONTROL_TOUCH_TARGET_SIZE,
      // Компенсация уменьшенного padding у root (см. activeFiltersRow).
      marginRight: MAP_TOOLBAR_TOUCH_PADDING,
      flexDirection: 'row',
      alignItems: 'center' as const,
      gap: 6,
      // Вертикального поля нет: высоту держит minHeight, иначе 48dp-рамка
      // крестика раздула бы ряд (тот же приём, что и у routeStartSelector).
      paddingVertical: 0,
      paddingLeft: 12,
      // Справа поля больше: отрицательные поля рамки крестика съедают 11dp,
      // остаток отводит видимый круг от скруглённого края пилюли.
      paddingRight: 14,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...(Platform.OS === 'web' ? shadowWeb : shadowNative),
    },
    // Единственный ужимаемый выход ряда: крестик стоит СНАРУЖИ него и потому
    // всегда остаётся внутри пилюли. Внутри выхода первым сдаёт подпись
    // состояния (flexShrink), а если её уже нет — метрики не выезжают на карту,
    // а обрезаются по краю выхода.
    routeSummaryContent: {
      flexShrink: 1,
      minWidth: 0,
      overflow: 'hidden' as const,
      flexDirection: 'row',
      alignItems: 'center' as const,
      gap: 6,
    },
    // Усекается первым: цифры маршрута важнее подписи состояния.
    routeSummaryTitle: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: 12,
      lineHeight: 15,
      fontWeight: '700' as const,
      color: colors.text,
    },
    // Кликабельная область крестика: прозрачная рамка 48×48dp. Отрицательные
    // поля съедают её на краях, поэтому ряд остаётся одноярусным (44dp), а
    // правое поле пилюли (14dp) держит рамку внутри её границ — иначе часть
    // таргета вышла бы за родителя, где тап уже не доходит до потомка (#1274).
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
      // Один ярус держит отсутствие flexWrap (было 'wrap' — метрики уезжали
      // вторым этажом). flexShrink: 0 — про другое: цифры не ужимаются, пока в
      // ряду есть подпись состояния, которую можно усечь (#1699).
      flexShrink: 0,
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
  })
