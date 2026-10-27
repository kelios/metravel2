/* global module, require */
// One CSS geometry for the static shell and the real responsive SSR book.
const {
  HOME_BOOK_GEOMETRY,
  getHomeBookLeftPagePaddingShares,
  getHomeBookTypeScale,
} = require('./homeBookGeometry')

// The week photo keeps 3:2 but never outgrows the paper height on a wide, short
// book: it narrows and stays centred, like the runtime slider frame.
// CSS uses the same coefficients before JS exists; viewport-derived book width
// respects the cap rather than using uncapped 100vw to derive its aspect height.
const DEFAULT_SELECTORS = { book: '.ssg-home-book', page: '.ssg-home-page', title: '.ssg-home-title', subtitle: '.ssg-home-sub', week: '.ssg-home-week' }

function buildHomeBookGeometryCSS(selectors = DEFAULT_SELECTORS, { important = false } = {}) {
  const g = HOME_BOOK_GEOMETRY
  let css = ''
  for (const [breakpoint, cap] of [[1280, 1200], [1480, 1200], [1920, 1360], [2560, 1520]]) {
    const scale = getHomeBookTypeScale(breakpoint)
    const narrow = breakpoint < 1480
    const rightPageShare = narrow ? 0.51 : 0.5
    const rightLeftShare = breakpoint >= 2560 ? 0.028 : narrow ? 0.026 : 0.032
    const rightRightShare = breakpoint >= 2560 ? 0.152 : narrow ? 0.172 : 0.162
    const photoBookShare = rightPageShare - rightLeftShare - rightRightShare
    // Grid-item percentages resolve against the page column, so the book-width
    // shares are spelled out against --home-book-width instead.
    const padding = getHomeBookLeftPagePaddingShares(1 - rightPageShare)
    css += `@media(min-width:${breakpoint}px){${selectors.book}{--home-book-width:min(calc(100vw - ${g.horizontalReserve}px),${cap}px);--home-book-height:max(${g.minHeight}px,min(calc(100vh - ${g.viewportReserve}px),calc(var(--home-book-width) * ${g.artworkHeightRatio})));--home-book-usable-height:calc(var(--home-book-height) * ${Math.round((1 - g.topInsetShare - g.bottomInsetShare) * 1e4) / 1e4});width:var(--home-book-width);height:var(--home-book-height);grid-template-columns:${narrow ? '49% 51%' : '50% 50%'}}${selectors.page}{padding-top:calc(var(--home-book-height) * ${g.topInsetShare});padding-bottom:calc(var(--home-book-height) * ${g.bottomInsetShare});padding-left:calc(var(--home-book-width) * ${padding.start});padding-right:calc(var(--home-book-width) * ${padding.end})}${selectors.title}{font-size:max(24px,min(${scale.titleVw}vw,${scale.titleMax}px,calc(var(--home-book-usable-height) * .1)));line-height:1.2}${selectors.subtitle}{font-size:max(12px,min(${scale.subtitleVw}vw,${scale.subtitleMax}px,calc(var(--home-book-usable-height) * .03)));line-height:1.5}${selectors.week}{--home-week-width:min(calc(var(--home-book-width) * ${photoBookShare}),calc(var(--home-book-usable-height) * 1.5));top:calc(var(--home-book-height) * ${g.topInsetShare} + (var(--home-book-usable-height) - var(--home-week-width) / 1.5) / 2);width:var(--home-week-width);margin-left:calc(var(--home-book-width) * ${rightLeftShare} + (var(--home-book-width) * ${photoBookShare} - var(--home-week-width)) / 2)}}`
  }
  return important ? css.replace(/:([^;{}]+)(?=[;}])/g, ':$1!important') : css
}

module.exports = { buildHomeBookGeometryCSS }
