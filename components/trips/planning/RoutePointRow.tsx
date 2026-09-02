// components/trips/planning/RoutePointRow.tsx
// #1303: строка точки в конструкторе маршрута. Вынесена из RouteBuilder и
// мемоизирована: во время перетаскивания состояние обновляется на каждом кадре,
// и без memo длинный маршрут пересобирал бы все строки на каждое движение.
//
// Мобильная (`compact`) строка отличается набором управления: там вся строка —
// одна кнопка «открыть точку», а редактор раскрывается под ней (`editorSlot`).
// Четыре иконки по 44dp съедали 188px из ~310px ширины на 390px, и названию
// точки оставалось ~46px — «Минск, площадь Победы» переносился по слогам.
// Стрелки «выше/ниже» и удаление переехали в раскрытый редактор; клавиатурный и
// a11y-путь перестановки остался на ручке перетаскивания.
import React, { useEffect, useRef } from 'react';
import Feather from '@expo/vector-icons/Feather';
import {
  Platform,
  Pressable,
  Text,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';

import type { RoutePoint } from '@/api/plannedTrips';
import TripPlanLinkedText from '@/components/trips/planning/TripPlanLinkedText';
import {
  ROUTE_POINT_ICON_NAME,
  ROUTE_POINT_LABEL,
  formatRoutePointCoordinates,
} from '@/components/trips/planning/tripPlanFormatting';
import type { ThemedColors } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n/LocaleProvider';
import type { createStyles } from './RouteBuilder.styles';
import type { RouteDragHandlers } from './useRoutePointDrag';

type RouteBuilderStyles = ReturnType<typeof createStyles>;

interface Props {
  point: RoutePoint;
  index: number;
  total: number;
  isOwner: boolean;
  styles: RouteBuilderStyles;
  colors: ThemedColors;
  /** `null`, когда перетаскивание недоступно (не владелец или одна точка). */
  dragHandlers: RouteDragHandlers | null;
  isDragging: boolean;
  isDropTarget: boolean;
  dragOffsetY: number;
  onLayout: (index: number, event: LayoutChangeEvent) => void;
  onEdit: (index: number) => void;
  /**
   * #1495: тап по телу строки центрует карту на точке. Передаётся только в
   * мобильной раскладке `mapFirst` — в двухколоночной `stack` строка остаётся
   * неинтерактивной, чтобы не перехватывать выделение текста описания.
   */
  onFocus?: (index: number) => void;
  onMove: (index: number, delta: number) => void;
  onDelete: (index: number) => void;
  /**
   * Мобильная строка: управление сворачивается до одной кнопки на всю строку,
   * текст точки получает освободившиеся ~190px ширины.
   */
  compact?: boolean;
  /** Открыт ли редактор этой точки — строка подсвечивается и разворачивает чеврон. */
  isEditing?: boolean;
  /** Инлайн-редактор точки: рисуется под строкой, внутри той же карточки. */
  editorSlot?: React.ReactNode;
  /**
   * Сворачивание открытого инлайн-редактора. Без него кнопка со стрелкой вверх
   * обещала «свернуть», а звала ту же `onEdit` — форма пересобиралась из
   * сохранённой точки и молча теряла введённое.
   */
  onCloseEdit?: () => void;
}

/**
 * Тело строки: нажимаемое только когда раскладка попросила интерактивность.
 * Без обработчика это обычный View — двухколоночная `stack` не должна получать
 * лишнюю кнопку вокруг описания точки.
 */
function PointBody({
  index,
  style,
  onPress,
  label,
  testID,
  children,
}: {
  index: number;
  style: RouteBuilderStyles['pointBody'];
  onPress?: (index: number) => void;
  label: string;
  testID: string;
  children: React.ReactNode;
}) {
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onPress(index)}
      style={style}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

function RoutePointRow({
  point,
  index,
  total,
  isOwner,
  styles,
  colors,
  dragHandlers,
  isDragging,
  isDropTarget,
  dragOffsetY,
  onLayout,
  onEdit,
  onMove,
  onDelete,
  onFocus,
  compact = false,
  isEditing = false,
  editorSlot = null,
  onCloseEdit,
}: Props) {
  const { t } = useTranslation();
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const coordinatesLabel = formatRoutePointCoordinates(point.coordinates);
  const moveUpLabel = t('trips:components.trips.planning.RouteBuilder.podnyat_tochku_vyshe_23208202');
  const moveDownLabel = t('trips:components.trips.planning.RouteBuilder.opustit_tochku_nizhe_c1c13a3e');
  const editLabel = t('trips:components.trips.planning.RouteBuilder.redaktirovat_tochku_8815b389');
  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'decrement' && !isFirst) onMove(index, -1);
    if (event.nativeEvent.actionName === 'increment' && !isLast) onMove(index, 1);
  };
  const handleKeyDown = (event: unknown) => {
    const source = event as {
      key?: string;
      preventDefault?: () => void;
      nativeEvent?: { key?: string };
    };
    const key = source.key ?? source.nativeEvent?.key;
    if (key === 'ArrowUp' && !isFirst) {
      source.preventDefault?.();
      onMove(index, -1);
    } else if (key === 'ArrowDown' && !isLast) {
      source.preventDefault?.();
      onMove(index, 1);
    }
  };
  const webKeyboardProps = Platform.OS === 'web'
    ? { tabIndex: 0 as const, onKeyDown: handleKeyDown }
    : {};

  // Точку, добавленную тапом по карте, редактор открывает в конце списка — она
  // оказывается ниже сгиба. Подводим карточку к кадру, когда её редактор
  // раскрылся; `nearest` не двигает страницу, если карточка и так видна.
  const cardRef = useRef<View | null>(null);
  useEffect(() => {
    if (!compact || !isEditing || Platform.OS !== 'web') return;
    const node = cardRef.current as unknown as {
      scrollIntoView?: (options?: { block?: string; behavior?: string }) => void;
    } | null;
    node?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [compact, isEditing]);

  // Мобильная строка открывает редактор и одновременно центрует карту: один
  // жест вместо «карандаш где-то справа» плюс «тап по телу строки». Пока
  // редактор этой точки открыт, повторный тап только центрует карту: второй
  // `onEdit` пересобрал бы форму и стёр несохранённый ввод.
  const handleBodyPress = compact
    ? (target: number) => {
        onFocus?.(target);
        if (!isEditing) onEdit(target);
      }
    : onFocus;

  return (
    <View
      ref={cardRef}
      onLayout={(event) => onLayout(index, event)}
      style={[
        styles.pointCard,
        isEditing && styles.pointCardEditing,
        isDropTarget && styles.pointRowDropTarget,
        isDragging && styles.pointRowDragging,
        isDragging && { transform: [{ translateY: dragOffsetY }] },
      ]}
      testID={`route-builder-point-${index}`}
    >
      <View style={[styles.pointRow, !dragHandlers && styles.pointRowFlat]}>
        {dragHandlers ? (
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={t('tripsStatic:plan.route.dragHandle', { name: point.name })}
            accessibilityHint={t('tripsStatic:plan.route.dragHint')}
            accessibilityValue={{ min: 1, max: total, now: index + 1 }}
            accessibilityActions={[
              ...(!isFirst ? [{ name: 'decrement' as const, label: moveUpLabel }] : []),
              ...(!isLast ? [{ name: 'increment' as const, label: moveDownLabel }] : []),
            ]}
            onAccessibilityAction={handleAccessibilityAction}
            style={[styles.dragHandle, isDragging && styles.dragHandleActive]}
            testID={`route-builder-drag-${index}`}
            {...dragHandlers}
            {...webKeyboardProps}
          >
            <Feather name="menu" size={18} color={isDragging ? colors.primaryDark : colors.textMuted} />
          </View>
        ) : null}
        <PointBody
          index={index}
          style={styles.pointBody}
          onPress={handleBodyPress}
          label={
            compact
              ? `${index + 1}. ${point.name} — ${editLabel}`
              : t('tripsStatic:plan.route.focusPoint', { name: point.name })
          }
          testID={`route-builder-focus-${index}`}
        >
          <View style={styles.pointTypeRow}>
            {/* Номер точки — единственная связь строки с порядком на карте. */}
            <Text style={styles.pointOrder}>{index + 1}</Text>
            <Feather
              name={ROUTE_POINT_ICON_NAME[point.type] as never}
              size={12}
              color={colors.primaryDark}
            />
            <Text style={styles.pointType}>{ROUTE_POINT_LABEL[point.type]}</Text>
          </View>
          <Text style={styles.pointName}>{point.name}</Text>
          {point.description ? (
            <TripPlanLinkedText
              text={point.description}
              style={styles.pointDescription}
              linkStyle={styles.descriptionLink}
            />
          ) : null}
          {coordinatesLabel ? (
            <Text
              style={styles.pointCoordinates}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {coordinatesLabel}
            </Text>
          ) : null}
        </PointBody>
        {isOwner && compact ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editLabel}
            accessibilityState={{ expanded: isEditing }}
            onPress={() => (isEditing ? onCloseEdit?.() : onEdit(index))}
            style={styles.ctrl}
            testID={`route-builder-edit-${index}`}
          >
            <Feather
              name={isEditing ? 'chevron-up' : 'edit-2'}
              size={16}
              color={colors.primaryDark}
            />
          </Pressable>
        ) : null}
        {isOwner && !compact ? (
          <View style={styles.pointControls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={editLabel}
              onPress={() => onEdit(index)}
              style={styles.ctrl}
              testID={`route-builder-edit-${index}`}
            >
              <Feather name="edit-2" size={15} color={colors.primaryDark} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={moveUpLabel}
              disabled={isFirst}
              onPress={() => onMove(index, -1)}
              style={[styles.ctrl, isFirst && styles.ctrlDisabled]}
              testID={`route-builder-move-up-${index}`}
            >
              <Feather name="chevron-up" size={16} color={colors.text} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={moveDownLabel}
              disabled={isLast}
              onPress={() => onMove(index, 1)}
              style={[styles.ctrl, isLast && styles.ctrlDisabled]}
              testID={`route-builder-move-down-${index}`}
            >
              <Feather name="chevron-down" size={16} color={colors.text} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('trips:components.trips.planning.RouteBuilder.udalit_tochku_37161453')}
              onPress={() => onDelete(index)}
              style={styles.ctrl}
              testID={`route-builder-delete-${index}`}
            >
              <Feather name="trash-2" size={15} color={colors.danger} />
            </Pressable>
          </View>
        ) : null}
      </View>
      {editorSlot ? <View style={styles.pointEditor}>{editorSlot}</View> : null}
    </View>
  );
}

export default React.memo(RoutePointRow);
