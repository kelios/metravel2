// Команды вида native-карты, которые RN шлёт через `injectJavaScript`: зум
// плавающих контролов (перенесён из nativeMapHtml.ts без изменений) и подгонка
// кадра под набор координат — день маршрута планировщика (#2058).
// Вставляется в bodyScript после `L.map(...)` и `__metravelProgrammaticMoveUntil`.

export const NATIVE_MAP_VIEW_COMMANDS_SCRIPT = `        window.__metravelMapZoomIn = function() {
          try { map.zoomIn(); } catch (e) {}
        };
        window.__metravelMapZoomOut = function() {
          try { map.zoomOut(); } catch (e) {}
        };
        window.__metravelMapFitCoords = function(coords, maxZoom) {
          try {
            var latLngs = [];
            for (var i = 0; i < coords.length; i += 1) {
              var lat = Number(coords[i] && coords[i][0]);
              var lng = Number(coords[i] && coords[i][1]);
              if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
                latLngs.push([lat, lng]);
              }
            }
            if (!latLngs.length) return false;
            __metravelProgrammaticMoveUntil = Date.now() + 700;
            if (latLngs.length === 1) {
              map.setView(latLngs[0], Math.max(map.getZoom ? map.getZoom() : maxZoom, maxZoom));
            } else {
              map.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50], maxZoom: maxZoom });
            }
            return true;
          } catch (e) {
            return false;
          }
        };`;

/** Команда `injectJavaScript` для `MapUiApi.fitToCoords`: только конечные числа. */
export const buildNativeMapFitCoordsCommand = (
  coords: ReadonlyArray<{ lat: number; lng: number }>,
  maxZoom: number,
): string => {
  const pairs = coords
    .filter(({ lat, lng }) => Number.isFinite(lat) && Number.isFinite(lng))
    .map(({ lat, lng }) => [lat, lng]);
  return `window.__metravelMapFitCoords && window.__metravelMapFitCoords(${JSON.stringify(pairs)}, ${maxZoom})`;
};
