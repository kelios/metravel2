import { isAddressLikeCityName, resolveTravelCityName } from '@/utils/travelDisplayLocation';

// Реальные значения `cityName` из прод-API (GET /api/travels/?page=1&perPage=60).
// В выборке из 120 записей настоящего названия города не встретилось ни разу:
// бэкенд кладёт туда подпись первой точки маршрута из обратного геокодинга.
const PRODUCTION_ADDRESSES = [
  'Базилика Святого Стефана, 1, Szent István tér, Lipótváros, 5th district, Будапешт, Центральная Венгрия, 1051, Венгрия',
  'Parking Zamkowy · Wałowa · Мальборк · Поморское воеводство · Мальбурский повят · Польша',
  'Rezerwat Lipowska, Kamienna, Krzusówka, Żabnica, gmina Węgierska Górka, Живецкий повят, Силезское воеводство, Польша',
  'Лямус, улица Ленина, Большое Можейково, Можейковский сельский Совет, Щучинский район, Гродненская об',
  '30110 · Адршпа · Краловеградецкий край · Чехия',
  'Дикушки: усадьба Гробовских',
  'Река Ислочь — стоянка «Туристическая поляна»',
  'Музей истории города Гомеля (Охотничий домик)',
  'Верхний город и площадь Свободы',
  'Лесное озеро Гремячее (Пуховичский район)',
  'Краков · Малопольское воеводство · Польша',
];

// Короткие подписи объектов без разделителей и цифр эвристика не отличает от
// города — и не должна: они умещаются в строку целиком, то есть дефекта
// «обрезанный адрес» не создают. Из 179 уникальных прод-значений таких два.
const SHORT_PLACE_LABELS = ['Замок Болчув', 'Приют под Лабским Щитом'];

// Названия городов, которые эвристика ломать не должна.
const REAL_CITIES = [
  'Минск',
  'Краков',
  'Санкт-Петербург',
  'Нижний Новгород',
  'Франкфурт-на-Майне',
  'Петропавловск-Камчатский',
  'Ростов-на-Дону',
  'Набережные Челны',
  'Вильнюс',
  'Тбилиси',
  'Warszawa',
  'Комсомольск-на-Амуре',
  'Villefranche-sur-Saône',
  // Ловушки для эвристики по словам-маркерам: 'гора', 'река', 'дорог', 'via',
  // 'castle', 'lake' — все они встречаются внутри настоящих топонимов.
  'Загора',
  'Белоозерск',
  'Дорогобуж',
  'Рекавичи',
  'Viareggio',
  'Castleford',
  'Lakeland',
  'Mount Isa',
  'San Giovanni in Persiceto',
  'Nowe Miasto nad Pilicą',
  'Rueil-Malmaison',
];

describe('isAddressLikeCityName', () => {
  it('flags every cityName value taken from production', () => {
    const flagged = PRODUCTION_ADDRESSES.filter((value) => isAddressLikeCityName(value));
    expect(flagged).toEqual(PRODUCTION_ADDRESSES);
  });

  it('keeps plain city names, including ones that contain marker-like substrings', () => {
    const flagged = REAL_CITIES.filter((value) => isAddressLikeCityName(value));
    expect(flagged).toEqual([]);
  });

  it('lets short object labels through — they fit the line and hide nothing', () => {
    expect(SHORT_PLACE_LABELS.filter((value) => isAddressLikeCityName(value))).toEqual([]);
  });

  it('treats empty input as not address-like', () => {
    expect(isAddressLikeCityName(undefined)).toBe(false);
    expect(isAddressLikeCityName(null)).toBe(false);
    expect(isAddressLikeCityName('   ')).toBe(false);
  });
});

describe('resolveTravelCityName', () => {
  it('drops the address so the caller falls back to the country', () => {
    // travel 485 «Будапешт»: countryName='Венгрия' остаётся у вызывающего кода.
    expect(resolveTravelCityName(PRODUCTION_ADDRESSES[0])).toBeUndefined();
  });

  it('returns a clean city name as is', () => {
    expect(resolveTravelCityName('Минск')).toBe('Минск');
    expect(resolveTravelCityName('  Тбилиси  ')).toBe('Тбилиси');
  });

  it('returns undefined when there is nothing to show', () => {
    expect(resolveTravelCityName(undefined)).toBeUndefined();
    expect(resolveTravelCityName(null)).toBeUndefined();
    expect(resolveTravelCityName('')).toBeUndefined();
    expect(resolveTravelCityName('   ')).toBeUndefined();
  });
});
