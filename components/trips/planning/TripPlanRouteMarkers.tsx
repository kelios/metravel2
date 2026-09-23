// components/trips/planning/TripPlanRouteMarkers.tsx
// #2059: маркеры точек маршрута web-карты конструктора — номер как в списке
// точек, активная точка крупнее, близкие точки собираются в кластер тем же
// механизмом, что на /map (`mapClusterGroup.ts`: leaflet.markercluster, радиус,
// клик «всегда приближает», подпись для скринридера). Вынесено из
// `TripPlanRouteMap.web.tsx`; импортирует только web-карта, Leaflet и
// react-leaflet приходят пропсами из `loadLeafletRuntime`.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import type { RoutePoint } from '@/api/plannedTrips';
import { useApplyClusterAccessibleName } from '@/components/MapPage/Map/clusterAccessibleName';
import { createMapClusterGroup } from '@/components/MapPage/Map/mapClusterGroup';
import { buildClusterIconHtml } from '@/components/MapPage/Map/mapMarkerStyles';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useTheme, type ThemedColors } from '@/hooks/useTheme';
import { translate as i18nT, translatePlural } from '@/i18n';
import type { ReactLeafletCoreRuntime } from '@/utils/loadLeafletRuntime';
import { formatRoutePointCoordinates, isDrawableCoordinatePair } from './tripPlanFormatting';
import { FOCUS_POINT_ZOOM, ROUTE_POINT_COORDINATE_PRECISION } from './tripPlanRouteMap.types';
import {
  fillRouteMarkerTemplate,
  routeMarkerIconTemplate,
  routeMarkerLabel,
  shouldClusterRouteMarkers,
} from './tripPlanMapMarkers';

type LeafletNS = typeof import('leaflet');
/** Та часть `L.Marker`, которую трогает подпись маркера (`leaflet` в проекте без типов). */
type TitledMarker = { options?: { title?: string }; getElement?: () => HTMLElement | undefined };
type ReactLeafletNS = typeof import('react-leaflet');
type DragEndEvent = { target?: { getLatLng?: () => { lat: number; lng: number } } };
type DroppedPoint = { index: number; lat: number; lng: number };

/** Шаг, на который `RouteBuilder` округляет координаты перенесённой точки. */
const DROP_MATCH_TOLERANCE = 10 ** -ROUTE_POINT_COORDINATE_PRECISION;

/** Точка стоит там, где её отпустили (с точностью до округления координат). */
const isDroppedAt = (coordinates: RoutePoint['coordinates'] | undefined, drop: DroppedPoint): boolean =>
  isDrawableCoordinatePair(coordinates)
  && Math.abs(coordinates[1] - drop.lat) <= DROP_MATCH_TOLERANCE
  && Math.abs(coordinates[0] - drop.lng) <= DROP_MATCH_TOLERANCE;

/** «Кластер: 12 точек» — дети кластера конструктора считаются точками маршрута. */
export const formatRoutePointCount = (count: number): string =>
  translatePlural('tripsStatic:plan.map.pointCount', count);

/** Иконки маркеров по номеру: одна и та же ссылка на рендер, иначе Leaflet пересобирает DOM. */
function useRouteMarkerIcons(L: LeafletNS, colors: ThemedColors) {
  const { primary, primaryDark, warning, textOnPrimary } = colors;
  return useMemo(() => {
    const palette = { primary, primaryDark, warning, textOnPrimary };
    const templates = [routeMarkerIconTemplate(palette, false), routeMarkerIconTemplate(palette, true)];
    const cache = new Map<string, unknown>();
    return (index: number, active: boolean) => {
      const label = routeMarkerLabel(index);
      const key = `${active ? 1 : 0}:${label}`;
      const cached = cache.get(key);
      if (cached) return cached;
      const template = templates[active ? 1 : 0];
      const icon = L.divIcon({
        className: template.className,
        html: fillRouteMarkerTemplate(template.html, label),
        iconSize: template.size,
        iconAnchor: template.anchor,
        popupAnchor: template.popupAnchor,
      });
      cache.set(key, icon);
      return icon;
    };
  }, [L, primary, primaryDark, warning, textOnPrimary]);
}

type ClusterProps = {
  L: LeafletNS;
  core: ReactLeafletCoreRuntime;
  useMap: ReactLeafletNS['useMap'];
  colors: ThemedColors;
  children: React.ReactNode;
};

/**
 * Группа кластеров как контейнер react-leaflet: дочерние `<Marker>` получают
 * `layerContainer` = группа и добавляются в неё, а не прямо на карту. Поэтому
 * перетаскивание (#1781), попапы и смена иконки остаются декларативными, а
 * переезд перетащенного маркера между кластерами делает сам markercluster
 * (`_childMarkerDragEnd` → `_moveChild`).
 */
