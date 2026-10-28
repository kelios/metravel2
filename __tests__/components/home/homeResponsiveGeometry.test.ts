import { buildHomeBookGeometryCSS } from '@/components/home/homeBookGeometryCss';
import { HOME_BOOK_GEOMETRY } from '@/components/home/homeBookGeometry';
import fs from 'node:fs';
import path from 'node:path';

const { buildHomeResponsiveCss } = require('@/scripts/lib/homeResponsiveCss');
const { START_MARKER, END_MARKER, renderHomeResponsiveCssRegion } = require('@/scripts/generate-home-responsive-css');
const HOME_RESPONSIVE_WEB_CSS = buildHomeResponsiveCss();

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

it('ships exactly the canonical generated region in the root stylesheet', () => {
  const stylesheet = fs.readFileSync(path.resolve(__dirname, '../../../app/global.css'), 'utf8');
  expect(stylesheet.split(START_MARKER)).toHaveLength(2);
  expect(stylesheet.split(END_MARKER)).toHaveLength(2);
  expect(renderHomeResponsiveCssRegion(stylesheet)).toBe(stylesheet);
  expect(stylesheet.slice(stylesheet.indexOf(START_MARKER) + START_MARKER.length, stylesheet.indexOf(END_MARKER)).trim())
    .toBe(HOME_RESPONSIVE_WEB_CSS.trim());
});

it('repairs only its generated region and rejects ambiguous or reordered ownership', () => {
  const prefix = 'html{color:var(--color-text)}\n\n';
  const canonical = renderHomeResponsiveCssRegion(prefix);
  expect(canonical.startsWith(prefix)).toBe(true);
  expect(renderHomeResponsiveCssRegion(canonical)).toBe(canonical);
  expect(renderHomeResponsiveCssRegion(`${prefix}${START_MARKER}\nstale\n${END_MARKER}\n`)).toBe(canonical);
  expect(() => renderHomeResponsiveCssRegion(`${prefix}${START_MARKER}`)).toThrow('markers');
  expect(() => renderHomeResponsiveCssRegion(`${canonical}body{margin:0}`)).toThrow('last');
  expect(() => renderHomeResponsiveCssRegion(canonical + canonical)).toThrow('markers');
});
