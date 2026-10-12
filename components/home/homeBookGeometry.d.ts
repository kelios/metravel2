export const HOME_BOOK_GEOMETRY: Readonly<{
  viewportReserve: number; horizontalReserve: number; artworkHeightRatio: number;
  minHeight: number; compactHeight: number; topInsetShare: number; bottomInsetShare: number;
  leftPageStartShare: number; leftPageEndShare: number; rightPageEndShare: number; pageNumberBottomShare: number;
}>
export function getHomeBookLeftPagePaddingShares(pageShare: number): { start: number; end: number }
export function getHomeBookWidthLimit(viewportWidth: number): number
export function getHomeBookWidth(viewportWidth: number): number
export function getHomeBookPageMetrics(viewportWidth: number, height: number): {
  topInset: number; bottomInset: number; usableHeight: number; titleSize: number;
  titleLineHeight: number; subtitleSize: number; subtitleLineHeight: number;
}
export function resolveHomeBookGeometry(viewportWidth: number, viewportHeight: number, measuredWidth?: number): ReturnType<typeof getHomeBookPageMetrics> & { width: number; height: number }
export function buildHomeBookSkeletonGeometryCSS(): string
