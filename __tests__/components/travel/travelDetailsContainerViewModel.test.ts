import { getTravelDetailsSeoViewModel } from '@/components/travel/details/hooks/travelDetailsContainerViewModel';

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
});
