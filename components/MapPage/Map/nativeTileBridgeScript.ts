// components/MapPage/Map/nativeTileBridgeScript.ts
//
// #1561 — мост базовой подложки native-карты (iOS + Android через Map.ios).
//
// Раньше этот код жил инлайном в `nativeMapHtml.ts` и был непроверяем: чтобы
// его выполнить, нужен был весь bodyScript целиком (Overpass, маркеры, погода).
// Вынесен отдельно, чтобы регрессионный тест гонял РЕАЛЬНЫЙ Leaflet 1.9.4 через
// zoom-цикл и считал requested/loaded/error тайлы на границе lifecycle.
//
// Мост нужен вместо прямого `L.tileLayer`, потому что каждый реально
// запрошенный тайл проходит через прозрачный дисковый кэш в RN. Prefetch/bulk
// регионов здесь нет: стандартный OSM tile server запрещает offline download.
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
}

/**
 * Мост TileBridge → RN. Ожидает в области видимости `L` и `map`.
 *
 * Контракт с RN (`Map.ios.tsx`):
 *   WebView → RN: `{ type: 'TILE_REQ', z, x, y, key }`
 *   RN → WebView: `window.__metravelSetTile(key, dataUrl)`, где пустой `dataUrl`
 *   означает «тайл не получен» (офлайн-промах или исчерпанные ретраи).
 */
export const buildNativeTileBridgeScript = ({
  attribution,
  maxZoom,
}: NativeTileBridgeScriptOptions): string => `        // Базовая подложка всегда светлая (OSM-прокси, без {s}), независимо от
        // темы приложения — обычный цвет карты. Тёмными остаются только панели/
        // контролы/маркеры.
        window.__metravelTilePending = {};
        window.__metravelTileStats = { requested: 0, loaded: 0, failed: 0, dropped: 0 };
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
            failed: stats.failed, dropped: stats.dropped, pending: pending
          };
        };
        var __metravelTileSeq = 0;
        var TileBridge = L.GridLayer.extend({
          createTile: function(coords, done) {
            var img = document.createElement('img');
            img.alt = '';
            // #1561: Leaflet отдаёт в createTile ОБЁРНУТЫЕ координаты
            // (\`_wrapCoords\`), поэтому на низком зуме, где вьюпорт шире одного
            // мира, несколько РАЗНЫХ DOM-тайлов приходят с одинаковыми z/x/y.
            // Ключ по координатам их склеивал: вторая запись затирала первую,
            // первый <img> навсегда оставался без src и без done(), то есть под
            // \`.leaflet-tile { visibility: hidden }\` — серая клетка навсегда.
            // Ключ обязан быть уникальным на DOM-тайл; z/x/y едут отдельными
            // полями сообщения, и RN всё так же качает тайл по ним.
            __metravelTileSeq += 1;
            var key = coords.z + '/' + coords.x + '/' + coords.y + '#' + __metravelTileSeq;
            img.__metravelTileKey = key;
            window.__metravelTilePending[key] = { img: img, done: done };
            window.__metravelTileStats.requested += 1;
            try {
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'TILE_REQ', z: coords.z, x: coords.x, y: coords.y, key: key
                }));
              }
            } catch (e) {}
            return img;
          },
          // Тайл могли снять с карты (зум/пан) раньше, чем RN ответил. Без
          // уборки его запись жила бы в pending до конца сессии.
          _removeTile: function(key) {
            try {
              var tile = this._tiles && this._tiles[key];
              var pendingKey = tile && tile.el && tile.el.__metravelTileKey;
              if (pendingKey) delete window.__metravelTilePending[pendingKey];
            } catch (e) {}
            return L.GridLayer.prototype._removeTile.call(this, key);
          }
        });
        // RN отдаёт результат сюда: data-URL → рисуем тайл; пусто → тайл не
        // получен.
        window.__metravelSetTile = function(key, dataUrl) {
          try {
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
          } catch (e) {}
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
