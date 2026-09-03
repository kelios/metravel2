import {
  buildAddressFromGeocode,
  buildPointTitleFromGeocode,
} from '@/utils/geocodeHelpers';

// Ответы взяты по образцу реальных данных прода из #1717: у точек путешествий
// в `travelAddress[].address` лежала вся цепочка обратного геокодирования, и
// подписи внутри одной статьи отличались только первым сегментом.
const latlng = { lat: 49.4881, lng: 19.1234 };

describe('buildPointTitleFromGeocode', () => {
  it('берёт имя объекта, а не цепочку: «Bacówka PTTK na Rycerzowej»', () => {
    const data = {
      name: 'Bacówka PTTK na Rycerzowej',
      address: {
        house_number: '450',
        village: 'Soblówka',
        state: 'Силезское воеводство',
        county: 'Живецкий повят',
        country: 'Польша',
      },
    };

    expect(buildPointTitleFromGeocode(data, latlng)).toBe('Bacówka PTTK na Rycerzowej');
  });

  // Ровно тот случай, ради которого заведена карточка: объекта нет, есть номер
  // дома без улицы — и он становился первым сегментом названия.
  it('номер дома без улицы не становится названием — остаётся «Soblówka»', () => {
    const data = {
      address: {
        house_number: '332',
        village: 'Soblówka',
        state: 'Силезское воеводство',
        county: 'Живецкий повят',
        country: 'Польша',
      },
    };

    expect(buildPointTitleFromGeocode(data, latlng)).toBe('Soblówka');
  });

  it('улица с домом — законное название, когда объекта нет', () => {
    const data = {
      address: {
        road: 'Partyzantów',
        house_number: '6',
        city: 'Щавница',
        state: 'Малопольское воеводство',
        country: 'Польша',
      },
    };

    expect(buildPointTitleFromGeocode(data, latlng)).toBe('Partyzantów 6');
  });

  // Второй исторический формат: точка, добавленная выбором места из поиска.
  // Там приходил сырой `display_name` через запятую — отсюда и расхождение
  // разделителей между статьями.
  it('результат поиска отдаёт имя объекта, а не сырой display_name через запятую', () => {
    const result = {
      display_name: 'Chata "Magóry", 11, Magóry, Пивнична-Здруй, gmina Piwniczna-Zdrój, Новосонченский повят, Польша',
      address: {
        name: 'Chata "Magóry"',
        house_number: '11',
        village: 'Magóry',
        county: 'Новосонченский повят',
        country: 'Польша',
      },
    };

    expect(buildPointTitleFromGeocode(result, latlng)).toBe('Chata "Magóry"');
  });

  it('когда разобранных частей нет, берётся первый осмысленный сегмент display_name', () => {
    const result = {
      display_name: '11, Rezerwat Lipowska, Żabnica, Живецкий повят, Польша',
    };

    expect(buildPointTitleFromGeocode(result, latlng)).toBe('Rezerwat Lipowska');
  });

  it('форма bigdatacloud разбирается так же: город без административного хвоста', () => {
    const data = {
      city: 'Rycerka Górna',
      principalSubdivision: 'Силезское воеводство',
      countryName: 'Польша',
      localityInfo: {
        administrative: [
          { order: 2, name: 'Силезское воеводство' },
          { order: 4, name: 'Живецкий повят' },
        ],
      },
    };

    expect(buildPointTitleFromGeocode(data, latlng)).toBe('Rycerka Górna');
  });

  it('страна из справочника — последний осмысленный запас перед координатами', () => {
    expect(buildPointTitleFromGeocode({}, latlng, { title_ru: 'Польша' })).toBe('Польша');
  });

  it('пустой ответ геокодера отдаёт координаты, а не пустую подпись', () => {
    expect(buildPointTitleFromGeocode({}, latlng)).toBe('49.4881, 19.1234');
  });
});

describe('buildAddressFromGeocode', () => {
  // Полная строка осталась у «Моих точек»: там это адрес сохранённого места,
  // а не подпись точки на карте маршрута.
  it('по-прежнему собирает полную цепочку с административным хвостом', () => {
    const data = {
      name: 'Bacówka PTTK na Rycerzowej',
      address: {
        road: 'Beskidzka Zielona Ścieżka',
        village: 'Soblówka',
        state: 'Силезское воеводство',
        county: 'Живецкий повят',
        country: 'Польша',
      },
    };

    expect(buildAddressFromGeocode(data, latlng)).toBe(
      'Bacówka PTTK na Rycerzowej · Beskidzka Zielona Ścieżka · Soblówka · Силезское воеводство · Живецкий повят · Польша',
    );
  });

  // Единственное изменение поведения адреса: голый номер дома без улицы больше
  // не открывает строку. Это тот же дефект, и оставлять его в адресе незачем.
  it('номер дома без улицы выпадает из адреса', () => {
    const data = {
      address: {
        house_number: '332',
        village: 'Soblówka',
        country: 'Польша',
      },
    };

    expect(buildAddressFromGeocode(data, latlng)).toBe('Soblówka · Польша');
  });
});
