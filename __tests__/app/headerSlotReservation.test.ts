/**
 * #1144/#1298: место под шапку резервируется медиазапросом, а не догадкой JS.
 *
 * Статический HTML один на все вьюпорты, но до первого кадра CSS обязан выбрать
 * тот же band, что и runtime header: mobile <768, compact 768–1279, wide >=1280.
 */
const fs = require('fs');
const path = require('path');

import {
  HEADER_HEIGHT_FALLBACK,
  HEADER_MEDIA_MAX_WIDTHS,
  getHeaderVariantForBand,
  getHeaderViewportBand,
} from '@/components/layout/headerLayoutContract';
import { buildCriticalCSS } from '@/utils/criticalCSSBuilder';

const REPO_ROOT = path.resolve(__dirname, '../..');
const globalCss: string = fs.readFileSync(
  path.join(REPO_ROOT, 'app', 'global.css'),
  'utf-8',
);
const layout: string = fs.readFileSync(
  path.join(REPO_ROOT, 'app', '(tabs)', '_layout.tsx'),
  'utf-8',
);
const criticalCss = buildCriticalCSS();

describe('резервирование высоты шапки', () => {
  it('выбирает высоту слота в тех же critical-CSS полосах, что и CustomHeader', () => {
    expect(criticalCss).toContain(
      '[data-header-slot=""]{height:var(--mt-header-slot-wide,78px)',
    );
    expect(criticalCss).toContain(
      `@media (max-width:${HEADER_MEDIA_MAX_WIDTHS.compact}px){\n  [data-header-slot=""]{height:var(--mt-header-slot-compact,64px)}`,
    );
    expect(criticalCss).toContain(
      `@media (max-width:${HEADER_MEDIA_MAX_WIDTHS.mobile}px){\n  [data-header-slot=""]{height:var(--mt-header-slot-mobile,64px)}`,
    );
    // `CustomHeader` also owns `data-header-slot="nav|account"`; a presence-only
    // selector would leak the outer reservation into those inner flex items.
    expect(criticalCss).not.toMatch(/(?:^|\n)\s*\[data-header-slot\]\s*\{/);
  });

  it.each([
    [412, 'mobile', 64],
    [768, 'compact', 64],
    [1152, 'compact', 64],
    [1279, 'compact', 64],
    [1280, 'wide', 78],
  ] as const)('держит no-bar matrix на %ipx: %s / %ipx', (width, band, height) => {
    expect(getHeaderViewportBand(width)).toBe(band);
    expect(HEADER_HEIGHT_FALLBACK[getHeaderVariantForBand(band, false)]).toBe(height);
  });

  it('учитывает разную геометрию context row в трёх полосах', () => {
    expect(HEADER_HEIGHT_FALLBACK['mobile-bar']).toBe(116);
    expect(HEADER_HEIGHT_FALLBACK['compact-bar']).toBe(110);
    expect(HEADER_HEIGHT_FALLBACK['wide-bar']).toBe(124);
  });

  it('layout прокидывает три переменные из одного источника правды', () => {
    expect(layout).toContain("'--mt-header-slot-mobile'");
    expect(layout).toContain("'--mt-header-slot-compact'");
    expect(layout).toContain("'--mt-header-slot-wide'");
    expect(layout).toContain("heightForBand('compact', hasCompactContextBar)");
  });

  it('global CSS не может вернуть старый breakpoint 768 для высоты слота', () => {
    expect(globalCss).not.toMatch(/\[data-header-slot(?:="")?\]\s*\{[^}]*height:/);
    expect(globalCss).not.toMatch(/\[data-header-slot\]\s*\{/);
  });

  it('critical slot reservation не блокирует inline-высоту после измерения', () => {
    const slotRules = criticalCss
      .split('\n')
      .filter((line) => line.includes('[data-header-slot=""]{height:'));

    expect(slotRules).toHaveLength(3);
    expect(slotRules.every((line) => !line.includes('!important'))).toBe(true);
  });

  it('не принимает interim onLayout до готовности гидрации', () => {
    expect(layout).toMatch(/if \(!hydrationReady \|\| h <= 0\) return/);
  });

  it('инлайновая высота ставится только после реального измерения', () => {
    // `useHydrationReady` переключается ещё ДО первого кадра, поэтому гидрации мало:
    // инлайн с «десктопной» догадкой снова успел бы отрисоваться на мобильном.
    expect(layout).toMatch(/hasMeasuredHeight \? \{ height: measuredHeight \} : null/);
    expect(layout).not.toMatch(/hydrationReady \? \{ height: measuredHeight \}/);
    expect(layout).toContain('setHasMeasuredHeight(true)');
  });
});
