import { test } from './fixtures';
import {
  preacceptCookies,
  gotoWithRetry,
  waitForMainListRender,
  openFallbackTravelDetails,
} from './helpers/navigation';
import { getTravelsListPath } from './helpers/routes';

const AXE_PATH = require.resolve('axe-core/axe.min.js');

type AxeWindow = Window & {
  axe: {
    run: (
      context: Document,
      options: { runOnly: { type: 'tag'; values: string[] } },
    ) => Promise<{ violations: any[] }>;
  };
};

async function dump(page: any, label: string) {
  await page.addScriptTag({ path: AXE_PATH });
  const results = await page.evaluate(async () => {
    const r = await (window as AxeWindow).axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
    });
    return r.violations.map((v: any) => ({
      id: v.id,
      nodes: v.nodes.slice(0, 4).map((n: any) => ({
        target: n.target,
        failure: n.failureSummary,
        html: String(n.html).slice(0, 260),
      })),
    }));
  });
  console.log(`\n===== ${label} =====\n` + JSON.stringify(results, null, 2));
}

test.describe('a11y nodes', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('list', async ({ page }) => {
    await preacceptCookies(page);
    await gotoWithRetry(page, getTravelsListPath());
    await waitForMainListRender(page);
    await dump(page, 'list');
  });

  test('detail', async ({ page }) => {
    await preacceptCookies(page);
    const ok = await openFallbackTravelDetails(page);
    if (!ok) return;
    await page.waitForTimeout(1500);
    await dump(page, 'detail');
  });
});
