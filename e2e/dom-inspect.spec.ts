import { test } from './fixtures';
import { getTravelsListPath } from './helpers/routes';

test('DOM structure inspection', async ({ page }) => {
  await page.goto(getTravelsListPath(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await Promise.race([
    page.waitForSelector('#search-input', { timeout: 30_000 }),
    page.waitForSelector('[data-testid="travel-card-link"], [data-testid="travel-card-skeleton"], [data-testid="list-travel-skeleton"]', {
      timeout: 30_000,
    }),
    page.waitForSelector('text=Пока нет путешествий', { timeout: 30_000 }),
    page.waitForSelector('text=Найдено:', { timeout: 30_000 }),
    page.waitForSelector('text=Пиши о своих путешествиях', { timeout: 30_000 }),
  ]);
  
  // Output full DOM structure
  const html = await page.content();
  console.log('Full DOM:', html);
  
  // Check for header specifically
  const header = await page.$('[data-testid="travel-wizard-header"]');
  console.log('Header exists:', !!header);
  
  if (header) {
    console.log('Header height:', await header.evaluate((el: HTMLElement) => el.offsetHeight));
  }
});
