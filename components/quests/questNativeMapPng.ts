// components/quests/questNativeMapPng.ts
// Native PNG-экспорт карты квеста (Android/iOS) — паритет с web/printable.
//
// Web снимает живой Leaflet-DOM через dom-to-image (QuestFullMap.tsx). На native
// карта живёт внутри WebView, а его DOM-origin (`about:blank`) делает tile-canvas
// «tainted» → toDataURL бросает SecurityError. Поэтому здесь НЕ снимаем видимую
// карту, а рисуем собственный off-DOM canvas тем же алгоритмом, что печатный
// web-путь (utils/mapSnapshot/canvasRenderer.ts): тайлы CARTO с CORS
// (crossOrigin=anonymous, сервер отдаёт Access-Control-Allow-Origin) → canvas
// не tainted → toDataURL работает. Маркеры — пронумерованные кружки как на
// видимой native-карте (iconFor) и как web numberIcon.
//
// Модуль импортируется ТОЛЬКО из QuestFullMap.native.tsx (expo-file-system/legacy,
// expo-sharing — blessed native-модули, web-бандла не касаются).
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { translate as i18nT } from '@/i18n'


export const QUEST_MAP_PNG_MESSAGE_TYPE = 'quest-map-png';

export type QuestMapPngMessage = {
    type: typeof QUEST_MAP_PNG_MESSAGE_TYPE;
    ok: boolean;
    dataUrl: string | null;
};

const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';

export function isQuestMapPngMessage(value: unknown): value is QuestMapPngMessage {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as { type?: unknown }).type === QUEST_MAP_PNG_MESSAGE_TYPE
    );
}

/**
 * Пишет PNG data-URL из WebView в кэш-файл и открывает нативный share-лист.
 * Возвращает true только если файл записан и share вызван; иначе false —
 * вызывающий показывает graceful-Alert, GPX/GeoJSON остаются рабочими.
 */
export async function saveAndShareQuestMapPng(params: {
    dataUrl: string | null | undefined;
    title: string;
}): Promise<boolean> {
    try {
        const { dataUrl, title } = params;
        if (typeof dataUrl !== 'string' || !dataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
            return false;
        }
        const base64 = dataUrl.slice(PNG_DATA_URL_PREFIX.length);
        if (!base64) return false;

        const cacheDir = FileSystem.cacheDirectory ?? '';
        if (!cacheDir) return false;

        const safeName = (title || 'quest-map').replace(/\s+/g, '_') || 'quest-map';
        const fileUri = `${cacheDir}${safeName}.png`;

        await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: 'base64' });

        if (!(await Sharing.isAvailableAsync())) return false;

        await Sharing.shareAsync(fileUri, {
            mimeType: 'image/png',
            dialogTitle: i18nT('quests:components.quests.questNativeMapPng.podelitsya_kartoy_kvesta_116938d2'),
        });
        return true;
    } catch {
        return false;
    }
}

