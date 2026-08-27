// components/trips/planning/RouteBuilder.tsx
// Конструктор маршрута поездки (Sprint 13 / блок D): список точек с reorder/delete
// (web-safe, без нативных drag-либ), inline-добавление точки, применение шаблонов
// и живая сводка маршрута. Только владелец может редактировать.
// #1490: пока правки не сохранены, линию и цифры даёт тот же движок
// маршрутизации, что и /map, а не прямая между точками.
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { fetchPlacesCatalog } from '@/api/places';
import { fetchTravels } from '@/api/travelsApi';
import type { Travel, TravelAddressItem } from '@/types/types';
import Button from '@/components/ui/Button';
import SegmentedControl from '@/components/MapPage/SegmentedControl';
import { safeLazy } from '@/components/layout/safeLazy';
import RouteBuilderMapFirst from '@/components/trips/planning/RouteBuilderMapFirst';
import RoutePointAddForm, {
  type SiteRouteOption,
  type SiteSearchStatus,
} from '@/components/trips/planning/RoutePointAddForm';
import RoutePointRow from '@/components/trips/planning/RoutePointRow';
import RouteSummaryBar from '@/components/trips/planning/RouteSummaryBar';
import TripBikeTypeControl from '@/components/trips/planning/TripBikeTypeControl';
import TripPlanRouteMap from '@/components/trips/planning/TripPlanRouteMap';
import TripRouteDownloadButtons from '@/components/trips/planning/TripRouteDownloadButtons';
import TripRouteImportPanel from '@/components/trips/planning/TripRouteImportPanel';
import {
  shouldRenderTripRouteExportMenu,
  useTripRouteExport,
} from '@/components/trips/planning/tripRouteExport';
import RoutingStatus, { ROUTING_DIRECT_LINE } from '@/components/MapPage/RoutingStatus';
import AddressSearch from '@/components/MapPage/AddressSearch';
import RouteStepBlock from '@/components/MapPage/RouteStepBlock';
import { routeBuilderCta } from '@/components/trips/planning/routeBuilderCta';
import TripRoutePreviewEngine from '@/components/trips/planning/TripRoutePreviewEngine';
import {
  ROUTE_TRANSPORTS,
  isRoutableTransport,
  previewPointsKey,
  previewStopsCount,
  routablePreviewPoints,
} from '@/components/trips/planning/tripRoutePreview';
import type { MapFocusPoint } from '@/components/trips/planning/tripPlanRouteMap.types';
import { useTripRouteDisplay } from '@/components/trips/planning/useTripRouteDisplay';
import {
  type PlannedTrip,
  type RoutePoint,
  type RoutePointType,
  type TripBikeType,
} from '@/api/plannedTrips';
import {
  ROUTE_POINT_ICON_NAME,
  ROUTE_POINT_LABEL,
  TRANSPORT_LABEL,
} from '@/components/trips/planning/tripPlanFormatting';
import {
  usePlannedTripOriginalTrack,
  usePlannedTripRouteFile,
  useDeletePlannedTripRouteFile,
  useUploadPlannedTripRouteFile,
} from '@/hooks/usePlannedTripRouteFile';
import { releasePickedTripRouteUpload } from '@/components/trips/planning/TripRouteFilePicker';
import {
  toRouteFileUploadPart,
  type PickedTripRouteFileUpload,
} from '@/components/trips/planning/TripRouteFilePicker.types';
import {
  useRefreshTripRouteElevation,
  useRouteTemplates,
  useTripRouteElevation,
  useUpdateTripBikeType,
  useUpdateTripTransport,
  useUpdateTripRoute,
} from '@/hooks/usePlannedTripsApi';
import { trackRoutePointAdded } from '@/utils/tripAnalytics';
import { useThemedColors } from '@/hooks/useTheme';
import { translate as i18nT } from '@/i18n'
import { useTranslation } from '@/i18n/LocaleProvider';
import { createStyles } from './RouteBuilder.styles';
import { createRoutePanelStyles } from './routePanelStyles';
import { moveItem, remapIndexAfterMove } from './routePointReorder';
import { useRoutePointDrag } from './useRoutePointDrag';


// Тот же график, что на travel details: react-native-svg и логика чарта грузятся
// только когда у маршрута действительно есть высоты. safeLazy переживает
// транзиентный отказ Metro async-require вместо пустой секции под картой.
const RouteElevationProfile = safeLazy(
  () => import('@/components/travel/details/sections/RouteElevationProfile'),
  'RouteElevationProfile',
  { retries: 1 },
);

interface Props {
  trip: PlannedTrip;
  /**
   * `stack` — историческая вертикальная раскладка (desktop и все readonly-экраны).
   * `mapFirst` — мобильная раскладка #1495: карта на весь экран, панель уезжает
   * в шторку. Выбирает её экран поездки, а не компонент: тесты и desktop должны
   * получать stack независимо от ширины окна в окружении.
   */
  layout?: 'stack' | 'mapFirst';
}

const POINT_TYPES: RoutePointType[] = ['place', 'custom', 'rest', 'overnight'];
/** Старт и финиш: тот же порог «маршрут можно строить», что и на /map. */
const MIN_ROUTE_POINTS = 2;
const SITE_SEARCH_MIN_LENGTH = 2;

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseLatLngPair = (value: unknown): { lat: number; lng: number } | null => {
  if (typeof value !== 'string') return null;
  const [latRaw, lngRaw] = value.split(',').map((part) => part.trim());
  const lat = parseNumber(latRaw);
  const lng = parseNumber(lngRaw);
  if (lat == null || lng == null) return null;
  return { lat, lng };
};

const travelAddressCoordinates = (point: TravelAddressItem): { lat: number; lng: number } | null => {
  if (typeof point === 'string') return null;
  const directLat = parseNumber(point.lat);
  const directLng = parseNumber(point.lng);
  if (directLat != null && directLng != null) return { lat: directLat, lng: directLng };
  return parseLatLngPair(point.coords);
};

const travelCoordinates = (travel: Travel): [number, number] | null => {
  const routePoint = travel.coordsMeTravel?.find((point) => {
    const lat = parseNumber(point.lat);
    const lng = parseNumber(point.lng);
    return lat != null && lng != null;
  });
  if (routePoint) return [Number(routePoint.lng), Number(routePoint.lat)];

  const addressPoint = travel.travelAddress
    ?.map(travelAddressCoordinates)
    .find((point): point is { lat: number; lng: number } => point != null);
  return addressPoint ? [addressPoint.lng, addressPoint.lat] : null;
};

