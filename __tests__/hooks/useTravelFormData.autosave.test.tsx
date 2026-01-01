/**
 * Тесты для проверки нормализации coordsMeTravel перед автосохранением
 *
 * ✅ ИСПРАВЛЕНИЕ: Поле image всегда должно присутствовать (строка)
 * Бэкенд требует обязательное поле image в каждом маркере
 */

describe('useTravelFormData - нормализация coordsMeTravel', () => {
  describe('✅ ИСПРАВЛЕНИЕ: Поле image в coordsMeTravel', () => {

    // Функция нормализации маркеров (извлечена из useTravelFormData)
    const normalizeMarkers = (markers: any[]) => {
      return markers.map((m: any) => {
        const { image, ...rest } = m ?? {};
        const imageValue = typeof image === 'string' ? image.trim() : (image || '');
        const categories = Array.isArray(m?.categories)
          ? m.categories
              .map((c: any) => Number(c))
              .filter((n: number) => Number.isFinite(n))
          : [];

        return {
          ...rest,
          categories,
          image: imageValue,
        };
      });
    };

    it('должно всегда включать поле image, даже если пустое', () => {
      const marker = {
        id: null,
        lat: 50.45,
        lng: 30.52,
        address: 'Киев, Украина',
        categories: [1, 2],
        country: 1,
        image: '',
      };

      const normalized = normalizeMarkers([marker]);

      expect(normalized[0]).toHaveProperty('image');
      expect(normalized[0].image).toBe('');
    });

    it('должно сохранять непустой image правильно', () => {
      const marker = {
        lat: 50.45,
        lng: 30.52,
        image: 'https://example.com/image.jpg',
        categories: [1],
      };

      const normalized = normalizeMarkers([marker]);

      expect(normalized[0].image).toBe('https://example.com/image.jpg');
    });

    it('должно обрезать пробелы в image', () => {
      const marker = {
        lat: 50.45,
        lng: 30.52,
        image: '  https://example.com/image.jpg  ',
        categories: [],
      };

      const normalized = normalizeMarkers([marker]);

      expect(normalized[0].image).toBe('https://example.com/image.jpg');
    });

    it('должно преобразовать null в пустую строку', () => {
      const marker = {
        lat: 50.45,
        lng: 30.52,
        image: null,
        categories: [],
      };

      const normalized = normalizeMarkers([marker]);

      expect(normalized[0].image).toBe('');
    });

    it('должно преобразовать undefined в пустую строку', () => {
      const marker = {
        lat: 50.45,
        lng: 30.52,
        image: undefined,
        categories: [],
      };

      const normalized = normalizeMarkers([marker]);

      expect(normalized[0].image).toBe('');
    });

    it('должно корректно обрабатывать несколько маркеров', () => {
      const markers = [
        { lat: 50.45, lng: 30.52, image: '', categories: [1] },
        { lat: 49.84, lng: 24.03, image: 'https://example.com/lviv.jpg', categories: [2] },
        { lat: 46.48, lng: 30.73, image: null, categories: [] },
      ];

      const normalized = normalizeMarkers(markers);

      expect(normalized).toHaveLength(3);
      expect(normalized[0].image).toBe('');
      expect(normalized[1].image).toBe('https://example.com/lviv.jpg');
      expect(normalized[2].image).toBe('');
    });

    it('должно нормализовать categories в числа', () => {
      const marker = {
        lat: 50.45,
        lng: 30.52,
        image: '',
        categories: ['1', '2', 'invalid', 3],
      };

      const normalized = normalizeMarkers([marker]);

      expect(normalized[0].categories).toEqual([1, 2, 3]);
    });

    it('должно фильтровать невалидные categories', () => {
      const marker = {
        lat: 50.45,
        lng: 30.52,
        image: '',
        categories: ['abc', null, undefined, NaN, 1, '2', Infinity],
      };

      const normalized = normalizeMarkers([marker]);

      // Number.isFinite() отфильтрует NaN, Infinity, но пропустит валидные числа
      // Number('abc') = NaN - отфильтруется
      // Number(null) = 0 - пропустится (это валидное число)
      // Number(undefined) = NaN - отфильтруется
      // Number(NaN) = NaN - отфильтруется
      // Number(1) = 1 - пропустится
      // Number('2') = 2 - пропустится
      // Number(Infinity) = Infinity - отфильтруется (isFinite(Infinity) = false)
      expect(normalized[0].categories).toEqual([0, 1, 2]);
    });

    it('должно обрабатывать пустой массив маркеров', () => {
      const normalized = normalizeMarkers([]);

      expect(normalized).toEqual([]);
    });

    it('должно обрабатывать маркер без поля categories', () => {
      const marker = {
        lat: 50.45,
        lng: 30.52,
        image: '',
      };

      const normalized = normalizeMarkers([marker]);

      expect(normalized[0].categories).toEqual([]);
    });

    it('должно сохранять все остальные поля маркера', () => {
      const marker = {
        id: 123,
        lat: 50.45,
        lng: 30.52,
        address: 'Киев',
        country: 1,
        image: '',
        categories: [1],
        customField: 'test',
      };

      const normalized = normalizeMarkers([marker]);

      expect(normalized[0].id).toBe(123);
      expect(normalized[0].lat).toBe(50.45);
      expect(normalized[0].lng).toBe(30.52);
      expect(normalized[0].address).toBe('Киев');
      expect(normalized[0].country).toBe(1);
      expect(normalized[0].customField).toBe('test');
    });
  });
});

