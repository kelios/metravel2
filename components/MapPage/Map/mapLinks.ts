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
const isNativePlatform = () => Platform.OS !== 'web';

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
  // На Android HTTPS-Universal-URL `/maps/search/?api=1&query=` НЕ ставит маркер —
  // открывает домашний экран Google Maps без пина и без координат (device-verify
  // 2026-06-23, Pixel 10 Pro). А `geo:`-intent через `Linking.openURL` нельзя
  // привязать к пакету Google → коллизия с Organic (тоже хэндлит `geo:`).
  // `/maps/place/lat,lon` — HTTPS-маркер-URL: Google Maps на Android открывается
  // напрямую, ставит пин на точку и показывает карточку с ТОЧНЫМИ координатами.
  // На web оставляем прежний `/maps/search/?api=1&query=` (прод, не ломаем).
  if (isNativePlatform()) {
    return `https://www.google.com/maps/place/${parsed.lat},${parsed.lon}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${parsed.lat},${parsed.lon}`;
};

export const buildOrganicMapsUrl = (coord: string) => {
  const parsed = parseCoordString(coord);
  if (!parsed) return '';
  // На Android `geo:`-intent открывает Organic Maps (или другое установленное
  // карт-приложение) с маркером на точке. `omaps.app`/`om://` без ge0-хеша
  // открывают приложение без позиционирования.
  if (isNativePlatform()) {
    return `geo:${parsed.lat},${parsed.lon}?q=${parsed.lat},${parsed.lon}`;
  }
  return `https://omaps.app/${parsed.lat},${parsed.lon}`;
};

export const buildWazeUrl = (coord: string) => {
  const parsed = parseCoordString(coord);
  if (!parsed) return '';
  if (isNativePlatform()) {
    // Без `navigate=yes`: показать ПИН на точке с карточкой места (а не сразу
    // гнать навигацию). Device-verify 2026-06-23 (Pixel 10 Pro): `waze://?ll=`
    // показывает маркер + карточку «Отправить / Маршруты», `navigate=yes` визуально
    // ничего не добавлял. Приоритет — чтобы пользователь увидел точку.
    return `waze://?ll=${parsed.lat},${parsed.lon}`;
  }
  return `https://waze.com/ul?ll=${parsed.lat},${parsed.lon}&navigate=yes`;
};

export const buildYandexNaviUrl = (coord: string) => {
  const parsed = parseCoordString(coord);
  if (!parsed) return '';
  if (isNativePlatform()) {
    // Схема Яндекс.Навигатора: строит маршрут к точке от текущего положения.
    // Веб-URL `yandex.ru/navi/?whatshere[...]` приложением не парсится.
    return `yandexnavi://build_route_on_map?lat_to=${parsed.lat}&lon_to=${parsed.lon}`;
  }
  return `https://yandex.ru/navi/?whatshere[point]=${parsed.lon},${parsed.lat}&whatshere[zoom]=16`;
};
// Если на устройстве нет Яндекс.Навигатора (схему `yandexnavi:` регистрирует
// только он, без него tap no-op'ит, result code=-91), открывалка `openExternalUrl`
// сама перестраивает ссылку в Яндекс.Карты с ПИНом на точке
// (`yandexmaps://...?pt=lon,lat&l=map`) — см. utils/externalLinks.ts.

export const buildOpenStreetMapUrl = (coord: string) => {
  const parsed = parseCoordString(coord);
  if (!parsed) return '';
  return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(parsed.lat))}&mlon=${encodeURIComponent(String(parsed.lon))}#map=16/${encodeURIComponent(String(parsed.lat))}/${encodeURIComponent(String(parsed.lon))}`;
};

export const buildTelegramShareUrl = (coord: string) => {
  const mapUrl = buildGoogleMapsUrl(coord);
  if (!mapUrl) return '';
  const text = `Координаты: ${coord}`;
  return `https://t.me/share/url?url=${encodeURIComponent(mapUrl)}&text=${encodeURIComponent(text)}`;
};
