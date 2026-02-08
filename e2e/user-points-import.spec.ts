import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';
import JSZip from 'jszip';

type MockPoint = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  color: string;
  status: string;
  category: string;
  source: string;
};

test.describe('User points import (mock API)', () => {
  async function openFiltersPanelTab(page: any) {
    const legacyTabButton = page.getByTestId('userpoints-panel-tab-filters').first();
    const segmentedTabButton = page.getByTestId('segmented-filters').first();
    const searchBox = page.getByRole('textbox', { name: 'Поиск по названию...' });

    for (let attempt = 0; attempt < 3; attempt++) {
      const tabButton = (await segmentedTabButton.count()) > 0 ? segmentedTabButton : legacyTabButton;
      await tabButton.click({ timeout: 30_000, force: true }).catch(() => undefined);
      await tabButton.evaluate((el: any) => (el as HTMLElement)?.click?.()).catch(() => undefined);
      await page.waitForTimeout(150);

      if ((await searchBox.count()) > 0) {
        await expect(searchBox).toBeVisible({ timeout: 5_000 });
        return;
      }
    }

    await expect(searchBox).toBeVisible({ timeout: 30_000 });
  }

  async function openImportWizard(page: any) {
    // Open actions menu
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.waitForTimeout(150);

    // The userpoints screen is map-first; actions live in the list header.
    // The header is rendered inside the "Фильтры" tab of the side panel.
    await openFiltersPanelTab(page);
    await expect(page.getByTestId('userpoints-actions-open')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('userpoints-actions-open').click({ force: true });

    const actionsDialog = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('button', { name: 'Выбрать точки', exact: true }) })
      .first();
    await actionsDialog.waitFor({ state: 'visible', timeout: 30_000 });

    await actionsDialog.getByRole('button', { name: 'Импорт', exact: true }).click();

    // ImportWizard modal
    await expect(page.getByText('Импорт точек', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  }

  async function uploadViaFileChooser(page: any, absoluteFilePath: string) {
    // Under parallel load the filechooser event can be delayed.
    // Retry up to 2 times to handle transient timing issues.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const [chooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 15_000 }),
          page.getByText('Импорт точек', { exact: true }).last().click(),
        ]);
        await chooser.setFiles(absoluteFilePath);
        return;
      } catch {
        if (attempt === 2) throw new Error(`File chooser did not open after 3 attempts for ${absoluteFilePath}`);
        await page.waitForTimeout(500);
      }
    }
  }

  async function createTempKmzWithDocKml(kmlText: string): Promise<string> {
    const zip = new JSZip();
    zip.file('doc.kml', kmlText);
    const content = await zip.generateAsync({ type: 'nodebuffer' });
    const p = path.join(os.tmpdir(), `metravel-e2e-${Date.now()}-${Math.floor(Math.random() * 100000)}.kmz`);
    fs.writeFileSync(p, content);
    return p;
  }

  const formats = [
    {
      name: 'JSON',
      filePath: () => path.resolve(process.cwd(), 'e2e/fixtures/user-points-sample.json'),
    },
    {
      name: 'KML',
      filePath: () => path.resolve(process.cwd(), 'e2e/fixtures/user-points-sample.kml'),
    },
    {
      name: 'GeoJSON',
      filePath: () => path.resolve(process.cwd(), 'e2e/fixtures/user-points-sample.geojson'),
    },
    {
      name: 'GPX',
      filePath: () => path.resolve(process.cwd(), 'e2e/fixtures/user-points-sample.gpx'),
    },
    {
      name: 'KMZ',
      filePath: async () => {
        const kml = fs.readFileSync(path.resolve(process.cwd(), 'e2e/fixtures/user-points-sample.kml'), 'utf8');
        return createTempKmzWithDocKml(kml);
      },
    },
  ] as const;

  for (const fmt of formats) {
    test(`import wizard supports ${fmt.name}`, async ({ page }) => {
      const points: MockPoint[] = [];

      await page.route('**/api/user-points/**', async (route) => {
        const req = route.request();
        const url = req.url();
        const method = req.method().toUpperCase();

        if (method === 'GET' && /\/api\/user-points\/?(\?.*)?$/.test(url)) {
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(points) });
        }

        if (method === 'POST' && /\/api\/user-points\/import\/?$/.test(url)) {
          return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ created: 1, updated: 0, skipped: 0, errors: [] }),
          });
        }

        return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Unhandled mock route' }) });
      });

      await preacceptCookies(page);
      await page.goto('/userpoints', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('userpoints-screen')).toBeVisible({ timeout: 30_000 });

      await openImportWizard(page);

      const absolutePath = await fmt.filePath();
      await uploadViaFileChooser(page, absolutePath);

      await expect(page.getByText('Предпросмотр данных', { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/Найдено точек:\s*\d+/)).toBeVisible({ timeout: 30_000 });

      await page.getByText('Импортировать', { exact: true }).click({ timeout: 30_000 });

      await expect(page.getByText('Импорт завершен!', { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/Создано:\s*1/)).toBeVisible({ timeout: 30_000 });

      await page.getByText('Готово', { exact: true }).click({ timeout: 30_000 });

      if (fmt.name === 'KMZ') {
        try {
          fs.unlinkSync(absolutePath);
        } catch {
          // ignore
        }
      }
    });
  }
});
