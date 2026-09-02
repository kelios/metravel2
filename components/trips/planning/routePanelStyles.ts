// components/trips/planning/routePanelStyles.ts
// Стили панели маршрута планировщика (#1491): нумерованные шаги «1 Транспорт →
// 2 Точки маршрута → 3 Итог» и desktop-раскладка «панель слева, карта справа».
//
// Четыре слота `block/header/number/title` — контракт `RouteStepBlock`, того же
// компонента, которым нумерует шаги /map. Разметка общая, токены свои: панель
// планировщика живёт карточками с рамкой, а не строками с разделителем, как
// шторка фильтров карты.
import { Platform, StyleSheet } from 'react-native';
import type { ThemedColors } from '@/hooks/useTheme';
import { webViewStyle } from '@/utils/webProps';

/** Ширина колонки панели на desktop: та же, что у шторки фильтров /map. */
const PANEL_COLUMN_WIDTH = 380;
const COLUMN_GAP = 16;

export const createRoutePanelStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    // ── Шаг ────────────────────────────────────────────────────────────────
    // Тело шага: контролы под заголовком. Отдельная вью нужна, чтобы у секции
    // остались свои testID и accessibilityState, не переезжая на карточку.
    stepBody: { gap: 6 },
    stepBlock: {
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.surfaceMuted,
    },
    stepHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    stepNumber: {
      width: 20,
      height: 20,
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
      color: colors.primaryText,
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 20,
      overflow: 'hidden',
    },
    stepTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    stepBadge: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primaryText,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      overflow: 'hidden',
    },
    stepHint: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textMuted,
      lineHeight: 17,
    },
    stepCheckBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.successLight,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 8,
    },
    stepCheckText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.success,
    },

    // Кнопка действия и подсказка под ней живут одним блоком.
    ctaBlock: { gap: 6 },

    // ── Раскладка ──────────────────────────────────────────────────────────
    // Desktop-раскладка `stack`: панель слева, карта справа — `workspace` всегда
    // применяется вместе с `workspaceSplit`, одноколоночного пути здесь нет.
    // Раскладку `mapFirst` собирает RouteBuilderMobile (#1691) — эти стили её
    // не касаются.
    workspace: { gap: 12 },
    workspaceSplit: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: COLUMN_GAP,
    },
    panelColumn: { gap: 12 },
    panelColumnSplit: {
      flexBasis: PANEL_COLUMN_WIDTH,
      flexGrow: 0,
      // На 768px контейнер отдаёт колонкам меньше, чем 380 + карта: пусть
      // ужимается панель, а карта не схлопывается в полоску.
      flexShrink: 1,
      minWidth: 300,
    },
    mapColumn: { gap: 12 },
    mapColumnSplit: {
      flex: 1,
      minWidth: 0,
      // Карта остаётся перед глазами, пока прокручивается список точек — ради
      // этого и разводятся колонки: на /map карта тоже никуда не уезжает.
      // sticky существует только на web; на native этот ключ невалиден.
      ...Platform.select({
        web: webViewStyle({ position: 'sticky', top: 16 }),
        default: {},
      }),
    },
  });
