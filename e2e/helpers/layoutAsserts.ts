import { expect, type Locator, type Page } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };

function intersectionArea(a: Box, b: Box): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const w = x2 - x1;
  const h = y2 - y1;
  return w > 0 && h > 0 ? w * h : 0;
}

export async function expectNoOverlap(
  elementA: Locator,
  elementB: Locator,
  opts?: { allowTouchingEdges?: boolean; labelA?: string; labelB?: string }
) {
  const allowTouchingEdges = opts?.allowTouchingEdges ?? true;
  const labelA = opts?.labelA ?? 'elementA';
  const labelB = opts?.labelB ?? 'elementB';

  const [a, b] = await Promise.all([elementA.boundingBox(), elementB.boundingBox()]);
  expect(a, `${labelA} must have a bounding box (visible in layout)`).not.toBeNull();
  expect(b, `${labelB} must have a bounding box (visible in layout)`).not.toBeNull();
  if (!a || !b) return;

  const area = intersectionArea(a, b);

  if (allowTouchingEdges) {
    // If edges only touch (area === 0), it's fine.
    expect(area, `${labelA} must not overlap ${labelB} (intersectionArea=${area})`).toBe(0);
  } else {
    // Disallow even touching edges by checking ordering with a 1px gap.
    const separated =
      a.x + a.width < b.x ||
      b.x + b.width < a.x ||
      a.y + a.height < b.y ||
      b.y + b.height < a.y;
    expect(separated, `${labelA} must not overlap/touch ${labelB}`).toBeTruthy();
  }
}

export async function expectFullyInViewport(
  element: Locator,
  page: Page,
  opts?: { margin?: number; label?: string }
) {
  const margin = opts?.margin ?? 1;
  const label = opts?.label ?? 'element';

  const box = await element.boundingBox();
  expect(box, `${label} must have a bounding box (visible in layout)`).not.toBeNull();
  if (!box) return;

  const vp = page.viewportSize();
  expect(vp, 'viewportSize must be set for expectFullyInViewport').toBeTruthy();
  if (!vp) return;

  expect(box.x, `${label} must not start off-screen (left). x=${box.x}`).toBeGreaterThanOrEqual(-margin);
  expect(box.y, `${label} must not start off-screen (top). y=${box.y}`).toBeGreaterThanOrEqual(-margin);
  expect(
    box.x + box.width,
    `${label} must not overflow viewport (right). right=${box.x + box.width}, viewportW=${vp.width}`
  ).toBeLessThanOrEqual(vp.width + margin);
  expect(
    box.y + box.height,
    `${label} must not overflow viewport (bottom). bottom=${box.y + box.height}, viewportH=${vp.height}`
  ).toBeLessThanOrEqual(vp.height + margin);
}

export async function expectNoHorizontalScroll(page: Page) {
  const res = await page.evaluate(() => {
    const docEl = document.documentElement;
    const body = document.body;
    const docScrollWidth = docEl?.scrollWidth ?? 0;
    const docClientWidth = docEl?.clientWidth ?? 0;
    const bodyScrollWidth = body?.scrollWidth ?? 0;
    const bodyClientWidth = body?.clientWidth ?? 0;

    return {
      docScrollWidth,
      docClientWidth,
      bodyScrollWidth,
      bodyClientWidth,
      docOverflowX: getComputedStyle(docEl).overflowX,
      bodyOverflowX: getComputedStyle(body).overflowX,
    };
  });

  expect(
    res.docScrollWidth,
    `documentElement has horizontal overflow: scrollWidth=${res.docScrollWidth} clientWidth=${res.docClientWidth} overflowX=${res.docOverflowX}`
  ).toBeLessThanOrEqual(res.docClientWidth);

  expect(
    res.bodyScrollWidth,
    `body has horizontal overflow: scrollWidth=${res.bodyScrollWidth} clientWidth=${res.bodyClientWidth} overflowX=${res.bodyOverflowX}`
  ).toBeLessThanOrEqual(res.bodyClientWidth);
}

export async function expectTopmostAtCenter(page: Page, element: Locator, label: string) {
  const box = await element.boundingBox();
  expect(box, `${label} must have a bounding box`).not.toBeNull();
  if (!box) return;

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  const hit = await page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      if (!el) return null;
      return {
        tag: el.tagName,
        testId: el.getAttribute('data-testid'),
        ariaLabel: el.getAttribute('aria-label'),
        role: el.getAttribute('role'),
        id: el.id,
        className: el.className,
      };
    },
    { x: cx, y: cy }
  );

  // We can't reliably match a specific node (RNW wrappers), so we just require that
  // the hit node is within the element subtree.
  const contains = await element.evaluate((el, point) => {
    const hit = document.elementFromPoint(point.x, point.y);
    return hit ? el.contains(hit) : false;
  }, { x: cx, y: cy });

  expect(contains, `${label} must be topmost/clickable at its center. elementFromPoint hit=${JSON.stringify(hit)}`).toBeTruthy();
}
