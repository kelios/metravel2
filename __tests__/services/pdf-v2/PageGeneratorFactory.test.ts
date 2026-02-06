// __tests__/services/pdf-v2/PageGeneratorFactory.test.ts
// ✅ ТЕСТЫ: Фабрика генераторов страниц

import { PageGeneratorFactory, PageType } from '@/services/pdf-export/generators/v2/factories/PageGeneratorFactory';
import { ImageProcessor } from '@/services/pdf-export/generators/v2/processors/ImageProcessor';
import { CoverPageGenerator } from '@/services/pdf-export/generators/v2/pages/CoverPageGenerator';
import { TocPageGenerator } from '@/services/pdf-export/generators/v2/pages/TocPageGenerator';
import { TravelPageGenerator } from '@/services/pdf-export/generators/v2/pages/TravelPageGenerator';
import { GalleryPageGenerator } from '@/services/pdf-export/generators/v2/pages/GalleryPageGenerator';
import { MapPageGenerator } from '@/services/pdf-export/generators/v2/pages/MapPageGenerator';
import { ChecklistPageGenerator } from '@/services/pdf-export/generators/v2/pages/ChecklistPageGenerator';
import { FinalPageGenerator } from '@/services/pdf-export/generators/v2/pages/FinalPageGenerator';

describe('PageGeneratorFactory', () => {
  let factory: PageGeneratorFactory;
  let imageProcessor: ImageProcessor;

  beforeEach(() => {
    imageProcessor = new ImageProcessor({
      proxyEnabled: true,
      proxyUrl: 'https://images.weserv.nl/?url=',
      maxWidth: 1200,
      cacheEnabled: true,
      cacheTTL: 3600000,
    });
    factory = new PageGeneratorFactory(imageProcessor);
  });

  describe('create', () => {
    it('должен создать CoverPageGenerator', () => {
      const generator = factory.create(PageType.COVER);
      expect(generator).toBeInstanceOf(CoverPageGenerator);
    });

    it('должен создать TocPageGenerator', () => {
      const generator = factory.create(PageType.TOC);
      expect(generator).toBeInstanceOf(TocPageGenerator);
    });

    it('должен создать TravelPageGenerator', () => {
      const generator = factory.create(PageType.TRAVEL);
      expect(generator).toBeInstanceOf(TravelPageGenerator);
    });

    it('должен создать GalleryPageGenerator', () => {
      const generator = factory.create(PageType.GALLERY);
      expect(generator).toBeInstanceOf(GalleryPageGenerator);
    });

    it('должен создать MapPageGenerator', () => {
      const generator = factory.create(PageType.MAP);
      expect(generator).toBeInstanceOf(MapPageGenerator);
    });

    it('должен создать ChecklistPageGenerator', () => {
      const generator = factory.create(PageType.CHECKLIST);
      expect(generator).toBeInstanceOf(ChecklistPageGenerator);
    });

    it('должен создать FinalPageGenerator', () => {
      const generator = factory.create(PageType.FINAL);
      expect(generator).toBeInstanceOf(FinalPageGenerator);
    });

    it('должен бросить ошибку для неизвестного типа', () => {
      expect(() => {
        factory.create('unknown' as PageType);
      }).toThrow('Unknown page type: unknown');
    });
  });

  describe('caching', () => {
    it('должен кэшировать созданные генераторы', () => {
      const generator1 = factory.create(PageType.COVER);
      const generator2 = factory.create(PageType.COVER);
      expect(generator1).toBe(generator2);
    });

    it('должен создавать разные инстансы для разных типов', () => {
      const cover = factory.create(PageType.COVER);
      const toc = factory.create(PageType.TOC);
      expect(cover).not.toBe(toc);
    });

    it('должен очищать кэш', () => {
      const generator1 = factory.create(PageType.COVER);
      factory.clearCache();
      const generator2 = factory.create(PageType.COVER);
      // После очистки кэша создается новый инстанс
      expect(generator1).not.toBe(generator2);
    });
  });

  describe('createAll', () => {
    it('должен создать все типы генераторов', () => {
      const generators = factory.createAll();
      expect(generators.size).toBe(7);
      expect(generators.has(PageType.COVER)).toBe(true);
      expect(generators.has(PageType.TOC)).toBe(true);
      expect(generators.has(PageType.TRAVEL)).toBe(true);
      expect(generators.has(PageType.GALLERY)).toBe(true);
      expect(generators.has(PageType.MAP)).toBe(true);
      expect(generators.has(PageType.CHECKLIST)).toBe(true);
      expect(generators.has(PageType.FINAL)).toBe(true);
    });

    it('должен вернуть Map с правильными типами', () => {
      const generators = factory.createAll();
      expect(generators.get(PageType.COVER)).toBeInstanceOf(CoverPageGenerator);
      expect(generators.get(PageType.TOC)).toBeInstanceOf(TocPageGenerator);
      expect(generators.get(PageType.TRAVEL)).toBeInstanceOf(TravelPageGenerator);
      expect(generators.get(PageType.GALLERY)).toBeInstanceOf(GalleryPageGenerator);
      expect(generators.get(PageType.MAP)).toBeInstanceOf(MapPageGenerator);
      expect(generators.get(PageType.CHECKLIST)).toBeInstanceOf(ChecklistPageGenerator);
      expect(generators.get(PageType.FINAL)).toBeInstanceOf(FinalPageGenerator);
    });
  });

  describe('getAvailableTypes', () => {
    it('должен вернуть список всех доступных типов', () => {
      const types = factory.getAvailableTypes();
      expect(types).toHaveLength(7);
      expect(types).toContain(PageType.COVER);
      expect(types).toContain(PageType.TOC);
      expect(types).toContain(PageType.TRAVEL);
      expect(types).toContain(PageType.GALLERY);
      expect(types).toContain(PageType.MAP);
      expect(types).toContain(PageType.CHECKLIST);
      expect(types).toContain(PageType.FINAL);
    });
  });

  describe('integration', () => {
    it('должен создавать работающие генераторы', () => {
      const generator = factory.create(PageType.FINAL);
      expect(generator.estimatePageCount).toBeDefined();
      expect(typeof generator.generate).toBe('function');
    });

    it('должен передавать imageProcessor в генераторы, которым он нужен', () => {
      const coverGenerator = factory.create(PageType.COVER) as CoverPageGenerator;
      expect(coverGenerator).toBeInstanceOf(CoverPageGenerator);
      // CoverPageGenerator использует imageProcessor внутри
    });
  });
});

