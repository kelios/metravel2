import { getOwmApiKey } from '@/config/mapWebLayers';
import { serializeForInlineScript } from '@/utils/webViewBridge';

/** Numeric OpenWeatherMap labels for the native Leaflet WebView overlay engine. */
export const buildNativeWeatherTempLabelsScript = () => `
        var OWM_API_KEY = ${serializeForInlineScript(getOwmApiKey())};

        function weatherTempText(temp) {
          if (!isFinite(temp)) return '';
          var rounded = Math.round(temp);
          var sign = rounded > 0 ? '+' : (rounded < 0 ? '\u2212' : '');
          return sign + Math.abs(rounded) + '\u00b0';
        }

        function weatherTempColor(temp) {
          if (temp <= -10) return '#1d4ed8';
          if (temp <= 0) return '#2563eb';
          if (temp <= 10) return '#0e7490';
          if (temp <= 20) return '#15803d';
          if (temp <= 28) return '#b45309';
          return '#b91c1c';
        }

        function makeWeatherTempIcon(temp) {
          var text = weatherTempText(temp);
          var color = weatherTempColor(temp);
          var html = '<span style="display:inline-block;padding:1px 6px;border-radius:9px;' +
            'font-size:13px;font-weight:800;line-height:1.25;white-space:nowrap;color:' + color + ';' +
            'background:rgba(255,255,255,0.88);border:1px solid rgba(0,0,0,0.18);' +
            'box-shadow:0 1px 2px rgba(0,0,0,0.35);text-shadow:0 1px 0 rgba(255,255,255,0.9);">' +
            text + '</span>';
          return L.divIcon({
            className: 'metravel-temp-label',
            html: html,
            iconSize: undefined,
            iconAnchor: [0, 0]
          });
        }

        function weatherGridPoints(b) {
          var points = [];
          var insetLat = (b.north - b.south) * 0.12;
          var insetLon = (b.east - b.west) * 0.12;
          var south = b.south + insetLat;
          var north = b.north - insetLat;
          var west = b.west + insetLon;
          var east = b.east - insetLon;
          for (var row = 0; row < 3; row++) {
            var lat = south + (north - south) * (row / 2);
            for (var col = 0; col < 4; col++) {
              var lon = west + (east - west) * (col / 3);
              if (isFinite(lat) && isFinite(lon)) points.push({ lat: lat, lon: lon });
            }
          }
          return points;
        }

        function makeWeatherTempLabelsController(layerGroup, def) {
          var timer = null;
          var abort = null;
          var lastKey = null;
          var loading = false;
          var started = false;
          var nextAllowedAt = 0;
          var backoffMs = 0;
          var requestVersion = 0;

          function cancelActiveRequest() {
            var hadActiveRequest = loading;
            requestVersion += 1;
            if (abort) { try { abort.abort(); } catch (e) {} }
            abort = null;
            loading = false;
            if (hadActiveRequest) lastKey = null;
          }

          function renderWeatherPoints(points) {
            layerGroup.clearLayers();
            var seen = {};
            var rendered = 0;
            for (var i = 0; i < points.length && rendered < 12; i++) {
              var point = points[i];
              if (!point || !isFinite(point.lat) || !isFinite(point.lon) || !isFinite(point.temp)) continue;
              var key = point.name
                ? ('n:' + String(point.name).toLowerCase())
                : ('c:' + (Math.round(point.lat * 50) / 50) + '|' + (Math.round(point.lon * 50) / 50));
              if (seen[key]) continue;
              seen[key] = true;
              var marker = L.marker([point.lat, point.lon], {
                icon: makeWeatherTempIcon(point.temp),
                interactive: false,
                keyboard: false
              });
              try { if (typeof marker.setZIndexOffset === 'function') marker.setZIndexOffset(1000); } catch (e) {}
              marker.addTo(layerGroup);
              rendered += 1;
            }
          }

          function load() {
            if (!started || loading || !OWM_API_KEY || Date.now() < nextAllowedAt) return;
            var zoom = (typeof map.getZoom === 'function') ? Number(map.getZoom()) : NaN;
            if (isFinite(zoom) && zoom < def.minZoom) {
              layerGroup.clearLayers();
              lastKey = null;
              return;
            }
            var b = overlayBBox();
            if (!b) return;
            var key = bboxKey(b) + '|' + Math.round(isFinite(zoom) ? zoom : 7);
            if (key === lastKey) return;
            lastKey = key;
            var requestId = ++requestVersion;
            var requestAbort = (typeof AbortController !== 'undefined') ? new AbortController() : null;
            abort = requestAbort;
            var fetchOpts = requestAbort ? { signal: requestAbort.signal } : {};
            loading = true;
            var failedRequests = 0;
            var retryAfterFailure = false;

            var requests = weatherGridPoints(b).map(function(point) {
              var url = 'https://api.openweathermap.org/data/2.5/weather' +
                '?lat=' + point.lat.toFixed(4) + '&lon=' + point.lon.toFixed(4) +
                '&units=metric&appid=' + encodeURIComponent(OWM_API_KEY);
              return fetch(url, fetchOpts).then(function(res) {
                if (!res.ok) throw new Error('OWM weather ' + res.status);
                return res.json();
              }).then(function(data) {
                var lat = data && data.coord && Number(data.coord.lat);
                var lon = data && data.coord && Number(data.coord.lon);
                var temp = data && data.main && Number(data.main.temp);
                if (!isFinite(lat) || !isFinite(lon) || !isFinite(temp)) {
                  failedRequests += 1;
                  return null;
                }
                return { lat: lat, lon: lon, temp: temp, name: typeof data.name === 'string' ? data.name : '' };
              }).catch(function(err) {
                if (err && err.name === 'AbortError') throw err;
                var message = String(err && err.message ? err.message : err).toLowerCase();
                if (
                  message.indexOf('401') !== -1 ||
                  message.indexOf('403') !== -1 ||
                  message.indexOf('429') !== -1
                ) {
                  throw err;
                }
                failedRequests += 1;
                return null;
              });
            });

            Promise.all(requests).then(function(points) {
              if (!started || requestId !== requestVersion) return;
              if (failedRequests >= requests.length) {
                throw new Error('OWM weather request failed');
              }
              renderWeatherPoints(points);
              backoffMs = 0;
              nextAllowedAt = Date.now() + 800;
            }).catch(function(err) {
              if (requestId !== requestVersion || (err && err.name === 'AbortError')) return;
              var message = String(err && err.message ? err.message : err).toLowerCase();
              if (message.indexOf('429') !== -1) {
                backoffMs = backoffMs ? Math.min(backoffMs * 2, 30000) : 2000;
                nextAllowedAt = Date.now() + backoffMs;
              } else if (message.indexOf('401') !== -1 || message.indexOf('403') !== -1) {
                nextAllowedAt = Date.now() + 60000;
              } else {
                nextAllowedAt = Date.now() + 1500;
              }
              lastKey = null;
              retryAfterFailure = true;
            }).then(function() {
              if (requestId !== requestVersion) return;
              loading = false;
              if (abort === requestAbort) abort = null;
              if (started && retryAfterFailure) schedule();
            });
          }

          function schedule() {
            if (!started) return;
            if (timer) clearTimeout(timer);
            cancelActiveRequest();
            var delay = Math.max(600, Math.max(0, nextAllowedAt - Date.now()));
            timer = setTimeout(function() {
              timer = null;
              load();
            }, delay);
          }

          return {
            start: function() {
              if (started) return;
              started = true;
              map.on('moveend', schedule);
              schedule();
            },
            stop: function() {
              if (!started) return;
              started = false;
              map.off('moveend', schedule);
              if (timer) clearTimeout(timer);
              timer = null;
              cancelActiveRequest();
              lastKey = null;
              layerGroup.clearLayers();
            }
          };
        }
`;
