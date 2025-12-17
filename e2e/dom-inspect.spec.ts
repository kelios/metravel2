import { test, expect } from '@playwright/test';

test('DOM structure inspection', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  
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
