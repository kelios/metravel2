import type { Page } from '@playwright/test';

import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';

/**
 * #2179: SEO-интро `/travelsby` читается до прихода карточек. Пока результаты
 * не пришли, интро жило в своей области прокрутки (`cards-scroll-container`),
 * а с приходом карточек владельцем прокрутки становился список — и экран
 * прыгал наверх. Контракт: у каталога один владелец прокрутки во всех фазах
 * загрузки, поэтому приход карточек не сдвигает то, что человек читает.
 *
 * Медленная сеть воспроизводится задержкой ответа списка через `page.route`;
 * прокрутка — настоящим колесом, не программным `scrollTo`.
 */

const INTRO = '[data-testid="belarus-travel-seo-hub"]';
const FIRST_ROW = '[data-testid="travel-row-1"]';
const WHEEL_DELTA = 600;
/** Сколько смотреть на экран после появления карточек (Task Contract #2179). */
const OBSERVE_AFTER_RESULTS_MS = 1000;

const VIEWPORTS = [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
] as const;

const isTravelListRequest = (url: URL) => /\/api\/travels\/?$/.test(url.pathname);

/** Прокрутка экрана: максимум по документу и прокручиваемым областям (как в web-scroll-delegation). */
async function readScrollSignal(page: Page): Promise<number> {
    return page.evaluate(() => {
        let max = window.scrollY;
        document.querySelectorAll('*').forEach((el) => {
            const cs = getComputedStyle(el);
            const scrollsY = cs.overflowY === 'auto' || cs.overflowY === 'scroll';
            if (scrollsY && el.scrollHeight - el.clientHeight > 40 && el.scrollTop > max) max = el.scrollTop;
        });
        return max;
    });
}

/** Запас прокрутки у ближайшей прокручиваемой области под точкой (x, y). */
async function readScrollExtentAt(page: Page, x: number, y: number): Promise<number> {
    return page.evaluate(
        ({ px, py }) => {
            let el: Element | null = document.elementFromPoint(px, py);
            while (el) {
                const cs = getComputedStyle(el);
                if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') return el.scrollHeight - el.clientHeight;
                el = el.parentElement;
            }
            return 0;
        },
        { px: x, py: y },
    );
}

type Samples = {
    frames: number;
    framesWithResults: number;
    framesWithoutIntro: number;
    minSignalAfterResults: number;
    maxIntroShift: number;
};

/**
 * Покадровое наблюдение внутри страницы (rAF), пока карточки не простоят
 * на экране `observeMs`: минимальная прокрутка и наибольший сдвиг интро
 * относительно положения до прихода результатов.
 */
async function observeResultsArrival(page: Page, introTopBefore: number): Promise<Samples> {
    return page.evaluate(
        ({ introSelector, rowSelector, observeMs, introTop }) =>
            new Promise<Samples>((resolve) => {
                const readSignal = () => {
                    let max = window.scrollY;
                    document.querySelectorAll('*').forEach((el) => {
                        const cs = getComputedStyle(el);
                        const scrollsY = cs.overflowY === 'auto' || cs.overflowY === 'scroll';
                        if (scrollsY && el.scrollHeight - el.clientHeight > 40 && el.scrollTop > max) max = el.scrollTop;
                    });
                    return max;
                };
                const stats: Samples = {
                    frames: 0,
                    framesWithResults: 0,
                    framesWithoutIntro: 0,
                    minSignalAfterResults: Number.POSITIVE_INFINITY,
                    maxIntroShift: 0,
                };
                let resultsSince: number | null = null;
                const tick = (now: number) => {
                    stats.frames += 1;
                    const intro = document.querySelector(introSelector);
                    if (!intro) stats.framesWithoutIntro += 1;
                    else stats.maxIntroShift = Math.max(stats.maxIntroShift, Math.abs(intro.getBoundingClientRect().top - introTop));
                    if (document.querySelector(rowSelector)) {
                        if (resultsSince === null) resultsSince = now;
                        stats.framesWithResults += 1;
                        stats.minSignalAfterResults = Math.min(stats.minSignalAfterResults, readSignal());
                        if (now - resultsSince >= observeMs) {
                            resolve(stats);
                            return;
                        }
                    }
                    requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            }),
        { introSelector: INTRO, rowSelector: FIRST_ROW, observeMs: OBSERVE_AFTER_RESULTS_MS, introTop: introTopBefore },
    );
}

test.describe('/travelsby: прокрутка интро переживает приход карточек (#2179)', () => {
    for (const viewport of VIEWPORTS) {
        test(`${viewport.name} ${viewport.width}x${viewport.height}`, async ({ page }) => {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await preacceptCookies(page);

            let releaseResults!: () => void;
            const resultsGate = new Promise<void>((resolve) => {
                releaseResults = resolve;
            });
            await page.route(isTravelListRequest, async (route) => {
                await resultsGate;
                await route.continue().catch(() => undefined);
            });

            await page.goto('/travelsby', { waitUntil: 'load' });
            await page.waitForSelector('html[data-scroll-delegation="on"]', { timeout: 45000 });
            const intro = page.locator(INTRO).first();
            await intro.waitFor({ state: 'visible', timeout: 45000 });
            await expect(page.locator(FIRST_ROW), 'карточки уже пришли — задержка ответа списка не сработала').toHaveCount(0);

            const box = await intro.boundingBox();
            expect(box, 'у интро нет геометрии').not.toBeNull();
            const x = Math.round(box!.x + box!.width / 2);
            const y = Math.round(Math.min(box!.y + box!.height / 2, viewport.height * 0.6));
            // Колесо крутится, когда под курсором уже есть что прокручивать:
            // до этого область интро ещё не выросла, и жест честно ничего не двигает.
            await expect
                .poll(() => readScrollExtentAt(page, x, y), { message: 'под интро нет прокручиваемой области' })
                .toBeGreaterThan(WHEEL_DELTA);
            await page.mouse.move(x, y);
            await page.mouse.wheel(0, WHEEL_DELTA);

            await expect
                .poll(() => readScrollSignal(page), { message: 'колесо над интро не сдвинуло экран до прихода карточек' })
                .toBeGreaterThan(0);
            // Позиция «до» — устойчивая: два соседних замера poll совпали.
            let previous = -1;
            await expect
                .poll(async () => {
                    const current = await readScrollSignal(page);
                    const stable = current === previous;
                    previous = current;
                    return stable;
                })
                .toBe(true);
            const signalBefore = previous;
            const introTopBefore = (await intro.boundingBox())!.y;

            const observation = observeResultsArrival(page, introTopBefore);
            releaseResults();
            const samples = await observation;

            const report = JSON.stringify({ signalBefore, introTopBefore, ...samples });
            expect(samples.framesWithResults, `карточки не появились: ${report}`).toBeGreaterThan(0);
            expect(samples.framesWithoutIntro, `интро пропадало с экрана: ${report}`).toBe(0);
            expect(samples.minSignalAfterResults, `прокрутка сбросилась после прихода карточек: ${report}`).toBeGreaterThanOrEqual(signalBefore);
            expect(samples.maxIntroShift, `интро сдвинулось при приходе карточек: ${report}`).toBeLessThanOrEqual(1);
        });
    }
});
