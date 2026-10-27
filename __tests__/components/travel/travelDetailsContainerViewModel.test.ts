import { getTravelDetailsSeoViewModel } from '@/components/travel/details/hooks/travelDetailsContainerViewModel';
import { normalizeTravelItem } from '@/api/travelsNormalize';

describe('getTravelDetailsSeoViewModel', () => {
  it.each([
    { travel_image_detail_hd_url: 'https://metravel.by/travel-image/679/conversions/hash-detail_hd.jpg' },
    { travel_image_thumb_url: 'https://metravel.by/travel-image/679/conversions/hash-thumb_200.jpg' },
  ])('preserves the published HD social image when the gallery is empty: %j', (cover) => {
    const seo = getTravelDetailsSeoViewModel({ id: 679, name: 'Поездка', slug: 'demo', gallery: [], ...cover }, 'demo');
    expect(seo.readyImage).toBe('https://metravel.by/travel-image/679/conversions/hash-detail_hd.jpg?w=1280');
  });

  it('rejects bare media endpoint images in the shared published fallback order', () => {
    const seo = getTravelDetailsSeoViewModel({ id: 679, name: 'Поездка', gallery: [{ url: '/gallery/' }],
      travel_image_thumb_url: '/travel-image/' }, 'demo');
    expect(seo.readyImage).toBe('https://metravel.by/assets/icons/logo_yellow_512x512.png');
  });

  it('preserves the published contextual description for short editorial leads', () => {
    const travel = { id: 116, name: 'Минск', countryName: 'Беларусь', slug: 'minsk-fixture',
      description: '<p>Утро в Минске: набережная и старые улицы.</p>', gallery: [] };
    expect(getTravelDetailsSeoViewModel(travel, travel.slug).readyDesc).toBe(
      'Утро в Минске: набережная и старые улицы. Минск — Беларусь. Маршрут, советы и впечатления путешественников в MeTravel.',
    );
  });

  it('preserves a complete late sentence from the published snippet when the body is longer', () => {
    const sentence = 'Прогулка ведёт через исторический центр города, вдоль старых домов и набережной, к зелёному парку и замку.';
    const travel = { id: 116, name: 'Минск', slug: 'minsk-fixture',
      description: `<p>${sentence} ${'Дальше открываются новые места и виды. '.repeat(6)}</p>` };
    expect(getTravelDetailsSeoViewModel(travel, travel.slug).readyDesc).toBe(
      `${sentence} Дальше открываются новые места и виды.`,
    );
  });

  it('uses the shared stored-metadata rule after API normalization without changing canonical or title', () => {
    const meta = 'Прогулка по старому городу: замок, набережная и тихие улицы. Советы для самостоятельной поездки.';
    const raw = { id: 116, name: 'Прогулка по Минску', slug: 'minsk-fixture',
      description: '<p>Different body lead</p>', meta_description: meta, gallery: [] };
    const travel = normalizeTravelItem(raw);
    const seo = getTravelDetailsSeoViewModel(travel, raw.slug);
    const { buildTravelSeoDescription } = require('@/utils/travelSeoDescription');
    const { normalizeTravelDetail } = require('@/scripts/lib/travelDetail');
    const detail = normalizeTravelDetail(raw);
    expect(seo.readyDesc).toBe(meta);
    expect(seo.readyDesc).toBe(buildTravelSeoDescription(raw, detail.description, detail.meta_description));
    expect(seo.readyTitle).toBe('Прогулка по Минску | Metravel');
    expect(seo.canonicalUrl).toBe('https://metravel.by/travels/minsk-fixture');
    expect(travel.description).toBe(raw.description);
  });

  it.each([null, '', '<p></p>', 'Короткое описание', 123])('preserves the existing loaded body fallback for invalid stored meta %p', meta => {
    const travel = { id: 116, name: 'Минск', slug: 'minsk-fixture',
      description: '<p>Утро в Минске: набережная и старые улицы.</p>', gallery: [] };
    expect(getTravelDetailsSeoViewModel({ ...travel, meta_description: meta }, travel.slug).readyDesc)
      .toBe(getTravelDetailsSeoViewModel(travel, travel.slug).readyDesc);
  });

  it('uses travel title for SEO title instead of latin slug fallback', () => {
    const seo = getTravelDetailsSeoViewModel(
      {
        id: 386,
        slug: 'trek-v-khokholovskoi-doline',
        title: 'Трек в Хохоловской долине',
        description: '<p>Маршрут по долине</p>',
        gallery: [],
      },
      'trek-v-khokholovskoi-doline'
    );

    expect(seo.readyTitle).toBe('Трек в Хохоловской долине | Metravel');
  });

  it('keeps head untouched (null title/desc) while travel data is incomplete', () => {
    // Слаг-фолбэк затирал корректный SSG-<title> транслитом, и Метрика/GA4
    // снимали hit с «Marshrut oden usadba…» — пока данных нет, head не трогаем.
    const seo = getTravelDetailsSeoViewModel(
      {
        id: 628,
        slug: 'vitebsk-chto-mozhno-posmotret',
        gallery: [],
      },
      'vitebsk-chto-mozhno-posmotret',
    );

    expect(seo.readyTitle).toBeNull();
    expect(seo.readyDesc).toBeNull();
  });

  it('keeps head untouched while travel is undefined (initial load)', () => {
    const seo = getTravelDetailsSeoViewModel(undefined, 'marshrut-na-oden-usadba-linovo');

    expect(seo.readyTitle).toBeNull();
    expect(seo.readyDesc).toBeNull();
  });

  // #1438: canonical и og:url собирались сырой интерполяцией, а пригодность
  // слага проверялась как «непустая строка». Литерал 'null' её проходил, и
  // прод отдавал 404 на `/travels/null` краулеру Meta, который ходит по og:url.
  describe('canonical hardening (#1438)', () => {
    it('falls back to the route slug when travel slug is a literal marker', () => {
      const seo = getTravelDetailsSeoViewModel(
        { id: null, slug: 'null', name: 'Гродненские форты', gallery: [] },
        'grodnenskie-forty-no4-i-no6-peshchery-i-skaly',
      );

      expect(seo.canonicalUrl).toBe(
        'https://metravel.by/travels/grodnenskie-forty-no4-i-no6-peshchery-i-skaly',
      );
    });

    // #1512: прямой заход на `/travels/<id>` прод отдаёт пустым 404, поэтому
    // числовая форма не годится для canonical — иначе мы сами публикуем краулерам
    // адрес в 404, то есть повторяем дефект #1438 другими словами.
    it('publishes no canonical instead of the numeric id form', () => {
      const seo = getTravelDetailsSeoViewModel(
        { id: 228, slug: 'undefined', name: 'Гродненские форты', gallery: [] },
        '',
      );

      expect(seo.canonicalUrl).toBeUndefined();
      expect(JSON.stringify(seo.jsonLd)).not.toContain('/travels/228');
    });

    it('keeps the opened slug URL canonical instead of switching to the id', () => {
      const seo = getTravelDetailsSeoViewModel(
        { id: 228, slug: null, name: 'Гродненские форты', gallery: [] },
        'grodnenskie-forty-no4-i-no6-peshchery-i-skaly',
      );

      expect(seo.canonicalUrl).toBe(
        'https://metravel.by/travels/grodnenskie-forty-no4-i-no6-peshchery-i-skaly',
      );
    });

    it('emits no canonical at all when no usable key exists', () => {
      const seo = getTravelDetailsSeoViewModel(
        { id: 0, slug: null, name: 'Гродненские форты', gallery: [] },
        '',
      );

      expect(seo.canonicalUrl).toBeUndefined();
    });

    // Воспроизведение прод-цепочки целиком: payload с `slug: null` → общий
    // нормализатор → head страницы. Именно на этом пути 21.08.2026 краулер Meta
    // получил `GET /travels/null` → 404 с referer здоровой статьи.
    it('keeps the head clean for a payload whose slug arrives as JSON null', () => {
      const travel = normalizeTravelItem({
        id: 228,
        slug: null,
        name: 'Гродненские форты №4 и №6',
        description: '<p>Форты под Гродно</p>',
        gallery: [],
      });

      const seo = getTravelDetailsSeoViewModel(
        travel,
        'grodnenskie-forty-no4-i-no6-peshchery-i-skaly',
      );

      expect(seo.canonicalUrl).toBe(
        'https://metravel.by/travels/grodnenskie-forty-no4-i-no6-peshchery-i-skaly',
      );
      expect(JSON.stringify(seo.jsonLd)).not.toContain('/travels/null');
    });

    // Голова и структурированные данные — два публичных объявления собственного
    // адреса страницы. Расходиться они не должны ни на одном входе.
    it('declares one and the same address in canonical and JSON-LD', () => {
      const seo = getTravelDetailsSeoViewModel(
        {
          id: 228,
          slug: null,
          name: 'Гродненские форты',
          description: '<p>Форты под Гродно</p>',
          gallery: [],
        },
        'grodnenskie-forty-no4-i-no6-peshchery-i-skaly',
      );

      const addresses = new Set(
        (JSON.stringify(seo.jsonLd).match(/https:\/\/metravel\.by\/travels\/[^"#]+/g) ?? []),
      );

      expect(seo.canonicalUrl).toBeDefined();
      expect([...addresses]).toEqual([seo.canonicalUrl]);
    });

    it('never builds a canonical pointing at a literal emptiness segment', () => {
      for (const slug of ['null', 'undefined', 'NaN', 'none']) {
        const seo = getTravelDetailsSeoViewModel(
          { id: null, slug, name: 'Статья', gallery: [] },
          slug,
        );

        expect(seo.canonicalUrl).toBeUndefined();
      }
    });
  });
});
