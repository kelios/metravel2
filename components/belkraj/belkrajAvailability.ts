// Общий гейт рендера Belkraj-виджета: web-вариант (iframe) и native-вариант
// (WebView) молча возвращают null вне production, когда у первой точки нет
// валидных координат и когда точка лежит за пределами Беларуси.
//
// Секции, которые рисуют вокруг виджета собственную обвязку — заголовок, карточку,
// разделитель, — обязаны спросить `canRenderBelkrajWidget` ДО отрисовки обвязки.
// Иначе на экране остаётся карточка-призрак с одним заголовком и пустым телом
// (#1452: именно так выглядел первый из двух блоков «Экскурсии рядом»).
//
// Оба виджета берут гейт отсюда же — предикат не может разойтись с их поведением.
//
// Страновая граница — не косметика, а корректность выдачи. Каталог партнёра
// покрывает только Беларусь, и на координаты вне страны его виджет отвечает не
// пустым списком, а тихой подменой города: для Лимасола (CY) он отдавал
// экскурсии по Минску с подписью «Минск, Кипр», а без параметра `country` — по
// Гомелю (проверено на проде 2026-08-18, квест `limassol-lionheart`). Внутри
// Беларуси координаты резолвятся верно — Витебск отдаёт витебские экскурсии, —
// поэтому режем ровно по стране.

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

/** Единственная страна, по которой у партнёра есть каталог экскурсий. */
export const BELKRAJ_COUNTRY_CODE = 'BY'

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
 * точке. Тот же порядок, что был внутри обоих виджетов, — теперь один на всех,
 * чтобы гейт и `country` в URL считались из одного источника.
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
  resolveBelkrajCountryCode(points, countryCode) === BELKRAJ_COUNTRY_CODE
