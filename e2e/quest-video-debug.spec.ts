// e2e/quest-video-debug.spec.ts
// Детальная отладка загрузки видео в квестах
import { test, expect } from '@playwright/test';

test.describe('Quest Video Debug', () => {
    test('should debug video loading step by step', async ({ page }) => {
        const logs: string[] = [];

        // Собираем все логи
        page.on('console', (msg) => {
            const text = msg.text();
            logs.push(`[${msg.type()}] ${text}`);
            console.log(`[BROWSER ${msg.type()}] ${text}`);
        });

        page.on('pageerror', (error) => {
            console.error('[PAGE ERROR]', error.message);
            logs.push(`[ERROR] ${error.message}`);
        });

        // Переходим на страницу квестов
        console.log('\n=== Step 1: Navigate to /quests ===');
        await page.goto('/quests', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('domcontentloaded');
        await Promise.race([
            page.locator('a[href*="/quests/"]').first().waitFor({ state: 'visible', timeout: 10000 }),
            page.locator('text=/ошибка|Internal Server Error|Failed to load quests|не удалось загрузить/i').first().waitFor({ state: 'visible', timeout: 10000 }),
        ]).catch(() => null);

        // Делаем скриншот
        await page.screenshot({ path: 'playwright-screenshots/quest-list.png', fullPage: true });

        // Ищем квест "Краков"
        console.log('\n=== Step 2: Find Krakow quest ===');
        const questLinks = await page.locator('a[href*="/quests/"]').all();
        console.log(`Found ${questLinks.length} quest links`);

        let krakowLink = null;
        for (const link of questLinks) {
            const text = await link.textContent();
            const href = await link.getAttribute('href');
            console.log(`Quest link: ${text} -> ${href}`);
            if (href?.includes('krakow') || text?.toLowerCase().includes('краков') || text?.toLowerCase().includes('krakow')) {
                krakowLink = link;
                break;
            }
        }

        if (!krakowLink) {
            console.log('Krakow quest not found, using first quest');
            krakowLink = questLinks[0];
        }

        if (!krakowLink) {
            test.skip(true, 'No quests found on /quests page');
            return;
        }

        // Переходим на страницу квеста
        console.log('\n=== Step 3: Open quest ===');
        await Promise.all([
            page.waitForURL(/\/quests\//, { timeout: 10000 }),
            krakowLink.click(),
        ]);
        await page.waitForLoadState('domcontentloaded');
        await expect(page).toHaveURL(/\/quests\//);
        await page.screenshot({ path: 'playwright-screenshots/quest-page.png', fullPage: true });

        // Проверяем наличие кнопки "Финал"
        console.log('\n=== Step 4: Check for Finale button ===');
        const finaleButton = page.locator('text=/Финал/i');
        const finaleCount = await finaleButton.count();
        console.log(`Finale buttons found: ${finaleCount}`);

        if (finaleCount === 0) {
            console.log('No finale button - checking if quest needs completion');
            
            // Проверяем, есть ли шаги квеста
            const stepButtons = await page.locator('[role="button"], button, a').all();
            console.log(`Found ${stepButtons.length} interactive elements`);

            // Ищем кнопку "Начать" или "Старт"
            const startButton = page.locator('text=/Начать|Старт|Start/i').first();
            if (await startButton.count() > 0) {
                console.log('Found start button, clicking...');
                await startButton.click();
                await page.waitForTimeout(1000);
            }

            // Проверяем снова
            const finaleAfterStart = await page.locator('text=/Финал/i').count();
            console.log(`Finale buttons after start: ${finaleAfterStart}`);
        }

        // Кликаем на финал
        console.log('\n=== Step 5: Click Finale ===');
        const finalButton = page.locator('text=/Финал/i').first();
        if (await finalButton.count() > 0) {
            await finalButton.click();
            await page.waitForTimeout(2000);
            await page.screenshot({ path: 'playwright-screenshots/quest-finale.png', fullPage: true });

            // Проверяем наличие видео
            console.log('\n=== Step 6: Check for video element ===');
            const videoElements = await page.locator('video, iframe[src*="youtube"]').all();
            console.log(`Video elements found: ${videoElements.length}`);

            if (videoElements.length > 0) {
                const video = videoElements[0];
                const tagName = await video.evaluate(el => el.tagName.toLowerCase());
                console.log(`Video element type: ${tagName}`);

                if (tagName === 'video') {
                    const videoInfo = await video.evaluate((v: HTMLVideoElement) => ({
                        src: v.src,
                        currentSrc: v.currentSrc,
                        readyState: v.readyState,
                        networkState: v.networkState,
                        error: v.error ? {
                            code: v.error.code,
                            message: v.error.message
                        } : null,
                        videoWidth: v.videoWidth,
                        videoHeight: v.videoHeight,
                    }));

                    console.log('\n=== Video Info ===');
                    console.log(JSON.stringify(videoInfo, null, 2));

                    // Ждем загрузки метаданных
                    await page.waitForTimeout(3000);

                    const finalVideoInfo = await video.evaluate((v: HTMLVideoElement) => ({
                        src: v.src,
                        readyState: v.readyState,
                        error: v.error ? {
                            code: v.error.code,
                            message: v.error.message
                        } : null,
                    }));

                    console.log('\n=== Final Video Info ===');
                    console.log(JSON.stringify(finalVideoInfo, null, 2));
                }
            } else {
                console.log('No video elements found in finale');
                
                // Проверяем, что вообще есть на странице
                const pageContent = await page.content();
                const hasVideoText = pageContent.includes('video') || pageContent.includes('Video');
                console.log(`Page contains "video" text: ${hasVideoText}`);
            }
        } else {
            console.log('Finale button not available');
        }

        // Выводим все собранные логи
        console.log('\n=== All Browser Logs ===');
        const questLogs = logs.filter(log => 
            log.includes('[Quest]') || 
            log.includes('[WebVideo]') || 
            log.includes('[QuestWizard]')
        );
        questLogs.forEach(log => console.log(log));

        // Проверяем наличие ошибок
        const errors = logs.filter(log => log.includes('[error]') || log.includes('[ERROR]'));
        if (errors.length > 0) {
            console.log('\n=== Errors Found ===');
            errors.forEach(err => console.log(err));
        }
    });
});
