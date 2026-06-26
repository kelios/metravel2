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

  it('uses slug/id based title and description fallbacks while travel data is incomplete', () => {
    const seo = getTravelDetailsSeoViewModel(
      {
        id: 628,
        slug: 'vitebsk-chto-mozhno-posmotret',
        gallery: [],
      },
      'vitebsk-chto-mozhno-posmotret',
    );

    expect(seo.readyTitle).toBe('Vitebsk chto mozhno posmotret | Metravel');
    expect(seo.readyDesc).toContain('Маршрут Vitebsk chto mozhno posmotret на Metravel');
  });
});
