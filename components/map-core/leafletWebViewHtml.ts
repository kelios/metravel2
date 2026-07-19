// components/map-core/leafletWebViewHtml.ts
//
// #990 — Единый билдер inline-Leaflet HTML для всех native WebView-карт.
//
// Раньше три движка (nativeMapHtml / questNativeMapHtml / TravelMap.native)
// каждый эмитил свой полный `<!DOCTYPE>` + head (LEAFLET_CSS/JS + reset-CSS) +
// `<body><div id="map">` + `<script>` целиком, с копипастой скелета и (у native
// /quest) байт-в-байт одинакового invalidate-планировщика.
//
// Здесь вынесены ТОЛЬКО те части, которые действительно общие и position-safe:
//   1. `buildLeafletWebViewHtml` — документ-скелет (doctype/head/leaflet/reset/body).
//   2. `buildInvalidateSchedulerScript` — общий invalidate-планировщик
//      (`invalidateSize`+[80,240,600] ретраи + resize/orientation/visibility),
//      параметризованный именем глобалки/хелпера каждого движка.
//   3. `ESCAPE_HTML_FN_SCRIPT` — общий escapeHtml (используется nativeMapHtml).
//
// Каждый движок вставляет `bodyScript` (свои маркеры/оверлеи/мост/fit) БЕЗ
// изменения порядка своих инструкций — планировщик подставляется ровно туда,
// где движок раньше его определял. Это сохраняет поведение на самой хрупкой
// Android-поверхности (серый экран/tile-retry/ghost-click воспроизводятся только
// на устройстве). Имена всех глобалок, которые RN дёргает через injectJavaScript
// (`__metravel*`, `__qm*`, `setActiveStep`), НЕ меняются — они целиком живут в
// bodyScript конкретного движка.

import { LEAFLET_CSS, LEAFLET_JS } from '@/utils/leafletInlineAsset';

// Общий reset — идентичен во всех трёх движках. Всё остальное (popup/marker/
// cluster/qmark/z-index) движок передаёт через `headStyles`.
export const LEAFLET_WEBVIEW_RESET_CSS = `* { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; }
        #map { width: 100%; height: 100%; }`;

export interface LeafletWebViewHtmlOptions {
  /** Доп. CSS движка (popup/marker/cluster/qmark/z-index), кладётся после reset. */
  headStyles?: string;
  /** Весь движок-специфичный JS: map-init, маркеры, оверлеи, мост, fit. */
  bodyScript: string;
}

/**
 * Собирает полный HTML-документ native-карты: doctype + head (inline Leaflet
 * CSS/JS + общий reset + `headStyles`) + `<body><div id="map"></div>` + `<script>`
 * с `bodyScript`. Единственный источник скелета для всех native WebView-карт.
 */
export const buildLeafletWebViewHtml = ({
  headStyles = '',
  bodyScript,
}: LeafletWebViewHtmlOptions): string => {
  const extraStyles = headStyles ? `\n${headStyles}` : '';
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${LEAFLET_CSS}</style>
      <script>${LEAFLET_JS}</script>
      <style>
        ${LEAFLET_WEBVIEW_RESET_CSS}${extraStyles}
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
${bodyScript}
      </script>
    </body>
    </html>
  `;
};

export interface InvalidateSchedulerOptions {
  /**
   * Имя планировщика. native: `__metravelScheduleInvalidate`
   * (объявляется как `window.<name> = function...`); quest: `scheduleMapRefresh`
   * (объявляется как `function <name>...`). См. `mode`.
   */
  schedulerName: string;
  /** Имя внутреннего invalidate-хелпера. native: `__metravelInvalidateMapSize`; quest: `refreshMapLayout`. */
  helperName: string;
  /**
   * Форма объявления планировщика:
   *  - 'window-prop'  → `window.<name> = function(stage) {...};` (native, RN зовёт `window.__metravelScheduleInvalidate`).
   *  - 'function-decl'→ `function <name>(stage) {...}` (quest, локальная функция).
   */
  mode: 'window-prop' | 'function-decl';
  /**
   * Эмитить ли init-вызов + resize/orientationchange/visibilitychange листенеры
   * (общий блок регистрации). По умолчанию true.
   */
  emitRegistration?: boolean;
}

/**
 * Байт-в-байт общий invalidate-планировщик native-карт (см. #503/#807 grey-map,
 * ADB device-verify). Логика идентична у nativeMapHtml и questNativeMapHtml;
 * различаются только имена глобалки/хелпера и форма объявления.
 *
 * Возвращает JS-строку (без внешних `<script>`), которую движок вставляет в свой
 * bodyScript ровно там, где раньше определял планировщик, — порядок инструкций
 * движка не меняется.
 */
export const buildInvalidateSchedulerScript = ({
  schedulerName,
  helperName,
  mode,
  emitRegistration = true,
}: InvalidateSchedulerOptions): string => {
  // Ссылка, по которой планировщик ВЫЗЫВАЕТСЯ (window-qualified для native).
  const callRef = mode === 'window-prop' ? `window.${schedulerName}` : schedulerName;
  const declaration =
    mode === 'window-prop'
      ? `window.${schedulerName} = function(stage) {`
      : `function ${schedulerName}(stage) {`;
  const declarationClose = mode === 'window-prop' ? '        };' : '        }';

  const helperAndScheduler = `        function ${helperName}(stage) {
          try {
            map.invalidateSize({ animate: false, pan: false });
          } catch (e) {
            try { map.invalidateSize(); } catch (err) {}
          }
        }

        ${declaration}
          try {
            ${helperName}(stage);
            [80, 240, 600].forEach(function(delay) {
              setTimeout(function() { ${helperName}(stage); }, delay);
            });
          } catch (e) {}
${declarationClose}`;

  if (!emitRegistration) return helperAndScheduler;

  const registration = `

        ${callRef}('init');
        window.addEventListener('resize', function() { ${callRef}('resize'); });
        window.addEventListener('orientationchange', function() { ${callRef}('orientationchange'); });
        document.addEventListener('visibilitychange', function() {
          if (!document.hidden) ${callRef}('visibilitychange');
        });`;

  return `${helperAndScheduler}${registration}`;
};

/**
 * Общий escapeHtml для inline-попапов (защита от XSS в WebView, #113).
 * Используется nativeMapHtml. Quest-движок намеренно НЕ эскейпит попап
 * (существующее поведение, не трогается в #990).
 */
export const ESCAPE_HTML_FN_SCRIPT = `        function escapeHtml(value) {
          return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        }`;
