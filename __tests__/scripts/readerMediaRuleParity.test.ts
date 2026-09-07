import { toLegacyResizePath as toLegacyResizePathTs } from '@/utils/mediaUrl';

const { buildOptimizedTravelImageUrl } = require('@/scripts/generate-seo-pages');

/**
 * #1868: SSG строит адрес кадра по ТОМ ЖЕ правилу, что и разметка читателя.
 *
 * Соседний `travelHeroPreloadParity` держит другой инвариант — preload греет тот
 * же файл, который затем запросит `<img>`, то есть сверяет генератор с разметкой
 * страницы. Расхождение самого ПРАВИЛА он не ловит: до #1868 генератор вёл
 * четвёртую копию `toLegacyResizePath`, и сузься во фронте набор расширений —
 * обе стороны SSG уехали бы согласованно, тест остался бы зелёным, а preload и
 * srcset грелись бы по устаревшему правилу. Ровно так уже разъехались три копии
 * до общего модуля `scripts/lib/readerMediaUrl.js`.
 *
 * Здесь сверяется наблюдаемый выход генератора (`buildOptimizedTravelImageUrl` —
 * через него идут и preload, и srcset, и варианты манифеста) с TS-источником
 * `utils/mediaUrl.ts`. Тест краснеет и когда правило правят только во фронте, и
 * когда в генератор возвращают собственную копию.
 */

// Origin, который генератор считает своим: `--api` по умолчанию (scripts/generate-seo-pages.js).
const SITE = 'https://metravel.by';

/**
 * По одному входу на ветку `toLegacyResizePath`, какие вообще доходят до SSG.
 *
 * Прямые ссылки на бакет и обёртки weserv сюда не входят намеренно: генератор
 * отсекает чужой origin раньше правила, и его ветка «не наш origin — не трогаем»
 * это отдельный контракт. Классы бакета сверяет `reader-media-url.test.ts`.
 */
const SSG_MEDIA_INPUTS = [
  // Conversion-ключ за каждым family-роутом, который знает переписывание фронта.
  `${SITE}/gallery/3994/conversions/HcQK2WZBkjkvHnupzbuIPA9ulGbifqOiIvgmkOlG-detail_hd.jpg`,
  `${SITE}/travel-image/682/conversions/10f0a8f2.webp`,
  `${SITE}/travel-description-image/12/conversions/x.WEBP`,
  `${SITE}/address-image/15601/conversions/ee55dead.webp`,
  // Ключ не перекодируется ни одной из сторон — иначе адреса разъехались бы на пробеле.
  `${SITE}/travel-image/682/conversions/a%20b.webp`,
  // `uploads/**` за family-роутом: класс, на котором удалённая копия была УЖЕ
  // источника — она знала только `conversions`, а фронт уводит и его.
  `${SITE}/gallery/uploads/1614096729IMG_6960.JPG`,
  // Family-роут без legacy-ключа: переписывать нечего.
  `${SITE}/gallery/3994/gallery/plain.jpg`,
  `${SITE}/travel-description-image/613eb392.jpg.webp`,
  // Роут, которого переписывание фронта не знает.
  `${SITE}/quest-cover/9/conversions/x.webp`,
  // Классы, которых legacy-роут не обслуживает.
  `${SITE}/gallery/682/responsive-images/x.webp`,
  `${SITE}/gallery/682/conversions/deep/conversions/x.webp`,
  `${SITE}/gallery/1/conversions/notes.pdf`,
  `${SITE}/gallery/1/conversions/`,
];

/** Путь, который SSG кладёт в preload/`srcset`. Ширина и качество на правило не влияют. */
const ssgPathname = (rawUrl: string): string =>
  new URL(String(buildOptimizedTravelImageUrl(rawUrl, { width: 800, quality: 80 }))).pathname;

/** Путь, который по тому же адресу запросит браузер читателя (`utils/mediaUrl.ts`). */
const readerPathname = (rawUrl: string): string =>
  new URL(toLegacyResizePathTs(rawUrl) ?? rawUrl, SITE).pathname;

describe('SSG: адрес кадра строится по правилу читателя', () => {
  it.each(SSG_MEDIA_INPUTS)('совпадает с toLegacyResizePath из utils/mediaUrl.ts: %s', (input) => {
    expect(ssgPathname(input)).toBe(readerPathname(input));
  });

  it('conversion-ключ уходит на transform-роут, а не остаётся на family-роуте', () => {
    // Family-роуты в proxy-contract v4 это `source_passthrough` (#1195): отдают
    // мастер на любой ширине и с `no-store`.
    expect(ssgPathname(`${SITE}/gallery/355/conversions/x.webp`)).toBe(
      '/media-resize/legacy/355/conversions/x.webp',
    );
  });

  it('`uploads/**` за family-роутом уходит на свой legacy-роут', () => {
    // Удалённая копия правила знала только `conversions` и оставляла этот класс
    // на family-роуте — адрес, которого читатель не запрашивает.
    expect(ssgPathname(`${SITE}/gallery/uploads/a.jpg`)).toBe('/media-resize/uploads/a.jpg');
  });

  it('падает, если генератор разойдётся с фронтом хотя бы на одном входе', () => {
    // Сам механизм сверки: без него `it.each` выше молчал бы на пустом наборе.
    const divergent = SSG_MEDIA_INPUTS.filter((input) => ssgPathname(input) !== readerPathname(input));
    expect(divergent).toEqual([]);

    // И набор действительно покрывает обе ветки переписывания, а не только «не трогаем».
    const rewritten = SSG_MEDIA_INPUTS.map((input) => ssgPathname(input)).filter((path) =>
      path.startsWith('/media-resize/'),
    );
    expect(rewritten.some((path) => path.startsWith('/media-resize/legacy/'))).toBe(true);
    expect(rewritten.some((path) => path.startsWith('/media-resize/uploads/'))).toBe(true);
    expect(SSG_MEDIA_INPUTS.some((input) => !ssgPathname(input).startsWith('/media-resize/'))).toBe(true);
  });
});
