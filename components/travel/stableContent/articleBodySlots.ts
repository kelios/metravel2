// Реальные слоты тела статьи: 100vw на мобиле, ~720px на 1280, ~920px на 1920.
//
// #1213: единственный источник атрибута `sizes`. Раньше отсюда же выбиралась
// ступень префетча первой картинки; префетч убран (#3420): запрос `rel=prefetch`
// уходит с `Accept` документа, ответ картинки несёт `Vary: Accept`, и `<img>`
// качал тот же файл заново.
//
// #3408: модуль без импортов — порог читают и построитель адресов, и выпуск
// отложенных картинок серверного острова (скрипт оболочки документа и
// `utils/richTextDeferredImages.ts`), которым построитель тянуть незачем.
const ARTICLE_BODY_SLOTS = [
  { maxViewport: 768, cssSize: '100vw' },
  { maxViewport: 1439, cssSize: '720px' },
  { maxViewport: Number.POSITIVE_INFINITY, cssSize: '920px' },
] as const

export const ARTICLE_BODY_MOBILE_VIEWPORT_MAX = ARTICLE_BODY_SLOTS[0].maxViewport

export const ARTICLE_BODY_SIZES = ARTICLE_BODY_SLOTS.map(({ maxViewport, cssSize }) =>
  Number.isFinite(maxViewport) ? `(max-width: ${maxViewport}px) ${cssSize}` : cssSize,
).join(', ')

/**
 * Вьюпорт мобильного слота. Ширина 0 — это SSR: там вьюпорт неизвестен, и набор
 * остаётся десктопным (разметка уезжает в браузер, который выберет ступень сам).
 */
export const isArticleBodyMobileViewport = (viewportWidth: number): boolean =>
  viewportWidth > 0 && viewportWidth <= ARTICLE_BODY_MOBILE_VIEWPORT_MAX