// JS, встраиваемый в WebView-HTML: определяет window.__qmExportPng, который
// рисует off-DOM canvas и постит { type:'quest-map-png', ok, dataUrl } наружу.
// Читает in-scope переменные htmlContent: grouped, routePoints, theme, isValidLatLng.
// Плоский var-стиль без async/await — паритет с остальным HTML-скриптом.
export const QUEST_MAP_PNG_RENDERER_SCRIPT = `
        function __qmPostPng(ok, dataUrl) {
          try {
            if (!window.ReactNativeWebView) return;
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: '${QUEST_MAP_PNG_MESSAGE_TYPE}',
              ok: ok,
              dataUrl: dataUrl
            }));
          } catch (e) {}
        }

        function __qmLngToTileX(lng, z) { return ((lng + 180) / 360) * Math.pow(2, z); }
        function __qmLatToTileY(lat, z) {
          var r = (lat * Math.PI) / 180;
          return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z);
        }
        function __qmFitZoom(minLat, maxLat, minLng, maxLng, w, h) {
          for (var z = 16; z >= 2; z--) {
            var x1 = __qmLngToTileX(minLng, z) * 256;
            var x2 = __qmLngToTileX(maxLng, z) * 256;
            var y1 = __qmLatToTileY(maxLat, z) * 256;
            var y2 = __qmLatToTileY(minLat, z) * 256;
            if ((x2 - x1) * 1.3 <= w && (y2 - y1) * 1.3 <= h) return z;
          }
          return 2;
        }
        function __qmLoadTile(url) {
          return new Promise(function (resolve) {
            var img = new Image();
            img.crossOrigin = 'anonymous';
            var timer = setTimeout(function () { resolve(null); }, 8000);
            img.onload = function () { clearTimeout(timer); resolve(img); };
            img.onerror = function () { clearTimeout(timer); resolve(null); };
            img.src = url;
          });
        }

        window.__qmExportPng = function () {
          try {
            var width = 1000;
            var height = 700;
            var t = (typeof theme !== 'undefined' && theme) ? theme : {
              warning: '#f0a020', warningDark: '#b87513', text: '#1a1a1a', routeLine: '#e07840'
            };
            var pins = (typeof grouped !== 'undefined' ? grouped : []).filter(function (p) {
              return p && Number.isFinite(p.lat) && Number.isFinite(p.lng);
            });
            var route = (typeof routePoints !== 'undefined' ? routePoints : []).filter(isValidLatLng);
            var allCoords = pins.map(function (p) { return [p.lat, p.lng]; }).concat(route);
            if (!allCoords.length) { __qmPostPng(false, null); return; }

            var lats = allCoords.map(function (c) { return c[0]; });
            var lngs = allCoords.map(function (c) { return c[1]; });
            var minLat = Math.min.apply(null, lats);
            var maxLat = Math.max.apply(null, lats);
            var minLng = Math.min.apply(null, lngs);
            var maxLng = Math.max.apply(null, lngs);
            var zoom = Math.min(16, __qmFitZoom(minLat, maxLat, minLng, maxLng, width, height));
            var centerLat = (minLat + maxLat) / 2;
            var centerLng = (minLng + maxLng) / 2;
            var cxPx = __qmLngToTileX(centerLng, zoom) * 256;
            var cyPx = __qmLatToTileY(centerLat, zoom) * 256;

            var tileSize = 256;
            var maxTile = Math.pow(2, zoom) - 1;
            var startTX = Math.max(0, Math.floor((cxPx - width / 2) / tileSize));
            var endTX = Math.min(maxTile, Math.floor((cxPx + width / 2) / tileSize));
            var startTY = Math.max(0, Math.floor((cyPx - height / 2) / tileSize));
            var endTY = Math.min(maxTile, Math.floor((cyPx + height / 2) / tileSize));

            var canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            var ctx = canvas.getContext('2d');
            if (!ctx) { __qmPostPng(false, null); return; }
            ctx.fillStyle = '#e8e4df';
            ctx.fillRect(0, 0, width, height);

            var subdomains = 'abcd';
            var jobs = [];
            for (var tx = startTX; tx <= endTX; tx++) {
              for (var ty = startTY; ty <= endTY; ty++) {
                (function (tx, ty) {
                  var s = subdomains[Math.abs(tx + ty) % subdomains.length];
                  var url = 'https://' + s + '.basemaps.cartocdn.com/rastertiles/voyager/' + zoom + '/' + tx + '/' + ty + '@2x.png';
                  var drawX = tx * tileSize - (cxPx - width / 2);
                  var drawY = ty * tileSize - (cyPx - height / 2);
                  jobs.push(__qmLoadTile(url).then(function (img) {
                    if (img) { try { ctx.drawImage(img, drawX, drawY, tileSize, tileSize); } catch (e) {} }
                  }));
                })(tx, ty);
              }
            }

            Promise.all(jobs).then(function () {
              try {
                var toX = function (lng) { return __qmLngToTileX(lng, zoom) * 256 - (cxPx - width / 2); };
                var toY = function (lat) { return __qmLatToTileY(lat, zoom) * 256 - (cyPx - height / 2); };

                if (route.length >= 2) {
                  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
                  ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                  ctx.beginPath();
                  route.forEach(function (c, i) {
                    var x = toX(c[1]), y = toY(c[0]);
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                  });
                  ctx.stroke();
                  ctx.strokeStyle = t.routeLine;
                  ctx.lineWidth = 4;
                  ctx.beginPath();
                  route.forEach(function (c, i) {
                    var x = toX(c[1]), y = toY(c[0]);
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                  });
                  ctx.stroke();
                }

                pins.forEach(function (gp) {
                  var label = (gp.indexes && gp.indexes.join) ? gp.indexes.join(',') : '';
                  var x = toX(gp.lng), y = toY(gp.lat);
                  var radius = 15;
                  ctx.beginPath();
                  ctx.ellipse(x, y + radius + 2, radius * 0.6, 4, 0, 0, Math.PI * 2);
                  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill();
                  ctx.beginPath();
                  ctx.arc(x, y, radius, 0, Math.PI * 2);
                  ctx.fillStyle = t.warning; ctx.fill();
                  ctx.strokeStyle = t.warningDark; ctx.lineWidth = 3; ctx.stroke();
                  ctx.fillStyle = t.text;
                  ctx.font = 'bold 14px -apple-system, sans-serif';
                  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                  ctx.fillText(label, x, y);
                });

                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
                ctx.fillText('(c) OpenStreetMap (c) CARTO', width - 6, height - 4);

                var dataUrl = canvas.toDataURL('image/png');
                __qmPostPng(true, dataUrl);
              } catch (e) {
                __qmPostPng(false, null);
              }
            });
          } catch (e) {
            __qmPostPng(false, null);
          }
        };
`;