const compactText = (parts: Array<string | number | null | undefined>): string =>
  parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' · ');

const formatCoordinateInput = (value: number): string => {
  const rounded = value.toFixed(6);
  return rounded.replace(/\.?0+$/, '');
};

const coordinatesFromFields = (
  latValue: string,
  lngValue: string,
): { coordinates: [number, number] | null; error: string | null } => {
  const latText = latValue.trim();
  const lngText = lngValue.trim();
  if (!latText && !lngText) return { coordinates: null, error: null };

  const lat = parseNumber(latText);
  const lng = parseNumber(lngText);
  if (lat == null || lng == null) {
    return { coordinates: null, error: i18nT('trips:components.trips.planning.RouteBuilder.ukazhite_shirotu_i_dolgotu_chislami_06a43fa9') };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { coordinates: null, error: i18nT('trips:components.trips.planning.RouteBuilder.shirota_dolzhna_byt_ot_90_do_90_dolgota_ot_1_964ccc95') };
  }

  return { coordinates: [lng, lat], error: null };
};

const routeSignature = (route: RoutePoint[]): string =>
  route
    .map((point) => {
      const coords = point.coordinates
        ? `${formatCoordinateInput(point.coordinates[0])},${formatCoordinateInput(point.coordinates[1])}`
        : '';
      return [
        point.id,
        point.type,
        point.placeId ?? '',
        point.name,
        point.description ?? '',
        coords,
      ].join('|');
    })
    .join('>');

