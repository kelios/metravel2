// components/MapPage/Map/nativeTileBridgeScript.ts
//
// #1561 — мост базовой подложки native-карты (iOS + Android через Map.ios).
//
// Раньше этот код жил инлайном в `nativeMapHtml.ts` и был непроверяем: чтобы
// его выполнить, нужен был весь bodyScript целиком (Overpass, маркеры, погода).
// Вынесен отдельно, чтобы регрессионный тест гонял РЕАЛЬНЫЙ Leaflet 1.9.4 через
// zoom-цикл и считал requested/loaded/error тайлы на границе lifecycle.
//
// #2452 — в онлайне тайлы грузит сам WebView (прямой `<img src>`), мост к
// дисковому кэшу RN остался запасным путём: сетевая ошибка тайла и офлайн.
// Prefetch/bulk регионов здесь нет: стандартный OSM tile server запрещает
// offline download.
import { serializeForInlineScript } from '@/utils/webViewBridge';

/** Сторона одного тайла Leaflet в CSS-пикселях. */
export const NATIVE_TILE_SIZE = 256;

/**
 * Потолок вычисленного нижнего зума. Мир на z6 — 16384 px, шире любого
 * мыслимого экрана: выше подниматься незачем, а жёсткий потолок защищает от
 * абсурдного `minZoom` при мусорном `innerWidth/innerHeight`.
 */
export const NATIVE_BASE_MIN_ZOOM_CEILING = 6;

/** Запасной нижний зум, если WebView не отдал размеры окна. */
export const NATIVE_BASE_MIN_ZOOM_FALLBACK = 2;

/**
 * Нижняя граница зума базовой подложки для конкретного экрана.
 *
 * Ниже неё один мир Leaflet физически уже/ниже вьюпорта: тайлов на остальную
 * площадь просто НЕ существует, и «карта» превращается в серое поле с
 * крошечным квадратом мира посередине — ровно то, что владелец увидел на
 * iPhone после нескольких отдалений. Берём `max(width, height)`, чтобы граница
 * не прыгала при повороте устройства.
 */
export const resolveBaseMinZoom = (
  viewportWidth: number,
  viewportHeight: number,
): number => {
  const side = Math.max(Number(viewportWidth) || 0, Number(viewportHeight) || 0);
  if (!Number.isFinite(side) || side <= 0) return NATIVE_BASE_MIN_ZOOM_FALLBACK;
  const needed = Math.ceil(Math.log2(side / NATIVE_TILE_SIZE));
  return Math.max(0, Math.min(NATIVE_BASE_MIN_ZOOM_CEILING, needed));
};

/** Имя глобалки с вычисленным нижним зумом (читает `L.map({ minZoom })`). */
export const NATIVE_BASE_MIN_ZOOM_GLOBAL = '__metravelBaseMinZoom';

/**
 * Имя глобалки-резолвера. Один расчёт на весь движок: и стартовый `minZoom`, и
 * пересчёт после изменения размера вьюпорта берут границу отсюда.
 */
export const NATIVE_BASE_MIN_ZOOM_RESOLVER_GLOBAL = '__metravelResolveBaseMinZoom';

/**
 * Скрипт-преамбула: считает нижний зум ДО инициализации карты. Ставится в
 * bodyScript непосредственно перед `L.map(...)`.
 *
 * Стартовый замер берётся из `window.innerWidth/innerHeight` и по определению
 * одноразовый — вьюпорт WebView меняется позже (RN-layout, поворот). За
 * актуальностью границы следит `resize`-хук из `buildNativeTileBridgeScript`.
 */
