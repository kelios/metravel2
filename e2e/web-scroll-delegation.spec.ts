import type { Page } from '@playwright/test';

import { test, expect } from './fixtures';
import { preacceptCookies } from './helpers/navigation';

/**
 * #1615: оболочка веба пришпилена ко вьюпорту, длинный контент живёт во
 * внутреннем `overflow-y:auto` экрана. Всё, что лежит вне этой колонки —
 * глобальная шапка, шапка экрана, нижний док, десктопный футер — было мёртвой
 * зоной: колесо и свайп там не двигали ни документ, ни контент.
 *
 * Регрессия проверяет пользовательский контракт, а не реализацию: настоящее
 * событие колеса (и настоящий свайп на mobile web) в ЛЮБОЙ точке экрана обязано
 * сдвинуть текущий экран. Программный `element.scrollTo` заменой не считается.
 */

const ROUTES = ['/quests', '/search', '/travelsby'] as const;

/**
 * #2154: каталог готов к пробе, когда отрисованы САМИ карточки, а не просто
 * появился длинный контент. На /travelsby до прихода результатов SEO-интро
 * живёт в отдельной области прокрутки (`cards-scroll-container`), и при
 * появлении карточек владелец прокрутки меняется, обнуляя позицию (#2179) —
 * проба в этой фазе мерила бы переходный экран.
 */
const CONTENT_READY: Record<(typeof ROUTES)[number], string> = {
    '/quests': '[data-testid^="quest-card-"]',
    '/search': '[data-testid="travel-row-1"]',
    '/travelsby': '[data-testid="travel-row-1"]',
};

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };

type Probe = { name: string; x: number; y: number };

function probesFor(width: number, height: number): Probe[] {
    return [
        { name: 'shell-header', x: Math.round(width / 2), y: 18 },
        { name: 'screen-chrome', x: Math.round(width / 2), y: 90 },
        { name: 'left-band', x: Math.round(width * 0.12), y: Math.round(height * 0.5) },
        { name: 'content', x: Math.round(width * 0.62), y: Math.round(height * 0.55) },
        { name: 'bottom-chrome', x: Math.round(width / 2), y: height - 10 },
    ];
}

/**
 * Насколько экран уехал вниз: максимум по документу и всем реально
 * прокручиваемым областям. Индекс-независимо — набор скролл-контейнеров на
 * каталоге меняется по мере догрузки карточек.
 */
async function readScrollSignal(page: Page): Promise<number> {
    return page.evaluate(() => {
        let max = window.scrollY;
        document.querySelectorAll('*').forEach((el) => {
            const cs = getComputedStyle(el);
            const scrollsY = cs.overflowY === 'auto' || cs.overflowY === 'scroll';
            if (scrollsY && el.scrollHeight - el.clientHeight > 40 && el.scrollTop > max) max = el.scrollTop;
            // Горизонтальная полка законно забирает колесо себе (useHorizontalScroll):
            // экран двигается, просто вбок — это не мёртвая зона.
            const scrollsX = cs.overflowX === 'auto' || cs.overflowX === 'scroll';
            if (scrollsX && el.scrollWidth - el.clientWidth > 40 && el.scrollLeft > max) max = el.scrollLeft;
        });
        return max;
    });
}

/**
 * Запас прокрутки у основного владельца — по тому же определению, что и в
 * оболочке: прокручиваемая область под характерными точками вьюпорта. Именно
 * его отсутствие (а не «где-то на странице есть длинный блок») означает, что
 * прокручивать экрану нечего.
 */
async function readPrimaryOwnerExtent(page: Page): Promise<number> {
    return page.evaluate(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const probes: Array<[number, number]> = [
            [w / 2, h / 2], [w / 2, h * 0.72], [w * 0.75, h * 0.5], [w * 0.25, h * 0.5],
        ];
        let best = 0;
        for (const [x, y] of probes) {
            for (const hit of document.elementsFromPoint(Math.round(x), Math.round(y))) {
                let el: Element | null = hit;
                let ownerFound = false;
                while (el) {
                    const cs = getComputedStyle(el);
                    const extent = el.scrollHeight - el.clientHeight;
                    if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && extent > 1) {
                        if (extent > best) best = extent;
                        ownerFound = true;
                        break;
                    }
                    el = el.parentElement;
                }
                if (ownerFound) break;
            }
        }
        return Math.max(best, document.documentElement.scrollHeight - document.documentElement.clientHeight);
    });
}

