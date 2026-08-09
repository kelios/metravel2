// components/trips/planning/RoutePointRow.tsx
// #1303: строка точки в конструкторе маршрута. Вынесена из RouteBuilder и
// мемоизирована: во время перетаскивания состояние обновляется на каждом кадре,
// и без memo длинный маршрут пересобирал бы все строки на каждое движение.
import React from 'react';
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
} from '@/components/trips/planning/tripPlanFormatting';
import type { ThemedColors } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n/LocaleProvider';
import { webViewStyle } from '@/utils/webProps';
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
  formatCoordinate: (value: number) => string;
  onLayout: (index: number, event: LayoutChangeEvent) => void;
  onEdit: (index: number) => void;
  onMove: (index: number, delta: number) => void;
  onDelete: (index: number) => void;
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
  formatCoordinate,
  onLayout,
  onEdit,
  onMove,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const moveUpLabel = t('trips:components.trips.planning.RouteBuilder.podnyat_tochku_vyshe_23208202');
  const moveDownLabel = t('trips:components.trips.planning.RouteBuilder.opustit_tochku_nizhe_c1c13a3e');
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
  // Pointer Events resolve touch-action before pointerdown. Keep vertical page
  // scrolling available from the start; the web touch listener claims the
  // gesture with preventDefault only after the hold delay has elapsed.
  const webScrollableHandleStyle = Platform.OS === 'web'
    ? webViewStyle({ touchAction: 'pan-y' })
    : null;

  return (
    <View
      onLayout={(event) => onLayout(index, event)}
      style={[
        styles.pointRow,
        !dragHandlers && styles.pointRowFlat,
        isDropTarget && styles.pointRowDropTarget,
        isDragging && styles.pointRowDragging,
        isDragging && { transform: [{ translateY: dragOffsetY }] },
      ]}
      testID={`route-builder-point-${index}`}
    >
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
          style={[
            styles.dragHandle,
            webScrollableHandleStyle,
            isDragging && styles.dragHandleActive,
          ]}
          testID={`route-builder-drag-${index}`}
          {...dragHandlers}
          {...webKeyboardProps}
        >
          <Feather name="menu" size={18} color={isDragging ? colors.primaryDark : colors.textMuted} />
        </View>
      ) : null}
      <View style={styles.pointBody}>
        <View style={styles.pointTypeRow}>
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
        {point.coordinates ? (
          <Text style={styles.pointCoordinates}>
            {formatCoordinate(point.coordinates[1])}, {formatCoordinate(point.coordinates[0])}
          </Text>
        ) : null}
      </View>
      {isOwner ? (
        <View style={styles.pointControls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('trips:components.trips.planning.RouteBuilder.redaktirovat_tochku_8815b389')}
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
  );
}

export default React.memo(RoutePointRow);
