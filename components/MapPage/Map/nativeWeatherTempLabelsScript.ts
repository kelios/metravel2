import { serializeForInlineScript } from '@/utils/webViewBridge';
import { WEATHER_LABELS_PANE, WEATHER_LABELS_PANE_Z_INDEX } from '@/utils/mapWeatherLabels';

/**
 * #2661 — рендерер слоя «Погода» в Leaflet WebView. Ячейки, кэш и запросы к
 * OpenWeatherMap живут в общем контроллере `utils/mapWeatherLabels.ts` на
 * стороне RN (`useNativeWeatherLabels`); сюда приходит только патч
 * `__metravelSetWeatherLabels({add:[{key,lat,lon,html}], removeKeys})`.
 * Неизменные подписи не пересоздаются, панель — под маркерами и кластерами.
 */
export const buildNativeWeatherTempLabelsScript = () => `
        var WEATHER_LABELS_PANE = ${serializeForInlineScript(WEATHER_LABELS_PANE)};
        var weatherLabelsGroup = null;
        var weatherLabelMarkers = {};

        function ensureWeatherLabelsPane() {
          try {
            if (typeof map.getPane !== 'function') return;
            // Стиль — всегда, не только при создании (см. ensureMapPane, #1813).
            var pane = map.getPane(WEATHER_LABELS_PANE) || map.createPane(WEATHER_LABELS_PANE);
            if (!pane || !pane.style) return;
            pane.style.zIndex = '${WEATHER_LABELS_PANE_Z_INDEX}';
            pane.style.pointerEvents = 'none';
          } catch (e) {}
        }

        function makeWeatherTempLabelsController(layerGroup) {
          return {
            start: function() {
              ensureWeatherLabelsPane();
              weatherLabelsGroup = layerGroup;
            },
            stop: function() {
              weatherLabelMarkers = {};
              try { layerGroup.clearLayers(); } catch (e) {}
              if (weatherLabelsGroup === layerGroup) weatherLabelsGroup = null;
            }
          };
        }

        window.__metravelSetWeatherLabels = function(patch) {
          if (!weatherLabelsGroup || !patch) return;
          var removeKeys = Array.isArray(patch.removeKeys) ? patch.removeKeys : [];
          for (var i = 0; i < removeKeys.length; i++) {
            var existing = weatherLabelMarkers[removeKeys[i]];
            if (!existing) continue;
            try { weatherLabelsGroup.removeLayer(existing); } catch (e) {}
            delete weatherLabelMarkers[removeKeys[i]];
          }
          var add = Array.isArray(patch.add) ? patch.add : [];
          var hasPane = typeof map.getPane === 'function' && !!map.getPane(WEATHER_LABELS_PANE);
          for (var j = 0; j < add.length; j++) {
            var label = add[j];
            if (!label || !label.key || weatherLabelMarkers[label.key]) continue;
            if (!isFinite(label.lat) || !isFinite(label.lon)) continue;
            try {
              var options = {
                icon: L.divIcon({
                  className: 'metravel-temp-label',
                  html: String(label.html || ''),
                  iconSize: undefined,
                  iconAnchor: [0, 0]
                }),
                interactive: false,
                keyboard: false
              };
              if (hasPane) options.pane = WEATHER_LABELS_PANE;
              var marker = L.marker([label.lat, label.lon], options);
              marker.addTo(weatherLabelsGroup);
              weatherLabelMarkers[label.key] = marker;
            } catch (e) {}
          }
        };
`;
