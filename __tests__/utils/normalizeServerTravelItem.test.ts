import { normalizeServerTravelCard, normalizeServerTravelCards } from '@/utils/normalizeServerTravelItem';
import type { CardViewTravelDto } from '@/api/user';

// Фикстуры — сырые ответы прода `GET /api/user/<id>/favorite-travels/` и
// `/history/` от 2026-08-10. Ровно на этих данных было видно расхождение:
// одна и та же карточка в истории показывала «Gdańsk, Польша», а в избранном —
// только «Польша», потому что историю дополняет клиент при просмотре, а
// серверная нормализация город теряла.
const dto = (over: Partial<CardViewTravelDto>): CardViewTravelDto => ({
  id: 1,
  name: 'Заголовок',
  url: 'https://metravel.by/travels/x',
  slug: 'x',
  countryName: 'Польша',
  travel_image_thumb_small_url: '',
  travel_image_thumb_url: '',
  updated_at: '2026-08-01T10:00:00Z',
  ...over,
});

describe('normalizeServerTravelCard', () => {
  it('keeps the real city the backend sent', () => {
    const n = normalizeServerTravelCard(dto({ id: 177, cityName: 'Warszawa' }));

    expect(n.city).toBe('Warszawa');
    expect(n.country).toBe('Польша');
  });

  it('passes an address-like cityName through untouched', () => {
    // Сырое значение не чиним здесь намеренно: его подстрокой матчит
    // utils/questForLocation, а адрес отсекает resolveTravelCityName при
    // отображении.
    const address =
      'Zamek w Pilicy, Partyzantów, Пилица, gmina Pilica, Заверценский повят, Силезское воеводство, 42-436, Польша';
    const n = normalizeServerTravelCard(dto({ id: 308, cityName: address }));

    expect(n.city).toBe(address);
  });

  it('leaves city undefined when the field is absent or null', () => {
    expect(normalizeServerTravelCard(dto({})).city).toBeUndefined();
    expect(normalizeServerTravelCard(dto({ cityName: null })).city).toBeUndefined();
  });

  it('carries city through the list mapper', () => {
    const [first, second] = normalizeServerTravelCards([
      dto({ id: 177, cityName: 'Warszawa' }),
      dto({ id: 646, cityName: 'Верхний город и площадь Свободы', countryName: 'Беларусь' }),
    ]);

    expect(first.city).toBe('Warszawa');
    expect(second.city).toBe('Верхний город и площадь Свободы');
  });
});