export const NATIVE_BASE_MIN_ZOOM_SCRIPT = `        // #1561 — см. resolveBaseMinZoom: ниже этой границы мир уже экрана и
        // подложка вырождается в серое поле, потому что тайлов на остальную
        // площадь не существует.
        window.${NATIVE_BASE_MIN_ZOOM_RESOLVER_GLOBAL} = function(viewportWidth, viewportHeight) {
          try {
            var side = Math.max(Number(viewportWidth) || 0, Number(viewportHeight) || 0);
            if (!isFinite(side) || side <= 0) return ${NATIVE_BASE_MIN_ZOOM_FALLBACK};
            var needed = Math.ceil(Math.log(side / ${NATIVE_TILE_SIZE}) / Math.LN2);
            return Math.max(0, Math.min(${NATIVE_BASE_MIN_ZOOM_CEILING}, needed));
          } catch (e) {
            return ${NATIVE_BASE_MIN_ZOOM_FALLBACK};
          }
        };
        window.${NATIVE_BASE_MIN_ZOOM_GLOBAL} = window.${NATIVE_BASE_MIN_ZOOM_RESOLVER_GLOBAL}(window.innerWidth, window.innerHeight);`;

export interface NativeTileBridgeScriptOptions {
  /** Обязательная OSM-атрибуция базового слоя. */
  attribution: string;
  /** Верхний зум базовой подложки. */
  maxZoom: number;
  /**
   * #2452 — шаблон `…/{z}/{x}/{y}.png`, по которому WebView в онлайне грузит
   * тайлы САМ (тот же `getThemedNativeBaseTileUrl()`, что раньше качал RN).
   * Без шаблона слой работает только через мост (как до #2452) — так его
   * гоняет lifecycle-тест #1561.
   */
  tileUrlTemplate?: string;
}

/** Тайлов в одном сообщении TILE_CAPTURE (≈20–60 КБ base64 на тайл). */
export const NATIVE_TILE_CAPTURE_BATCH = 8;

/** 1×1 прозрачный GIF: подмена `src` отменяет сетевой запрос снятого тайла. */
const EMPTY_TILE_GIF = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

/**
 * Базовая подложка native-карты. Ожидает в области видимости `L` и `map`.
 *
 * #2452 — владелец загрузки в онлайне — сам WebView: `createTile` ставит
 * `<img src=шаблон>`, браузер грузит тайлы параллельно, с HTTP-кэшем, и
 * отменяет снятые с карты (`_removeTile` подменяет `src`). Мост — только
 * запасной путь.
 *
 * Контракт с RN (`Map.ios.tsx` + `nativeTileBridgeController.ts`):
 *   WebView → RN: `{ type: 'TILE_REQ', z, x, y, key, fallback? }` — в онлайне
 *     только после сетевой ошибки тайла (`fallback: true`, один раз на тайл),
 *     в офлайне — на каждый новый тайл;
 *   WebView → RN: `{ type: 'TILE_CANCEL', keys }` — тайлы, снятые до ответа
 *     моста (не чаще раза в кадр);
 *   WebView → RN: `{ type: 'MAP_TILES_STATE', … }` — счётчики после того, как
 *     слой догрузил вьюпорт (событие `load`), для замера;
 *   RN → WebView: `window.__metravelSetTiles([[key, dataUrl], …])` батчем
 *     (`__metravelSetTile(key, dataUrl)` — одиночная форма), пустой `dataUrl`
 *     означает «тайл не получен»;
 *   RN → WebView: `window.__metravelCaptureTiles(['z/x/y', …], gen)` — снять
 *     уже загруженные тайлы в canvas; ответ `{ type: 'TILE_CAPTURE', gen,
 *     tiles: [[z/x/y, dataUrl], …] }` пакетами, `TILE_CAPTURE_DISABLED` — canvas
 *     «грязный», захват выключен;
 *   RN → WebView: `window.__metravelSetTileNetwork(online, forceRedraw?)` —
 *     смена режима; переход офлайн → онлайн делает ровно один `redraw()` (#1665).
 */