function RouteMarkerClusterGroup({ L, core, useMap, colors, children }: ClusterProps) {
  const map = useMap() as unknown as {
    addLayer: (layer: unknown) => void;
    removeLayer: (layer: unknown) => void;
    on: (event: string, handler: (event: { layer?: unknown }) => void) => void;
    off: (event: string, handler: (event: { layer?: unknown }) => void) => void;
    eachLayer: (callback: (layer: unknown) => void) => void;
  };
  const parentContext = core.useLeafletContext();
  const { isDark } = useTheme();
  const [group, setGroup] = useState<{ refreshClusters?: () => void; clearLayers: () => void } | null>(null);
  const applyAccessibleName = useApplyClusterAccessibleName(L, formatRoutePointCount);
  const applyNameRef = useRef(applyAccessibleName);
  applyNameRef.current = applyAccessibleName;

  const iconFactory = useMemo(
    () => (cluster: { getChildCount?: () => number }) => {
      const { metrics, html } = buildClusterIconHtml({
        count: Number(cluster?.getChildCount?.() ?? 0),
        accentColor: colors.primary,
        accentDarkColor: colors.primaryDark,
        softGlowColor: colors.primaryAlpha30,
        textColor: colors.textOnDark,
        isDark,
      });
      return L.divIcon({
        className: 'metravel-cluster-icon metravel-trip-plan-cluster',
        html,
        iconSize: [metrics.size, metrics.size],
        iconAnchor: [metrics.size / 2, metrics.size / 2],
      });
    },
    [L, colors.primary, colors.primaryDark, colors.primaryAlpha30, colors.textOnDark, isDark],
  );
  const iconFactoryRef = useRef(iconFactory);
  iconFactoryRef.current = iconFactory;

  useEffect(() => {
    const { group: created, dispose } = createMapClusterGroup(L, map, {
      iconCreateFunction: (cluster) => iconFactoryRef.current(cluster),
      // Кластеры — только на малом масштабе (макет §4): с зума фокуса точки и
      // дня (`FOCUS_POINT_ZOOM`) каждая точка стоит своим маркером, её видно
      // после «показать на карте» и её можно тянуть (#1781). На /map порог 16.
      // Без анимации разбиения: с ней маркеры дня ещё 300 мс после фокуса летят
      // от центра прежнего кластера, уже живые для мыши, — хват по видимому
      // номеру брал соседа, а клик после отпускания попадал в гаснущий кластер
      // и уводил кадр. Карта-редактор ставит маркер сразу на его место.
      overrides: { disableClusteringAtZoom: FOCUS_POINT_ZOOM, animate: false },
    });
    const handleLayerAdd = (event: { layer?: unknown }) => applyNameRef.current(event?.layer);
    map.addLayer(created);
    map.on('layeradd', handleLayerAdd);
    setGroup(created);
    return () => {
      map.off('layeradd', handleLayerAdd);
      dispose();
      map.removeLayer(created);
      created.clearLayers();
      setGroup(null);
    };
  }, [L, map]);

  // Смена темы перекрашивает кластеры на месте, без пересборки группы.
  useEffect(() => {
    group?.refreshClusters?.();
  }, [group, iconFactory]);

  // Эффект родителя идёт после эффектов детей: маркеры этого коммита уже в
  // группе, и счётчик в подписи кластера совпадает с числом на значке.
  useEffect(() => {
    if (group) map.eachLayer((layer) => applyNameRef.current(layer));
  });

  const context = useMemo(
    () => (group ? core.extendContext(parentContext, { layerContainer: group as never }) : null),
    [core, group, parentContext],
  );
  if (!context) return null;
  return <core.LeafletContext.Provider value={context}>{children}</core.LeafletContext.Provider>;
}

type RouteMarkerProps = {
  RL: ReactLeafletNS;
  point: RoutePoint;
  lat: number;
  lng: number;
  index: number;
  icon: unknown;
  active: boolean;
  readonly: boolean;
  draggable: boolean;
  styles: ReturnType<typeof createStyles>;
  onDragEnd: (index: number) => (event: DragEndEvent) => void;
  onEditPoint: (index: number) => void;
  onDeletePoint?: (index: number) => void;
};