/**
 * #2154: следующее колесо помечается на window — после обработчика оболочки
 * видно, делегировал ли он жест (`defaultPrevented`). Нужен только для
 * диагностики упавшей пробы.
 */
async function watchNextWheel(page: Page): Promise<void> {
    await page.evaluate(() => {
        const w = window as Window & { __e2eLastWheel?: unknown };
        w.__e2eLastWheel = null;
        window.addEventListener(
            'wheel',
            (event) => {
                w.__e2eLastWheel = {
                    defaultPrevented: event.defaultPrevented,
                    target: (event.target as Element | null)?.getAttribute?.('data-testid') ?? (event.target as Element | null)?.tagName ?? null,
                };
            },
            { once: true },
        );
    });
}

/** Что видела проба, когда экран не сдвинулся: для разбора без перезапуска. */
async function readScrollDiagnostics(page: Page): Promise<Record<string, unknown>> {
    return page.evaluate(() => {
        const scrollers: Array<{ testId: string | null; top: number; extent: number }> = [];
        document.querySelectorAll('*').forEach((el) => {
            const cs = getComputedStyle(el);
            if (cs.overflowY !== 'auto' && cs.overflowY !== 'scroll') return;
            const extent = el.scrollHeight - el.clientHeight;
            if (extent > 40) scrollers.push({ testId: el.getAttribute('data-testid'), top: el.scrollTop, extent });
        });
        return {
            delegation: document.documentElement.getAttribute('data-scroll-delegation'),
            windowScrollY: window.scrollY,
            scrollers,
            lastWheel: (window as Window & { __e2eLastWheel?: unknown }).__e2eLastWheel ?? 'not delivered',
        };
    });
}

/**
 * Сброс с временным снятием `scroll-behavior: smooth`: у колонки каталога
 * квестов он стоит в CSS, и обычное присваивание scrollTop анимировалось бы,
 * из-за чего следующий замер стартовал бы посреди анимации.
 */
async function resetScroll(page: Page): Promise<void> {
    await page.evaluate(() => {
        document.querySelectorAll('*').forEach((el) => {
            const cs = getComputedStyle(el);
            const scrollsY = cs.overflowY === 'auto' || cs.overflowY === 'scroll';
            // Полки обнуляются наравне с колонками: сигнал считает и scrollLeft,
            // и уехавшая вбок полка иначе держала бы его положительным на все
            // последующие пробы — проверка позеленела бы при вернувшемся дефекте.
            const scrollsX = cs.overflowX === 'auto' || cs.overflowX === 'scroll';
            if (!scrollsY && !scrollsX) return;
            const node = el as HTMLElement;
            const previous = node.style.scrollBehavior;
            node.style.scrollBehavior = 'auto';
            if (scrollsY) node.scrollTop = 0;
            if (scrollsX) node.scrollLeft = 0;
            node.style.scrollBehavior = previous;
        });
        window.scrollTo(0, 0);
    });
    // Сброс считается сделанным, когда сигнал реально вернулся в ноль, а не
    // через фиксированную паузу (#2154): иначе следующая проба под нагрузкой
    // стартует с ненулевой прокрутки или посреди догрузки каталога.
    await expect.poll(() => readScrollSignal(page), { message: 'прокрутка не вернулась в ноль после сброса' }).toBe(0);
}

