// src/services/pdf-export/generators/v2/factories/PageGeneratorFactory.ts
// ✅ FACTORY: Фабрика для создания генераторов страниц

import type { PageGenerator } from '../pages/PageGenerator';
import { CoverPageGenerator } from '../pages/CoverPageGenerator';
import { TocPageGenerator } from '../pages/TocPageGenerator';
import { TravelPageGenerator } from '../pages/TravelPageGenerator';
import { GalleryPageGenerator } from '../pages/GalleryPageGenerator';
import { MapPageGenerator } from '../pages/MapPageGenerator';
import { ChecklistPageGenerator } from '../pages/ChecklistPageGenerator';
import { FinalPageGenerator } from '../pages/FinalPageGenerator';
import type { ImageProcessor } from '../processors/ImageProcessor';

/**
 * Типы страниц
 */
export enum PageType {
  COVER = 'cover',
  TOC = 'toc',
  TRAVEL = 'travel',
  GALLERY = 'gallery',
  MAP = 'map',
  CHECKLIST = 'checklist',
  FINAL = 'final',
}

/**
 * Фабрика для создания генераторов страниц
 *
 * Использует паттерн Factory для централизованного создания
 * всех типов генераторов страниц
 */
export class PageGeneratorFactory {
  private imageProcessor: ImageProcessor;
  private cache: Map<PageType, PageGenerator> = new Map();

  constructor(imageProcessor: ImageProcessor) {
    this.imageProcessor = imageProcessor;
  }

  /**
   * Создает генератор страницы указанного типа
   */
  create(type: PageType): PageGenerator {
    // Используем кэш для синглтонов (генераторы без состояния)
    if (this.cache.has(type)) {
      return this.cache.get(type)!;
    }

    let generator: PageGenerator;

    switch (type) {
      case PageType.COVER:
        generator = new CoverPageGenerator(this.imageProcessor);
        break;

      case PageType.TOC:
        generator = new TocPageGenerator();
        break;

      case PageType.TRAVEL:
        generator = new TravelPageGenerator();
        break;

      case PageType.GALLERY:
        generator = new GalleryPageGenerator(this.imageProcessor);
        break;

      case PageType.MAP:
        generator = new MapPageGenerator();
        break;

      case PageType.CHECKLIST:
        generator = new ChecklistPageGenerator();
        break;

      case PageType.FINAL:
        generator = new FinalPageGenerator();
        break;

      default:
        throw new Error(`Unknown page type: ${type}`);
    }

    // Кэшируем созданный генератор
    this.cache.set(type, generator);
    return generator;
  }

  /**
   * Создает все генераторы (для прогрева кэша)
   */
  createAll(): Map<PageType, PageGenerator> {
    const types = Object.values(PageType);
    types.forEach((type) => this.create(type as PageType));
    return new Map(this.cache);
  }

  /**
   * Очищает кэш генераторов
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Получает список всех доступных типов страниц
   */
  getAvailableTypes(): PageType[] {
    return Object.values(PageType);
  }
}

