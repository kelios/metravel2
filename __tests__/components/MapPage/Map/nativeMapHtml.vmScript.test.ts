/**
 * #2071 code review (2026-09-24) — синтаксическая проверка ВСЕГО сгенерированного
 * `<script>` (ядро Leaflet + инлайненный `leaflet.markercluster` + весь движок
 * карты), а не только вырезанных фрагментов, как в соседних `nativeMapHtml.*`
 * тестах. `new vm.Script` компилирует текст как JS и бросает `SyntaxError` на
 * месте, если инлайн-шаблон сломан — ровно такой класс дефекта (случайный
 * backtick внутри `bodyScript`/`headStyles`, обрывающий template literal)
 * `tsc`/`eslint` не ловят: они видят валидную TS-строку, а не её JS-содержимое.
 */
import vm from 'vm';

import { buildNativeMapHtml } from '@/components/MapPage/Map/nativeMapHtml';

const themeColorsStub = {
  surface: '#ffffff',
  text: '#111111',
  textOnDark: '#ffffff',
  primary: '#0a84ff',
  primaryDark: '#0060df',
  success: '#34c759',
  warning: '#f0a020',
  warningDark: '#b87513',
  textOnPrimary: '#ffffff',
  accent: '#ff6a00',
} as any;

// Документ несёт ДВА `<script>`: в `<head>` — только ядро Leaflet
// (`LEAFLET_JS`, отдельный проверенный вендорный ассет), в `<body>` — всё,
// что затронула эта задача (инлайн markercluster + движок карты). Берём
// именно последний тег, иначе диапазон захватывает HTML между ними
// (`</script><style>...</style></head><body>...<script>`) и `vm.Script`
// падает на реальной разметке, а не на JS-ошибке.
const extractScriptBody = (html: string): string => {
  const start = html.lastIndexOf('<script>');
  const end = html.lastIndexOf('</script>');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return html.slice(start + '<script>'.length, end);
};

describe('#2071 buildNativeMapHtml — сгенерированный <script> валиден целиком', () => {
  it('компилируется без SyntaxError (vm.Script) и содержит инлайн leaflet.markercluster + кластер-проводку', () => {
    const html = buildNativeMapHtml({ themeColors: themeColorsStub, markerShadowColor: 'rgba(0,0,0,0.2)' });
    const scriptBody = extractScriptBody(html);

    expect(() => new vm.Script(scriptBody, { filename: 'nativeMapHtml.generated.js' })).not.toThrow();

    // #2071 — leaflet.markercluster инлайнится в тот же <script>, что ядро Leaflet.
    expect(scriptBody).toContain('L.MarkerClusterGroup');
    // Проводка кластера и held-точки (P2-2) живёт в nativeRouteClusterScript.ts,
    // но вставляется сюда же — регрессия «пропала функция» ловится тут же.
    expect(scriptBody).toContain('function buildRoutePointClusterGroup');
    expect(scriptBody).toContain('function disposeRoutePointClusterGroup');
    expect(scriptBody).toContain('function ensureRoutePointClusterGroup');
    expect(scriptBody).toContain('function isRoutePointHeld');
    expect(scriptBody).toContain('function addRoutePointMarkerToLayer');
  });

  it('не зависит от переданных themeColors — тот же результат под другой темой (dark)', () => {
    const html = buildNativeMapHtml({
      themeColors: { ...themeColorsStub, surface: '#0b0b0b', text: '#f5f5f5' },
      markerShadowColor: 'rgba(0,0,0,0.5)',
    });
    expect(() => new vm.Script(extractScriptBody(html), { filename: 'nativeMapHtml.dark.generated.js' })).not.toThrow();
  });
});
