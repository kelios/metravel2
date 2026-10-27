import { buildHomeBookGeometryCSS } from '@/components/home/homeBookGeometryCss';
import { HOME_BOOK_GEOMETRY } from '@/components/home/homeBookGeometry';
import { HOME_RESPONSIVE_WEB_CSS } from '@/components/home/HomeResponsiveStyles.web';

it('uses the same parameterized geometry for the old shell and the visible responsive document', () => {
  const { buildHomeBookSkeletonGeometryCSS } = require('@/scripts/ssg-home-book-css');
  expect(buildHomeBookSkeletonGeometryCSS()).toBe(buildHomeBookGeometryCSS());
  const selectors = { book: '[data-book]', page: '[data-page]', title: '[data-title]', subtitle: '[data-sub]', week: '[data-week]' };
  const css = buildHomeBookGeometryCSS(selectors, { important: true });
  expect(css).not.toContain('.ssg-home-');
  expect(css).toContain(`calc(100vh - ${HOME_BOOK_GEOMETRY.viewportReserve}px)`);
  expect(css).toContain(`calc(100vw - ${HOME_BOOK_GEOMETRY.horizontalReserve}px)`);
  expect(css).toContain(`height:var(--home-book-height)!important`);
  expect(css).toContain('max(24px,min(');
  expect(css).toContain('max(12px,min(');
  for (const cap of [1200, 1360, 1520]) expect(css).toContain(`),${cap}px)!important`);
});

it('reserves the complete left-page scroll and real promo/media geometry before JavaScript', () => {
  expect(HOME_RESPONSIVE_WEB_CSS).toContain('overflow-y:auto!important');
  expect(HOME_RESPONSIVE_WEB_CSS).toContain('aspect-ratio:3/2!important');
  expect(HOME_RESPONSIVE_WEB_CSS).toContain('[data-home-quest-grid]>*:nth-child(n+5){display:none!important}');
  expect(HOME_RESPONSIVE_WEB_CSS).toContain('@media(min-width:768px)');
  expect(HOME_RESPONSIVE_WEB_CSS).toContain('@media(min-width:770px) and (max-width:1279.98px)');
  expect(HOME_RESPONSIVE_WEB_CSS).toContain('--home-scroll-end:calc(max(');
  expect(HOME_RESPONSIVE_WEB_CSS).toContain('[data-home-primary-action]{display:none!important}');
  expect(HOME_RESPONSIVE_WEB_CSS).toContain('grid-column:1/-1!important;grid-row:2!important');
});