function RouteMarker({
  RL,
  point,
  lat,
  lng,
  index,
  icon,
  active,
  readonly,
  draggable,
  styles,
  onDragEnd,
  onEditPoint,
  onDeletePoint,
}: RouteMarkerProps) {
  const { Marker, Popup } = RL;
  // `position` и `eventHandlers` react-leaflet сравнивает по ссылке. Свежий
  // массив на каждый рендер звал бы `setLatLng` у каждого маркера, а в группе
  // кластеров любой сдвиг — `_moveChild`: маркер снимается и добавляется
  // заново, кластеры пересчитываются, раскрытый «паук» схлопывается. Карта же
  // перерисовывается на каждый ввод в панели конструктора.
  const position = useMemo<[number, number]>(() => [lat, lng], [lat, lng]);
  const title = `${routeMarkerLabel(index)}. ${point.name}`;
  // #2073: `accessibilityHint` на web ничего не даёт — react-native-web 0.21.2
  // не реализует этот проп ни у одного элемента. Подсказку читает
  // `aria-description` прямо на DOM-узле маркера (не требует связанного
  // элемента с id, в отличие от `aria-describedby`).
  const hint = draggable ? i18nT('tripsStatic:plan.map.markerHint') : undefined;
  // #2073 P2: значения читает стабильный `add`-обработчик ниже, а не замыкание
  // рендера — так его не нужно пересоздавать на каждое переименование точки
  // (эффект ниже уже это делает для уже смонтированного узла).
  const accessibilityRef = useRef({ title, hint });
  accessibilityRef.current = { title, hint };
  const applyMarkerAccessibility = useCallback((marker: TitledMarker | null | undefined) => {
    if (!marker?.options) return;
    const current = accessibilityRef.current;
    marker.options.title = current.title;
    const element = marker.getElement?.();
    if (!element) return;
    element.title = current.title;
    if (current.hint) element.setAttribute?.('aria-description', current.hint);
    else element.removeAttribute?.('aria-description');
  }, []);
  // Гость не тянет маркер и не получает подсказку — `eventHandlers` остаётся
  // `undefined`, как и раньше (тест «гостю не даёт ни тянуть маркер...»
  // проверяет это напрямую). `add` живёт в том же объекте и по тем же deps,
  // что и `dragend`, а не пересоздаётся на переименование точки (`title`/`hint`
  // в deps сломали бы это же условие и вернули бы прежний баг).
  const eventHandlers = useMemo(() => {
    if (!draggable) return undefined;
    return {
      dragend: onDragEnd(index),
      // #2073 P2: markercluster снимает и заново добавляет маркер на каждый
      // zoom/pan, который меняет его группировку — Leaflet `_initIcon` создаёт
      // НОВЫЙ DOM-узел и переносит на него только `options.title`, а
      // `aria-description` без этого терялась бы на каждой такой пересборке.
      // `add` стабильно стреляет и на первом монтировании, и на каждом таком
      // пересоздании — эффект ниже остаётся для смены hint без пересборки DOM
      // (переименование точки на статичном, некластеризованном маркере).
      add: (event: unknown) => applyMarkerAccessibility((event as { target?: TitledMarker })?.target),
    };
  }, [applyMarkerAccessibility, draggable, index, onDragEnd]);
  const markerRef = useRef<TitledMarker | null>(null);
  useEffect(() => {
    applyMarkerAccessibility(markerRef.current);
  }, [applyMarkerAccessibility, title, hint]);
  const coordinatesLabel = formatRoutePointCoordinates(point.coordinates);

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={icon}
      title={title}
      zIndexOffset={active ? 1000 : 0}
      draggable={draggable}
      eventHandlers={eventHandlers}
    >
      <Popup>
        <div style={styles.popup as React.CSSProperties}>
          <div style={styles.popupTitle as React.CSSProperties}>{point.name}</div>
          {coordinatesLabel ? (
            <div style={styles.popupMeta as React.CSSProperties}>{coordinatesLabel}</div>
          ) : null}
          {!readonly ? (
            <div style={styles.popupActions as React.CSSProperties}>
              <button
                type="button"
                onClick={() => onEditPoint(index)}
                style={styles.popupButton as React.CSSProperties}
                data-testid={`trip-plan-map-edit-point-${index}`}
              >
                {i18nT('trips:components.trips.planning.TripPlanRouteMap.redaktirovat_0c9026cb')}</button>
              {onDeletePoint ? (
                <button
                  type="button"
                  onClick={() => onDeletePoint(index)}
                  style={styles.popupButtonDanger as React.CSSProperties}
                  data-testid={`trip-plan-map-delete-point-${index}`}
                >
                  {i18nT('tripsStatic:plan.map.deletePoint')}</button>
              ) : null}
            </div>
          ) : null}
        </div>
      </Popup>
    </Marker>
  );
}

type MarkersProps = {
  L: LeafletNS;
  RL: ReactLeafletNS;
  /** Без ядра react-leaflet (тесты, нештатный рантайм) маркеры идут прямо на карту. */
  RLCore?: ReactLeafletCoreRuntime;
  route: RoutePoint[];
  activeIndex?: number | null;
  readonly: boolean;
  draggable: boolean;
  colors: ThemedColors;
  onDragEnd: (index: number) => (event: DragEndEvent) => void;
  onEditPoint: (index: number) => void;
  onDeletePoint?: (index: number) => void;
};

