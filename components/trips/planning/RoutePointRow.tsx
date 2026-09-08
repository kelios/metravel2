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
//
// Та же арифметика догнала и десктопную раскладку: панель конструктора шириной
// 380 (`routePanelStyles.ts`) оставляет карточке ~356px, из которых ручка и
// четыре иконки забирали 232 — тексту доставалось ~90px, и описание точки
// переносилось по слогам ровно так же. Поэтому карточка перестроена: ручка в
// левом жёлобе, шапка «номер + тип + управление» одной строкой, а название,
// описание, координаты и бронь идут под ней на всю ширину колонки. Стрелки
// перестановки уехали в редактор точки в ОБЕИХ раскладках (в строке остались
// правка и удаление), а длинное описание сворачивается до трёх строк с кнопкой
// «Показать полностью» — иначе одна точка с логистикой выдавливает из
// ограниченного по высоте списка все остальные.
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import TripPlanCollapsibleText, {
  tripPlanTextCharsPerWidth,
} from '@/components/trips/planning/TripPlanCollapsibleText';
import {
  buildTripPlanLinkProps,
  resolveTripPlanLink,
  type TripPlanLinkElementProps,
} from '@/components/trips/planning/TripPlanLinkedText';
import { formatOvernightPrice } from '@/components/trips/planning/routeOvernightBooking';
import {
  ROUTE_POINT_ICON_NAME,
  ROUTE_POINT_LABEL,
  formatRoutePointCoordinates,
} from '@/components/trips/planning/tripPlanFormatting';
import { pointOvernightBooking } from '@/utils/overnightBooking';
import type { ThemedColors } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n/LocaleProvider';
import { POINT_DESCRIPTION_FONT_SIZE, type createStyles } from './RouteBuilder.styles';
import type { RouteDragHandlers } from './useRoutePointDrag';

type RouteBuilderStyles = ReturnType<typeof createStyles>;

/** Описание точки в списке: свёрнуто до трёх строк, дальше — «Показать полностью». */
const POINT_DESCRIPTION_LINES = 3;
/**
 * Ширина текста до первого `onLayout`. Узкая оценка безопаснее широкой: текст
 * приходит уже свёрнутым, и список не схлопывается рывком после первого замера.
 */
const FALLBACK_TEXT_WIDTH = 240;

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
  // testID стоит в обеих ветках: текстовая колонка — то, что меряет проверка
  // ширины строки, и в неинтерактивной раскладке её тоже надо находить.
  if (!onPress) return <View style={style} testID={testID}>{children}</View>;
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

// `Text` с web-пропсами анкора: RNW рендерит `<a href>` только когда они
// объявлены в типе (тот же приём, что в `TripPlanLinkedText`).
const BookingLink = Text as React.ComponentType<TripPlanLinkElementProps>;

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
  // #1843: бронь показывается только у ночёвки — предикат живёт в общем модуле,
  // и строка не решает заново, чья это точка.
  const booking = pointOvernightBooking(point);
  const bookingLink = booking?.url ? resolveTripPlanLink(booking.url) : null;
  const bookingPrice = formatOvernightPrice(booking?.price);
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

  // Ширина текстовой колонки: по ней считается, влезает ли описание в три
  // строки. `onTextLayout` в react-native-web не реализован, поэтому оценка
  // идёт по замеренной ширине и кеглю описания — как в шапке поездки (#1844).
  const [textWidth, setTextWidth] = useState(0);
  const handleContentLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setTextWidth((prev) => (prev === next ? prev : next));
  }, []);
  const descriptionCharsPerLine = tripPlanTextCharsPerWidth(
    textWidth || FALLBACK_TEXT_WIDTH,
    POINT_DESCRIPTION_FONT_SIZE,
  );

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
        <View style={styles.pointContent} onLayout={handleContentLayout}>
          <View style={styles.pointTypeRow}>
            {/* Номер точки — единственная связь строки с порядком на карте. */}
            <Text style={styles.pointOrder}>{index + 1}</Text>
            <Feather
              name={ROUTE_POINT_ICON_NAME[point.type] as never}
              size={12}
              color={colors.primaryDark}
            />
            <Text style={styles.pointType} numberOfLines={1}>
              {ROUTE_POINT_LABEL[point.type]}
            </Text>
            {isOwner ? (
              <View style={styles.pointControls}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={editLabel}
                  accessibilityState={compact ? { expanded: isEditing } : undefined}
                  onPress={() => (compact && isEditing ? onCloseEdit?.() : onEdit(index))}
                  style={styles.ctrl}
                  testID={`route-builder-edit-${index}`}
                >
                  <Feather
                    name={compact && isEditing ? 'chevron-up' : 'edit-2'}
                    size={16}
                    color={colors.primaryDark}
                  />
                </Pressable>
                {/* Удаление в мобильной раскладке живёт в раскрытом редакторе:
                    рядом с правкой оно стояло бы вплотную под пальцем. */}
                {compact ? null : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('trips:components.trips.planning.RouteBuilder.udalit_tochku_37161453')}
                    onPress={() => onDelete(index)}
                    style={styles.ctrl}
                    testID={`route-builder-delete-${index}`}
                  >
                    <Feather name="trash-2" size={15} color={colors.danger} />
                  </Pressable>
                )}
              </View>
            ) : null}
          </View>
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
            <Text style={styles.pointName}>{point.name}</Text>
            {point.description ? (
              <TripPlanCollapsibleText
                text={point.description}
                style={styles.pointDescription}
                linkStyle={styles.descriptionLink}
                numberOfLines={POINT_DESCRIPTION_LINES}
                charsPerLine={descriptionCharsPerLine}
                testID={`route-builder-point-description-${index}`}
                toggleTestID={`route-builder-point-description-toggle-${index}`}
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
            {/* #1843: адрес жилья, бронь, цена и заезд отдельными значениями.
                Ссылка — настоящий анкор через тот же контракт, что и ссылки в
                описании точки (#1494): на web это `<a href target=_blank>`, на
                native — общий обработчик ссылок rich-текста. */}
            {booking ? (
              <View style={styles.overnightMeta} testID={`route-builder-point-booking-${index}`}>
                {booking.address ? (
                  <View style={styles.overnightMetaItem}>
                    <Feather name="map-pin" size={12} color={colors.textMuted} />
                    <Text style={styles.overnightMetaText}>{booking.address}</Text>
                  </View>
                ) : null}
                {bookingLink ? (
                  <BookingLink
                    style={styles.overnightLink}
                    testID={`route-builder-point-booking-link-${index}`}
                    {...buildTripPlanLinkProps(bookingLink)}
                  >
                    {t('tripsStatic:plan.overnight.openBooking', { domain: bookingLink.domain })}
                  </BookingLink>
                ) : null}
                {bookingPrice ? (
                  <View style={styles.overnightMetaItem}>
                    <Feather name="tag" size={12} color={colors.textMuted} />
                    <Text style={styles.overnightMetaText}>
                      {t('tripsStatic:plan.overnight.priceValue', { value: bookingPrice })}
                    </Text>
                  </View>
                ) : null}
                {booking.checkinTime ? (
                  <View style={styles.overnightMetaItem}>
                    <Feather name="clock" size={12} color={colors.textMuted} />
                    <Text style={styles.overnightMetaText}>
                      {t('tripsStatic:plan.overnight.checkinValue', { value: booking.checkinTime })}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </PointBody>
        </View>
      </View>
      {editorSlot ? <View style={styles.pointEditor}>{editorSlot}</View> : null}
    </View>
  );
}

export default React.memo(RoutePointRow);
