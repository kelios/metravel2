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

  // #1438: пустой слаг плюс `id: null` (поле объявлено `number`, но бэкенд
  // присылает и `null`) собирал адрес `/travels/null` — карточка коллекции
  // вела в 404. Пустая строка = «ссылки нет», вызывающий её не рисует.
  it.each([null, undefined, 0])('returns no url when slug is empty and id is %p', (id) => {
    const n = normalizeServerTravelCard(dto({ slug: '', url: '', id: id as any }));

    expect(n.url).toBe('');
  });

  it('still builds the url from a real slug or id', () => {
    expect(normalizeServerTravelCard(dto({ slug: 'grodno' })).url).toBe('/travels/grodno');
    expect(normalizeServerTravelCard(dto({ slug: '', url: '', id: 77 })).url).toBe('/travels/77');
  });

  // Тот же гард, что и в `resolveTravelUrl`: сюда попадают сырые серверные
  // `slug`/`url`, а результат уходит в `router.push` из избранного и истории.
  it.each(['null', 'undefined'])('does not build the url from the literal slug %p', (slug) => {
    expect(normalizeServerTravelCard(dto({ slug, url: '', id: null as any })).url).toBe('');
    expect(normalizeServerTravelCard(dto({ slug, url: '', id: 77 })).url).toBe('/travels/77');
  });

  it.each(['/travels/null', '/travels/undefined', '/travels/0'])(
    'does not pass the unusable backend url %p through',
    (url) => {
      expect(normalizeServerTravelCard(dto({ slug: '', url, id: null as any })).url).toBe('');
    },
  );

  it('carries city through the list mapper', () => {
    const [first, second] = normalizeServerTravelCards([
      dto({ id: 177, cityName: 'Warszawa' }),
      dto({ id: 646, cityName: 'Верхний город и площадь Свободы', countryName: 'Беларусь' }),
    ]);

    expect(first.city).toBe('Warszawa');
    expect(second.city).toBe('Верхний город и площадь Свободы');
  });
});
