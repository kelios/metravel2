// Общий гейт рендера Belkraj-виджета: web-вариант (iframe) и native-вариант
// (WebView) молча возвращают null вне production, когда у первой точки нет
// валидных координат и когда страна точки не входит в каталог партнёра.
//
// Секции, которые рисуют вокруг виджета собственную обвязку — заголовок, карточку,
// разделитель, — обязаны спросить `canRenderBelkrajWidget` ДО отрисовки обвязки.
// Иначе на экране остаётся карточка-призрак с одним заголовком и пустым телом
// (#1452: именно так выглядел первый из двух блоков «Экскурсии рядом»).
//
// Оба виджета берут гейт отсюда же — предикат не может разойтись с их поведением.
//
// Страновая граница — не косметика, а корректность выдачи. Каталог партнёра
// (belkraj.by → tripvenue) покрывает десятки стран, но не весь мир: для страны
// БЕЗ каталога виджет отвечает не пустым списком, а тихой подменой на
// белорусский город (Лимасол/CY, Цюрих/CH, Рейкьявик/IS, Мальдивы/MV → Минск —
// проверено на проде 2026-08-24). Виджет — сторонний iframe/WebView, из другого
// origin счётчик результатов недоступен (widget-iframe.js шлёт только
// setHeight/getHeight), поэтому «есть ли реальный результат» нельзя определить в
// рантайме — приходится решать ДО рендера по стране первой точки.
//
// Второй столп корректности — сам параметр `country`. tripvenue резолвит
// координаты в ближайший город каталога, и без верного кода страны промахивается
// даже по поддержанной стране: Варшава без `country` → «Бобинка», с `country=BY`
// → «Бобинка», и только с `country=PL` → «Варшава» (проверено на проде
// 2026-08-24). Поэтому в URL всегда уходит реальный код страны точки, а не BY.

import { isBelarusByCoords } from '@/utils/geoBelarus'

export type BelkrajPoint = {
  id?: number
  address?: string
  coord?: string
  lat?: number
  lng?: number
}

// Вход шире `BelkrajPoint`: travel-details передаёт `TravelAddressItem[]`, а это
// union `string | {...}`. Строковый элемент координат не несёт — сам виджет на нём
// тоже отрисует null, поэтому предикат обязан вести себя так же.
export type BelkrajPointLike = BelkrajPoint | string | null

/** Страна по умолчанию для координатного фолбэка, когда явный код не пришёл. */
export const BELKRAJ_COUNTRY_CODE = 'BY'

// Страны, по которым у партнёра есть реальный каталог экскурсий (ISO 3166-1
// alpha-2, верхний регистр). Список снят живой пробой прода 2026-08-24: для
// каждого кода виджет `belkraj.by/partner/widget?...&country=<CC>` отдаёт
// экскурсии по городу ВНУТРИ этой страны, а не тихую подмену на Минск. Страны с
// подменой (CH, CY, IS, US, LU, KR, SG, SA, CA, MV, DO, MK, XK, …) сюда не
// входят — на них секция «Экскурсии» не рисуется вовсе.
//
// Каталог партнёра со временем меняется; список пересобирается той же пробой:
// curl "https://belkraj.by/partner/widget?lat=<LAT>&lng=<LNG>&term=place&theme=cards&partner=u180793&size=6&country=<CC>"
// и проверкой заголовка «экскурсии в <Город>» — если это белорусский город при
// не-BY стране, каталога нет.
export const SUPPORTED_BELKRAJ_COUNTRIES: ReadonlySet<string> = new Set([
  'AE', 'AL', 'AM', 'AR', 'AT', 'AU', 'AZ', 'BA', 'BE', 'BG',
  'BR', 'BY', 'CN', 'CU', 'CZ', 'DE', 'DK', 'EE', 'EG', 'ES',
  'FI', 'FR', 'GB', 'GE', 'GR', 'HR', 'HU', 'ID', 'IE', 'IL',
  'IN', 'IT', 'JO', 'JP', 'KG', 'KZ', 'LK', 'LT', 'LV', 'MA',
  'MD', 'ME', 'MT', 'MX', 'MY', 'NL', 'NO', 'PL', 'PT', 'QA',
  'RO', 'RS', 'RU', 'SE', 'SI', 'SK', 'TH', 'TN', 'TR', 'UA',
  'UZ', 'VN', 'ZA',
])

/** true, если у партнёра есть каталог по стране (регистр/пробелы не важны). */
export const isBelkrajSupportedCountry = (countryCode?: string): boolean => {
  const normalized = String(countryCode || '').trim().toUpperCase()
  return SUPPORTED_BELKRAJ_COUNTRIES.has(normalized)
}

export const parseBelkrajCoord = (point?: BelkrajPointLike) => {
  if (!point || typeof point !== 'object') return null
  if (typeof point.lat === 'number' && typeof point.lng === 'number') {
    return { lat: point.lat, lng: point.lng }
  }
  if (!point.coord) return null

  const [rawLat, rawLng] = point.coord.split(',').map((value) => value.trim())
  const lat = Number(rawLat)
  const lng = Number(rawLng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

/**
 * Код страны для виджета: явный проп важнее координат, иначе резолв по первой
 * точке. Явный двухбуквенный код возвращается как есть (в URL уходит реальная
 * страна точки — от неё зависит корректность выдачи tripvenue). Координатный
 * фолбэк умеет распознать только Беларусь, поэтому без явного кода за пределами
 * BY страна остаётся неизвестной и виджет не рисуется.
 */
export const resolveBelkrajCountryCode = (
  points?: readonly BelkrajPointLike[],
  countryCode?: string,
): string | undefined => {
  const normalized = String(countryCode || '').trim().toUpperCase()
  if (/^[A-Z]{2}$/.test(normalized)) return normalized
  const coord = parseBelkrajCoord(points?.[0])
  if (!coord) return undefined
  return isBelarusByCoords(coord.lat, coord.lng) ? BELKRAJ_COUNTRY_CODE : undefined
}

export const isBelkrajEnabled = () =>
  typeof process !== 'undefined' &&
  !!process.env &&
  process.env.NODE_ENV === 'production'

export const canRenderBelkrajWidget = (points?: readonly BelkrajPointLike[], countryCode?: string) =>
  isBelkrajEnabled() &&
  parseBelkrajCoord(points?.[0]) !== null &&
  isBelkrajSupportedCountry(resolveBelkrajCountryCode(points, countryCode))
