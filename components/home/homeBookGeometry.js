/* global module */
// Pure geometry shared by the loaded book and its Node-only static shell
// (scripts/ssg-home-book-css.js builds the shell CSS from these numbers; the
// builder stays out of this module because it ships in the home route chunk).
// Inner page frame drawn on open-book-bg(-dark).webp (both share one drawing),
// as shares of the artwork. The wrapper stretches the artwork with
// `background-size: 100% 100%`, so horizontal shares are shares of the book
// width and vertical ones of the book height. Innermost line across the page
// slant, measured on the 1536×1024 source.
const HOME_BOOK_ARTWORK_FRAME = Object.freeze({
  left: 0.131,
  gutterLeft: 0.4805,
  right: 0.867,
  top: 0.097,
  bottom: 0.777,
})
// Breathing room between that frame line and the page content.
const HOME_BOOK_FRAME_GAP = Object.freeze({ x: 0.025, y: 0.035 })
// Shares go into CSS strings verbatim, so float noise is cut off here.
const share = (value) => Math.round(value * 1e4) / 1e4

const HOME_BOOK_GEOMETRY = Object.freeze({
  viewportReserve: 180,
  horizontalReserve: 80,
  artworkHeightRatio: 765 / 1040,
  minHeight: 240,
  compactHeight: 760,
  topInsetShare: share(HOME_BOOK_ARTWORK_FRAME.top + HOME_BOOK_FRAME_GAP.y),
  bottomInsetShare: share(1 - HOME_BOOK_ARTWORK_FRAME.bottom + HOME_BOOK_FRAME_GAP.y),
  // Left-page content edges, as shares of the whole book width.
  leftPageStartShare: share(HOME_BOOK_ARTWORK_FRAME.left + HOME_BOOK_FRAME_GAP.x),
  leftPageEndShare: share(HOME_BOOK_ARTWORK_FRAME.gutterLeft - HOME_BOOK_FRAME_GAP.x),
  rightPageEndShare: share(1 - HOME_BOOK_ARTWORK_FRAME.right + HOME_BOOK_FRAME_GAP.x),
  // Page numbers sit inside the frame, just above its bottom line.
  pageNumberBottomShare: share(1 - HOME_BOOK_ARTWORK_FRAME.bottom + 0.012),
})

// Horizontal padding of a left page that takes `pageShare` of the book width,
// as shares of the book width: CSS percentage padding of a flex item resolves
// against its container — the whole book row — not against the page itself.
function getHomeBookLeftPagePaddingShares(pageShare) {
  return {
    start: HOME_BOOK_GEOMETRY.leftPageStartShare,
    end: share(Math.max(0, pageShare - HOME_BOOK_GEOMETRY.leftPageEndShare)),
  }
}

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

module.exports = { HOME_BOOK_GEOMETRY, getHomeBookLeftPagePaddingShares, getHomeBookWidthLimit, getHomeBookWidth, resolveHomeBookGeometry, getHomeBookTypeScale, getHomeBookPageMetrics }
