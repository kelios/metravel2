import { test, expect } from './fixtures';

test('debug login robots meta', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  
  // Check immediately
  const immediate = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="robots"]');
    return meta ? meta.getAttribute('content') : 'NOT FOUND';
  });
  console.log('Immediate:', immediate);
  
  // Wait 5s for hydration
  await page.waitForTimeout(5000);
  const after5s = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="robots"]');
    return meta ? meta.getAttribute('content') : 'NOT FOUND';
  });
  console.log('After 5s:', after5s);
  
  // Wait 15s total
  await page.waitForTimeout(10000);
  const after15s = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="robots"]');
    return meta ? meta.getAttribute('content') : 'NOT FOUND';
  });
  console.log('After 15s:', after15s);
  
  // Check title
  const title = await page.title();
  console.log('Title:', title);
  
  // Check URL
  console.log('URL:', page.url());
});
