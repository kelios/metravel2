// components/trips/planning/tripPlanRouteMap.types.ts
// Общий контракт web- и native-варианта карты конструктора маршрута: оба файла
// платформенные, а типы у них обязаны совпадать (как у TripRouteFilePicker).

/**
 * #1495: запрос «покажи эту точку». `token` растёт на каждый тап по точке в
 * списке — по нему карта понимает, что цель нужно показать снова, даже если
 * координаты те же самые.
 */
export type MapFocusPoint = {
  lat: number;
  lng: number;
  token: number;
};

/** Зум, на который карта встаёт при центрировании на точке маршрута. */
export const FOCUS_POINT_ZOOM = 14;

/**
 * #1781: запрос «перенеси эту точку сюда». Карта только сообщает намерение —
 * владелец черновика (`RouteBuilder`) решает, как применить его к маршруту.
 */
export type RoutePointMove = {
  index: number;
  lat: number;
  lng: number;
};

/**
 * Шаг округления координат точки маршрута. Один и тот же для ручного ввода,
 * перетаскивания маркера и ключа защёлки кадра: сохранение маршрута на бэкенде
 * пересоздаёт строки точек и выдаёт им НОВЫЕ id, поэтому идентичность точки для
 * карты держится на координатах, а не на id (#1781).
 */
export const ROUTE_POINT_COORDINATE_PRECISION = 6;

/**
 * Ключ точки для защёлки авто-подгонки кадра. Leaflet отдаёт сырую позицию
 * дропа, а в маршрут уезжает округлённая — без общего округления ключ дропа не
 * совпал бы с сохранённым никогда. Нефинитную пару ключом не считаем: такая
 * точка не рисуется, но индекс в наборе занимает.
 */
export const routePointFitKey = (lat: number, lng: number): string =>
  Number.isFinite(lat) && Number.isFinite(lng)
    ? `${lat.toFixed(ROUTE_POINT_COORDINATE_PRECISION)},${lng.toFixed(ROUTE_POINT_COORDINATE_PRECISION)}`
    : '';
