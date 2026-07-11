import { test, expect } from '@playwright/test';

test.describe('Production Media Loading Smoke Test', () => {
  const prodUrl = 'https://metravel.by';
  
  // Storage for results
  const results = {
    travelImages: [] as any[],
    articleCovers: [] as any[],
    avatars: [] as any[],
    icons: [] as any[],
    consoleErrors: [] as any[],
    networkErrors: [] as any[],
  };

  test('Check travel cards on homepage', async ({ page }) => {
    const imageFailures: any[] = [];
    const consoleMessages: any[] = [];

    page.on('response', (response) => {
      if (response.request().resourceType() === 'image' && !response.ok()) {
        imageFailures.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
        });
      }
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
          location: msg.location(),
        });
      }
    });

    await page.goto(`${prodUrl}/`, { waitUntil: 'networkidle' });

    // Check travel cards images
    const travelImages = await page.$$eval('img[src*="travel-image"]', (elements) => {
      return elements.map((el) => ({
        src: el.getAttribute('src'),
        alt: el.getAttribute('alt'),
        width: el.getAttribute('width'),
        height: el.getAttribute('height'),
        loading: el.getAttribute('loading'),
      }));
    });

    results.travelImages = travelImages;
    console.log(`✅ Found ${travelImages.length} travel images on homepage`);
    travelImages.slice(0, 3).forEach((img) => {
      console.log(`  - ${img.src?.substring(0, 80)}...`);
    });

    expect(travelImages.length).toBeGreaterThan(0);

    // Check for failed images
    if (imageFailures.length > 0) {
      console.log(`❌ Image load failures: ${imageFailures.length}`);
      imageFailures.forEach((fail) => {
        console.log(`  - ${fail.status} ${fail.url.substring(0, 80)}`);
      });
    }
    results.networkErrors.push(...imageFailures);

    if (consoleMessages.length > 0) {
      console.log(`⚠️ Console errors: ${consoleMessages.length}`);
      consoleMessages.forEach((msg) => {
        console.log(`  - ${msg.text.substring(0, 100)}`);
      });
    }
    results.consoleErrors.push(...consoleMessages);
  });

  test('Check article/travel detail page media', async ({ page }) => {
    const imageFailures: any[] = [];
    const consoleMessages: any[] = [];
    const mediaLog: any[] = [];

    page.on('response', (response) => {
      const url = response.url();
      if (response.request().resourceType() === 'image') {
        mediaLog.push({
          url,
          status: response.status(),
          ok: response.ok(),
        });
        if (!response.ok()) {
          imageFailures.push({
            url,
            status: response.status(),
          });
        }
      }
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      }
    });

    // Navigate to a known travel detail
    await page.goto(`${prodUrl}/travels/krakov-karer-zakshuvek`, { waitUntil: 'networkidle' });

    // Get all images on the page
    const allImages = await page.$$eval('img', (elements) => {
      return elements.map((el) => ({
        src: el.getAttribute('src'),
        alt: el.getAttribute('alt'),
        type: el.getAttribute('class')?.includes('cover') ? 'cover' : 'content',
      }));
    });

    console.log(`\n📸 Travel Detail Page Images`);
    console.log(`Total images loaded: ${allImages.length}`);
    console.log(`Network requests for images: ${mediaLog.length}`);

    const successful = mediaLog.filter((m) => m.ok);
    const failed = mediaLog.filter((m) => !m.ok);

    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);

    if (failed.length > 0) {
      console.log('\nFailed image loads:');
      failed.forEach((f) => {
        console.log(`  - ${f.status}: ${f.url.substring(0, 100)}`);
      });
    }

    // Check gallery images
    const galleryImages = await page.$$eval('img[alt*="gallery"], img[alt*="slideshow"]', (elements) => {
      return elements.map((el) => ({
        src: el.getAttribute('src'),
        alt: el.getAttribute('alt'),
      }));
    });

    if (galleryImages.length > 0) {
      console.log(`\n🎞️ Gallery images: ${galleryImages.length}`);
      galleryImages.slice(0, 2).forEach((img) => {
        console.log(`  - ${img.src?.substring(0, 80)}`);
      });
    }

    results.networkErrors.push(...imageFailures);
    results.consoleErrors.push(...consoleMessages);
  });

  test('Check travel catalog with various images', async ({ page }) => {
    const imageFailures: any[] = [];
    const mediaUrls: Set<string> = new Set();

    page.on('response', (response) => {
      const url = response.url();
      if (response.request().resourceType() === 'image') {
        mediaUrls.add(url);
        if (!response.ok()) {
          imageFailures.push({
            url,
            status: response.status(),
            statusText: response.statusText(),
          });
        }
      }
    });

    await page.goto(`${prodUrl}/travels?perPage=12`, { waitUntil: 'networkidle' });

    console.log(`\n🗺️ Travel Catalog Media Check`);
    console.log(`Total unique image URLs: ${mediaUrls.size}`);
    console.log(`✅ Successful loads: ${mediaUrls.size - imageFailures.length}`);
    console.log(`❌ Failed loads: ${imageFailures.length}`);

    // Group failures by error code
    const failuresByCode = imageFailures.reduce((acc, f) => {
      if (!acc[f.status]) acc[f.status] = [];
      acc[f.status].push(f.url);
      return acc;
    }, {} as Record<number, string[]>);

    Object.entries(failuresByCode).forEach(([code, urls]) => {
      console.log(`\nHTTP ${code}: ${urls.length} failures`);
      urls.slice(0, 2).forEach((url) => {
        console.log(`  - ${url.substring(0, 100)}`);
      });
    });

    results.networkErrors.push(...imageFailures);

    // Analyze image paths
    const imagePaths = Array.from(mediaUrls).slice(0, 10);
    console.log(`\n📁 Sample image paths:`);
    imagePaths.forEach((url) => {
      console.log(`  - ${new URL(url).pathname}`);
    });
  });

  test('Check user avatars and author images', async ({ page }) => {
    const imageFailures: any[] = [];

    page.on('response', (response) => {
      if (response.request().resourceType() === 'image' && !response.ok()) {
        imageFailures.push({
          url: response.url(),
          status: response.status(),
        });
      }
    });

    await page.goto(`${prodUrl}/`, { waitUntil: 'networkidle' });

    // Look for avatar-like images
    const avatars = await page.$$eval('img[alt*="avatar"], img[alt*="author"], img[src*="avatar"]', (elements) => {
      return elements.map((el) => ({
        src: el.getAttribute('src'),
        alt: el.getAttribute('alt'),
      }));
    });

    console.log(`\n👤 User/Author Avatars`);
    if (avatars.length > 0) {
      console.log(`Found ${avatars.length} avatar images`);
      avatars.slice(0, 3).forEach((img) => {
        console.log(`  - ${img.src?.substring(0, 80)}`);
      });
    } else {
      console.log('No avatar images found in common patterns');
    }

    results.avatars = avatars;
    results.networkErrors.push(...imageFailures);
  });

  test('Check webp and modern image formats', async ({ page }) => {
    const imageFormats: Record<string, number> = {};
    const failed: any[] = [];

    page.on('response', (response) => {
      const url = response.url();
      if (response.request().resourceType() === 'image') {
        const ext = new URL(url).pathname.split('.').pop()?.toLowerCase() || 'unknown';
        imageFormats[ext] = (imageFormats[ext] || 0) + 1;

        if (!response.ok()) {
          failed.push({
            url,
            status: response.status(),
            format: ext,
          });
        }
      }
    });

    await page.goto(`${prodUrl}/travels/krakov-karer-zakshuvek`, { waitUntil: 'networkidle' });

    console.log(`\n🎨 Image Formats Used`);
    Object.entries(imageFormats)
      .sort(([, a], [, b]) => b - a)
      .forEach(([format, count]) => {
        console.log(`  ${format.toUpperCase()}: ${count}`);
      });

    if (failed.length > 0) {
      console.log(`\n❌ Failed format loads:`);
      failed.forEach((f) => {
        console.log(`  - ${f.format.toUpperCase()} (${f.status}): ${f.url.substring(0, 80)}`);
      });
    }

    results.networkErrors.push(...failed);
  });

  test('Summary report', () => {
    console.log('\n\n========== MEDIA LOADING SMOKE TEST SUMMARY ==========');
    console.log(`Total images checked: ${results.travelImages.length}`);
    console.log(`Network errors: ${results.networkErrors.length}`);
    console.log(`Console errors: ${results.consoleErrors.length}`);

    if (results.networkErrors.length > 0) {
      console.log('\n⚠️ FAILED IMAGES:');
      const grouped = results.networkErrors.reduce((acc, f) => {
        const key = `${f.status || 'unknown'}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(f.url);
        return acc;
      }, {} as Record<string, string[]>);

      Object.entries(grouped).forEach(([code, urls]) => {
        console.log(`\n  HTTP ${code}: ${urls.length} failures`);
        urls.slice(0, 3).forEach((url) => {
          console.log(`    - ${url.substring(0, 100)}`);
        });
      });
    }

    if (results.consoleErrors.length > 0) {
      console.log('\n⚠️ CONSOLE ERRORS:');
      results.consoleErrors.slice(0, 5).forEach((err) => {
        console.log(`  - ${err.text.substring(0, 120)}`);
      });
    }

    console.log('\n====================================================');
  });
});
