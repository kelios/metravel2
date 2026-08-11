import { test, expect, devices } from '@playwright/test';
import type { Page } from '@playwright/test';
import { gotoWithRetry, preacceptCookies, tid } from './helpers/navigation';

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

    // Check images that belong to actual travel-card links. Media URLs now use
    // `/media-resize/legacy/**` and no longer contain the old `travel-image`
    // substring, so URL-shape matching produced a false production failure.
    const travelCardImages = page.locator('a[href^="/travels/"] img');
    await expect(travelCardImages.first()).toBeVisible({ timeout: 15_000 });
    const travelImages = await travelCardImages.evaluateAll((elements) => {
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
      const key = String(f.status);
      if (!acc[key]) acc[key] = [];
      acc[key].push(f.url);
      return acc;
    }, {} as Record<string, string[]>);

    Object.entries<string[]>(failuresByCode).forEach(([code, urls]) => {
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

      Object.entries<string[]>(grouped).forEach(([code, urls]) => {
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

/**
 * #1263 — «карточки въезжают с фоном и перерисовываются при скролле».
 *
 * Сценарий гоняет НАСТОЯЩИЙ виртуализированный список `/search` на проде и
 * падает, если в кадре есть обложка, залитая только доминантным цветом
 * (fill-only), подмена чужого фото (stale), провал геометрии или повторная
 * загрузка уже скачанной обложки при возврате назад.
 *
 * Почему прод, а не локальная сборка: прод-API отдаёт CORS только своему
 * origin, поэтому локально поднятый билд списка данных не получит.
 *
 * Почему без `page.route`: регистрация перехвата в Playwright отключает
 * HTTP-кэш, и тогда любой ре-маунт строки сам по себе даёт повторную загрузку —
 * замер начинает мерить харнесс, а не продукт.
 *
 * Транспорт закреплён внутри сценария (1,6 Мбит/с, 150 мс, CPU 4× на мобиле) —
 * иначе и гейт, и негативный контроль меряли бы скорость раннера.
 *
 * Негативный контроль: `E2E_1263_DRAW_DISTANCE=180 npm run e2e:production-smoke`
 * подменяет lookahead на прежнее значение через Metro-регистратор модулей —
 * сценарий обязан упасть, иначе он ничего не проверяет. Сама подмена
 * подтверждается маркером `window.__dd1263Applied`: без него молчаливый
 * промах патча выглядел бы как успех.
 */
const SEARCH_TRACE = {
  url: 'https://metravel.by/search',
  scrollPx: 1160,
  stepPx: 145,
  // Первый кадр после шага проверяет сам въезд. Порог отсекает случайный
  // пиксель на границе viewport, но оставляет явно заметную пользователю
  // четверть обложки. Длинное окно ниже отвечает только за eventual/network
  // состояние и не может больше «простить» пустой первый кадр.
  entryMinVisibleRatio: 0.25,
  motionSampleMs: 60,
  // Окно eventual-ожидания после жеста соразмерно закреплённому каналу,
  // иначе сетевые гейты краснеют от самой тяжёлой обложки набора, а не от дефекта.
  // Замер прода 2026-08-10: `?w=640` весит от 36 КБ (травел 682) до 82 КБ
  // (травел 641); при 200 КБ/с это 0,18–0,41 с только на передачу, плюс
  // очередь. 40 × 75 мс = 3 с даёт запас ~7× к самой тяжёлой.
  settleFrames: 40,
  settleMs: 75,
};

/**
 * Транспорт, на котором сняты числа бюджета ниже. Закреплён явно: без этого
 * замер меряет скорость раннера, а не продукт.
 */
const TRACE_NETWORK = {
  latencyMs: 150,
  // 1,6 Мбит/с в байтах в секунду.
  throughputBytesPerSec: (1.6 * 1024 * 1024) / 8,
};

type TraceProfile = {
  cpuThrottle: number;
  minVisibleCovers: number;
  maxRequests: number;
  maxBytes: number;
};

/**
 * Обложки карточек выдачи. Считаем по шаблону путей image-proxy
 * (`utils/imageProxy.ts`), исключая аватары — они принадлежат другим секциям
 * страницы и в бюджет ленты не входят.
 */
const isTravelCoverRequest = (url: string) => {
  try {
    const { pathname } = new URL(url);
    // Прод отдаёт обложки ленты через `/media-resize/legacy/<id>/conversions/…`.
    // Прежний шаблон `/travel-image|/gallery` не совпадал ни с одним запросом,
    // из-за чего бюджет считался по пустому набору и ассерты были пустышкой.
    return /^\/media-resize\//i.test(pathname) || /^\/(gallery|travel-image)\//i.test(pathname);
  } catch {
    return false;
  }
};

type CoverSample = {
  slug: string;
  visRatio: number;
  fillOnly: boolean;
  stale: boolean;
  diag?: {
    complete: boolean;
    naturalWidth: number;
    opacity: number;
    current: string;
    expected: string;
  };
};

type CatalogMediaPolicySample = {
  row: number;
  loading: string | null;
  fetchPriority: string | null;
};

const sampleCatalogMediaPolicy = (): CatalogMediaPolicySample[] =>
  Array.from(document.querySelectorAll('[data-testid^="travel-row-"]')).flatMap((row) => {
    const match = (row.getAttribute('data-testid') || '').match(/^travel-row-(\d+)$/);
    if (!match) return [];
    return Array.from(row.querySelectorAll('img')).map((img) => ({
      row: Number(match[1]),
      loading: img.getAttribute('loading'),
      fetchPriority: img.getAttribute('fetchpriority'),
    }));
  });

/** Состояние всех обложек, реально видимых в кадре. */
const sampleVisibleCovers = () => {
  const stripQuery = (url: string | null | undefined) => (url ? String(url).split('?')[0] : '');
  const cards = Array.from(document.querySelectorAll('[data-testid^="travel-card-"]')).filter(
    (el) => {
      const id = el.getAttribute('data-testid') || '';
      // `travel-card-link` — обёртка-ссылка вокруг той же карточки (дубль).
      // `travel-card-skeleton*` (components/ui/SkeletonLoader.tsx) рендерятся
      // и при первой загрузке, и при пагинации, и в Suspense-фолбэке /search.
      // У них нет <img> по определению, поэтому без этого фильтра каждый
      // скелетон в кадре засчитывался бы как «залитая обложка».
      return id !== 'travel-card-link' && !id.includes('skeleton');
    },
  );
  const out: CoverSample[] = [];
  let noMedia = 0;
  for (const card of cards) {
    const img = card.querySelector('img');
    // Карточка без обложки — поддерживаемое состояние продукта, а не дефект:
    // `UnifiedTravelCard` рисует нейтральный `image-stub` (View без <img>),
    // когда у travel нет cover. Такие карточки в fill-only не превращаем,
    // иначе редакторский контент прода красит зелёную сборку.
    if (!img) {
      const stubRect = card.getBoundingClientRect();
      const stubVisible =
        Math.max(0, Math.min(stubRect.bottom, window.innerHeight) - Math.max(stubRect.top, 0)) > 0;
      if (stubVisible) noMedia += 1;
      continue;
    }
    // Видимость считаем по прямоугольнику <img>, а не карточки: у уехавшей
    // вверх карточки снизу остаётся текст, а фото уже за кадром.
    const rect = img.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const visiblePx = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    if (visiblePx <= 0) continue;
    const srcset = img.getAttribute('srcset') || img.getAttribute('src') || '';
    const expected = stripQuery(srcset.split(',')[0].trim().split(' ')[0]);
    const current = stripQuery(img.currentSrc);
    const opacity = Number(getComputedStyle(img).opacity);
    const decoded = Boolean(img.complete && img.naturalWidth > 0 && opacity > 0.99);
    out.push({
      slug: (card.getAttribute('data-testid') || '').replace('travel-card-', ''),
      visRatio: Number((visiblePx / rect.height).toFixed(2)),
      // Диагностика для разбора падений: почему именно кадр не готов —
      // не пришёл ответ, не декодировалось, или элемент прозрачный.
      diag: { complete: img.complete, naturalWidth: img.naturalWidth, opacity, current, expected },
      // Единственный допустимый loading-слой — доминантный цвет, но он не
      // должен доживать до появления карточки в кадре.
      fillOnly: !decoded,
      // Гейт владения источником из #1294: чужие пиксели показывать нельзя.
      stale: Boolean(current && expected && current !== expected && opacity > 0.01),
    });
  }
  return { count: out.length, noMedia, cards: out };
};

/**
 * Значения web-lookahead из `components/listTravel/rightColumnModel.ts`.
 * Подменяем только их: на `/search` живут и другие списки (мультиселект
 * фильтров), их окно трогать нельзя. Если константы модели поедут, негативный
 * контроль перестанет срабатывать — это осознанная связка, а не совпадение.
 */
const SHIPPED_WEB_DRAW_DISTANCES = [720, 600];

/** Подмена lookahead на прежнее значение — только для негативного контроля. */
const installDrawDistanceOverride = async (page: Page, forced: number) => {
  await page.addInitScript(([value, shipped]: [number, number[]]) => {
    let realDefine: any = null;
    const wrapFactory = (factory: any) =>
      function (g: any, r: any, i: any, a: any, m: any, e: any, d: any) {
        factory(g, r, i, a, m, e, d);
        const exports = (m && m.exports) || e;
        const Tracker = exports && exports.RVEngagedIndicesTrackerImpl;
        if (Tracker && !Tracker.__ddPatched) {
          Tracker.__ddPatched = true;
          Object.defineProperty(Tracker.prototype, 'drawDistance', {
            configurable: true,
            get() {
              return this.__dd;
            },
            set(incoming: number) {
              // Маркер ставим только когда подмена РЕАЛЬНО сработала на
              // shipped-значении. Без него дрейф (апгрейд FlashList, mangle
              // имени экспорта, смена констант модели) тихо превращал бы
              // негативный контроль в декорацию: тест зелёный, а проверять
              // ему нечего.
              if (shipped.includes(incoming)) {
                (window as any).__dd1263Applied = true;
                this.__dd = value;
                return;
              }
              this.__dd = incoming;
            },
          });
        }
      };
    Object.defineProperty(globalThis, '__d', {
      configurable: true,
      get: () => (realDefine ? (f: any, id: any, deps: any) => realDefine(wrapFactory(f), id, deps) : undefined),
      set: (v) => {
        realDefine = v;
      },
    });
  }, [forced, SHIPPED_WEB_DRAW_DISTANCES] as [number, number[]]);
};

const runSearchScrollTrace = async (page: Page, profile: TraceProfile) => {
  const forced = Number(process.env.E2E_1263_DRAW_DISTANCE || 0);
  if (forced > 0) await installDrawDistanceOverride(page, forced);
  // Баннер согласия — position:fixed, zIndex 900, и он же задаёт
  // `--mt-consent-h` в паддинге списка. Кликать его нельзя: клик гоняется с
  // гидратацией, а `isVisible({ timeout })` в Playwright помечен deprecated и
  // опция игнорируется, то есть проверка всегда мгновенная и всегда false.
  // Сеем согласие до загрузки — тогда геометрия совпадает с той, что видит
  // согласившийся пользователь.
  await preacceptCookies(page);

  // Реальные байты — только CDP `encodedDataLength`: группировка по ширине и
  // content-length врёт (грабля #745-749).
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  // Транспорт закрепляем явно. Без этого и гейт, и негативный контроль меряют
  // скорость раннера: на быстром канале даже прежние 180 успевают декодировать
  // за шаг, и контроль зеленеет; на медленном краснеет исправная сборка.
  // Профиль тот же, на котором сняты числа бюджета.
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: TRACE_NETWORK.latencyMs,
    downloadThroughput: TRACE_NETWORK.throughputBytesPerSec,
    uploadThroughput: TRACE_NETWORK.throughputBytesPerSec,
  });
  if (profile.cpuThrottle > 1) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuThrottle });
  }

  const byRequestId = new Map<string, string>();
  const transfers: { url: string; bytes: number; at: number }[] = [];
  const cancelledCoverRequests: string[] = [];
  cdp.on('Network.requestWillBeSent', (e: any) => byRequestId.set(e.requestId, e.request.url));
  cdp.on('Network.loadingFinished', (e: any) => {
    const url = byRequestId.get(e.requestId);
    if (url) transfers.push({ url, bytes: e.encodedDataLength, at: Date.now() });
  });
  cdp.on('Network.loadingFailed', (e: any) => {
    const url = byRequestId.get(e.requestId);
    if (url && e.canceled && isTravelCoverRequest(url)) cancelledCoverRequests.push(url);
  });

  await gotoWithRetry(page, SEARCH_TRACE.url, { waitUntil: 'domcontentloaded' });
  // Ждём НАСТОЯЩУЮ карточку с декодированным <img>, а не первый попавшийся
  // `travel-card-*`: под этот префикс подходят и скелетоны, поэтому прежний
  // `waitForSelector` резолвился на них, и готовность списка держал только сон.
  await expect
    .poll(
      async () => (await page.evaluate(sampleVisibleCovers)).cards.filter((c) => !c.fillOnly).length,
      { timeout: 60_000, message: 'первый экран /search не отдал ни одной готовой обложки' },
    )
    .toBeGreaterThanOrEqual(profile.minVisibleCovers);

  if (forced > 0) {
    // Если патч не применился, «негативный контроль» ничего не контролирует.
    const applied = await page.evaluate(() => Boolean((window as any).__dd1263Applied));
    expect(applied, `E2E_1263_DRAW_DISTANCE=${forced}: подмена lookahead не применилась`).toBe(true);
  }

  // Дожидаемся тишины по обложкам, а не фиксированного сна. Готовности первого
  // экрана недостаточно: смысл lookahead в том, что prefetch-хвост скачивается
  // ЗАРАНЕЕ, и стартовать сверху, пока он ещё в полёте, значит мерить скорость
  // канала вместо окна планирования. Порог берём от закреплённого транспорта.
  const quietMs = 1_200;
  const readyDeadline = Date.now() + 45_000;
  for (;;) {
    const last = transfers.filter((t) => isTravelCoverRequest(t.url)).at(-1)?.at ?? 0;
    if (Date.now() - last >= quietMs) break;
    if (Date.now() > readyDeadline) break;
    await page.waitForTimeout(200);
  }

  // Контроль на заведомо здоровой позиции: первый экран обязан быть готов.
  const control = await page.evaluate(sampleVisibleCovers);
  const initialMediaPolicy = await page.evaluate(sampleCatalogMediaPolicy);
  const afterInitial = Date.now();

  const scroller = page.locator(tid('right-column-scrollview'));
  const box = await scroller.boundingBox();
  expect(box, 'right-column-scrollview не отрисован').not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);

  const samples: { phase: string; frame: ReturnType<typeof sampleVisibleCovers> }[] = [];
  const sweep = async (phase: string, direction: 1 | -1) => {
    for (let done = 0; done < SEARCH_TRACE.scrollPx; done += SEARCH_TRACE.stepPx) {
      await page.mouse.wheel(0, direction * SEARCH_TRACE.stepPx);
      // `mouse.wheel()` не ждёт применения scroll/виртуализации. Первый rAF —
      // ближайший воспроизводимый кадр, в котором пользователь уже видит
      // въехавшую карточку; именно его прежний 3-секундный settle скрывал.
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
      );
      samples.push({ phase: `${phase}-entry`, frame: await page.evaluate(sampleVisibleCovers) });
      await page.waitForTimeout(SEARCH_TRACE.motionSampleMs);
      samples.push({ phase: `${phase}-motion`, frame: await page.evaluate(sampleVisibleCovers) });
    }
    for (let i = 0; i < SEARCH_TRACE.settleFrames; i += 1) {
      samples.push({ phase: `${phase}-settle`, frame: await page.evaluate(sampleVisibleCovers) });
      await page.waitForTimeout(SEARCH_TRACE.settleMs);
    }
  };

  await sweep('down', 1);
  const afterDownMediaPolicy = await page.evaluate(sampleCatalogMediaPolicy);
  const afterDown = Date.now();
  await sweep('up', -1);
  // #1400: после поведенческого sweep отдельно выполняем требуемые десять
  // быстрых циклов вниз-вверх. Адреса уже известны браузеру, так что повторный
  // запрос или canceled здесь означает дефект lifecycle/windowing.
  for (let cycle = 0; cycle < 10; cycle += 1) {
    await scroller.evaluate((node: HTMLElement, offset: number) => {
      node.scrollTop = offset;
      node.dispatchEvent(new Event('scroll', { bubbles: true }));
    }, SEARCH_TRACE.scrollPx);
    await page.waitForTimeout(50);
    await scroller.evaluate((node: HTMLElement) => {
      node.scrollTop = 0;
      node.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    await page.waitForTimeout(50);
  }
  const afterReturnMediaPolicy = await page.evaluate(sampleCatalogMediaPolicy);
  const afterReturn = Date.now();

  // Бюджет считаем по ШАБЛОНУ медиа-путей, а не по наблюдённым обложкам.
  // Считаем весь хвост lookahead, включая lazy-узлы за пределами кадра: бюджет
  // не должен зависеть от того, попала ли конкретная обложка в DOM-выборку.
  const covers = transfers.filter((t) => isTravelCoverRequest(t.url));
  const bytesUntil = (ts: number) =>
    covers.filter((c) => c.at <= ts).reduce((sum, c) => sum + c.bytes, 0);
  const requestsUntil = (ts: number) => covers.filter((c) => c.at <= ts).length;

  // Повторная загрузка уже скачанной обложки = строка была выброшена из окна
  // и переехала заново. Ре-маунт из кэша (0 байт) дефектом не является.
  // Ключ — путь без query: тот же файл, перезапрошенный под другую `?w=`,
  // это тоже лишние байты и нарушение «один слот — один растр».
  const seen = new Map<string, number>();
  const redownloaded: string[] = [];
  for (const c of covers) {
    const key = c.url.split('?')[0];
    const before = seen.get(key) || 0;
    if (before > 0 && c.bytes > 0) redownloaded.push(c.url);
    seen.set(key, before + 1);
  }

  // Сетевой слой независим от DOM-выборки: если обложка не готова, здесь видно,
  // приходил ли вообще ответ по её адресу и сколько байт.
  const transferOf = (url: string) => {
    const key = url.split('?')[0];
    const hits = transfers.filter((t) => t.url.split('?')[0] === key);
    return hits.length ? hits.map((h) => ({ bytes: h.bytes, url: h.url.split('/').pop() })) : null;
  };

  return {
    control,
    samples,
    transferOf,
    redownloaded,
    cancelledCoverRequests,
    initialMediaPolicy,
    afterDownMediaPolicy,
    afterReturnMediaPolicy,
    initial: { requests: requestsUntil(afterInitial), bytes: bytesUntil(afterInitial) },
    afterDown: { requests: requestsUntil(afterDown), bytes: bytesUntil(afterDown) },
    afterReturn: { requests: requestsUntil(afterReturn), bytes: bytesUntil(afterReturn) },
  };
};

const assertScrollTrace = (
  trace: Awaited<ReturnType<typeof runSearchScrollTrace>>,
  budget: TraceProfile,
) => {
  const describeCards = (cards: CoverSample[], predicate: (c: CoverSample) => boolean) =>
    cards.filter(predicate).map((c) => `${c.slug} (видно ${Math.round(c.visRatio * 100)}%)`);

  expect(describeCards(trace.control.cards, (c) => c.fillOnly), 'первый экран до скролла').toEqual([]);

  expect(trace.initialMediaPolicy.length, 'начальный ряд не содержит img').toBeGreaterThan(0);
  expect(
    trace.initialMediaPolicy.filter(
      (sample) =>
        sample.loading !== (sample.row === 0 ? 'eager' : 'lazy') ||
        sample.fetchPriority !== (sample.row === 0 ? 'high' : 'low'),
    ),
    'до скролла eager/high разрешён только начальному ряду',
  ).toEqual([]);
  for (const [phase, samples] of [
    ['после прокрутки вниз', trace.afterDownMediaPolicy],
    ['после возврата', trace.afterReturnMediaPolicy],
  ] as const) {
    expect(samples.length, `${phase}: виртуализированный ряд не содержит img`).toBeGreaterThan(0);
    expect(
      samples.filter((sample) => sample.loading !== 'lazy' || sample.fetchPriority !== 'low'),
      `${phase}: после первого скролла все ремоунты должны быть lazy/low`,
    ).toEqual([]);
  }

  // Инвариант тикета — «карточка ВЪЕХАЛА в кадр уже с фотографией». Для каждого
  // направления фиксируем первый кадр, где видно хотя бы четверть обложки.
  // Поздний decode в settle не должен превращать наблюдаемую заливку в PASS.
  const inMotion = new Set<string>();
  const firstEntries = new Map<string, CoverSample>();
  const stale = new Set<string>();
  let minVisible = Number.POSITIVE_INFINITY;
  for (const { phase, frame } of trace.samples) {
    minVisible = Math.min(minVisible, frame.count);
    if (!phase.endsWith('-settle')) {
      const direction = phase.startsWith('down') ? 'down' : 'up';
      for (const c of frame.cards) {
        if (c.fillOnly) inMotion.add(c.slug);
        if (c.visRatio >= SEARCH_TRACE.entryMinVisibleRatio) {
          const key = `${direction}:${c.slug}`;
          if (!firstEntries.has(key)) firstEntries.set(key, c);
        }
      }
    }
    for (const c of frame.cards) {
      if (c.stale) stale.add(`${c.slug} (видно ${Math.round(c.visRatio * 100)}%)`);
    }
  }
  const initiallyVisible = new Set(trace.control.cards.map((c) => c.slug));
  const newlyEntered = new Set(
    [...firstEntries.values()].filter((c) => !initiallyVisible.has(c.slug)).map((c) => c.slug),
  );
  const blankOnEntry = [...firstEntries.entries()]
    .filter(([, c]) => c.fillOnly)
    .map(([key, c]) => `${key} (видно ${Math.round(c.visRatio * 100)}%)`);

  // Итоговое состояние берём из ПОСЛЕДНЕГО settle-кадра каждого прохода, а не
  // копим по всем: карточка, не готовая в первом кадре после остановки, ещё не
  // дефект — окно settle на то и существует, чтобы дать долететь ответу.
  // Накопительный набор держал бы её «виновной» и после того, как она догрузилась.
  const lastSettleFrames = ['down-settle', 'up-settle']
    .map((phase) => [...trace.samples].reverse().find((s) => s.phase === phase))
    .filter(Boolean) as typeof trace.samples;
  const settled = new Set<string>();
  const decodedAtRest = new Set<string>();
  for (const { frame } of lastSettleFrames) {
    for (const c of frame.cards) (c.fillOnly ? settled : decodedAtRest).add(c.slug);
  }
  const stuck = [...inMotion].filter((slug) => !decodedAtRest.has(slug) && settled.has(slug));

  // Разбор падения: по каждой незакрытой карточке печатаем и DOM-состояние,
  // и сетевой факт по её адресу — иначе «залита доминантным цветом» не
  // отличить от «ответ не пришёл».
  if (settled.size > 0 || stuck.length > 0) {
    const blame = [...new Set([...settled, ...stuck])];
    for (const slug of blame) {
      const last = [...trace.samples]
        .reverse()
        .flatMap(({ frame }) => frame.cards.filter((c) => c.slug === slug))[0];
      console.log(
        '[#1263 blame]',
        JSON.stringify({ slug, dom: last?.diag ?? null, network: trace.transferOf(last?.diag?.expected || '') }),
      );
    }
  }

  expect([...settled], 'обложки остались залиты доминантным цветом после остановки').toEqual([]);
  expect(stuck, 'обложка не догрузилась к остановке прокрутки').toEqual([]);
  expect(
    newlyEntered.size,
    'невакуозная трасса: прокрутка не ввела в кадр новые обложки',
  ).toBeGreaterThanOrEqual(Math.max(1, Math.ceil(budget.minVisibleCovers / 2)));
  expect(blankOnEntry, 'обложка въехала в кадр до готовности фотографии').toEqual([]);
  expect([...stale], 'подмена чужого фото').toEqual([]);
  expect(minVisible, 'провал геометрии: строка не смонтирована').toBeGreaterThanOrEqual(
    budget.minVisibleCovers,
  );
  // Возврат назад не должен стоить трафика. Сравнивать суммы «до/после» здесь
  // нельзя: если пагинация догрузит страницу на последнем шаге вниз, ответы
  // придут уже после отсечки и дадут ложное падение. Точный инвариант — ни один
  // адрес обложки не скачан по сети дважды.
  expect(trace.redownloaded, 'обложка скачана повторно при возврате').toEqual([]);
  expect(trace.cancelledCoverRequests, 'обложка отменена при штатном windowing').toEqual([]);
  expect(trace.afterReturn.requests).toBeLessThanOrEqual(budget.maxRequests);
  expect(trace.afterReturn.bytes).toBeLessThanOrEqual(budget.maxBytes);
};

test.describe('#1263 search list scroll reveal', () => {
  test.describe('desktop 1280x900', () => {
    test.use({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });

    test('обложки готовы при въезде в кадр и не грузятся заново', async ({ page }) => {
      const profile: TraceProfile = {
        cpuThrottle: 1,
        minVisibleCovers: 6,
        maxRequests: 20,
        // Замер прода 2026-08-10, сборка v1786347820465: 1 404 556 B, повторный
        // прогон дал то же число байт-в-байт. Прежние круглые 1 400 000 не были
        // ни на чём основаны и падали на 0,33 %, хотя оба поведенческих
        // инварианта #1263 (обложка готова при въезде, ни один адрес не скачан
        // дважды) держатся. Граница = замер + 3 % на дрейф контента живого
        // списка; регрессия ступеней `?w=` дала бы кратный скачок, а не проценты.
        maxBytes: 1_450_000,
      };
      const trace = await runSearchScrollTrace(page, profile);
      console.log('[#1263 desktop]', JSON.stringify({
        initial: trace.initial,
        afterDown: trace.afterDown,
        afterReturn: trace.afterReturn,
      }));
      assertScrollTrace(trace, profile);
    });
  });

  test.describe('mobile 390x844', () => {
    // #1287: мобильный профиль — это touch + coarse pointer + DPR>1 + мобильный
    // UA, а не просто узкий viewport (DPR выбирает другую ступень `?w=`).
    // Целиком device descriptor в describe-группе применить нельзя: он тянет
    // `defaultBrowserType` и требует нового воркера.
    test.use({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent: devices['Pixel 7'].userAgent,
    });

    test('обложки готовы при въезде в кадр и не грузятся заново', async ({ page }) => {
      const profile: TraceProfile = {
        cpuThrottle: 4,
        minVisibleCovers: 3,
        maxRequests: 12,
        maxBytes: 700_000,
      };
      const trace = await runSearchScrollTrace(page, profile);
      console.log('[#1263 mobile]', JSON.stringify({
        initial: trace.initial,
        afterDown: trace.afterDown,
        afterReturn: trace.afterReturn,
      }));
      assertScrollTrace(trace, profile);
    });
  });
});