async function openCatalog(page: Page, route: (typeof ROUTES)[number]): Promise<void> {
    await preacceptCookies(page);
    await page.goto(route, { waitUntil: 'load' });

    // До гидрации делегирования нет вовсе, и любая проба по хрому «докажет»
    // мёртвую зону, которой уже не существует. Гейт — собственный признак
    // готовности контракта, а не таймаут.
    await page.waitForSelector('html[data-scroll-delegation="on"]', { timeout: 45000 });
    await page.locator(CONTENT_READY[route]).first().waitFor({ state: 'visible', timeout: 45000 });

    // И каталог должен быть наполнен: прокручивать нечего, пока карточки не
    // пришли, а список ещё и «дышит» — скелетоны сменяются карточками. Отделяет
    // дефект контракта от тонких данных окружения: без длинного контента проба
    // ничего не доказывает и обязана падать своим текстом.
    // Владелец должен быть УСТОЙЧИВ: список каталога доезжает рывками, и между
    // двумя соседними кадрами прокручиваемой области может не быть вовсе.
    // Устойчивость — минимум двух соседних замеров poll (шаг 400 мс), а не сон
    // внутри замера (#2154).
    let previousExtent = 0;
    await expect
        .poll(
            async () => {
                const current = await readPrimaryOwnerExtent(page);
                const stable = Math.min(previousExtent, current);
                previousExtent = current;
                return stable;
            },
            {
                intervals: [400],
                timeout: 45000,
                message: `${route}: в этом окружении нет длинного контента, проба прокрутки бессмысленна`,
            },
        )
        .toBeGreaterThan(400);

    await resetScroll(page);
}

function assertRouteScrollsEverywhere(route: (typeof ROUTES)[number], viewport: { width: number; height: number }) {
    test(`${route} прокручивается колесом в любой точке экрана`, async ({ page }) => {
        await openCatalog(page, route);

        const dead: string[] = [];
        const diagnostics: unknown[] = [];
        for (const probe of probesFor(viewport.width, viewport.height)) {
            await page.mouse.move(probe.x, probe.y);
            await watchNextWheel(page);
            await page.mouse.wheel(0, 600);
            // Контракт #1615 — колесо сдвигает экран в момент жеста. Ждём сам
            // сдвиг, а не фиксированные 500 мс (#2154): нативная прокрутка
            // контента асинхронна, а на /travelsby до прихода карточек владелец
            // прокрутки — интро, и смена владельца потом обнуляет позицию
            // (продуктовая #2179) — разовое чтение через паузу видело этот откат
            // как мёртвую зону. Настоящая мёртвая зона держит сигнал в нуле
            // весь бюджет expect и попадает в список.
            const waitError = await expect
                .poll(() => readScrollSignal(page))
                .toBeGreaterThan(0)
                .then(
                    () => null,
                    // eslint-disable-next-line no-control-regex
                    (error: Error) => error.message.replace(/\u001b\[\d+m/g, '').split('\n')[0],
                );
            if (waitError) {
                dead.push(`${probe.name} (${probe.x},${probe.y})`);
                const readStartedAt = Date.now();
                const signalNow = await readScrollSignal(page);
                diagnostics.push({
                    probe: probe.name,
                    waitError,
                    signalNow,
                    signalReadMs: Date.now() - readStartedAt,
                    ...(await readScrollDiagnostics(page)),
                });
            }
            await resetScroll(page);
        }

        expect(
            dead,
            `Мёртвые зоны прокрутки на ${route}: ${dead.join(', ')}\n${JSON.stringify(diagnostics, null, 2)}`,
        ).toEqual([]);
    });
}

test.describe('Web scroll: единый владелец прокрутки экрана @smoke', () => {
    test.describe('desktop 1280x900', () => {
        test.use({ viewport: DESKTOP });
        for (const route of ROUTES) assertRouteScrollsEverywhere(route, DESKTOP);
    });

    test.describe('mobile web 390x844', () => {
        test.use({ viewport: MOBILE, hasTouch: true, isMobile: true });
        for (const route of ROUTES) assertRouteScrollsEverywhere(route, MOBILE);

        test('/quests: вертикальный свайп по шапке двигает каталог', async ({ page }) => {
            await openCatalog(page, '/quests');

            // Настоящие touch-события через CDP: шапка лежит вне колонки
            // контента, и без делегирования свайп по ней не двигает ничего.
            const cdp = await page.context().newCDPSession(page);
            const x = MOBILE.width / 2;
            const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', y: number) =>
                cdp.send('Input.dispatchTouchEvent', {
                    type,
                    touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
                });

            await send('touchStart', 40);
            for (let y = 36; y >= 4; y -= 8) await send('touchMove', y);
            await send('touchEnd', 4);

            await expect.poll(() => readScrollSignal(page)).toBeGreaterThan(0);
        });
    });
});
