import { expect, test } from './fixtures';
import { preacceptCookies } from './helpers/navigation';

/**
 * #3467: касание во время гидратации обязано гидратировать только свой путь.
 *
 * React синхронно догидратирует Suspense-границы на пути к цели дискретного
 * события — это норма. Дефект — когда во время этого синхронного прохода
 * меняется состояние или контекст НАД ещё не гидратированными границами
 * (ROUTE_NAMES_CHANGED навигатора, контекст темы, любой новый провайдер):
 * тогда React обязан догидратировать их все тем же синхронным приоритетом, и
 * вся страница гидратируется внутри обработчика первого тапа (INP 450–850 мс
 * на mobile, GSC держал /travels в «нужно ускорить»).
 *
 * Проверка не зависит от скорости машины: считаем границы Suspense,
 * гидратированные внутри обработчика `pointerdown`, хуком React DevTools
 * (он работает и в прод-сборке). Нажатие на шапку — граница страницы лежит
 * вне его пути и должна остаться на обычную, нарезанную гидратацию.
 */

type CascadeStats = {
  hydratedInTap: number;
  hydratedTotal: number;
  tapStarted: boolean;
  /** Не гидратированных границ в момент нажатия; -1 — до первого коммита (гидратация ещё идёт). */
  pendingAtTap: number;
  pendingAfter: number;
};

async function installCascadeProbe(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const stats = { hydratedInTap: 0, hydratedTotal: 0, tapStarted: false, pendingAtTap: -1, pendingAfter: -1 };
    (window as any).__tapCascade = stats;
    let inTap = false;
    let committed = false;
    const dehydrated = new Set<unknown>();
    window.addEventListener('pointerdown', () => {
      inTap = true;
      stats.tapStarted = true;
      stats.pendingAtTap = committed ? dehydrated.size : -1;
    }, { capture: true });
    window.addEventListener('pointerdown', () => { inTap = false; });
    (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      isDisabled: false,
      supportsFiber: true,
      renderers: new Map(),
      inject() { return 1; },
      checkDCE() {},
      onScheduleFiberRoot() {},
      onCommitFiberUnmount() {},
      onPostCommitFiberRoot() {},
      onCommitFiberRoot(_id: number, root: any) {
        const current = new Set<unknown>();
        const stack = [root.current];
        while (stack.length) {
          const fiber = stack.pop();
          // tag 13 = SuspenseComponent; memoizedState.dehydrated — ещё серверная разметка.
          if (fiber.tag === 13 && fiber.memoizedState?.dehydrated) {
            current.add(fiber.memoizedState.dehydrated);
            dehydrated.add(fiber.memoizedState.dehydrated);
          }
          for (let child = fiber.child; child; child = child.sibling) stack.push(child);
        }
        for (const node of Array.from(dehydrated)) {
          if (current.has(node)) continue;
          dehydrated.delete(node);
          stats.hydratedTotal += 1;
          if (inTap) stats.hydratedInTap += 1;
        }
        stats.pendingAfter = current.size;
        committed = true;
      },
    };
  });
}

test.describe('@perf hydration: tap does not hydrate the whole page (#3467)', () => {
  test('header tap during hydration leaves off-path boundaries to sliced hydration', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'CPU throttling needs CDP');
    await preacceptCookies(page);
    await installCascadeProbe(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await page.goto('/about', { waitUntil: 'domcontentloaded' });
    const header = await page.locator('[data-testid="main-header"]').first().boundingBox();
    expect(header, 'server-rendered header is present before hydration').not.toBeNull();
    // Только pointerdown: дефект живёт в его обработчике, а click по ссылке шапки увёл бы со страницы.
    await page.mouse.move(header!.x + header!.width / 2, header!.y + Math.min(20, header!.height / 2));
    await page.mouse.down();
    await page.waitForFunction(() => (window as any).__tapCascade?.pendingAfter === 0, null, { timeout: 30_000 });
    await page.mouse.up();

    const stats: CascadeStats = await page.evaluate(() => (window as any).__tapCascade);
    test.info().annotations.push({ type: 'hydration', description: JSON.stringify(stats) });
    expect(stats.tapStarted).toBe(true);
    test.skip(stats.pendingAtTap === 0, 'tap landed after hydration finished; nothing to assert on this machine');
    expect(stats.hydratedTotal).toBeGreaterThan(1);
    expect(
      stats.hydratedInTap,
      'a tap must not force every dehydrated boundary to hydrate synchronously inside its handler',
    ).toBeLessThan(stats.hydratedTotal);
  });
});