function RouteBuilder({ trip, layout = 'stack' }: Props) {
  const isMapFirst = layout === 'mapFirst';
  const { t } = useTranslation();
  const colors = useThemedColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // #1491: шаги панели рисует тот же RouteStepBlock, что нумерует шаги /map;
  // сюда приходят только токены планировщика.
  const panelStyles = useMemo(() => createRoutePanelStyles(colors), [colors]);
  const stepStyles = useMemo(
    () => ({
      block: panelStyles.stepBlock,
      header: panelStyles.stepHeader,
      number: panelStyles.stepNumber,
      title: panelStyles.stepTitle,
    }),
    [panelStyles],
  );
  const updateTripRoute = useUpdateTripRoute();
  const updateTripTransport = useUpdateTripTransport();
  const updateTripBikeType = useUpdateTripBikeType();
  const templatesQuery = useRouteTemplates();
  // Транспорт и тип велосипеда шлют один и тот же PATCH по одной поездке,
  // поэтому лок общий: параллельных перестроений маршрута быть не должно.
  const transportMutationLockedRef = useRef(false);

  const [route, setRoute] = useState<RoutePoint[]>(trip.route);

  const [newType, setNewType] = useState<RoutePointType>('place');
  const [newName, setNewName] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPointError, setNewPointError] = useState<string | null>(null);
  const [isAddPointOpen, setIsAddPointOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editType, setEditType] = useState<RoutePointType>('custom');
  const [editName, setEditName] = useState('');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [siteQuery, setSiteQuery] = useState('');
  const [siteOptions, setSiteOptions] = useState<SiteRouteOption[]>([]);
  const [siteSearchStatus, setSiteSearchStatus] = useState<SiteSearchStatus>('idle');
  const [transportCommitPending, setTransportCommitPending] = useState(false);
  // Транспорт и тип велосипеда перестраивают маршрут одним потоком, поэтому и
  // ошибка одна: иначе неудача одного контрола висела бы под другим успешным.
  const [routeRebuildError, setRouteRebuildError] = useState<string | null>(null);

  // #1496 — фаза 2 импорта. Исходный файл хранится у поездки отдельно от точек:
  // хранилище доступно только владельцу, поэтому участник видит обычный маршрут
  // без запросов к нему.
  const routeFileQuery = usePlannedTripRouteFile(trip.id, { enabled: trip.isOwner });
  const storedRouteFile = routeFileQuery.data ?? null;
  const originalTrackQuery = usePlannedTripOriginalTrack(trip.id, storedRouteFile, {
    enabled: trip.isOwner,
  });
  const originalTrack = originalTrackQuery.data ?? null;
  const uploadRouteFile = useUploadPlannedTripRouteFile();
  const deleteRouteFile = useDeletePlannedTripRouteFile();
  // Оригинал уезжает на бэкенд тем же действием «Сохранить маршрут», что и точки:
  // иначе сохранённый файл описывал бы маршрут, которого у поездки ещё нет.
  const pendingOriginalRef = useRef<PickedTripRouteFileUpload | null>(null);
  const [pendingOriginalName, setPendingOriginalName] = useState<string | null>(null);
  const [originalUploadError, setOriginalUploadError] = useState<string | null>(null);
  // Отказ `PUT /route/` (например 400 от валидации точек) до этого нигде не
  // всплывал: у мутации был только `onSuccess`, поэтому кнопка гасла, маршрут
  // не сохранялся и пользователь не получал ни одного признака ошибки.
  //
  // Вместе с текстом храним подпись маршрута, на котором отказ случился: ошибка
  // остаётся оценкой ровно того набора точек, который её вызвал. Как только на
  // экране другой маршрут — правка точки, новый импорт, откат и повторная
  // правка — сообщение само перестаёт показываться, без россыпи сбросов по всем
  // местам, где меняется `route`.
  const [routeSaveError, setRouteSaveError] = useState<
    { message: string; signature: string } | null
  >(null);

  const savedRouteSignature = useMemo(() => routeSignature(trip.route), [trip.route]);
  // #1491: кнопка действия существует только пока есть что отправлять. Сравнение
  // идёт по полной сигнатуре, а не по координатной: переименование точки — тоже
  // несохранённая правка, и потерять её молча нельзя.
  const currentRouteSignature = useMemo(() => routeSignature(route), [route]);
  const hasUnsavedRouteChanges = currentRouteSignature !== savedRouteSignature;
  // Геометрия, сводка и высоты зависят только от координат и транспорта: правка
  // названия или описания точки их не обесценивает. Поэтому серверные данные
  // держатся за координатной сигнатурой, а не за полной — иначе опечатка в
  // названии снимала бы с карты сохранённую дорогу и жгла запрос к ORS (#1490).
  const savedRouteShape = useMemo(
    () => previewPointsKey(routablePreviewPoints(trip.route), trip.transport),
    [trip.route, trip.transport],
  );
  const routeShapeMatchesSaved = useMemo(
    () => previewPointsKey(routablePreviewPoints(route), trip.transport) === savedRouteShape,
    [route, savedRouteShape, trip.transport],
  );
  const routableSavedPoints = useMemo(
    () => trip.route.filter((point) => point.coordinates).length,
    [trip.route],
  );

  // Профиль высот описывает сохранённый маршрут, поэтому пока точки не совпадают
  // с серверными, он скрыт вместе с серверной геометрией.
  const routeElevationQuery = useTripRouteElevation(trip.id, {
    enabled: routeShapeMatchesSaved && routableSavedPoints >= 2,
  });
  const refreshRouteElevation = useRefreshTripRouteElevation();
  const refreshRouteElevationMutate = refreshRouteElevation.mutate;
  const routeElevation = routeShapeMatchesSaved ? routeElevationQuery.data ?? null : null;

  const routeDisplay = useTripRouteDisplay({
    trip,
    route,
    routeElevation,
    routeElevationPending: routeShapeMatchesSaved && routeElevationQuery.isFetching,
    routeShapeMatchesSaved,
  });
  const preview = routeDisplay.preview;

  // Сохранение маршрута кладёт сводку без высот; один пересчёт ORS на маршрут
  // возвращает ascent/descent и 3D-полилинию. Прямую линию не пересчитываем —
  // у провайдера для неё высот нет.
  const elevationRefreshKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !trip.isOwner ||
      !routeShapeMatchesSaved ||
      routeElevationQuery.isFetching ||
      !routeDisplay.hasUsableSavedGeometry
    ) return;
    const elevation = routeElevationQuery.data;
    if (!elevation || elevation.preview || elevation.provider !== 'ors') return;

    // Профиль зависит не только от точек: смена транспорта и типа велосипеда
    // перестраивает маршрут на тех же точках и снова обнуляет высоты, поэтому
    // без них ключ повторно совпал бы и график высот больше не вернулся бы.
    const refreshKey = `${trip.id}:${savedRouteSignature}:${trip.transport}:${trip.bikeType ?? 'none'}`;
    if (elevationRefreshKeyRef.current === refreshKey) return;
    elevationRefreshKeyRef.current = refreshKey;
    refreshRouteElevationMutate({ tripId: trip.id });
  }, [
    refreshRouteElevationMutate,
    routeElevationQuery.data,
    routeElevationQuery.isFetching,
    routeDisplay.hasUsableSavedGeometry,
    routeShapeMatchesSaved,
    savedRouteSignature,
    trip.bikeType,
    trip.id,
    trip.isOwner,
    trip.transport,
  ]);

  // Один владелец выбирает всю отображаемую триаду. Если сохранённый healthy
  // status приехал без geometry, shared preview engine чинит тот же набор точек;
  // старые status/summary не могут пережить геометрию отдельно (#873).
  const routeGeometry = routeDisplay.geometry;
  const routingState = routeDisplay.routingState;
  // Точка без координат дорогу не меняет, поэтому серверные геометрия и цифры
  // остаются в силе — но в списке точек она есть, и счётчик остановок обязан
  // увидеть её сразу, а не после сохранения. Формула та же, что у бэкенда
  // (`stops_count = len(route_points)`), поэтому подмена — no-op, пока список
  // точек совпадает с сохранённым.
  const summaryBase = routeDisplay.summary;
  const summary = useMemo(() => {
    if (!summaryBase) return summaryBase;
    const stopsCount = previewStopsCount(route);
    return summaryBase.stopsCount === stopsCount ? summaryBase : { ...summaryBase, stopsCount };
  }, [route, summaryBase]);

  // #1304: скачивание живёт там же, где маршрут строится. Экспортируем то, что
  // сейчас на карте: у несохранённых правок это геометрия превью, поэтому файл
  // всегда совпадает с картинкой.
  const exportTrip = useMemo(
    () => ({ ...trip, route, routeGeometry, routingState, routeSummary: summary }),
    [route, routeGeometry, routingState, summary, trip],
  );
  const exportController = useTripRouteExport(exportTrip);
  const routeDownloadSection = shouldRenderTripRouteExportMenu(Platform.OS) ? (
    <TripRouteDownloadButtons
      controller={exportController}
      showDisabledHint
      showApproximateWarning
      tripId={trip.id}
      originalFile={storedRouteFile}
      testID="route-builder-export"
    />
  ) : null;

  // Названия точек маршрута подписывают старт/пик/финиш на графике. Берём
  // текущий маршрут, а не сохранённый: график идёт вслед за превью.
  const elevationPlaceHints = useMemo(
    () =>
      route.flatMap((point) =>
        point.coordinates
          ? [{ name: point.name, coord: `${point.coordinates[1]},${point.coordinates[0]}` }]
          : [],
      ),
    [route],
  );

  const elevationPreview = routeDisplay.elevation;

  const elevationProfileSection = elevationPreview ? (
    <Suspense fallback={null}>
      <RouteElevationProfile
        preview={elevationPreview}
        placeHints={elevationPlaceHints}
        transportHints={[TRANSPORT_LABEL[trip.transport]]}
      />
    </Suspense>
  ) : null;

  // Движок живёт под ключом retryToken: у useRouting нет входа «построй заново»,
  // а деградированный ответ он намеренно не кэширует (ROUTING-ORS-001).
  const previewEngine = preview.active && preview.transportMode ? (
    <TripRoutePreviewEngine
      key={preview.retryToken}
      points={preview.points}
      transportMode={preview.transportMode}
      onResult={preview.handleResult}
    />
  ) : null;

  // Прогресс построения и баннер «Прямая линия» с повтором — общий компонент
  // /map. distance не передаём: цифры печатает RouteSummaryBar, дублировать их
  // здесь незачем, и в спокойном состоянии блок не рендерится вовсе.
  // Схематичная линия public/mixed сюда не попадает: там ничего не строится,
  // и объясняет её подпись самой карты, а не прогресс-бар с повтором.
  const previewStatusSection = preview.engaged && !preview.schematic && preview.transportMode ? (
    <RoutingStatus
      isLoading={preview.loading && !preview.degraded}
      error={preview.degraded ? ROUTING_DIRECT_LINE : null}
      distance={null}
      transportMode={preview.transportMode}
      onRetry={preview.retry}
    />
  ) : null;

  // Единственная точка входа для перестановки: и стрелки, и перетаскивание.
  // Открытая форма редактирования едет вместе со своей точкой, иначе после
  // переупорядочивания сохранение ушло бы в соседнюю строку.
  const handleReorder = useCallback((from: number, to: number) => {
    setRoute((prev) => moveItem(prev, from, to));
    setEditingIndex((prev) => remapIndexAfterMove(prev, from, to));
  }, []);

  const handleMove = useCallback(
    (index: number, delta: number) => handleReorder(index, index + delta),
    [handleReorder],
  );

  const handleDelete = useCallback((index: number) => {
    setRoute((prev) => prev.filter((_, i) => i !== index));
    setEditingIndex((prev) => {
      if (prev == null) return prev;
      if (prev === index) return null;
      return prev > index ? prev - 1 : prev;
    });
  }, []);

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const { coordinates, error } = coordinatesFromFields(newLat, newLng);
    if (error) {
      setNewPointError(error);
      return;
    }
    const description = newDescription.trim();

    setNewPointError(null);
    setRoute((prev) => [
      ...prev,
      {
        id: `local-${prev.length}-${name}`,
        type: newType,
        name,
        description: description || null,
        coordinates,
        placeId: null,
      },
    ]);
    trackRoutePointAdded(trip.id, newType);
    setNewName('');
    setNewLat('');
    setNewLng('');
    setNewDescription('');
    setIsAddPointOpen(false);
  };

  const handleStartEdit = useCallback((point: RoutePoint, index: number) => {
    setIsAddPointOpen(false);
    setEditingIndex(index);
    setEditType(point.type);
    setEditName(point.name);
    setEditDescription(point.description ?? '');
    setEditLat(point.coordinates ? formatCoordinateInput(point.coordinates[1]) : '');
    setEditLng(point.coordinates ? formatCoordinateInput(point.coordinates[0]) : '');
    setEditError(null);
  }, []);

  const handleEditPoint = useCallback(
    (index: number) => {
      const point = route[index];
      if (point) handleStartEdit(point, index);
    },
    [handleStartEdit, route],
  );

  // #1495: тап по точке в списке шторки центрует карту на этой точке. Токен
  // растёт на каждый тап, поэтому повторный тап по той же точке возвращает карту
  // к ней даже после ручного панорамирования.
  const [focusPoint, setFocusPoint] = useState<MapFocusPoint | null>(null);
  const focusTokenRef = useRef(0);
  const handleFocusPoint = useCallback(
    (index: number) => {
      const coordinates = route[index]?.coordinates;
      if (!coordinates) return;
      focusTokenRef.current += 1;
      setFocusPoint({ lat: coordinates[1], lng: coordinates[0], token: focusTokenRef.current });
    },
    [route],
  );

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditError(null);
  };

  const handleOpenAddPoint = () => {
    setEditingIndex(null);
    setEditError(null);
    setNewPointError(null);
    setIsAddPointOpen(true);
  };

  const handleCancelAddPoint = () => {
    setIsAddPointOpen(false);
    setNewPointError(null);
  };

  const handleSaveEdit = () => {
    if (editingIndex == null) return;
    const name = editName.trim();
    if (!name) {
      setEditError(i18nT('trips:components.trips.planning.RouteBuilder.vvedite_nazvanie_tochki_65a2f141'));
      return;
    }

    const { coordinates, error } = coordinatesFromFields(editLat, editLng);
    if (error) {
      setEditError(error);
      return;
    }

    setRoute((prev) => {
      const current = prev[editingIndex];
      if (!current) return prev;
      const next = prev.slice();
      // #1532: `place` — не самостоятельный ярлык, а следствие привязки к месту
      // или путешествию MeTravel. Точка без `placeId` этот тип получить не
      // может: маршрут ушёл бы как `point_type: 'travel', place_id: null`, а
      // бэкенд (`validate_route_point_attrs`) отклоняет такой PUT целиком —
      // вместе со всеми здоровыми точками маршрута.
      const nextType = editType === 'place' && current.placeId == null ? 'custom' : editType;
      next[editingIndex] = {
        ...current,
        type: nextType,
        name,
        description: editDescription.trim() || null,
        coordinates,
        placeId: nextType === 'place' ? current.placeId : null,
      };
      return next;
    });
    setEditingIndex(null);
    setEditError(null);
  };

  const handleAddPointFromMap = ({ lat, lng }: { lat: number; lng: number }) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setIsAddPointOpen(false);
    setRoute((prev) => {
      const nextIndex = prev.length;
      const name = i18nT('trips:components.trips.planning.RouteBuilder.tochka_value1_58a44f4e', { value1: nextIndex + 1 });
      const point: RoutePoint = {
        id: `map-${Date.now()}-${nextIndex}`,
        type: 'custom',
        name,
        description: null,
        coordinates: [lng, lat],
        placeId: null,
      };
      setEditingIndex(nextIndex);
      setEditType(point.type);
      setEditName(point.name);
      setEditDescription('');
      setEditLat(formatCoordinateInput(lat));
      setEditLng(formatCoordinateInput(lng));
      setEditError(null);
      return [...prev, point];
    });
    trackRoutePointAdded(trip.id, 'custom');
  };

  useEffect(() => {
    const query = siteQuery.trim();
    if (!isAddPointOpen || newType !== 'place' || query.length < SITE_SEARCH_MIN_LENGTH) {
      setSiteOptions([]);
      setSiteSearchStatus('idle');
      return;
    }

    const controller = new AbortController();
    setSiteSearchStatus('loading');

    Promise.all([
      fetchPlacesCatalog({ page: 1, perPage: 6, q: query }, controller.signal),
      fetchTravels(0, 6, query, {}, { signal: controller.signal }),
    ])
      .then(([placesPage, travelsPage]) => {
        const placeOptions: SiteRouteOption[] = placesPage.places.map((place) => {
          const numericId = parseNumber(place.id);
          return {
            key: `place-${place.id}`,
            kind: 'place',
            id: numericId,
            title: place.title,
            subtitle: compactText([place.category, place.country]),
            description: place.address ?? null,
            coordinates: [place.lngNumber, place.latNumber],
            imageUrl: place.travelImageThumbUrl || place.imageUrl || null,
          };
        });

        const travelOptions: SiteRouteOption[] = travelsPage.data.map((travel) => ({
          key: `travel-${travel.id}`,
          kind: 'travel',
          id: travel.id,
          title: travel.name,
          subtitle: compactText([i18nT('trips:components.trips.planning.RouteBuilder.puteshestvie_7cbf3a43'), travel.countryName]),
          description: travel.description || null,
          coordinates: travelCoordinates(travel),
          imageUrl: travel.travel_image_thumb_url || travel.travel_image_thumb_small_url || null,
        }));

        setSiteOptions([...placeOptions, ...travelOptions]);
        setSiteSearchStatus('ready');
      })
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setSiteOptions([]);
        setSiteSearchStatus('error');
      });

    return () => controller.abort();
  }, [isAddPointOpen, newType, siteQuery]);

  const handleAddSitePoint = (option: SiteRouteOption) => {
    const title = option.title.trim();
    if (!title) return;

    setRoute((prev) => [
      ...prev,
      {
        id: `${option.key}-${prev.length}`,
        type: 'place',
        name: title,
        description: option.description || option.subtitle || null,
        coordinates: option.coordinates,
        placeId: option.id,
      },
    ]);
    trackRoutePointAdded(trip.id, 'place');
    setSiteQuery('');
    setSiteOptions([]);
    setSiteSearchStatus('idle');
    setIsAddPointOpen(false);
  };

  // #1491: шаг «Точки маршрута» умеет то же, что и /map, — искать адрес. Поиск
  // переиспользован целиком (`AddressSearch`, Nominatim + разбор координат);
  // здесь только раскладка результата в доменную точку маршрута.
  const handleAddAddressPoint = useCallback(
    (address: string, coords: { lat: number; lng: number }) => {
      const full = address.trim();
      if (!full || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return;
      // Nominatim отдаёт полный адрес до страны; в названии точки остаётся
      // голова, весь адрес уходит в описание и виден в карточке точки.
      const [head] = full.split(',');
      const name = head.trim() || full;

      setRoute((prev) => [
        ...prev,
        {
          id: `address-${prev.length}-${name}`,
          type: 'custom',
          name,
          description: full === name ? null : full,
          coordinates: [coords.lng, coords.lat],
          placeId: null,
        },
      ]);
      trackRoutePointAdded(trip.id, 'custom');
      setIsAddPointOpen(false);
    },
    [trip.id],
  );

  const handleApplyTemplate = (points: Array<Omit<RoutePoint, 'id'>>) => {
    setRoute(
      points.map((p, index) => ({
        ...p,
        id: `tpl-${index}-${p.name}`,
      })),
    );
    setEditingIndex(null);
    setEditError(null);
    setIsAddPointOpen(false);
  };

  const handleApplyImportedRoute = useCallback((
    nextRoute: RoutePoint[],
    originalUpload: PickedTripRouteFileUpload | null,
  ) => {
    setRoute(nextRoute);
    setEditingIndex(null);
    setEditError(null);
    setIsAddPointOpen(false);
    setNewPointError(null);
    setOriginalUploadError(null);
    if (originalUpload) {
      // Предыдущий невыгруженный выбор больше не нужен — иначе на устройстве
      // остаётся кэш-копия файла до 20 МиБ.
      const previous = pendingOriginalRef.current;
      if (previous) void releasePickedTripRouteUpload(previous);
      pendingOriginalRef.current = originalUpload;
      setPendingOriginalName(
        originalUpload.kind === 'native' ? originalUpload.name : originalUpload.file.name,
      );
    }
  }, []);

  const handleRemoveStoredRouteFile = useCallback(() => {
    if (!storedRouteFile) return;
    setOriginalUploadError(null);
    deleteRouteFile.mutate(
      { tripId: trip.id, routeId: storedRouteFile.id },
      {
        onError: () => setOriginalUploadError(
          i18nT('tripsStatic:plan.routeImport.original.removeError'),
        ),
      },
    );
  }, [deleteRouteFile, storedRouteFile, trip.id]);

  // Освобождаем кэш-копию, если экран закрыли, не сохранив маршрут.
  useEffect(() => () => {
    const pending = pendingOriginalRef.current;
    pendingOriginalRef.current = null;
    if (pending) void releasePickedTripRouteUpload(pending);
  }, []);

  // Загрузка оригинала идёт после успешного сохранения точек и не откатывает их:
  // при отказе хранилища точки остаются сохранёнными, файл остаётся выбранным, и
  // повторное «Сохранить маршрут» пробует загрузку ещё раз.
  const uploadPendingOriginal = async (): Promise<void> => {
    const pending = pendingOriginalRef.current;
    if (!pending) return;
    setOriginalUploadError(null);
    try {
      await uploadRouteFile.mutateAsync({
        tripId: trip.id,
        file: toRouteFileUploadPart(pending),
      });
      pendingOriginalRef.current = null;
      setPendingOriginalName(null);
      void releasePickedTripRouteUpload(pending);
    } catch {
      setOriginalUploadError(i18nT('tripsStatic:plan.routeImport.original.uploadError'));
    }
  };

  const handleSave = () => {
    if (
      transportMutationLockedRef.current ||
      updateTripTransport.isPending ||
      updateTripBikeType.isPending
    ) {
      return;
    }

    // После успешного сохранения точек загрузка оригинала могла упасть. В таком
    // состоянии повторная кнопка ретраит только файл и не делает лишний PUT
    // неизменившегося маршрута.
    if (!hasUnsavedRouteChanges) {
      void uploadPendingOriginal();
      return;
    }

    setRouteSaveError(null);
    updateTripRoute.mutate(
      { tripId: trip.id, route },
      {
        onSuccess: (updatedTrip) => {
          setRoute(updatedTrip.route);
          void uploadPendingOriginal();
        },
        onError: () => {
          setRouteSaveError({
            message: i18nT('tripsStatic:plan.route.saveError'),
            signature: currentRouteSignature,
          });
        },
      },
    );
  };


  // Инвариант «ровно один PATCH на переключение» держится здесь, а не на
  // `disabled` дочернего контрола: ref ловит повтор в одном тике, isPending —
  // мутацию этого экрана, которая ещё летит.
  const canCommitRouteRebuild = () =>
    !transportMutationLockedRef.current &&
    !updateTripRoute.isPending &&
    !updateTripTransport.isPending &&
    !updateTripBikeType.isPending;

  // Транспорт и тип велосипеда перестраивают маршрут одним и тем же PATCH, поэтому
  // обвязка коммита общая: лок ставится синхронно до mutate, ответ применяется
  // атомарно и не затирает несохранённый черновик маршрута.
  const beginRouteRebuild = () => {
    const persistedRouteSignature = routeSignature(trip.route);
    transportMutationLockedRef.current = true;
    setTransportCommitPending(true);
    setRouteRebuildError(null);

    return {
      onSuccess: (updatedTrip: PlannedTrip) => {
        setRoute((currentRoute) => (
          routeSignature(currentRoute) === persistedRouteSignature
            ? updatedTrip.route
            : currentRoute
        ));
      },
      onError: () => {
        setRouteRebuildError(
          t('trips:components.trips.planning.RouteBuilder.ne_udalos_perestroit_marshrut_poprobuyte_esche_raz_9c4be156'),
        );
      },
      onSettled: () => {
        transportMutationLockedRef.current = false;
        setTransportCommitPending(false);
      },
    };
  };

  const handleTransportChange = (value: string) => {
    if (value === trip.transport || !isRoutableTransport(value) || !canCommitRouteRebuild()) {
      return;
    }

    updateTripTransport.mutate({ tripId: trip.id, transport: value }, beginRouteRebuild());
  };

  const handleBikeTypeChange = (value: TripBikeType) => {
    if (value === trip.bikeType || !canCommitRouteRebuild()) return;

    updateTripBikeType.mutate({ tripId: trip.id, bikeType: value }, beginRouteRebuild());
  };

  // Перетаскивание доступно только владельцу и только когда переставлять есть
  // что. Стрелки остаются на месте как клавиатурный и a11y путь.
  const canReorder = trip.isOwner && route.length > 1;
  const { drag, registerRowLayout, handleProps } = useRoutePointDrag({
    enabled: canReorder,
    count: route.length,
    onReorder: handleReorder,
  });

  const renderPoint = (point: RoutePoint, index: number) => (
    <RoutePointRow
      key={point.id}
      point={point}
      index={index}
      total={route.length}
      isOwner={trip.isOwner}
      styles={styles}
      colors={colors}
      dragHandlers={canReorder ? handleProps[index] ?? null : null}
      isDragging={drag?.index === index}
      isDropTarget={drag != null && drag.dropIndex === index && drag.index !== index}
      dragOffsetY={drag?.index === index ? drag.offsetY : 0}
      formatCoordinate={formatCoordinateInput}
      onLayout={registerRowLayout}
      onEdit={handleEditPoint}
      onFocus={isMapFirst ? handleFocusPoint : undefined}
      onMove={handleMove}
      onDelete={handleDelete}
    />
  );

  if (!trip.isOwner) {
    return (
      <View style={styles.wrap} testID="route-builder">
        <Text style={styles.heading}>{i18nT('trips:components.trips.planning.RouteBuilder.marshrut_49482da4')}</Text>
        <TripPlanRouteMap
          route={route}
          routeGeometry={routeGeometry}
          originalTrack={originalTrack?.geometry ?? null}
          routingState={routingState}
          summary={summary}
          transport={trip.transport}
          readonly
          activeIndex={editingIndex}
          onEditPoint={handleEditPoint}
        />
        {elevationProfileSection}
        {route.length ? (
          <View style={styles.pointList}>{route.map(renderPoint)}</View>
        ) : (
          <Text style={styles.hint}>{i18nT('trips:components.trips.planning.RouteBuilder.marshrut_poka_ne_postroen_fbdcf5ed')}</Text>
        )}
        <RouteSummaryBar summary={summary} routingState={routingState} transport={trip.transport} />
        {routeDownloadSection}
      </View>
    );
  }

  const templates = templatesQuery.data ?? [];
  const transportPending =
    transportCommitPending || updateTripTransport.isPending || updateTripBikeType.isPending;
  const transportDisabled = transportPending || updateTripRoute.isPending;
  const transportOptions = ROUTE_TRANSPORTS.map((transport) => ({
    key: transport,
    label: TRANSPORT_LABEL[transport],
  }));

  // Секции панели собираются один раз и раскладываются по-разному: вертикальным
  // стеком (desktop и вся историческая раскладка) или шторкой поверх карты
  // (#1495, mobile). Разъезжаться содержимому между раскладками нельзя.
  //
  // #1491: три нумерованных шага — та же последовательность и те же слова, что на
  // /map: заголовки берутся из общих ключей панели маршрута карты, чтобы
  // «Транспорт → Точки маршрута → Итог» не разъехались по формулировкам.
  const transportSection = (
    <RouteStepBlock
      step={1}
      title={i18nT('map:components.MapPage.FiltersPanelRouteSection.transport_aa70a7ea')}
      styles={stepStyles}
      aside={<Text style={panelStyles.stepBadge}>{TRANSPORT_LABEL[trip.transport]}</Text>}
      testID="route-builder-step-transport"
    >
      <View
        style={panelStyles.stepBody}
        accessibilityState={{ busy: transportPending }}
        testID="route-builder-transport-control"
      >
        <SegmentedControl
          options={transportOptions}
          value={trip.transport}
          onChange={handleTransportChange}
          accessibilityLabel={t('trips:components.trips.planning.RouteBuilder.sposob_peredvizheniya_f5c52d42')}
          compact
          dense
          minTouchHeight={44}
          noOuterMargins
          disabled={transportDisabled}
        />
        {trip.transport === 'bike' && trip.bikeType ? (
          <TripBikeTypeControl
            value={trip.bikeType}
            disabled={transportDisabled}
            onChange={handleBikeTypeChange}
            styles={styles}
          />
        ) : null}
        {transportPending ? (
          <Text
            style={styles.hint}
            accessibilityLiveRegion="polite"
            testID="route-builder-transport-pending"
          >
            {t('trips:components.trips.planning.RouteBuilder.perestraivaem_marshrut_d8d47f21')}
          </Text>
        ) : null}
        {routeRebuildError ? (
          <Text
            style={styles.errorText}
            accessibilityLiveRegion="assertive"
            testID="route-builder-transport-error"
          >
            {routeRebuildError}
          </Text>
        ) : null}
      </View>
    </RouteStepBlock>
  );

  const mapSection = (
    <TripPlanRouteMap
      route={route}
      routeGeometry={routeGeometry}
      originalTrack={originalTrack?.geometry ?? null}
      routingState={routingState}
      summary={summary}
      transport={trip.transport}
      activeIndex={editingIndex}
      fill={isMapFirst}
      focusPoint={focusPoint}
      onEditPoint={handleEditPoint}
      onAddPointFromMap={editingIndex == null ? handleAddPointFromMap : undefined}
    />
  );

  const pointsSection = (
    <RouteStepBlock
      step={2}
      title={i18nT('map:components.MapPage.FiltersPanelRouteSection.tochki_marshruta_0250dc3a')}
      styles={stepStyles}
      aside={
        route.length >= MIN_ROUTE_POINTS ? (
          <View style={panelStyles.stepCheckBadge}>
            <Feather name="check" size={12} color={colors.success} />
            <Text style={panelStyles.stepCheckText}>
              {i18nT('map:components.MapPage.FiltersPanelRouteSection.gotovo_aab95a18')}
            </Text>
          </View>
        ) : (
          <Text style={panelStyles.stepHint}>
            {i18nT('map:components.MapPage.FiltersPanelRouteSection.vyberite_tochki_fb6530e6')}
          </Text>
        )
      }
      testID="route-builder-step-points"
    >
      {isAddPointOpen && editingIndex == null ? (
        <AddressSearch onAddressSelect={handleAddAddressPoint} enableCoordinateInput dense />
      ) : null}
      {route.length ? (
        isMapFirst ? (
          <View style={styles.pointList}>{route.map(renderPoint)}</View>
        ) : (
          <ScrollView
            style={styles.pointListScroll}
            contentContainerStyle={styles.pointList}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            accessibilityLabel={i18nT('map:components.MapPage.FiltersPanelRouteSection.tochki_marshruta_0250dc3a')}
            testID="route-builder-point-list-scroll"
            {...(Platform.OS === 'web' ? { tabIndex: 0 as const } : {})}
          >
            {route.map(renderPoint)}
          </ScrollView>
        )
      ) : (
        <Text style={styles.hint}>{i18nT('trips:components.trips.planning.RouteBuilder.dobavte_pervuyu_tochku_marshruta_nizhe_d7cb9f9e')}</Text>
      )}
    </RouteStepBlock>
  );

  const addPointSection = editingIndex != null ? null : !isAddPointOpen ? (
    <Button
      label={i18nT('trips:components.trips.planning.RouteBuilder.dobavit_tochku_60ab5746')}
      onPress={handleOpenAddPoint}
      variant="secondary"
      size="sm"
      icon={<Feather name="plus" size={16} color={colors.text} />}
      testID="route-builder-add-action"
    />
  ) : (
    <RoutePointAddForm
      styles={styles}
      colors={colors}
      pointTypes={POINT_TYPES}
      type={newType}
      name={newName}
      lat={newLat}
      lng={newLng}
      description={newDescription}
      error={newPointError}
      siteQuery={siteQuery}
      siteOptions={siteOptions}
      siteSearchStatus={siteSearchStatus}
      onTypeChange={setNewType}
      onNameChange={setNewName}
      onLatChange={setNewLat}
      onLngChange={setNewLng}
      onDescriptionChange={setNewDescription}
      onSiteQueryChange={setSiteQuery}
      onAddSitePoint={handleAddSitePoint}
      onAdd={handleAdd}
      onCancel={handleCancelAddPoint}
    />
  );

  // #1532: чип «Место» в форме редактирования доступен только точке, уже
  // привязанной к сущности MeTravel. Привязка ставится выбором в поиске формы
  // добавления (`handleAddSitePoint`), поэтому у ручной точки, точки с карты и
  // точки из адресного поиска этого типа в переключателе нет.
  const editingPoint = editingIndex != null ? route[editingIndex] ?? null : null;
  const editTypeOptions =
    editingPoint?.placeId != null
      ? POINT_TYPES
      : POINT_TYPES.filter((type) => type !== 'place');

  const editPointSection = editingIndex != null ? (
      <View style={styles.editForm} testID="route-builder-edit-form">
        <Text style={styles.label}>{i18nT('trips:components.trips.planning.RouteBuilder.redaktirovat_tochku_8815b389')}</Text>
        <View style={styles.chipRow}>
          {editTypeOptions.map((type) => {
            const active = type === editType;
            return (
              <Pressable
                key={type}
                accessibilityRole="button"
                onPress={() => setEditType(type)}
                style={[styles.typeChip, active && styles.typeChipActive]}
                testID={`route-builder-edit-type-${type}`}
              >
                <Feather
                  name={ROUTE_POINT_ICON_NAME[type] as never}
                  size={13}
                  color={active ? colors.textOnPrimary : colors.textSecondary}
                />
                <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                  {ROUTE_POINT_LABEL[type]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={editName}
          onChangeText={setEditName}
          placeholder={i18nT('trips:components.trips.planning.RouteBuilder.nazvanie_tochki_0cdacb0f')}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          testID="route-builder-edit-name"
        />
        <View style={styles.coordRow}>
          <TextInput
            value={editLat}
            onChangeText={setEditLat}
            placeholder={i18nT('trips:components.trips.planning.RouteBuilder.shirota_lat_6d696d4a')}
            placeholderTextColor={colors.textMuted}
            keyboardType="numbers-and-punctuation"
            style={[styles.input, styles.coordInput]}
            testID="route-builder-edit-lat"
          />
          <TextInput
            value={editLng}
            onChangeText={setEditLng}
            placeholder={i18nT('trips:components.trips.planning.RouteBuilder.dolgota_lng_f08c3647')}
            placeholderTextColor={colors.textMuted}
            keyboardType="numbers-and-punctuation"
            style={[styles.input, styles.coordInput]}
            testID="route-builder-edit-lng"
          />
        </View>
        <TextInput
          value={editDescription}
          onChangeText={setEditDescription}
          placeholder={i18nT('trips:components.trips.planning.RouteBuilder.opisanie_ili_ssylka_po_zhelaniyu_2a1ab272')}
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
          style={[styles.input, styles.textArea]}
          testID="route-builder-edit-description"
        />
        {editError ? <Text style={styles.errorText}>{editError}</Text> : null}
        <View style={styles.editActions}>
          <Button
            label={i18nT('trips:components.trips.planning.RouteBuilder.sohranit_tochku_467b8cde')}
            onPress={handleSaveEdit}
            variant="secondary"
            disabled={!editName.trim()}
            testID="route-builder-edit-save"
          />
          <Button
            label={i18nT('trips:components.trips.planning.RouteBuilder.otmena_cb0c29f2')}
            onPress={handleCancelEdit}
            variant="ghost"
            testID="route-builder-edit-cancel"
          />
        </View>
    </View>
  ) : null;

  const templatesSection = templates.length ? (
      <View style={styles.templates}>
        <Text style={styles.label}>{i18nT('trips:components.trips.planning.RouteBuilder.shablony_marshruta_083d49d2')}</Text>
        {templates.map((tpl) => (
          <View key={tpl.id} style={styles.templateRow}>
            <View style={styles.templateBody}>
              <Text style={styles.templateTitle}>{tpl.title}</Text>
              <Text style={styles.templateDescription}>{tpl.description}</Text>
            </View>
            <Button
              label={i18nT('trips:components.trips.planning.RouteBuilder.primenit_12ea5d97')}
              onPress={() => handleApplyTemplate(tpl.points)}
              variant="ghost"
              testID={`route-builder-template-${tpl.id}`}
            />
          </View>
      ))}
    </View>
  ) : null;

  const summarySection = (
    <RouteStepBlock
      step={3}
      title={i18nT('map:components.MapPage.FiltersPanelRouteSection.itog_marshruta_aa8b7865')}
      styles={stepStyles}
      testID="route-builder-step-summary"
    >
      <RouteSummaryBar summary={summary} routingState={routingState} transport={trip.transport} />
    </RouteStepBlock>
  );

  const importSection = (
    <TripRouteImportPanel
      route={route}
      routeGeometry={routeGeometry}
      disabled={updateTripRoute.isPending || transportPending || uploadRouteFile.isPending}
      storedFile={storedRouteFile}
      pendingUploadName={pendingOriginalName}
      uploadError={originalUploadError}
      removing={deleteRouteFile.isPending}
      onRemoveStoredFile={handleRemoveStoredRouteFile}
      onApply={handleApplyImportedRoute}
    />
  );

  // #1491: главное действие панели. Подписи — общая лесенка с /map
  // («Добавьте старт и финиш» → «Построить маршрут» → «Пересчитать маршрут»),
  // а сама кнопка появляется только когда есть несохранённые правки: постоянная
  // «Сохранить маршрут» не отличала «правки ждут» от «всё уже на сервере».
  const routeSavePending = updateTripRoute.isPending || uploadRouteFile.isPending;
  const visibleRouteSaveError =
    routeSaveError && routeSaveError.signature === currentRouteSignature
      ? routeSaveError.message
      : null;
  const cta = routeBuilderCta({
    pointCount: route.length,
    savedPointCount: trip.route.length,
    hasUnsavedChanges: hasUnsavedRouteChanges,
    hasPendingOriginal: pendingOriginalName != null,
    pending: routeSavePending || transportPending,
  });

  const saveSection = cta.visible ? (
    <View style={panelStyles.ctaBlock}>
      <Button
        label={cta.label}
        onPress={handleSave}
        loading={routeSavePending}
        disabled={cta.disabled}
        fullWidth
        testID="route-builder-save"
      />
      {cta.hint ? (
        <Text style={panelStyles.stepHint} testID="route-builder-save-hint">
          {cta.hint}
        </Text>
      ) : null}
      {visibleRouteSaveError ? (
        <Text
          style={styles.errorText}
          accessibilityLiveRegion="assertive"
          testID="route-builder-save-error"
        >
          {visibleRouteSaveError}
        </Text>
      ) : null}
    </View>
  ) : null;

  if (isMapFirst) {
    return (
      <RouteBuilderMapFirst
        mapSlot={mapSection}
        engineSlot={previewEngine}
        transportSlot={
          <>
            {transportSection}
            {previewStatusSection}
          </>
        }
        pointsSlot={
          <>
            {pointsSection}
            {elevationProfileSection}
          </>
        }
        summarySlot={summarySection}
        toolsSlot={
          <>
            {addPointSection}
            {editPointSection}
            {templatesSection}
            {importSection}
            {routeDownloadSection}
            {saveSection}
          </>
        }
        summary={summary}
        routingState={routingState}
        transport={trip.transport}
        // Ключ карты, а не свой: строка та же самая, а в fill-режиме её шапку
        // рисует сцена — дублировать перевод в пятый раз незачем.
        mapHint={
          route.length
            ? null
            : i18nT('trips:components.trips.planning.TripPlanRouteMap.nazhmite_na_kartu_chtoby_dobavit_tochku_posl_52845bf6')
        }
        editingIndex={editingIndex}
        focusToken={focusPoint?.token ?? 0}
      />
    );
  }

  // #1491: раскладка как на /map — шаги слева, карта справа и всегда перед
  // глазами. Одну колонку stack держит только там, где двух не хватает по
  // ширине: мобильная раскладка — отдельная (#1495) и сюда не попадает.
  return (
    <View style={styles.wrap} testID="route-builder">
      <Text style={styles.heading}>{i18nT('trips:components.trips.planning.RouteBuilder.konstruktor_marshruta_187e063e')}</Text>

      <View style={[panelStyles.workspace, panelStyles.workspaceSplit]} testID="route-builder-workspace">
        <View
          style={[panelStyles.panelColumn, panelStyles.panelColumnSplit]}
          testID="route-builder-panel-column"
        >
          {transportSection}

          {pointsSection}

          {addPointSection}

          {editPointSection}

          {templatesSection}

          {summarySection}

          {importSection}

          {routeDownloadSection}

          {saveSection}
        </View>

        <View
          style={[panelStyles.mapColumn, panelStyles.mapColumnSplit]}
          testID="route-builder-map-column"
        >
          {mapSection}
          {previewEngine}
          {previewStatusSection}

          {elevationProfileSection}
        </View>
      </View>
    </View>
  );
}

export default React.memo(RouteBuilder);
