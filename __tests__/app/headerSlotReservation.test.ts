/**
 * #1144: место под шапку резервируется медиазапросом, а не догадкой JS.
 *
 * Статический HTML один на все вьюпорты, поэтому до гидрации React обязан считать
 * вариант шапки десктопным (иначе hydration mismatch, #418). Раньше из-за этого
 * мобильный первый экран резервировал 78 px вместо реальных 116 px, и после
 * гидрации весь `main` уезжал вниз на 38 px.
 *
 * Замер прода 2026-07-30 (`/travels/ourvietnam`, 412×823, 4× CPU / 1.6 Мбит/с):
 *   t=9172 ms  MAIN#travel-main-content  y 78 → 116   value 0.1508
 *   суммарный CLS 0.1665 при бюджете 0.1
 * Контекст-строка при этом монтировалась только на t≈10 046 ms — то есть сдвиг давала
 * именно неверно зарезервированная высота, а не появление самой строки.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');
const css: string = fs.readFileSync(path.join(REPO_ROOT, 'app', 'global.css'), 'utf-8');
const layout: string = fs.readFileSync(
  path.join(REPO_ROOT, 'app', '(tabs)', '_layout.tsx'),
  'utf-8',
);

const readFallback = (variant: string): number => {
  const block = /HEADER_HEIGHT_FALLBACK[^{]*\{([\s\S]*?)\}/.exec(layout);
  expect(block).toBeTruthy();
  const row = new RegExp(`'${variant}':\\s*(\\d+)`).exec(block![1]);
  expect(row).toBeTruthy();
  return Number(row![1]);
};

describe('резервирование высоты шапки', () => {
  it('в CSS есть правило слота и мобильный медиазапрос', () => {
    expect(css).toMatch(/\[data-header-slot\]\s*\{[^}]*height:\s*var\(--mt-header-slot-desktop/);
    expect(css).toMatch(
      /@media\s*\(max-width:\s*767px\)\s*\{\s*\[data-header-slot\]\s*\{[^}]*var\(--mt-header-slot-mobile/,
    );
  });

  it('CSS-фолбэки совпадают с HEADER_HEIGHT_FALLBACK', () => {
    const desktopFallback = /--mt-header-slot-desktop,\s*(\d+)px/.exec(css);
    const mobileFallback = /--mt-header-slot-mobile,\s*(\d+)px/.exec(css);
    expect(desktopFallback).toBeTruthy();
    expect(mobileFallback).toBeTruthy();
    expect(Number(desktopFallback![1])).toBe(readFallback('desktop-nobar'));
    expect(Number(mobileFallback![1])).toBe(readFallback('mobile-bar'));
  });

  it('layout прокидывает обе переменные из одного источника правды', () => {
    expect(layout).toContain("'--mt-header-slot-mobile'");
    expect(layout).toContain("'--mt-header-slot-desktop'");
    expect(layout).toMatch(/shouldShowHeaderContextBar\(pathname \|\| '\/', true\)/);
  });

  it('инлайновая высота ставится только после реального измерения', () => {
    // `useHydrationReady` переключается ещё ДО первого кадра, поэтому гидрации мало:
    // инлайн с «десктопной» догадкой снова успел бы отрисоваться на мобильном.
    expect(layout).toMatch(/hasMeasuredHeight \? \{ height: measuredHeight \} : null/);
    expect(layout).not.toMatch(/hydrationReady \? \{ height: measuredHeight \}/);
    expect(layout).toContain('setHasMeasuredHeight(true)');
  });
});
