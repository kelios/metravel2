import { Platform } from 'react-native';

type ParsedCoord = {
  lat: number;
  lon: number;
};

// На native (Android в первую очередь) HTTPS-«веб»-ссылки картографических
// сервисов либо открывают браузер вместо приложения, либо открывают приложение
// без передачи координаты (точка/маршрут не строятся, #map-deeplink). Надёжный
// путь на Android — стандартный `geo:`-intent и документированные deep-link
// схемы навигаторов. На web схемы приложений не работают, поэтому там сохраняем
// прежние HTTPS-URL, которые открываются в новой вкладке (web — прод, не ломаем).
const IS_NATIVE = Platform.OS !== 'web';

const parseCoordString = (coord: string): ParsedCoord | null => {
  const cleaned = String(coord || '').replace(/;/g, ',').replace(/\s+/g, '');
  const [latStr, lonStr] = cleaned.split(',').map((s) => s.trim());
  const lat = Number(latStr);
  const lon = Number(lonStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
};

export const buildGoogleMapsUrl = (coord: string) => {
  const parsed = parseCoordString(coord);
  if (!parsed) return '';
  // HTTPS Universal URL — Google Maps app-link'ает его на Android/iOS и ставит
  // маркер; на web открывается веб-карта. Один формат для обеих платформ.
  return `https://www.google.com/maps/search/?api=1&query=${parsed.lat},${parsed.lon}`;
};

export const buildOrganicMapsUrl = (coord: string) => {
  const parsed = parseCoordString(coord);
  if (!parsed) return '';
  // На Android `geo:`-intent открывает Organic Maps (или другое установленное
  // карт-приложение) с маркером на точке. `omaps.app`/`om://` без ge0-хеша
  // открывают приложение без позиционирования.
  if (IS_NATIVE) {
    return `geo:${parsed.lat},${parsed.lon}?q=${parsed.lat},${parsed.lon}`;
  }
  return `https://omaps.app/${parsed.lat},${parsed.lon}`;
};

export const buildWazeUrl = (coord: string) => {
  const parsed = parseCoordString(coord);
  if (!parsed) return '';
  if (IS_NATIVE) {
    // Документированная deep-link Waze: показать точку и предложить маршрут.
    return `waze://?ll=${parsed.lat},${parsed.lon}&navigate=yes`;
  }
  return `https://waze.com/ul?ll=${parsed.lat},${parsed.lon}&navigate=yes`;
};

export const buildYandexNaviUrl = (coord: string) => {
  const parsed = parseCoordString(coord);
  if (!parsed) return '';
  if (IS_NATIVE) {
    // Схема Яндекс.Навигатора: строит маршрут к точке от текущего положения.
    // Веб-URL `yandex.ru/navi/?whatshere[...]` приложением не парсится.
    return `yandexnavi://build_route_on_map?lat_to=${parsed.lat}&lon_to=${parsed.lon}`;
  }
  return `https://yandex.ru/navi/?whatshere[point]=${parsed.lon},${parsed.lat}&whatshere[zoom]=16`;
};

export const buildTelegramShareUrl = (coord: string) => {
  const mapUrl = buildGoogleMapsUrl(coord);
  if (!mapUrl) return '';
  const text = `Координаты: ${coord}`;
  return `https://t.me/share/url?url=${encodeURIComponent(mapUrl)}&text=${encodeURIComponent(text)}`;
};
