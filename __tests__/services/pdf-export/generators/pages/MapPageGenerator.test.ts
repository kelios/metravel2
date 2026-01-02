// __tests__/services/pdf-export/generators/pages/MapPageGenerator.test.ts

import { MapPageGenerator } from '@/src/services/pdf-export/generators/pages';
import { minimalTheme } from '@/src/services/pdf-export/themes/PdfThemeConfig';

describe('MapPageGenerator', () => {
  let generator: MapPageGenerator;

  beforeEach(() => {
    generator = new MapPageGenerator(minimalTheme);
  });

  const mockTravel = {
    id: 1,
    name: 'Париж',
  };

  const mockLocations = [
    {
      id: '1',
      address: 'Эйфелева башня',
      coord: '48.8584,2.2945',
      categoryName: 'Достопримечательность',
    },
    {
      id: '2',
      address: 'Лувр',
      coord: '48.8606,2.3376',
      categoryName: 'Музей',
    },
  ];

  describe('generate', () => {
    it('должен генерировать HTML страницы с картой', async () => {
      const html = await generator.generate(mockTravel, mockLocations, 10);

      expect(html).toContain('Карта путешествия');
      expect(html).toContain('Париж');
      expect(html).toContain('pdf-page');
      expect(html).toContain('map-page');
    });

    it('должен отображать легенду с локациями', async () => {
      const html = await generator.generate(mockTravel, mockLocations, 10);

      expect(html).toContain('Эйфелева башня');
      expect(html).toContain('Лувр');
      expect(html).toContain('Достопримечательность');
      expect(html).toContain('Музей');
    });

    it('должен отображать количество локаций', async () => {
      const html = await generator.generate(mockTravel, mockLocations, 10);

      expect(html).toContain('Локации (2)');
    });

    it('должен отображать номера локаций', async () => {
      const html = await generator.generate(mockTravel, mockLocations, 10);

      expect(html).toContain('>1<');
      expect(html).toContain('>2<');
    });

    it('должен отображать номер страницы', async () => {
      const html = await generator.generate(mockTravel, mockLocations, 15);

      expect(html).toContain('>15<');
    });

    it('должен обрабатывать пустой список локаций', async () => {
      const html = await generator.generate(mockTravel, [], 10);

      expect(html).toContain('Карта путешествия');
      expect(html).toContain('Париж');
    });

    it('должен экранировать HTML в адресах', async () => {
      const locations = [
        {
          id: '1',
          address: '<script>alert("xss")</script>',
          coord: '48.8584,2.2945',
        },
      ];

      const html = await generator.generate(mockTravel, locations, 10);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('должен правильно склонять "локация"', async () => {
      const locations1 = [mockLocations[0]];
      const html1 = await generator.generate(mockTravel, locations1, 10);
      expect(html1).toContain('Локации (1)');

      const locations2 = mockLocations;
      const html2 = await generator.generate(mockTravel, locations2, 10);
      expect(html2).toContain('Локации (2)');

      const locations5 = Array.from({ length: 5 }, (_, i) => ({
        id: String(i),
        address: `Место ${i}`,
        coord: '48.8584,2.2945',
      }));
      const html5 = await generator.generate(mockTravel, locations5, 10);
      expect(html5).toContain('Локации (5)');
    });

    it('должен отображать сообщение о дополнительных локациях', async () => {
      const manyLocations = Array.from({ length: 12 }, (_, i) => ({
        id: String(i),
        address: `Место ${i}`,
        coord: '48.8584,2.2945',
      }));

      const html = await generator.generate(mockTravel, manyLocations, 10);

      expect(html).toContain('И еще 4');
    });
  });

  describe('map image generation', () => {
    it('должен генерировать placeholder карту', async () => {
      const html = await generator.generate(mockTravel, mockLocations, 10);

      // Without a Google Maps API key in tests, MapPageGenerator falls back to an OSM static map URL.
      // In some environments it may also use Google Static Maps (if EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is set)
      // or a data URI placeholder as a last resort.
      expect(html).toMatch(
        /(data:image\/svg\+xml|staticmap\.openstreetmap\.fr\/staticmap\.php|maps\.googleapis\.com\/maps\/api\/staticmap)/
      );
    });

    it('должен обрабатывать локации без координат', async () => {
      const locationsWithoutCoords = [
        {
          id: '1',
          address: 'Неизвестное место',
          coord: 'invalid',
        },
      ];

      const html = await generator.generate(mockTravel, locationsWithoutCoords, 10);

      expect(html).toContain('Карта путешествия');
    });
  });
});
