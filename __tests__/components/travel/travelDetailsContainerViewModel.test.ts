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
});
