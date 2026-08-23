import { getTravelDetailsSeoViewModel } from '@/components/travel/details/hooks/travelDetailsContainerViewModel';
import { normalizeTravelItem } from '@/api/travelsNormalize';

describe('getTravelDetailsSeoViewModel', () => {
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
