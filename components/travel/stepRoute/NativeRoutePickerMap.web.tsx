// components/travel/stepRoute/NativeRoutePickerMap.web.tsx
//
// #1148: web-заглушка native-пикера маршрута.
//
// `RouteMapCard` рендерит `NativeRoutePickerMap` только в ветке `Platform.OS !== 'web'`,
// но импорт был статическим — и весь native-путь попадал в web-граф. По нему тянулся
// `routePickerNativeHtml.ts` → `components/map-core/leafletWebViewHtml.ts` →
// `utils/leafletInlineAsset.ts`: инлайн-исходники Leaflet 1.9.4 для WebView, 163 КБ
// transformed, которые на web не исполняются никогда. Модуль был достижим из
// нескольких async-чанков (`travel/[id]`, `travel/new`), поэтому Metro поднимал его в
// `__common`, который грузится на каждой странице.
//
// Platform-сплит вместо ленивого импорта выбран намеренно: native сохраняет прежний
// синхронный импорт и прежнее поведение без кадра-заглушки, а web этот файл просто
// не видит. Пропсы объявлены локально — как в `ThemedPaperProvider.web.tsx`, чтобы
// web-ветка не тянула типы из native-файла.
type NativeRoutePickerMapProps = {
  markers: unknown[];
  onAddPoint: (lat: number, lng: number) => void;
  onMovePoint: (index: number, lat: number, lng: number) => void;
  onSelectPoint: (index: number) => void;
};

export function NativeRoutePickerMap(_props: NativeRoutePickerMapProps) {
  return null;
}

export default NativeRoutePickerMap;
