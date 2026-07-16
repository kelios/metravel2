import { test, expect } from './fixtures';
import {
  preacceptCookies,
  gotoWithRetry,
  waitForMainListRender,
  openFallbackTravelDetails,
} from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

/**
 * WCAG 2.1 AA regression gate using axe-core (injected from node_modules, no
 * extra dependency). The previously-known debt (aria-allowed-attr on the
 * favorite button, aria-required-attr on the gallery slider, and one
 * low-contrast country label) has been fixed, so this gate now enforces zero
 * violations. Any new violation category fails the test.
 */
const AXE_PATH = require.resolve('axe-core/axe.min.js');
// All previously-tracked debt is resolved — the gate enforces zero. If a new,
// hard-to-fix violation appears, add its rule id here with a tracking note.
const KNOWN_DEBT = new Set<string>([]);

type Violation = { id: string; impact: string | null; nodes: number; targets: string[] };

async function runAxe(page: import('@playwright/test').Page): Promise<Violation[]> {
  await page.addScriptTag({ path: AXE_PATH });
  return page.evaluate(async () => {
    // @ts-expect-error axe is injected on window by addScriptTag
    const result = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
    });
    return result.violations.map((v: any) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 3).map((node: any) => node.target.join(' ')),
    }));
  });
}

function assertNoNewViolations(violations: Violation[], label: string) {
  const unexpected = violations.filter((v) => !KNOWN_DEBT.has(v.id));
  expect(
    unexpected,
    `New WCAG violations on ${label}: ${JSON.stringify(unexpected)}`
  ).toEqual([]);

  const known = violations.filter((v) => KNOWN_DEBT.has(v.id));
  if (known.length > 0) {
    test.info().annotations.push({
      type: 'a11y-known-debt',
      description: `${label}: ${known.map((v) => `${v.id}×${v.nodes}`).join(', ')}`,
    });
  }
}

test.describe('Accessibility (WCAG 2.1 AA) — no regressions', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('travels list', async ({ page }) => {
    await preacceptCookies(page);
    await gotoWithRetry(page, getTravelsListPath());
    await waitForMainListRender(page);
    assertNoNewViolations(await runAxe(page), 'travels list');
  });

  test('search page', async ({ page }) => {
    await preacceptCookies(page);
    await gotoWithRetry(page, '/search');
    await page.waitForTimeout(2500);
    assertNoNewViolations(await runAxe(page), 'search');
  });

  test('travel detail', async ({ page }) => {
    await preacceptCookies(page);
    expect(await openFallbackTravelDetails(page)).toBe(true);
    await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 20_000 });
    assertNoNewViolations(await runAxe(page), 'travel detail');
  });
});

test.describe('Accessibility — keyboard', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('first Tab reveals a working skip link to main content', async ({ page }) => {
    await preacceptCookies(page);
    await gotoWithRetry(page, getTravelsListPath());
    await waitForMainListRender(page);

    await page.evaluate(() => {
      document.body.setAttribute('tabindex', '-1');
      document.body.focus();
      document.body.removeAttribute('tabindex');
    });
    await page.keyboard.press('Tab');

    const focusedElement = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      return {
        label: element?.getAttribute('aria-label') || '',
        role: element?.getAttribute('role') || '',
        html: element?.outerHTML.slice(0, 500) || '<none>',
      };
    });
    expect(focusedElement, `first Tab focused ${focusedElement.html}`).toMatchObject({
      label: 'Перейти к основному содержимому',
      role: 'link',
    });
    await page.keyboard.press('Enter');

    const activeAfterSkip = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      return { id: element?.id || '', html: element?.outerHTML.slice(0, 500) || '<none>' };
    });
    expect(activeAfterSkip.id, `skip activation focused ${activeAfterSkip.html}`).toBe('main-content');
  });

  test('keyboard focus reaches an interactive control with a visible focus ring', async ({ page }) => {
    await preacceptCookies(page);
    await gotoWithRetry(page, getTravelsListPath());
    await waitForMainListRender(page);

    // Start from a known point, then walk the tab order.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    let reachedInteractive = false;
    let hadFocusRing = false;

    for (let i = 0; i < 20; i += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const role = el.getAttribute('role');
        const tag = el.tagName.toLowerCase();
        const tabindex = el.getAttribute('tabindex');
        const interactive =
          ['a', 'button', 'input', 'select', 'textarea'].includes(tag) ||
          role === 'button' ||
          role === 'link' ||
          (tabindex != null && tabindex !== '-1');
        const s = window.getComputedStyle(el);
        const focusRing =
          (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) ||
          (s.boxShadow !== 'none' && s.boxShadow.length > 0);
        return { interactive, focusRing };
      });

      if (info?.interactive) {
        reachedInteractive = true;
        if (info.focusRing) {
          hadFocusRing = true;
          break;
        }
      }
    }

    expect(reachedInteractive, 'Tab never reached an interactive control').toBe(true);
    expect(hadFocusRing, 'Focused interactive control had no visible focus ring').toBe(true);
  });
});
