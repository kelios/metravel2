/**
 * Fixtures контракта place/source (#1567/#1571, MAP-POI-SOURCE-GROUPING-001).
 *
 * Формы обязаны совпадать с DTO из `docs/features/map.md` → «Один физический
 * объект с несколькими источниками» и Task Contract #1567. Используются
 * слайсами модели (#1571), pager UI (#1572) и renderers/bridge (#1573);
 * интеграцию и TestFlight-приёмку (#1568) fixtures не закрывают.
 *
 * Сюжет — реальный подтверждённый кейс: Национальная библиотека Минска как два
 * материала (`point 14029 / travel 389` и `point 15688 / travel 646`) одного
 * `place_id`, рядом — самостоятельное место с другим `place_id`.
 */

/** Сырой `primary_source` (snake_case, как отдаёт backend). */
export const RAW_LIBRARY_SOURCE_A = {
  source_id: 'travel-address:14029',
  point_id: 14029,
  travel_id: 389,
  article_title: 'Минск за выходные',
  article_url: '/travels/minsk-za-vyhodnye',
  thumbnail_url: '/address-image/14029/conversions/x-thumb_400_wp.webp',
  thumbnail_width: 400,
  thumbnail_height: 300,
} as const;

export const RAW_LIBRARY_SOURCE_B = {
  source_id: 'travel-address:15688',
  point_id: 15688,
  travel_id: 646,
  article_title: 'Библиотеки Беларуси',
  article_url: '/travels/biblioteki-belarusi',
  thumbnail_url: '/address-image/15688/conversions/x-thumb_400_wp.webp',
  thumbnail_width: 400,
  thumbnail_height: 300,
} as const;

/** Grouped marker: backend уже склеил место, отдаёт счётчик и primary_source. */
export const RAW_GROUPED_LIBRARY_MARKER = {
  place_id: 501,
  name: 'Национальная библиотека Беларуси',
  address: 'Минск, просп. Независимости 116',
  lat: '53.9312900',
  lng: '27.6459000',
  source_count: 2,
  primary_source: RAW_LIBRARY_SOURCE_A,
  // Legacy flat поля сохраняются на период совместимости (#1567).
  id: 14029,
  point_id: 14029,
  travelImageThumbUrl: '/address-image/14029/conversions/x-thumb_400_wp.webp',
  urlTravel: '/travels/minsk-za-vyhodnye',
} as const;

/** Два плоских row одного place_id — переходная форма search_travels_for_map. */
export const RAW_FLAT_LIBRARY_ROW_A = {
  id: 14029,
  place_id: 501,
  address: 'Национальная библиотека Беларуси',
  lat: '53.9312900',
  lng: '27.6459000',
  travelImageThumbUrl: '/address-image/14029/conversions/x-thumb_400_wp.webp',
  urlTravel: '/travels/minsk-za-vyhodnye',
} as const;

export const RAW_FLAT_LIBRARY_ROW_B = {
  id: 15688,
  place_id: 501,
  address: 'Национальная библиотека Беларуси',
  lat: '53.9315800',
  lng: '27.6460100',
  travelImageThumbUrl: '/address-image/15688/conversions/x-thumb_400_wp.webp',
  urlTravel: '/travels/biblioteki-belarusi',
} as const;

/**
 * Production #1567 identity is a UUID string, not a numeric point/place id.
 * Sources endpoint is `GET /api/map/places/{uuid}/sources/`; numeric 14029/501 404.
 */
export const LIBRARY_PLACE_UUID = '01409e46-415e-5dab-9e8d-a88b7bed1b64';

export const RAW_GROUPED_LIBRARY_MARKER_UUID = {
  ...RAW_GROUPED_LIBRARY_MARKER,
  place_id: LIBRARY_PLACE_UUID,
  primary_source: {
    ...RAW_LIBRARY_SOURCE_A,
    source_id: '14029',
  },
} as const;

export const RAW_FLAT_LIBRARY_ROW_A_UUID = {
  ...RAW_FLAT_LIBRARY_ROW_A,
  place_id: LIBRARY_PLACE_UUID,
} as const;

export const RAW_FLAT_LIBRARY_ROW_B_UUID = {
  ...RAW_FLAT_LIBRARY_ROW_B,
  place_id: LIBRARY_PLACE_UUID,
} as const;

/** Соседнее самостоятельное место: другой place_id, склеивать запрещено. */
export const RAW_NEARBY_DISTINCT_MARKER = {
  place_id: 502,
  name: 'Парк Писателей',
  address: 'Минск, просп. Независимости 118',
  lat: '53.9320000',
  lng: '27.6470000',
  source_count: 1,
  primary_source: {
    source_id: 'travel-address:15900',
    point_id: 15900,
    travel_id: 700,
    article_title: 'Парки Минска',
    article_url: '/travels/parki-minska',
    thumbnail_url: '/address-image/15900/conversions/x-thumb_400_wp.webp',
    thumbnail_width: 400,
    thumbnail_height: 300,
  },
  id: 15900,
} as const;

/** Legacy row без place_id: остаётся отдельным single-source маркером. */
export const RAW_LEGACY_PLACELESS_ROW = {
  id: 4242,
  address: 'Синагога главная (1793), Столин',
  lat: '51.8865137',
  lng: '26.8430203',
  travelImageThumbUrl: '/address-image/5960/conversions/x-thumb_400_wp.webp',
  urlTravel: '/travels/stolin',
} as const;

/** Ответ sources endpoint: страница 1 из 2 (cursor-пагинация). */
export const RAW_SOURCES_PAGE_1 = {
  results: [RAW_LIBRARY_SOURCE_A],
  next: 'cursor-2',
} as const;

export const RAW_SOURCES_PAGE_2 = {
  results: [RAW_LIBRARY_SOURCE_B],
  next: null,
} as const;

/** Однастраничный ответ с обоими материалами — базовый случай sourceCount=2. */
export const RAW_SOURCES_SINGLE_PAGE = {
  results: [RAW_LIBRARY_SOURCE_A, RAW_LIBRARY_SOURCE_B],
  next: null,
} as const;

/**
 * Второй материал без своей ссылки и фото (DTO разрешает null в обоих полях).
 * Плоские legacy-поля записи описывают primary, поэтому под таким источником
 * карточка обязана остаться без фото/ссылки, а не показать чужие.
 */
export const RAW_LIBRARY_SOURCE_B_WITHOUT_MEDIA = {
  source_id: 'travel-address:15688',
  point_id: 15688,
  travel_id: 646,
  article_title: 'Библиотеки Беларуси',
  article_url: null,
  thumbnail_url: null,
} as const;

export const RAW_SOURCES_PAGE_WITHOUT_MEDIA = {
  results: [RAW_LIBRARY_SOURCE_A, RAW_LIBRARY_SOURCE_B_WITHOUT_MEDIA],
  next: null,
} as const;
