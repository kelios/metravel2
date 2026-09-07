// components/trips/planning/RouteBuilder.tsx
// Конструктор маршрута поездки (Sprint 13 / блок D): список точек с reorder/delete
// (web-safe, без нативных drag-либ), inline-добавление точки, применение шаблонов
// и живая сводка маршрута. Только владелец может редактировать.
// #1490: пока правки не сохранены, линию и цифры даёт тот же движок
// маршрутизации, что и /map, а не прямая между точками.
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';

import Button from '@/components/ui/Button';
import { safeLazy } from '@/components/layout/safeLazy';
import RouteBuilderLayout from '@/components/trips/planning/RouteBuilderLayout';
import { type SiteRouteOption } from '@/components/trips/planning/RoutePointAddForm';
import RoutePointEditForm from '@/components/trips/planning/RoutePointEditForm';
import RoutePointRow from '@/components/trips/planning/RoutePointRow';
import RoutePointsSection from '@/components/trips/planning/RoutePointsSection';
import RouteSaveSection from '@/components/trips/planning/RouteSaveSection';
import RouteTransportSection from '@/components/trips/planning/RouteTransportSection';
import RouteSummaryBar from '@/components/trips/planning/RouteSummaryBar';
import TripPlanRouteMap from '@/components/trips/planning/TripPlanRouteMap';
import TripRouteDownloadButtons from '@/components/trips/planning/TripRouteDownloadButtons';
import TripRouteImportPanel from '@/components/trips/planning/TripRouteImportPanel';
import {
  shouldRenderTripRouteExportMenu,
  useTripRouteExport,
} from '@/components/trips/planning/tripRouteExport';
import RoutingStatus, { ROUTING_DIRECT_LINE } from '@/components/MapPage/RoutingStatus';
import RouteStepBlock from '@/components/MapPage/RouteStepBlock';
import TripRoutePreviewEngine from '@/components/trips/planning/TripRoutePreviewEngine';
import {
  previewPointsKey,
  previewStopsCount,
  routablePreviewPoints,
} from '@/components/trips/planning/tripRoutePreview';
import {
  type MapFocusPoint,
  type RoutePointMove,
} from '@/components/trips/planning/tripPlanRouteMap.types';
import {
  COORDINATE_PRECISION,
  POINT_TYPES,
  formatCoordinateInput,
  routeSignature,
} from '@/components/trips/planning/routeBuilderPoint';
import { useRoutePointDraft } from '@/components/trips/planning/useRoutePointDraft';
import { useRouteSiteSearch } from '@/components/trips/planning/useRouteSiteSearch';
import { useTripRouteDisplay } from '@/components/trips/planning/useTripRouteDisplay';
import {
  type PlannedTrip,
  type RouteSummary,
  type RoutingState,
  type RoutePoint,
} from '@/api/plannedTrips';
import { TRANSPORT_LABEL } from '@/components/trips/planning/tripPlanFormatting';
import { type PickedTripRouteFileUpload } from '@/components/trips/planning/TripRouteFilePicker.types';
import { useTripRouteFileBranch } from '@/components/trips/planning/useTripRouteFileBranch';
import {
  useTripRouteElevationRefresh,
  useTripRouteElevationSource,
} from '@/components/trips/planning/useTripRouteElevationRefresh';
import { useTripRouteRebuild } from '@/components/trips/planning/useTripRouteRebuild';
import { useTripRouteSave } from '@/components/trips/planning/useTripRouteSave';
import {
  useRouteTemplates,
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

export interface RouteBuilderDisplayState {
  summary: RouteSummary | null;
  routingState: RoutingState | null;
  routablePointCount: number;
}

interface Props {
  trip: PlannedTrip;
  /**
   * `stack` — не-мобильная раскладка (ширина ≥768px, планшет портрет и десктоп):
   * две колонки, панель слева, карта справа. Имя историческое — от времён, когда
   * колонка была одна.
   * `mapFirst` — мобильная раскладка: карта первым блоком фиксированной высоты,
   * панель маршрута — контент под ней в общем скролле страницы. Выбирает её
   * экран поездки, а не компонент: тесты и широкий экран должны получать stack
   * независимо от ширины окна в окружении.
   * Выбор между двумя раскладками делает только владельческая ветка: у
   * не-владельца компонент выходит раньше (`if (!trip.isOwner)`) со своей
   * одноколоночной разметкой. Проп при этом доходит и туда — через `isMapFirst`
   * строки точек получают `compact`/`onFocus` (#1700), поэтому гость на телефоне
   * получает `mapFirst`, но не двухколоночную ветку.
   */
  layout?: 'stack' | 'mapFirst';
  /** Keep the page header on the same live display tuple as map/summary/export. */
  onDisplayStateChange?: (state: RouteBuilderDisplayState | null) => void;
}

function RouteBuilder({
  trip,
  layout = 'stack',
  onDisplayStateChange,
}: Props) {
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
  const templatesQuery = useRouteTemplates();
  // #1824: у сохранения маршрута лока не было вовсе. `disabled` кнопки держится
  // на `isPending`, а он появляется только со следующим рендером — повтор в
  // одном тике успевал отправить второй PUT. Ref ловит его синхронно, как это
  // уже сделано у перестроения маршрута.
  const routeSaveLockedRef = useRef(false);

  const [route, setRoute] = useState<RoutePoint[]>(trip.route);
  // #1820: маршрут заменён целиком — шаблоном или импортированным треком.
  // Карта снимает по этому счётчику защёлку кадра, поставленную перетаскиванием
  // маркера: сама она такую замену увидеть не может, потому что повторное
  // применение того же шаблона возвращает неперетащенные точки с прежними
  // координатами. Ответы бэкенда (сохранение маршрута, смена транспорта) точки
  // не заменяют и счётчик не трогают — иначе они выбрасывали бы наведённый кадр.
  const [routeReplacementToken, setRouteReplacementToken] = useState(0);
  const markRouteReplaced = useCallback(() => {
    setRouteReplacementToken((value) => value + 1);
  }, []);

  const {
    routeRebuildError,
    transportPending,
    isRouteRebuildBusy,
    handleTransportChange,
    handleBikeTypeChange,
  } = useTripRouteRebuild({
    trip,
    setRoute,
    t,
    isRouteSaveBusy: () => routeSaveLockedRef.current || updateTripRoute.isPending,
  });


  const {
    newType,
    newName,
    newLat,
    newLng,
    newDescription,
    newPointError,
    isAddPointOpen,
    editingIndex,
    editType,
    editName,
    editLat,
    editLng,
    editDescription,
    editBooking,
    editError,
    setNewType,
    setNewName,
    setNewLat,
    setNewLng,
    setNewDescription,
    setNewPointError,
    setIsAddPointOpen,
    setEditingIndex,
    setEditType,
    setEditLat,
    setEditLng,
    setEditDescription,
    setEditError,
    handleAdd,
    handleStartEdit,
    handleCancelEdit,
    commitEditName,
    handleEditBookingChange,
    handleOpenAddPoint,
    handleCancelAddPoint,
    handleSaveEdit,
    handleAddPointFromMap,
    handleAddAddressSelect,
    handleEditAddressSelect,
  } = useRoutePointDraft({ tripId: trip.id, setRoute });

  const {
    storedRouteFile,
    originalTrack,
    pendingOriginalName,
    originalUploadError,
    originalUploadPending,
    storedFileRemoving,
    handleRemoveStoredRouteFile,
    uploadPendingOriginal,
    acceptImportedOriginal,
  } = useTripRouteFileBranch({ tripId: trip.id, isOwner: trip.isOwner });
  const savedRouteSignature = useMemo(() => routeSignature(trip.route), [trip.route]);
  // #1491: кнопка действия существует только пока есть что отправлять. Сравнение
  // идёт по полной сигнатуре, а не по координатной: переименование точки — тоже
  // несохранённая правка, и потерять её молча нельзя.
  const currentRouteSignature = useMemo(() => routeSignature(route), [route]);
  const hasUnsavedRouteChanges = currentRouteSignature !== savedRouteSignature;
  const { handleSave, visibleRouteSaveError } = useTripRouteSave({
    tripId: trip.id,
    route,
    setRoute,
    currentRouteSignature,
    hasUnsavedRouteChanges,
    routeSaveLockedRef,
    updateTripRoute,
    isRouteRebuildBusy,
    uploadPendingOriginal,
  });
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

  const {
    routeElevationQuery,
    routeElevation,
    routeElevationPending,
  } = useTripRouteElevationSource({
    tripId: trip.id,
    routeShapeMatchesSaved,
    routableSavedPoints,
  });

  const routeDisplay = useTripRouteDisplay({
    trip,
    route,
    routeElevation,
    routeElevationPending,
    routeShapeMatchesSaved,
  });
  const preview = routeDisplay.preview;

  const elevationPlaceHints = useTripRouteElevationRefresh({
    trip,
    route,
    routeElevationQuery,
    routeShapeMatchesSaved,
    hasUsableSavedGeometry: routeDisplay.hasUsableSavedGeometry,
    savedRouteSignature,
  });

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

  useEffect(() => {
    onDisplayStateChange?.({
      summary,
      routingState,
      routablePointCount: routablePreviewPoints(route).length,
    });
  }, [onDisplayStateChange, route, routingState, summary]);

  useEffect(
    () => () => onDisplayStateChange?.(null),
    [onDisplayStateChange],
  );

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

  const elevationPreview = routeDisplay.elevation;

  const elevationProfileSection = elevationPreview ? (
    <View testID="route-builder-elevation">
      <Suspense fallback={null}>
        <RouteElevationProfile
          preview={elevationPreview}
          placeHints={elevationPlaceHints}
          transportHints={[TRANSPORT_LABEL[trip.transport]]}
        />
      </Suspense>
    </View>
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
  }, [setEditingIndex]);

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
  }, [setEditingIndex]);

  // #1781: точку перетащили по карте. Владелец черновика здесь один, поэтому
  // перемещение проходит тем же путём, что и правка из списка: меняются только
  // координаты одной точки, порядок и остальные поля остаются как были.
  const handleMovePoint = useCallback(({ index, lat, lng }: RoutePointMove) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
    // Округление тем же шагом, что и ручной ввод: иначе список, поля редактора
    // и координатная сигнатура показывали бы три разных значения одной точки.
    const nextLat = Number(lat.toFixed(COORDINATE_PRECISION));
    const nextLng = Number(lng.toFixed(COORDINATE_PRECISION));
    setRoute((prev) => {
      const current = prev[index];
      if (!current) return prev;
      const [currentLng, currentLat] = current.coordinates ?? [];
      if (currentLat === nextLat && currentLng === nextLng) return prev;
      const next = prev.slice();
      next[index] = { ...current, coordinates: [nextLng, nextLat] };
      return next;
    });
    // Открытый редактор этой же точки обязан переехать вместе с маркером: иначе
    // «Сохранить» в нём вернуло бы точку в дотасковую позицию.
    setEditingIndex((currentIndex) => {
      if (currentIndex === index) {
        setEditLat(formatCoordinateInput(nextLat));
        setEditLng(formatCoordinateInput(nextLng));
        setEditError(null);
      }
      return currentIndex;
    });
  }, [setEditError, setEditLat, setEditLng, setEditingIndex]);

  const handleEditPoint = useCallback(
    (index: number) => {
      const point = route[index];
      if (point) handleStartEdit(point, index);
    },
    [handleStartEdit, route],
  );

  // #1495: тап по точке в списке панели центрует карту на этой точке — только в
  // раскладке `mapFirst`: в `stack` строка точки получает `onFocus=undefined`.
  // Владелец и гость здесь равны (#1700): обе ветки отдают карте один и тот же
  // `focusPoint`. Токен растёт на каждый тап, поэтому повторный тап по той же
  // точке возвращает карту к ней даже после ручного панорамирования.
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

  const {
    siteQuery,
    setSiteQuery,
    siteOptions,
    siteSearchStatus,
    resetSiteSearch,
  } = useRouteSiteSearch({ isAddPointOpen, newType });

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
    resetSiteSearch();
    setIsAddPointOpen(false);
  };

  const handleApplyTemplate = (points: Array<Omit<RoutePoint, 'id'>>) => {
    setRoute(
      points.map((p, index) => ({
        ...p,
        id: `tpl-${index}-${p.name}`,
      })),
    );
    markRouteReplaced();
    setEditingIndex(null);
    setEditError(null);
    setIsAddPointOpen(false);
  };

  const handleApplyImportedRoute = useCallback((
    nextRoute: RoutePoint[],
    originalUpload: PickedTripRouteFileUpload | null,
  ) => {
    setRoute(nextRoute);
    markRouteReplaced();
    setEditingIndex(null);
    setEditError(null);
    setIsAddPointOpen(false);
    setNewPointError(null);
    acceptImportedOriginal(originalUpload);
  }, [
    acceptImportedOriginal,
    markRouteReplaced,
    setEditError,
    setEditingIndex,
    setIsAddPointOpen,
    setNewPointError,
  ]);

  // Перетаскивание доступно только владельцу и только когда переставлять есть
  // что. Стрелки остаются на месте как клавиатурный и a11y путь.
  const canReorder = trip.isOwner && route.length > 1;
  const { drag, registerRowLayout, handleProps } = useRoutePointDrag({
    enabled: canReorder,
    count: route.length,
    onReorder: handleReorder,
  });

  // `editorSlot` приходит только из мобильного списка: там форма правки живёт
  // внутри карточки своей точки, а не в конце панели.
  const renderPoint = (point: RoutePoint, index: number, editorSlot?: React.ReactNode) => (
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
      onLayout={registerRowLayout}
      onEdit={handleEditPoint}
      onFocus={isMapFirst ? handleFocusPoint : undefined}
      onMove={handleMove}
      onDelete={handleDelete}
      compact={isMapFirst}
      isEditing={editingIndex === index}
      editorSlot={editorSlot}
      onCloseEdit={handleCancelEdit}
    />
  );

  if (!trip.isOwner) {
    return (
      <View style={styles.wrap} testID="route-builder">
        <Text style={styles.heading}>{i18nT('trips:components.trips.planning.RouteBuilder.marshrut_49482da4')}</Text>
        <TripPlanRouteMap
          route={route}
          routeGeometry={routeGeometry}
          originalTrackSegments={originalTrack?.segments ?? null}
          routingState={routingState}
          summary={summary}
          transport={trip.transport}
          readonly
          activeIndex={editingIndex}
          focusPoint={focusPoint}
          onEditPoint={handleEditPoint}
        />
        {elevationProfileSection}
        {route.length ? (
          <View style={styles.pointList}>
            {route.map((point, index) => renderPoint(point, index))}
          </View>
        ) : (
          <Text style={styles.hint}>{i18nT('trips:components.trips.planning.RouteBuilder.marshrut_poka_ne_postroen_fbdcf5ed')}</Text>
        )}
        <RouteSummaryBar summary={summary} routingState={routingState} transport={trip.transport} />
        {routeDownloadSection}
      </View>
    );
  }

  const templates = templatesQuery.data ?? [];

  // Секции панели собираются один раз и раскладываются по-разному: `stack` —
  // не-мобильная раскладка (ширина ≥768px, планшет портрет и десктоп), две
  // колонки, шаги слева и карта справа; `mapFirst` — её собирает
  // RouteBuilderMobile: карта блоком, панель обычным контентом под ней (#1495
  // завёл mobile-раскладку шторкой, #1691 заменил её на этот блок).
  // Разъезжаться содержимому между раскладками нельзя.
  //
  // #1491: три нумерованных шага — та же последовательность и те же слова, что на
  // /map: заголовки берутся из общих ключей панели маршрута карты, чтобы
  // «Транспорт → Точки маршрута → Итог» не разъехались по формулировкам.
  const transportSection = (
    <RouteTransportSection
      styles={styles}
      panelStyles={panelStyles}
      stepStyles={stepStyles}
      transport={trip.transport}
      bikeType={trip.bikeType}
      pending={transportPending}
      disabled={transportPending || updateTripRoute.isPending}
      error={routeRebuildError}
      onTransportChange={handleTransportChange}
      onBikeTypeChange={handleBikeTypeChange}
    />
  );

  const mapSection = (
    <TripPlanRouteMap
      route={route}
      routeGeometry={routeGeometry}
      originalTrackSegments={originalTrack?.segments ?? null}
      routingState={routingState}
      summary={summary}
      transport={trip.transport}
      activeIndex={editingIndex}
      fill={isMapFirst}
      focusPoint={focusPoint}
      routeReplacementToken={routeReplacementToken}
      onEditPoint={handleEditPoint}
      onMovePoint={handleMovePoint}
      onDeletePoint={handleDelete}
      onAddPointFromMap={handleAddPointFromMap}
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
    <RoutePointEditForm
      styles={styles}
      colors={colors}
      isMapFirst={isMapFirst}
      editingIndex={editingIndex}
      routeLength={route.length}
      typeOptions={editTypeOptions}
      type={editType}
      name={editName}
      lat={editLat}
      lng={editLng}
      description={editDescription}
      booking={editBooking}
      error={editError}
      onTypeChange={setEditType}
      onBookingChange={handleEditBookingChange}
      onAddressSelect={handleEditAddressSelect}
      onNameChange={commitEditName}
      onLatChange={setEditLat}
      onLngChange={setEditLng}
      onDescriptionChange={setEditDescription}
      onSave={handleSaveEdit}
      onCancel={handleCancelEdit}
      onMove={handleMove}
      onDelete={handleDelete}
    />
  ) : null;

  const pointsSection = (
    <RoutePointsSection
      styles={styles}
      panelStyles={panelStyles}
      stepStyles={stepStyles}
      colors={colors}
      isMapFirst={isMapFirst}
      route={route}
      editingIndex={editingIndex}
      editorSlot={editPointSection}
      renderPoint={renderPoint}
      isAddPointOpen={isAddPointOpen}
      newType={newType}
      newName={newName}
      newLat={newLat}
      newLng={newLng}
      newDescription={newDescription}
      newPointError={newPointError}
      siteQuery={siteQuery}
      siteOptions={siteOptions}
      siteSearchStatus={siteSearchStatus}
      onTypeChange={setNewType}
      onNameChange={setNewName}
      onLatChange={setNewLat}
      onLngChange={setNewLng}
      onDescriptionChange={setNewDescription}
      onAddressSelect={handleAddAddressSelect}
      onSiteQueryChange={setSiteQuery}
      onAddSitePoint={handleAddSitePoint}
      onAdd={handleAdd}
      onOpenAddPoint={handleOpenAddPoint}
      onCancelAddPoint={handleCancelAddPoint}
    />
  );

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
      disabled={updateTripRoute.isPending || transportPending || originalUploadPending}
      storedFile={storedRouteFile}
      pendingUploadName={pendingOriginalName}
      uploadError={originalUploadError}
      removing={storedFileRemoving}
      onRemoveStoredFile={handleRemoveStoredRouteFile}
      onApply={handleApplyImportedRoute}
    />
  );

  const saveSection = (
    <RouteSaveSection
      styles={styles}
      panelStyles={panelStyles}
      pointCount={route.length}
      savedPointCount={trip.route.length}
      hasUnsavedChanges={hasUnsavedRouteChanges}
      hasPendingOriginal={pendingOriginalName != null}
      routeSavePending={updateTripRoute.isPending || originalUploadPending}
      transportPending={transportPending}
      error={visibleRouteSaveError}
      onSave={handleSave}
    />
  );

  return (
    <RouteBuilderLayout
      isMapFirst={isMapFirst}
      styles={styles}
      panelStyles={panelStyles}
      pointCount={route.length}
      summary={summary}
      routingState={routingState}
      transport={trip.transport}
      mapSection={mapSection}
      previewEngine={previewEngine}
      previewStatusSection={previewStatusSection}
      transportSection={transportSection}
      pointsSection={pointsSection}
      editPointSection={editPointSection}
      templatesSection={templatesSection}
      summarySection={summarySection}
      importSection={importSection}
      routeDownloadSection={routeDownloadSection}
      saveSection={saveSection}
      elevationProfileSection={elevationProfileSection}
    />
  );
}

export default React.memo(RouteBuilder);
