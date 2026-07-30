/**
 * #1149 (FE-часть): не звать `/api/quests/near-location/` там, где квестов заведомо нет.
 *
 * Городские квесты MeTravel существуют только по Беларуси. На статье о загранице
 * эндпоинт стабильно отвечает `{"results":[],"count":0}`, но стоит 0.77–1.85 с TTFB
 * и отдаётся с `cache-control: no-store` — на travel-странице это самый долгий
 * запрос из всех (замер прода 2026-07-30, /travels/ourvietnam: countryCode='vn').
 */
import { isWithinQuestCoverage } from '@/utils/questForLocation';

describe('isWithinQuestCoverage', () => {
  it('пропускает белорусскую локацию по коду страны', () => {
    expect(isWithinQuestCoverage({ countryCode: 'by', countryName: 'Беларусь' })).toBe(true);
    expect(isWithinQuestCoverage({ countryCode: 'BY' })).toBe(true);
  });

  it('отсекает зарубежную локацию по коду страны (реальный кейс прода)', () => {
    expect(
      isWithinQuestCoverage({
        countryCode: 'vn',
        countryName: 'Вьетнам',
        cityName: 'Далат, Đà Lạt District, Ламдонг, 02633, Вьетнам',
        coords: [{ lat: 11.923253, lng: 108.4537353 }],
      }),
    ).toBe(false);
  });

  it('без кода страны решает по названию', () => {
    expect(isWithinQuestCoverage({ countryName: 'Беларусь' })).toBe(true);
    expect(isWithinQuestCoverage({ countryName: 'Belarus' })).toBe(true);
    expect(isWithinQuestCoverage({ countryName: 'Вьетнам' })).toBe(false);
    expect(isWithinQuestCoverage({ countryName: 'Польша' })).toBe(false);
  });

  it('без страны решает по координате', () => {
    expect(isWithinQuestCoverage({ coords: [{ lat: 53.9, lng: 27.56 }] })).toBe(true); // Минск
    expect(isWithinQuestCoverage({ coords: [{ lat: 11.92, lng: 108.45 }] })).toBe(false); // Далат
    expect(isWithinQuestCoverage({ coords: [{ lat: 52.23, lng: 21.01 }] })).toBe(false); // Варшава
  });

  it('когда признаков нет — решает сервер, а не эвристика', () => {
    expect(isWithinQuestCoverage({})).toBe(true);
    expect(isWithinQuestCoverage({ cityName: 'Неизвестно' })).toBe(true);
    expect(isWithinQuestCoverage({ coords: [] })).toBe(true);
  });

  it('не падает на мусорных координатах', () => {
    expect(
      isWithinQuestCoverage({ coords: [{ lat: NaN, lng: NaN }, { lat: 53.9, lng: 27.56 }] }),
    ).toBe(true);
  });
});
