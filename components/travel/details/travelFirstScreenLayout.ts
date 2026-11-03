import { METRICS } from '@/constants/layout'
import { resolveTravelAuthorName } from '@/components/listTravel/travelListItemHelpers'
import type { Travel } from '@/types/types'
import { formatDays } from '@/utils/pluralize'

/**
 * #2904: первый экран статьи на mobile web (< 768 px) — h1 и строка меты над
 * галереей, подпись точки под фото мелким серым, дальше табы
 * (`docs/features/ux-audit-2026-11-mocks.md` §4). Desktop-порядок не меняется.
 *
 * Порядок держит CSS, а не JS-ветка: `useResponsive` отдаёт ширину 0 на SSR и
 * в кадре гидрации на ЛЮБОМ экране, поэтому `isMobile`-ветка на desktop
 * переставила бы блоки уже после первой отрисовки (CLS). DOM остаётся
 * desktop-порядка (hero → h1 → статья), а ниже брейкпоинта `order:-1` поднимает
 * h1 и мету в начало flex-колонки контента. Одна таблица стилей действует и на
 * router-SSR HTML, и на гидрированный React — геометрия совпадает до и после.
 *
 * Значения продублированы в SSG-шелле (`scripts/ssg-skeletons.js`: CommonJS на
 * этапе сборки не импортирует TS); паритет держит
 * `__tests__/components/travel/travelFirstScreenLayout.test.ts`.
 */
export const TRAVEL_FIRST_SCREEN = {
  /** Последний mobile-пиксель: тот же порог, что `isMobile` (`width < tablet`). */
  mobileMaxWidth: `${METRICS.breakpoints.tablet - 0.02}px`,
  titleFontSizePx: 28,
  titleLineHeight: 1.25,
  /**
   * Typical title height the loading skeleton reserves. The h1 itself is never
   * line-clamped: `scripts/post-deploy-seo-check.js` rejects a clipped travel H1
   * (`travel.h1.hidden`, `overflow:hidden`), so a long title simply wraps.
   */
  titleReserveLines: 2,
  titleMarginTopPx: 12,
  titleMarginBottomPx: 4,
  metaFontSizePx: 14,
  metaLineHeightPx: 20,
  metaMarginBottomPx: 12,
} as const

/** `dataSet`/атрибут-маркеры, на которые опирается таблица стилей. */
export const TRAVEL_FIRST_SCREEN_ATTR = 'data-travel-first-screen'
export const TRAVEL_SLIDER_CAPTION_ATTR = 'data-travel-slider-caption-part'

const MOBILE_SANS_FONT =
  '-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",system-ui,sans-serif'

const F = TRAVEL_FIRST_SCREEN
const CAPTION = `[${TRAVEL_SLIDER_CAPTION_ATTR}`

export const TRAVEL_FIRST_SCREEN_STYLES = `
[${TRAVEL_FIRST_SCREEN_ATTR}="meta"]{display:none}
[${TRAVEL_FIRST_SCREEN_ATTR}="favorite"]{min-height:76px;margin-bottom:12px}
@media(max-width:${F.mobileMaxWidth}){
[data-testid="travel-details-stale-content-banner"]{order:-2}
[${TRAVEL_FIRST_SCREEN_ATTR}="favorite"]{order:-1}
[${TRAVEL_FIRST_SCREEN_ATTR}="title"]{order:-1;margin:${F.titleMarginTopPx}px 0 ${F.titleMarginBottomPx}px!important}
[${TRAVEL_FIRST_SCREEN_ATTR}="meta"]{order:-1;display:block;height:${F.metaLineHeightPx}px;margin:0 0 ${F.metaMarginBottomPx}px;font:400 ${F.metaFontSizePx}px/${F.metaLineHeightPx}px ${MOBILE_SANS_FONT};color:var(--color-textMuted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${CAPTION}="root"]{padding:6px 4px 8px!important;gap:8px!important;align-items:baseline!important}
${CAPTION}="counter"]{flex-direction:row!important;align-items:baseline!important;gap:4px!important;padding-right:8px!important}
${CAPTION}="position"],${CAPTION}="total"],${CAPTION}="text"]{font:400 13px/18px ${MOBILE_SANS_FONT}!important;font-style:normal!important;color:var(--color-textMuted)!important}
}
`

/** «Юля · Октябрь 2019 · 1 день · Беларусь»: пустые части пропускаются. */
export function buildTravelFirstScreenMeta(travel: Travel): string {
  const author = resolveTravelAuthorName(travel, travel.userName)
  const when = [travel.monthName, travel.year != null ? String(travel.year) : '']
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ')
  const days = formatDays(travel.number_days != null ? Number(travel.number_days) : null)
  return [author, when, days, travel.countryName]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' · ')
}
