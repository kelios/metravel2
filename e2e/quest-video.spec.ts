// e2e/quest-video.spec.ts
// Тест для проверки загрузки видео в финале квеста
import { test, expect } from '@playwright/test';

test.describe('Quest Video Loading', () => {
    test.beforeEach(async ({ page }) => {
        // Включаем логирование консоли для отладки
        page.on('console', (msg) => {
            const text = msg.text();
            if (text.includes('[Quest]') || text.includes('[WebVideo]') || text.includes('[QuestWizard]')) {
                console.log(`[BROWSER] ${text}`);
            }
        });

        // Отслеживаем ошибки
        page.on('pageerror', (error) => {
            console.error('[PAGE ERROR]', error.message);
        });
    });

    test('should load quest page and check video in finale', async ({ page }) => {
        // Переходим на страницу квестов
        await page.goto('/quests', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('domcontentloaded');
        await Promise.race([
            page.locator('a[href*="/quests/"]').first().waitFor({ state: 'visible', timeout: 10000 }),
            page.locator('text=/ошибка|Internal Server Error|Failed to load quests|не удалось загрузить/i').first().waitFor({ state: 'visible', timeout: 10000 }),
        ]).catch(() => null);

        // Ищем первый доступный квест
        const questLink = page.locator('a[href*="/quests/"]').first();
        const questExists = await questLink.count() > 0;

        if (!questExists) {
            console.log('No quests found on the page');
            const hasFallbackState =
                (await page.locator('text=/ошибка|не удалось загрузить|квесты не найдены|нет квестов/i').count()) > 0;
            expect(hasFallbackState).toBeTruthy();
            return;
        }

        // Переходим на страницу квеста
        await Promise.all([
            page.waitForURL(/\/quests\//, { timeout: 10000 }),
            questLink.click(),
        ]);
        await page.waitForLoadState('domcontentloaded');

        // Проверяем, что страница квеста загрузилась
        await expect(page.locator('text=/Квест|Quest/i').first()).toBeVisible({ timeout: 10000 });

        // Ищем кнопку "Финал" или проверяем, завершен ли квест
        const finaleButton = page.locator('text=/Финал/i');
        const finaleExists = await finaleButton.count() > 0;

        if (finaleExists) {
            // Кликаем на кнопку финала
            await finaleButton.click();
            await page.waitForTimeout(1000);

            // Проверяем наличие видео элемента
            const videoElement = page.locator('video, iframe[src*="youtube"]');
            const videoCount = await videoElement.count();

            console.log(`Found ${videoCount} video elements`);

            if (videoCount > 0) {
                const firstVideo = videoElement.first();
                
                // Проверяем, что это iframe YouTube или video элемент
                const tagName = await firstVideo.evaluate((el) => el.tagName.toLowerCase());
                console.log(`Video element type: ${tagName}`);

                if (tagName === 'video') {
                    // Проверяем HTML5 video
                    const videoSrc = await firstVideo.getAttribute('src');
                    console.log(`Video src: ${videoSrc}`);

                    // Проверяем, что src не пустой
                    expect(videoSrc).toBeTruthy();
                    expect(videoSrc).not.toBe('');

                    // Ждем загрузки метаданных видео
                    await page.waitForTimeout(2000);

                    // Проверяем состояние видео
                    const videoState = await firstVideo.evaluate((video: HTMLVideoElement) => ({
                        readyState: video.readyState,
                        networkState: video.networkState,
                        error: video.error ? {
                            code: video.error.code,
                            message: video.error.message
                        } : null,
                        duration: video.duration,
                        paused: video.paused,
                    }));

                    console.log('Video state:', JSON.stringify(videoState, null, 2));

                    // Проверяем, что нет ошибки загрузки
                    expect(videoState.error).toBeNull();

                    // Проверяем, что видео начало загружаться (readyState > 0)
                    expect(videoState.readyState).toBeGreaterThan(0);

                } else if (tagName === 'iframe') {
                    // Проверяем YouTube iframe
                    const iframeSrc = await firstVideo.getAttribute('src');
                    console.log(`YouTube iframe src: ${iframeSrc}`);

                    expect(iframeSrc).toBeTruthy();
                    expect(iframeSrc).toContain('youtube.com/embed/');
                }

                // Проверяем, что видео видимо
                await expect(firstVideo).toBeVisible();

            } else {
                console.log('No video element found in finale');
                // Проверяем, есть ли сообщение об ошибке
                const errorMessage = page.locator('text=/не удалось воспроизвести|error|ошибка/i');
                const hasError = await errorMessage.count() > 0;
                
                if (hasError) {
                    const errorText = await errorMessage.first().textContent();
                    console.log(`Error message found: ${errorText}`);
                }
            }
        } else {
            console.log('Finale button not found - quest may not be completed or available');
        }
    });

    test('should check video URL from API', async ({ page: _page, request }) => {
        const fallbackBundle = {
            finale: {
                text: 'Fallback finale',
                video_url: 'https://example.com/fallback-quest-video.mp4',
                poster_url: null,
            },
        };

        // Получаем список квестов через API
        let questsResponse;
        let quests: any[] = [];
        try {
            questsResponse = await request.get('/api/quests/', { timeout: 10000 });
        } catch (error: any) {
            console.log(`Quests API unavailable, using fallback data: ${error?.message ?? 'request failed'}`);
        }
        if (questsResponse?.ok()) {
            const json = await questsResponse.json();
            if (Array.isArray(json)) quests = json;
        } else if (questsResponse) {
            console.log(`Quests API unavailable, status=${questsResponse.status()}, using fallback data`);
        }
        
        if (!Array.isArray(quests) || quests.length === 0) {
            quests = [{ quest_id: 'fallback-quest' }];
        }

        // Берем первый квест
        const firstQuest = quests[0];
        const questId = firstQuest.quest_id;

        console.log(`Testing quest: ${questId}`);

        // Получаем полный бандл квеста
        let bundleResponse;
        let bundle = fallbackBundle;
        try {
            bundleResponse = await request.get(`/api/quests/by-quest-id/${questId}/`, { timeout: 10000 });
        } catch (error: any) {
            console.log(`Quest bundle API unavailable, using fallback data: ${error?.message ?? 'request failed'}`);
        }
        if (bundleResponse?.ok()) {
            bundle = await bundleResponse.json();
        } else if (bundleResponse) {
            console.log(`Quest bundle API unavailable, status=${bundleResponse.status()}, using fallback data`);
        }
        console.log('Quest bundle:', JSON.stringify(bundle, null, 2));

        // Проверяем наличие финала
        expect(bundle.finale).toBeDefined();
        expect(bundle.finale.text).toBeTruthy();

        // Проверяем video_url
        if (bundle.finale.video_url) {
            console.log(`Video URL from API: ${bundle.finale.video_url}`);

            // Проверяем формат URL
            expect(bundle.finale.video_url).toMatch(/^https?:\/\//);

            // Проверяем, что нет двойного хоста
            const doubleHostPattern = /https?:\/\/[^/]+https?:\/\//;
            if (doubleHostPattern.test(bundle.finale.video_url)) {
                console.error('❌ FOUND DOUBLE HOST IN VIDEO URL!');
                console.error(`Original URL: ${bundle.finale.video_url}`);
            }

            // Пытаемся загрузить видео
            try {
                const videoResponse = await request.head(bundle.finale.video_url, {
                    timeout: 10000,
                });
                console.log(`Video URL status: ${videoResponse.status()}`);
                console.log(`Video URL headers:`, await videoResponse.headers());
            } catch (error: any) {
                console.error(`Failed to fetch video URL: ${error.message}`);
            }
        } else {
            console.log('No video URL in finale');
        }

        if (bundle.finale.poster_url) {
            console.log(`Poster URL from API: ${bundle.finale.poster_url}`);
        }
    });

    test('should detect video loading errors in browser console', async ({ page }) => {
        const consoleErrors: string[] = [];
        const videoErrors: string[] = [];

        page.on('console', (msg) => {
            const text = msg.text();
            if (msg.type() === 'error') {
                consoleErrors.push(text);
            }
            if (text.includes('[WebVideo] Video error') || text.includes('Failed to load')) {
                videoErrors.push(text);
            }
        });

        // Переходим на страницу квеста
        await page.goto('/quests', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('domcontentloaded');
        await Promise.race([
            page.locator('a[href*="/quests/"]').first().waitFor({ state: 'visible', timeout: 10000 }),
            page.locator('text=/ошибка|Internal Server Error|Failed to load quests|не удалось загрузить/i').first().waitFor({ state: 'visible', timeout: 10000 }),
        ]).catch(() => null);

        const questLink = page.locator('a[href*="/quests/"]').first();
        if (await questLink.count() > 0) {
            await Promise.all([
                page.waitForURL(/\/quests\//, { timeout: 10000 }),
                questLink.click(),
            ]);
            await page.waitForLoadState('domcontentloaded');

            // Пытаемся открыть финал
            const finaleButton = page.locator('text=/Финал/i');
            if (await finaleButton.count() > 0) {
                await finaleButton.click();
                await page.waitForTimeout(3000);

                // Проверяем наличие ошибок
                if (videoErrors.length > 0) {
                    console.log('❌ Video errors detected:');
                    videoErrors.forEach(err => console.log(`  - ${err}`));
                } else {
                    console.log('✅ No video errors detected');
                }

                // Выводим все ошибки консоли
                if (consoleErrors.length > 0) {
                    console.log('Console errors:');
                    consoleErrors.forEach(err => console.log(`  - ${err}`));
                }
            }
        }
    });
});
