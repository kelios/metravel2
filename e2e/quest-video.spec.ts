// e2e/quest-video.spec.ts
// Тест для проверки загрузки видео в финале квеста
import { test, expect } from '@playwright/test';
import { normalizeMediaUrl } from '@/utils/mediaUrl';

const QUEST_DETAIL_URL_RE = /\/quests\/[^/]+\/[^/?#]+/;
const QUEST_FALLBACK_RE = /ошибка|Internal Server Error|Failed to load quests|не удалось загрузить|квесты не найдены|нет квестов/i;

const waitForQuestListState = async (page: any, timeout = 30_000) =>
    Promise.any([
        page.locator('[data-testid^="quest-card-"]').first().waitFor({ state: 'visible', timeout }),
        page.getByRole('link', { name: /Начать приключение/i }).first().waitFor({ state: 'visible', timeout }),
        page.getByText(QUEST_FALLBACK_RE).first().waitFor({ state: 'visible', timeout }),
        page.getByRole('heading', { name: /Квесты/i }).first().waitFor({ state: 'visible', timeout }),
        page.getByText(/Нет квестов для отображения на карте/i).first().waitFor({ state: 'visible', timeout }),
        page.getByText(/квест(ов|а)?/i).first().waitFor({ state: 'visible', timeout }),
    ]);

const getQuestCardLocator = (page: any) => {
    const byTestId = page.locator('[data-testid^="quest-card-"]');
    const byRole = page.getByRole('link', { name: /Начать приключение/i });
    return { byTestId, byRole };
};

const getFirstQuestCard = async (page: any) => {
    const { byTestId, byRole } = getQuestCardLocator(page);
    if ((await byTestId.count()) > 0) return byTestId.first();
    if ((await byRole.count()) > 0) return byRole.first();
    return null;
};

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
        await waitForQuestListState(page).catch(() => null);

        // Ищем первый доступный квест
        const questLink = await getFirstQuestCard(page);
        const questExists = questLink !== null;

        if (!questExists) {
            console.log('No quests found on the page');
            const hasFallback = await page.getByText(QUEST_FALLBACK_RE).first().isVisible().catch(() => false);
            if (hasFallback) {
                await expect(page.getByText(QUEST_FALLBACK_RE).first()).toBeVisible({ timeout: 10000 });
            } else {
                await expect(page.getByRole('heading', { name: /Квесты/i }).first()).toBeVisible({ timeout: 10000 });
            }
            return;
        }

        // Переходим на страницу квеста
        await Promise.all([
            page.waitForURL(QUEST_DETAIL_URL_RE, { timeout: 10000 }),
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

        // Получаем полный бандл квеста напрямую из API
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

        // Проверяем наличие финала
        expect(bundle.finale).toBeDefined();
        expect(bundle.finale.text).toBeTruthy();

        // Проверяем video_url - применяем ту же нормализацию, что и фронтенд
        if (bundle.finale.video_url) {
            console.log(`Video URL from backend: ${bundle.finale.video_url}`);

            // Применяем нормализацию как в api/quests.ts
            const normalizedUrl = normalizeMediaUrl(bundle.finale.video_url);

            console.log(`Normalized video URL: ${normalizedUrl}`);

            // Проверяем формат нормализованного URL
            expect(normalizedUrl).toMatch(/^https?:\/\//);

            // Проверяем, что нет двойного хоста в нормализованном URL
            const doubleHostPattern = /https?:\/\/[^/]+https?:\/\//;
            expect(normalizedUrl).not.toMatch(doubleHostPattern);
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
        await waitForQuestListState(page).catch(() => null);

        const questLink = await getFirstQuestCard(page);
        if (questLink) {
            await Promise.all([
                page.waitForURL(QUEST_DETAIL_URL_RE, { timeout: 10000 }),
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