export const buildNativeTileBridgeScript = ({
  attribution,
  maxZoom,
  tileUrlTemplate,
}: NativeTileBridgeScriptOptions): string => `        // Базовая подложка всегда светлая (OSM-прокси, без {s}), независимо от
        // темы приложения — обычный цвет карты. Тёмными остаются только панели/
        // контролы/маркеры.
        window.__metravelTilePending = {};
        window.__metravelTileStats = {
          requested: 0, loaded: 0, failed: 0, dropped: 0,
          netRequested: 0, netLoaded: 0, netErrors: 0, fallbacks: 0, redraws: 0
        };
        // Счётчики читаются с устройства при разборе серой подложки (IOS-07).
        window.__metravelGetTileStats = function() {
          var stats = window.__metravelTileStats;
          var pending = 0;
          try {
            for (var k in window.__metravelTilePending) {
              if (Object.prototype.hasOwnProperty.call(window.__metravelTilePending, k)) pending += 1;
            }
          } catch (e) {}
          return {
            requested: stats.requested, loaded: stats.loaded,
            failed: stats.failed, dropped: stats.dropped, pending: pending,
            netRequested: stats.netRequested, netLoaded: stats.netLoaded,
            netErrors: stats.netErrors, fallbacks: stats.fallbacks, redraws: stats.redraws
          };
        };
        var __metravelTileTemplate = ${serializeForInlineScript(tileUrlTemplate || '')};
        // Онлайн-режим по умолчанию (если есть шаблон): RN досылает реальный
        // статус NetInfo после готовности. Даже если устройство стартовало в
        // офлайне, сетевая ошибка тайла сразу уводит его в мостовой fallback.
        var __metravelTileOnline = !!__metravelTileTemplate;
        var __metravelTileSeq = 0;
        var __metravelTileCancelKeys = [];
        var __metravelTileCancelScheduled = false;
        function __metravelPostTileMessage(message) {
          try {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify(message));
            }
          } catch (e) {}
        }
        function __metravelFlushTileCancel() {
          __metravelTileCancelScheduled = false;
          if (!__metravelTileCancelKeys.length) return;
          var keys = __metravelTileCancelKeys;
          __metravelTileCancelKeys = [];
          __metravelPostTileMessage({ type: 'TILE_CANCEL', keys: keys });
        }
        function __metravelQueueTileCancel(key) {
          __metravelTileCancelKeys.push(key);
          if (__metravelTileCancelScheduled) return;
          __metravelTileCancelScheduled = true;
          if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(__metravelFlushTileCancel);
          } else {
            setTimeout(__metravelFlushTileCancel, 16);
          }
        }
        // #1561: Leaflet отдаёт в createTile ОБЁРНУТЫЕ координаты
        // (\`_wrapCoords\`), поэтому на низком зуме, где вьюпорт шире одного
        // мира, несколько РАЗНЫХ DOM-тайлов приходят с одинаковыми z/x/y.
        // Ключ по координатам их склеивал: вторая запись затирала первую,
        // первый <img> навсегда оставался без src и без done(), то есть под
        // \`.leaflet-tile { visibility: hidden }\` — серая клетка навсегда.
        // Ключ обязан быть уникальным на DOM-тайл; z/x/y едут отдельными
        // полями сообщения, и RN всё так же качает тайл по ним.
        function __metravelNextTileKey(coords) {
          __metravelTileSeq += 1;
          return coords.z + '/' + coords.x + '/' + coords.y + '#' + __metravelTileSeq;
        }
        function __metravelRequestBridgeTile(img, coords, done, fallback) {
          var key = __metravelNextTileKey(coords);
          img.__metravelTileKey = key;
          window.__metravelTilePending[key] = { img: img, done: done };
          window.__metravelTileStats.requested += 1;
          var message = { type: 'TILE_REQ', z: coords.z, x: coords.x, y: coords.y, key: key };
          if (fallback) {
            message.fallback = true;
            window.__metravelTileStats.fallbacks += 1;
          }
          __metravelPostTileMessage(message);
        }
        var TileBridge = L.GridLayer.extend({
          createTile: function(coords, done) {
            var img = document.createElement('img');
            img.alt = '';
            if (!__metravelTileOnline) {
              __metravelRequestBridgeTile(img, coords, done, false);
              return img;
            }
            // #2452 — онлайн: тайл грузит браузер WebView напрямую.
            img.__metravelNetTile = true;
            img.__metravelCoordKey = coords.z + '/' + coords.x + '/' + coords.y;
            // #2452 — CORS-режим (прокси отдаёт ACAO *): уже загруженную
            // картинку можно снять в canvas и отдать в дисковый кэш RN без
            // повторной сетевой загрузки. Ставится ДО src.
            img.crossOrigin = 'anonymous';
            window.__metravelTileStats.netRequested += 1;
            img.onload = function() {
              img.onload = null;
              img.onerror = null;
              window.__metravelTileStats.netLoaded += 1;
              try { done(null, img); } catch (e) {}
            };
            img.onerror = function() {
              img.onload = null;
              img.onerror = null;
              window.__metravelTileStats.netErrors += 1;
              // Один запрос к дисковому кэшу RN (там же ретраи #1561 при живой
              // сети). Пустой ответ → done(error) → наблюдаемый tileerror.
              __metravelRequestBridgeTile(img, coords, done, true);
            };
            img.src = __metravelTileTemplate
              .replace('{z}', String(coords.z))
              .replace('{x}', String(coords.x))
              .replace('{y}', String(coords.y));
            return img;
          },
          // Тайл могли снять с карты (зум/пан) раньше, чем пришёл ответ. Без
          // уборки его запись жила бы в pending до конца сессии; сетевой
          // запрос отменяем подменой src, ответ моста — сообщением TILE_CANCEL.
          _removeTile: function(key) {
            try {
              var tile = this._tiles && this._tiles[key];
              var el = tile && tile.el;
              var pendingKey = el && el.__metravelTileKey;
              if (pendingKey && window.__metravelTilePending[pendingKey]) {
                delete window.__metravelTilePending[pendingKey];
                __metravelQueueTileCancel(pendingKey);
              }
              if (el && el.__metravelNetTile && !tile.loaded) {
                el.onload = null;
                el.onerror = null;
                el.src = ${serializeForInlineScript(EMPTY_TILE_GIF)};
              }
            } catch (e) {}
            return L.GridLayer.prototype._removeTile.call(this, key);
          }
        });
        function __metravelApplyTile(key, dataUrl) {
          var pending = window.__metravelTilePending[key];
          if (!pending) {
            // Ответ на уже снятый с карты тайл — нормальная гонка зума.
            window.__metravelTileStats.dropped += 1;
            return;
          }
          delete window.__metravelTilePending[key];
          var img = pending.img, done = pending.done;
          if (dataUrl) {
            // Счётчики отражают ФАКТ отрисовки, а не факт отправки данных:
            // битый кэш-файл декодируется с ошибкой и обязан попасть в failed.
            img.onload = function() {
              window.__metravelTileStats.loaded += 1;
              try { done(null, img); } catch (e) {}
            };
            img.onerror = function() {
              window.__metravelTileStats.failed += 1;
              try { done(new Error('tile-decode'), img); } catch (e) {}
            };
            img.src = dataUrl;
          } else {
            // #1561: раньше здесь звалось done(null, img) — Leaflet вешал
            // \`leaflet-tile-loaded\` на пустую картинку, и провал сети выглядел
            // как успешно загруженная серая клетка. Ретраи к этому моменту уже
            // исчерпаны в RN, поэтому отдаём ошибку: летит \`tileerror\`, растёт
            // счётчик failed, состояние наблюдаемо.
            window.__metravelTileStats.failed += 1;
            try { done(new Error('tile-unavailable'), img); } catch (e) {}
          }
        }
        // RN отдаёт результат сюда: data-URL → рисуем тайл; пусто → тайл не
        // получен.
        window.__metravelSetTile = function(key, dataUrl) {
          try { __metravelApplyTile(key, dataUrl); } catch (e) {}
        };
        // #2452 — батч ответов моста: один инжект на кадр вместо инжекта на тайл.
        window.__metravelSetTiles = function(items) {
          if (!items || !items.length) return;
          for (var i = 0; i < items.length; i += 1) {
            try {
              var item = items[i];
              if (item && item.length >= 2) __metravelApplyTile(String(item[0]), item[1] ? String(item[1]) : '');
            } catch (e) {}
          }
        };
        // Слой держим в глобалке: события \`tileerror\`/\`load\` живут на слое, а не
        // на карте, и без ссылки на него провал тайлов ничем не наблюдаем.
        window.__metravelBaseTileLayer = new TileBridge({
          attribution: ${serializeForInlineScript(attribution)},
          maxZoom: ${maxZoom},
          tileSize: ${NATIVE_TILE_SIZE},
          updateWhenIdle: false,
          updateWhenZooming: false,
          keepBuffer: 1
        });
        // #2452 — смена сетевого режима. Онлайн → офлайн: только флаг — уже
        // загруженные из HTTP-кэша тайлы остаются на месте (redraw заменил бы их
        // мостом, а на диске их может не быть). Офлайн → онлайн: ровно один
        // redraw — серые после офлайн-промаха клетки перезапрашиваются без
        // жеста (#1665 / MAP-IOS-TILE-GRAY-001). \`forceRedraw\` — RN видел
        // переход офлайн → онлайн, пока страница ещё не была готова: флаг слоя
        // мог так и остаться онлайн, а клетки — серыми после сетевых ошибок.
        window.__metravelSetTileNetwork = function(online, forceRedraw) {
          try {
            var next = !!online && !!__metravelTileTemplate;
            if (next === __metravelTileOnline && !(next && forceRedraw)) return false;
            __metravelTileOnline = next;
            if (!next) return false;
            window.__metravelTileStats.redraws += 1;
            window.__metravelBaseTileLayer.redraw();
            return true;
          } catch (e) {
            return false;
          }
        };
        // Замер (#2452): после того как слой догрузил текущий вьюпорт, RN
        // получает одно сообщение со счётчиками и временем догрузки.
        var __metravelTileCycleStart = 0;
        window.__metravelBaseTileLayer.on('loading', function() {
          __metravelTileCycleStart = Date.now();
        });
        window.__metravelBaseTileLayer.on('load', function() {
          try {
            var snapshot = window.__metravelGetTileStats();
            snapshot.type = 'MAP_TILES_STATE';
            snapshot.online = __metravelTileOnline;
            snapshot.ms = __metravelTileCycleStart ? Date.now() - __metravelTileCycleStart : null;
            // Вьюпорт, который слой только что догрузил: по нему RN считает,
            // каких тайлов нет в дисковом кэше, и просит их захватить.
            var bounds = map.getBounds();
            snapshot.zoom = map.getZoom();
            snapshot.bbox = {
              south: bounds.getSouth(), west: bounds.getWest(),
              north: bounds.getNorth(), east: bounds.getEast()
            };
            __metravelPostTileMessage(snapshot);
          } catch (e) {}
        });

        // #2452 — наполнение дискового кэша БЕЗ второй сетевой загрузки: RN
        // присылает координаты недостающих тайлов (\`z/x/y\`), WebView в idle
        // снимает уже загруженные и ещё стоящие в DOM <img> в canvas и отвечает
        // TILE_CAPTURE пакетами ≤${NATIVE_TILE_CAPTURE_BATCH}. Движение карты отменяет незавершённый
        // захват. «Грязный» canvas (SecurityError: нет CORS) отключает захват
        // до перезапуска страницы — без отката в двойную загрузку.
        var __metravelCaptureGen = 0;
        var __metravelCaptureDisabled = false;
        var __metravelCaptureCanvas = null;
        function __metravelIdle(fn) {
          if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(fn, { timeout: 500 });
            return;
          }
          setTimeout(fn, 0);
        }
        function __metravelLoadedTileIndex() {
          var index = {};
          var tiles = window.__metravelBaseTileLayer._tiles || {};
          for (var tileKey in tiles) {
            var tile = tiles[tileKey];
            var el = tile && tile.el;
            if (el && el.__metravelNetTile && tile.loaded && el.parentNode && el.__metravelCoordKey) {
              index[el.__metravelCoordKey] = el;
            }
          }
          return index;
        }
        function __metravelCaptureImage(img) {
          if (!__metravelCaptureCanvas) {
            __metravelCaptureCanvas = typeof window.__metravelCreateCaptureCanvas === 'function'
              ? window.__metravelCreateCaptureCanvas()
              : document.createElement('canvas');
          }
          var canvas = __metravelCaptureCanvas;
          canvas.width = ${NATIVE_TILE_SIZE};
          canvas.height = ${NATIVE_TILE_SIZE};
          var context = canvas.getContext('2d');
          if (!context) return '';
          context.clearRect(0, 0, ${NATIVE_TILE_SIZE}, ${NATIVE_TILE_SIZE});
          context.drawImage(img, 0, 0, ${NATIVE_TILE_SIZE}, ${NATIVE_TILE_SIZE});
          return canvas.toDataURL('image/png');
        }
        window.__metravelCancelTileCapture = function() {
          __metravelCaptureGen += 1;
        };
        window.__metravelCaptureTiles = function(keys, requestGen) {
          __metravelCaptureGen += 1;
          var captureGen = __metravelCaptureGen;
          if (__metravelCaptureDisabled || !keys || !keys.length) return;
          var queue = keys.slice(0, 64);
          function step() {
            if (captureGen !== __metravelCaptureGen || __metravelCaptureDisabled) return;
            var index = __metravelLoadedTileIndex();
            var batch = [];
            while (queue.length && batch.length < ${NATIVE_TILE_CAPTURE_BATCH}) {
              var coordKey = String(queue.shift());
              var img = index[coordKey];
              if (!img) continue;
              try {
                var dataUrl = __metravelCaptureImage(img);
                if (dataUrl && dataUrl.indexOf('data:image/png;base64,') === 0) batch.push([coordKey, dataUrl]);
              } catch (e) {
                if (e && (e.name === 'SecurityError' || e.code === 18)) {
                  __metravelCaptureDisabled = true;
                  try { console.warn('[map-tiles] tile capture disabled: tainted canvas'); } catch (logError) {}
                  __metravelPostTileMessage({ type: 'TILE_CAPTURE_DISABLED', reason: String(e.name || 'SecurityError') });
                  return;
                }
                // Битая/недогруженная картинка — просто пропускаем тайл.
              }
            }
            if (batch.length) __metravelPostTileMessage({ type: 'TILE_CAPTURE', gen: requestGen, tiles: batch });
            if (queue.length) __metravelIdle(step);
          }
          __metravelIdle(step);
        };
        map.on('movestart', window.__metravelCancelTileCapture);
        map.on('zoomstart', window.__metravelCancelTileCapture);
        window.__metravelBaseTileLayer.addTo(map);
        // #1561 — стартовый minZoom меряется ДО layout: WebView отдаёт финальный
        // размер позже (RN-layout вкладки, поворот, F-17-каскад
        // __metravelScheduleInvalidate → invalidateSize). Если контейнер вырос,
        // одноразовая граница остаётся заниженной, мир на ней снова уже экрана —
        // и серое поле возвращается. Едем за реальным размером карты: Leaflet
        // стреляет \`resize\` ровно из того же invalidateSize.
        map.on('resize', function() {
          try {
            if (typeof window.${NATIVE_BASE_MIN_ZOOM_RESOLVER_GLOBAL} !== 'function') return;
            var size = map.getSize();
            // Контейнер может схлопнуться в 0 (скрытая вкладка, промежуточный
            // layout). Нулевой размер — это «размер неизвестен», а не «нужен
            // низкий зум»: резолвер вернул бы fallback ${NATIVE_BASE_MIN_ZOOM_FALLBACK}, и на экране, где
            // настоящая граница выше, она молча опустилась бы обратно в серое
            // поле. Уже посчитанную границу держим до реального замера.
            if (!size || !(size.x > 0) || !(size.y > 0)) return;
            var next = window.${NATIVE_BASE_MIN_ZOOM_RESOLVER_GLOBAL}(size.x, size.y);
            window.${NATIVE_BASE_MIN_ZOOM_GLOBAL} = next;
            // setMinZoom сам подтянет текущий зум вверх, если тот стал ниже
            // границы, — это и есть выход из серого поля.
            if (next !== map.getMinZoom()) map.setMinZoom(next);
          } catch (e) {}
        });`;
