/**
 * Тесты для утилит расчета расстояния и времени
 */

import {
  calculateDistance,
  formatDistance,
  formatDistanceMeters,
  ROUTE_DISTANCE_FORMAT,
  calculateTravelTime,
  formatTravelTime,
  getDistanceInfo,
} from '@/utils/distanceCalculator';
import { i18n } from '@/i18n';

describe('distanceCalculator', () => {
  describe('calculateDistance', () => {
    it('должен правильно рассчитывать расстояние между двумя точками', () => {
      // Минск - Гродно (примерно 250 км)
      const minsk = { lat: 53.9045, lng: 27.5615 };
      const grodno = { lat: 53.6693, lng: 23.8131 };

      const distance = calculateDistance(minsk, grodno);

      // Проверяем с погрешностью ±10%
      expect(distance).toBeGreaterThan(225);
      expect(distance).toBeLessThan(275);
    });

    it('должен возвращать 0 для одной и той же точки', () => {
      const point = { lat: 53.9045, lng: 27.5615 };
      const distance = calculateDistance(point, point);

      expect(distance).toBe(0);
    });

    it('должен правильно работать для близких точек', () => {
      const point1 = { lat: 53.9045, lng: 27.5615 };
      const point2 = { lat: 53.9055, lng: 27.5625 }; // ~100 метров

      const distance = calculateDistance(point1, point2);

      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(1); // меньше километра
    });
  });

  describe('formatDistance', () => {
    it('должен форматировать расстояние меньше 1 км в метрах', () => {
      expect(formatDistance(0.5)).toBe('500 м');
      expect(formatDistance(0.123)).toBe('123 м');
    });

    it('должен форматировать расстояние 1-10 км с одним знаком', () => {
      expect(formatDistance(1.5)).toBe('1,5 км');
      expect(formatDistance(9.9)).toBe('9,9 км');
    });

    it('должен форматировать расстояние больше 10 км округленно', () => {
      expect(formatDistance(15.6)).toBe('16 км');
      expect(formatDistance(150.4)).toBe('150 км');
    });

    // #1433: десятичный разделитель берётся из локали интерфейса, а не из toFixed
    const localeCases: Array<[string, string, string, string]> = [
      // локаль, 1 км, 2.5 км, 100 км
      ['ru', '1,0 км', '2,5 км', '100 км'],
      ['be', '1,0 км', '2,5 км', '100 км'],
      ['uk', '1,0 км', '2,5 км', '100 км'],
      ['pl', '1,0 km', '2,5 km', '100 km'],
      ['en', '1.0 km', '2.5 km', '100 km'],
    ];

    describe('десятичный разделитель по локали', () => {
      afterEach(async () => {
        await i18n.changeLanguage('ru');
      });

      it.each(localeCases)(
        'форматирует дробные километры по нормам локали %s',
        async (locale, one, twoAndHalf, hundred) => {
          await i18n.changeLanguage(locale);

          expect(formatDistance(1)).toBe(one);
          expect(formatDistance(2.5)).toBe(twoAndHalf);
          // ≥10 км округляется до целого — дробной части быть не должно
          expect(formatDistance(100)).toBe(hundred);
          // <1 км уходит в метровую ветку, дробной части там нет вовсе
          expect(formatDistance(0)).toBe(locale === 'ru' || locale === 'be' || locale === 'uk' ? '0 м' : '0 m');
        },
      );
    });

    // #1440: у больших чисел разряды тоже локальные — «2800 км» вместо
    // «2 800 км» читается как другое число. Порог группировки берётся из
    // локали: be/pl группируют только с пяти цифр (minimumGroupingDigits=2).
    describe('разделитель разрядов по локали', () => {
      afterEach(async () => {
        await i18n.changeLanguage('ru');
      });

      it.each([
        ['ru', '2\u00a0800 км', '12\u00a0000 км'],
        ['be', '2800 км', '12\u00a0000 км'],
        ['uk', '2\u00a0800 км', '12\u00a0000 км'],
        ['pl', '2800 km', '12\u00a0000 km'],
        ['en', '2,800 km', '12,000 km'],
      ] as const)('печатает разряды по нормам локали %s', async (locale, small, large) => {
        await i18n.changeLanguage(locale);

        expect(formatDistance(2800)).toBe(small);
        expect(formatDistance(12000)).toBe(large);
      });
    });
  });

  // #1440: панель маршрута на карте и валидатор длины считают в метрах и
  // держат дробный километр дольше, чем списки, — но форматтер один.
  describe('formatDistanceMeters', () => {
    afterEach(async () => {
      await i18n.changeLanguage('ru');
    });

    it('переводит метры в ту же ветку, что и километры', () => {
      expect(formatDistanceMeters(800)).toBe('800 м');
      expect(formatDistanceMeters(1500)).toBe('1,5 км');
      expect(formatDistanceMeters(15_600)).toBe('16 км');
    });

    it('в режиме маршрута держит дробный километр до 1000 км', () => {
      expect(formatDistanceMeters(11_400, ROUTE_DISTANCE_FORMAT)).toBe('11,4 км');
      expect(formatDistanceMeters(512_300, ROUTE_DISTANCE_FORMAT)).toBe('512,3 км');
      expect(formatDistanceMeters(2_800_000, ROUTE_DISTANCE_FORMAT)).toBe('2\u00a0800 км');
    });

    it('в режиме маршрута берёт разделители из локали', async () => {
      await i18n.changeLanguage('en');

      expect(formatDistanceMeters(11_400, ROUTE_DISTANCE_FORMAT)).toBe('11.4 km');
      expect(formatDistanceMeters(2_800_000, ROUTE_DISTANCE_FORMAT)).toBe('2,800 km');
    });
  });

  describe('calculateTravelTime', () => {
    it('должен правильно рассчитывать время для авто (50 км/ч)', () => {
      expect(calculateTravelTime(50, 'car')).toBe(60); // 1 час
      expect(calculateTravelTime(25, 'car')).toBe(30); // 30 минут
    });

    it('должен правильно рассчитывать время для велосипеда (15 км/ч)', () => {
      expect(calculateTravelTime(15, 'bike')).toBe(60); // 1 час
      expect(calculateTravelTime(7.5, 'bike')).toBe(30); // 30 минут
    });

    it('должен правильно рассчитывать время пешком (5 км/ч)', () => {
      expect(calculateTravelTime(5, 'foot')).toBe(60); // 1 час
      expect(calculateTravelTime(2.5, 'foot')).toBe(30); // 30 минут
    });

    it('должен использовать car по умолчанию', () => {
      expect(calculateTravelTime(50)).toBe(60);
    });
  });

  describe('formatTravelTime', () => {
    it('должен форматировать время меньше 1 минуты', () => {
      expect(formatTravelTime(0)).toBe('< 1 мин');
      expect(formatTravelTime(0.5)).toBe('< 1 мин');
    });

    it('должен форматировать время в минутах', () => {
      expect(formatTravelTime(1)).toBe('1 мин');
      expect(formatTravelTime(30)).toBe('30 мин');
      expect(formatTravelTime(59)).toBe('59 мин');
    });

    it('должен форматировать время в часах без минут', () => {
      expect(formatTravelTime(60)).toBe('1 ч');
      expect(formatTravelTime(120)).toBe('2 ч');
    });

    it('должен форматировать время в часах с минутами', () => {
      expect(formatTravelTime(90)).toBe('1 ч 30 мин');
      expect(formatTravelTime(145)).toBe('2 ч 25 мин');
    });
  });

  describe('getDistanceInfo', () => {
    it('должен возвращать полную информацию о расстоянии', () => {
      const from = { lat: 53.9045, lng: 27.5615 };
      const to = { lat: 53.9145, lng: 27.5715 }; // ~1.2 км

      const info = getDistanceInfo(from, to, 'car');

      expect(info).not.toBeNull();
      expect(info?.distance).toBeGreaterThan(0);
      expect(info?.distanceText).toBeTruthy();
      expect(info?.travelTime).toBeGreaterThan(0);
      expect(info?.travelTimeText).toBeTruthy();
    });

    it('должен возвращать null если нет координат from', () => {
      const to = { lat: 53.9055, lng: 27.5625 };

      const info = getDistanceInfo(null, to, 'car');

      expect(info).toBeNull();
    });

    it('должен правильно работать с разными режимами транспорта', () => {
      const from = { lat: 53.9045, lng: 27.5615 };
      const to = { lat: 53.9545, lng: 27.6115 }; // ~7 км

      const carInfo = getDistanceInfo(from, to, 'car');
      const bikeInfo = getDistanceInfo(from, to, 'bike');
      const footInfo = getDistanceInfo(from, to, 'foot');

      // Расстояние одинаковое
      expect(carInfo?.distance).toBe(bikeInfo?.distance);
      expect(bikeInfo?.distance).toBe(footInfo?.distance);

      // Время разное (пешком > велосипед > авто)
      expect(footInfo!.travelTime).toBeGreaterThan(bikeInfo!.travelTime);
      expect(bikeInfo!.travelTime).toBeGreaterThan(carInfo!.travelTime);
    });
  });
});