export default function TripPlanRouteMarkers({
  L,
  RL,
  RLCore,
  route,
  activeIndex,
  readonly,
  draggable,
  colors,
  onDragEnd,
  onEditPoint,
  onDeletePoint,
}: MarkersProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const iconFor = useRouteMarkerIcons(L, colors);

  // #1781 в кластерах: отпущенный маркер markercluster раскладывает заново
  // (`_childMarkerDragEnd` → `_moveChild`), и брошенный рядом с соседом на
  // зуме < 14 исчезал в кластере «2» — точка не оставалась там, где её
  // бросили. Поэтому перенесённая точка, как активная, живёт вне кластеров.
  const [dropped, setDropped] = useState<DroppedPoint | null>(null);
  const handleDragEnd = useCallback(
    (index: number) => {
      const forward = onDragEnd(index);
      return (event: DragEndEvent) => {
        const position = event?.target?.getLatLng?.();
        if (position && Number.isFinite(position.lat) && Number.isFinite(position.lng)) {
          setDropped({ index, lat: position.lat, lng: position.lng });
        }
        forward(event);
      };
    },
    [onDragEnd],
  );
  // Держим маркер вне кластеров, пока точка стоит там, куда её бросили:
  // отклонённый перенос, удаление точки выше по списку или правка координат
  // возвращают маркер в кластеры сами.
  const heldIndex =
    dropped && isDroppedAt(route[dropped.index]?.coordinates, dropped) ? dropped.index : null;

  const renderMarker = (point: RoutePoint, index: number) => {
    // #1683: не «есть пара», а «пара пригодна к отрисовке» — на
    // невалидном LatLng `L.marker` бросает и уносит всю карту.
    if (!isDrawableCoordinatePair(point.coordinates)) return null;
    const [lng, lat] = point.coordinates;
    const active = activeIndex === index;
    return (
      // #1781: координаты убраны из ключа. `position` — реактивный проп
      // react-leaflet, а координатный ключ пересоздавал маркер ровно в
      // момент завершения жеста перетаскивания.
      <RouteMarker
        key={`${point.id}-${index}`}
        RL={RL}
        point={point}
        lat={lat}
        lng={lng}
        index={index}
        icon={iconFor(index, active)}
        active={active}
        readonly={readonly}
        draggable={draggable}
        styles={styles}
        onDragEnd={handleDragEnd}
        onEditPoint={onEditPoint}
        onDeletePoint={onDeletePoint}
      />
    );
  };

  const clusterable =
    typeof (L as unknown as { markerClusterGroup?: unknown }).markerClusterGroup === 'function'
    && shouldClusterRouteMarkers(route.length);
  // Без кластеров маркеры идут в порядке маршрута: порядок узлов в DOM не
  // меняется от того, какая точка открыта в редакторе.
  if (!RLCore || !clusterable) return <>{route.map(renderMarker)}</>;

  // Активная точка открыта в редакторе, перенесённая только что брошена —
  // их маркеры живут вне кластеров и видны на любом масштабе.
  const unclustered = Array.from(
    new Set([activeIndex, heldIndex].filter((index): index is number => index != null && Boolean(route[index]))),
  );
  const clustered = route.map((point, index) => (unclustered.includes(index) ? null : renderMarker(point, index)));
  return (
    <>
      <RouteMarkerClusterGroup L={L} core={RLCore} useMap={RL.useMap} colors={colors}>
        {clustered}
      </RouteMarkerClusterGroup>
      {unclustered.map((index) => renderMarker(route[index], index))}
    </>
  );
}

const createStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    popup: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 160,
      color: colors.text,
    },
    popupTitle: {
      fontWeight: '700',
      fontSize: 14,
      lineHeight: 18,
      color: colors.text,
    },
    popupMeta: {
      fontSize: 12,
      lineHeight: 16,
      color: colors.textMuted,
    },
    popupActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    popupButton: {
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors.border,
      borderRadius: DESIGN_TOKENS.radii.sm,
      paddingTop: 7,
      paddingRight: 10,
      paddingBottom: 7,
      paddingLeft: 10,
      backgroundColor: colors.surface,
      color: colors.text,
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: '700',
    },
    popupButtonDanger: {
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors.danger,
      borderRadius: DESIGN_TOKENS.radii.sm,
      paddingTop: 7,
      paddingRight: 10,
      paddingBottom: 7,
      paddingLeft: 10,
      backgroundColor: colors.surface,
      color: colors.danger,
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: '700',
    },
  });
