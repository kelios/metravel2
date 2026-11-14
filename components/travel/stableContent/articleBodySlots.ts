// Реальные слоты тела статьи: 100vw на мобиле, ~720px на 1280, ~920px на 1920.
//
// #1213: это ЕДИНСТВЕННЫЙ источник и для атрибута `sizes`, и для выбора ступени
// префетча первой картинки. Раньше `sizes` был литералом, а префетч брал
// фиксированный `RESPONSIVE_FALLBACK_WIDTH`: на десктопе браузер грузил по srcset
// w=1920, а `<link rel=prefetch>` следом тянул w=800 — один слот двумя ступенями.
// Замер прода 2026-08-02: 29 252 B и 96 912 B выброшены на двух статьях.
//
// #3408: модуль без импортов — порог читают и построитель адресов, и выпуск
// отложенных картинок серверного острова (скрипт оболочки документа и
// `utils/richTextDeferredImages.ts`), которым построитель тянуть незачем.
export const ARTICLE_BODY_SLOTS = [
  { maxViewport: 768, cssSize: '100vw', slotWidth: (viewportWidth: number) => viewportWidth },
  { maxViewport: 1439, cssSize: '720px', slotWidth: () => 720 },
  { maxViewport: Number.POSITIVE_INFINITY, cssSize: '920px', slotWidth: () => 920 },
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
