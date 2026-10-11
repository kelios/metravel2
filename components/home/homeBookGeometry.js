/* global module */
// Pure geometry shared by the loaded book and its Node-only static shell.
const HOME_BOOK_GEOMETRY = Object.freeze({
  viewportReserve: 180,
  horizontalReserve: 80,
  artworkHeightRatio: 765 / 1040,
  minHeight: 240,
  compactHeight: 760,
  topInsetShare: 0.08,
  bottomInsetShare: 0.14,
})

function getHomeBookWidthLimit(viewportWidth) {
  return viewportWidth >= 2560 ? 1520 : viewportWidth >= 1920 ? 1360 : 1200
}

function getHomeBookWidth(viewportWidth) {
  return Math.max(0, Math.min(viewportWidth - HOME_BOOK_GEOMETRY.horizontalReserve, getHomeBookWidthLimit(viewportWidth)))
}

function resolveHomeBookGeometry(viewportWidth, viewportHeight, measuredWidth = 0) {
  const width = measuredWidth > 0 ? measuredWidth : getHomeBookWidth(viewportWidth)
  const height = width > 0
    ? Math.max(HOME_BOOK_GEOMETRY.minHeight, Math.min(width * HOME_BOOK_GEOMETRY.artworkHeightRatio, viewportHeight - HOME_BOOK_GEOMETRY.viewportReserve))
    : 0
  return { width, height, ...getHomeBookPageMetrics(viewportWidth, height) }
}

function getHomeBookTypeScale(viewportWidth) {
  if (viewportWidth >= 2560) return { titleVw: 2.8, titleMax: 74, subtitleVw: 1.1, subtitleMax: 22 }
  if (viewportWidth >= 1920) return { titleVw: 2.4, titleMax: 58, subtitleVw: 0.95, subtitleMax: 18 }
  if (viewportWidth < 1480) return { titleVw: 1.9, titleMax: 32, subtitleVw: 0.85, subtitleMax: 13 }
  return { titleVw: 2.1, titleMax: 38, subtitleVw: 0.9, subtitleMax: 14 }
}

function getHomeBookPageMetrics(viewportWidth, height) {
  const topInset = height * HOME_BOOK_GEOMETRY.topInsetShare
  const bottomInset = height * HOME_BOOK_GEOMETRY.bottomInsetShare
  const usableHeight = Math.max(0, height - topInset - bottomInset)
  const scale = getHomeBookTypeScale(viewportWidth)
  const titleSize = Math.max(24, Math.min(viewportWidth * scale.titleVw / 100, scale.titleMax, usableHeight * 0.1))
  const subtitleSize = Math.max(12, Math.min(viewportWidth * scale.subtitleVw / 100, scale.subtitleMax, usableHeight * 0.03))
  return { topInset, bottomInset, usableHeight, titleSize, titleLineHeight: titleSize * 1.2, subtitleSize, subtitleLineHeight: subtitleSize * 1.5 }
}

// CSS uses the same coefficients before JS exists; viewport-derived book width
// respects the cap rather than using uncapped 100vw to derive its aspect height.
function buildHomeBookSkeletonGeometryCSS() {
  const g = HOME_BOOK_GEOMETRY
  let css = ''
  for (const [breakpoint, cap] of [[1280, 1200], [1480, 1200], [1920, 1360], [2560, 1520]]) {
    const scale = getHomeBookTypeScale(breakpoint)
    const narrow = breakpoint < 1480
    const rightPageShare = narrow ? 0.51 : 0.5
    const rightLeftShare = breakpoint >= 2560 ? 0.028 : narrow ? 0.026 : 0.032
    const rightRightShare = breakpoint >= 2560 ? 0.152 : narrow ? 0.172 : 0.162
    const photoBookShare = rightPageShare - rightLeftShare - rightRightShare
    css += `@media(min-width:${breakpoint}px){.ssg-home-book{--home-book-width:min(calc(100vw - ${g.horizontalReserve}px),${cap}px);--home-book-height:max(${g.minHeight}px,min(calc(100vh - ${g.viewportReserve}px),calc(var(--home-book-width) * ${g.artworkHeightRatio})));--home-book-usable-height:calc(var(--home-book-height) * ${1 - g.topInsetShare - g.bottomInsetShare});width:var(--home-book-width);height:var(--home-book-height);grid-template-columns:${narrow ? '49% 51%' : '50% 50%'}}.ssg-home-page{padding-top:calc(var(--home-book-height) * ${g.topInsetShare});padding-bottom:calc(var(--home-book-height) * ${g.bottomInsetShare});padding-left:${narrow ? 16 : breakpoint >= 1920 && breakpoint < 2560 ? 18 : 17}%;padding-right:${breakpoint >= 2560 ? 8 : 9}%}.ssg-home-title{font-size:max(24px,min(${scale.titleVw}vw,${scale.titleMax}px,calc(var(--home-book-usable-height) * .1)));line-height:1.2}.ssg-home-sub{font-size:max(12px,min(${scale.subtitleVw}vw,${scale.subtitleMax}px,calc(var(--home-book-usable-height) * .03)));line-height:1.5}.ssg-home-week{top:calc(var(--home-book-height) * ${g.topInsetShare} + (var(--home-book-usable-height) - var(--home-book-width) * ${photoBookShare / 1.5}) / 2);width:calc(var(--home-book-width) * ${photoBookShare});margin-left:calc(var(--home-book-width) * ${rightLeftShare})}}`
  }
  return css
}

module.exports = { HOME_BOOK_GEOMETRY, getHomeBookWidthLimit, getHomeBookWidth, resolveHomeBookGeometry, getHomeBookPageMetrics, buildHomeBookSkeletonGeometryCSS }
