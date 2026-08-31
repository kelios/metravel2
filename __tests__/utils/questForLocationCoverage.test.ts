/**
 * #1647: клиентский гейт запроса `/api/quests/near-location/` — только наличие
 * локации. Раньше здесь стоял статический Беларусь-only deny (#1149): он был
 * верен, пока квесты были только по Беларуси, и устарел, как только появились
 * опубликованные квесты в Польше. Прод 2026-08-31 на запросе travel 737
 * (`city='Dominikanów · Краков · Малопольское воеводство · Польша'`,
 * `country='Польша'`, `country_code='pl'`) отдаёт `count=37`, а гейт не давал
 * запросу уйти вовсе.
 *
 * Инвариант, который остаётся: сеть не трогаем там, где серверу нечего
 * сопоставлять. Покрытие каталога решает сервер, а не список стран на клиенте.
 */
import { hasQuestLocation } from '@/utils/questForLocation';

/** Ровно та локация, на которой блок квестов Кракова не появлялся (#1647). */
const TRAVEL_737_QUERY = {
  cityName: 'Dominikanów · Краков · Малопольское воеводство · Польша',
  countryName: 'Польша',
  countryCode: 'pl',
  coords: [{ lat: 50.086575, lng: 19.9663028 }],
};

describe('hasQuestLocation', () => {
  it('пропускает зарубежную локацию: страна больше не запрещает запрос', () => {
    expect(hasQuestLocation(TRAVEL_737_QUERY)).toBe(true);
    expect(hasQuestLocation({ countryName: 'Польша' })).toBe(true);
    expect(hasQuestLocation({ countryCode: 'pl', countryName: 'Polska' })).toBe(true);
    // Вьетнам квестов не имеет, но решает это сервер пустым 200, а не клиент.
    expect(hasQuestLocation({ countryName: 'Вьетнам', countryCode: 'vn' })).toBe(true);
    expect(hasQuestLocation({ coords: [{ lat: 52.23, lng: 21.01 }] })).toBe(true); // Варшава
  });

  it('пропускает белорусскую локацию', () => {
    expect(hasQuestLocation({ cityName: 'Минск', countryName: 'Беларусь' })).toBe(true);
    expect(hasQuestLocation({ coords: [{ lat: 53.9, lng: 27.56 }] })).toBe(true);
  });

  it('достаточно одного признака локации', () => {
    expect(hasQuestLocation({ cityName: 'Краков' })).toBe(true);
    expect(hasQuestLocation({ countryName: 'Польша' })).toBe(true);
    expect(hasQuestLocation({ coords: [{ lat: 50.06, lng: 19.94 }] })).toBe(true);
  });

  it('без локации запрос не нужен: серверу нечего сопоставлять', () => {
    expect(hasQuestLocation({})).toBe(false);
    expect(hasQuestLocation({ cityName: null, countryName: null, coords: [] })).toBe(false);
    expect(hasQuestLocation({ cityName: '   ', countryName: '\n' })).toBe(false);
  });

  it('код страны без города, названия страны и координат запрос не открывает', () => {
    // Не потому, что серверу нечем ответить: по одному коду он вернёт квесты
    // всей страны со score «страна совпала». Но это уже не «по этому городу и
    // рядом», а travel-пейлоад отдаёт `countryName` и `countryCode` из одной
    // связи `countries` — кода в одиночку в проде не бывает.
    expect(hasQuestLocation({ countryCode: 'pl' })).toBe(false);
  });

  it('мусорные координаты не считаются локацией, валидная в том же списке — считается', () => {
    expect(hasQuestLocation({ coords: [{ lat: NaN, lng: NaN }] })).toBe(false);
    expect(
      hasQuestLocation({ coords: [{ lat: NaN, lng: NaN }, { lat: 50.06, lng: 19.94 }] }),
    ).toBe(true);
  });
});
