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
