// src/services/pdf-export/parsers/ArticleParser.ts
// ✅ АРХИТЕКТУРА: Парсер HTML статьи путешествия в ArticlePdfModel

import type { ArticlePdfModel, Section, ImageRef, MapPoint, RecommendationBlock } from '@/src/types/article-pdf';
import type { Travel } from '@/src/types/types';
import { ContentParser, type ParsedContentBlock } from './ContentParser';

/**
 * Парсер статьи путешествия в модель для PDF
 */
export class ArticleParser {
  private contentParser: ContentParser;

  constructor() {
    this.contentParser = new ContentParser();
  }

  /**
   * Парсит путешествие в модель для PDF
   */
  parse(travel: Travel): ArticlePdfModel {
    const sections: Section[] = [];
    
    // Парсим описание
    if (travel.description) {
      const descriptionBlocks = this.contentParser.parse(travel.description);
      const convertedSections = this.convertBlocksToSections(descriptionBlocks);
      sections.push(...convertedSections);
      
      // Отладочная информация
      if (typeof console !== 'undefined') {
        console.log('[ArticleParser] Description blocks:', descriptionBlocks.length);
        console.log('[ArticleParser] Converted sections:', convertedSections.length);
      }
    } else {
      // Если нет описания, добавляем заголовок
      sections.push({
        type: 'heading',
        level: 2,
        text: travel.name || 'Описание',
      });
      sections.push({
        type: 'paragraph',
        text: 'Описание путешествия отсутствует.',
      });
    }

    // Парсим рекомендации
    if (travel.recommendation) {
      const recommendationBlocks = this.contentParser.parse(travel.recommendation);
      sections.push(...this.convertBlocksToSections(recommendationBlocks));
    }

    // Парсим плюсы
    if (travel.plus) {
      sections.push({
        type: 'heading',
        level: 2,
        text: 'Что понравилось',
      });
      const plusBlocks = this.contentParser.parse(travel.plus);
      sections.push(...this.convertBlocksToSections(plusBlocks));
    }

    // Парсим минусы
    if (travel.minus) {
      sections.push({
        type: 'heading',
        level: 2,
        text: 'Что не зашло',
      });
      const minusBlocks = this.contentParser.parse(travel.minus);
      sections.push(...this.convertBlocksToSections(minusBlocks));
    }

    // Извлекаем метаданные
    const meta = this.extractMeta(travel);

    // Извлекаем обложку
    const coverImage = this.extractCoverImage(travel);

    // Извлекаем галерею
    const gallery = this.extractGallery(travel);

    // Извлекаем карту
    const map = this.extractMap(travel);

    // Извлекаем рекомендации
    const recommendations = this.extractRecommendations(travel);

    return {
      title: travel.name || 'Путешествие',
      subtitle: this.extractSubtitle(travel),
      author: travel.userName || 'MeTravel',
      coverImage,
      meta,
      sections,
      map,
      recommendations,
      gallery,
    };
  }

  /**
   * Конвертирует блоки контента в секции статьи
   */
  private convertBlocksToSections(blocks: ParsedContentBlock[]): Section[] {
    const sections: Section[] = [];

    if (!blocks || blocks.length === 0) {
      // Если блоков нет, возвращаем пустой массив
      return sections;
    }

    for (const block of blocks) {
      switch (block.type) {
        case 'heading':
          // Принимаем все уровни заголовков, но нормализуем H1-H6 в H2-H3
          if (block.level >= 1 && block.level <= 6) {
            const normalizedLevel = block.level === 1 ? 2 : (block.level > 3 ? 3 : block.level) as 2 | 3;
            sections.push({
              type: 'heading',
              level: normalizedLevel,
              text: block.text,
            });
          }
          break;

        case 'paragraph':
          sections.push({
            type: 'paragraph',
            text: block.text,
            html: block.html,
          });
          break;

        case 'list':
          sections.push({
            type: 'list',
            ordered: block.ordered,
            items: block.items,
          });
          break;

        case 'quote':
          sections.push({
            type: 'quote',
            text: block.text,
            author: block.author,
          });
          break;

        case 'image':
          sections.push({
            type: 'image',
            image: {
              url: block.src,
              alt: block.alt,
              caption: block.caption,
              width: block.width,
              height: block.height,
            },
            caption: block.caption,
          });
          break;

        case 'image-gallery':
          sections.push({
            type: 'imageGallery',
            images: block.images.map((img) => ({
              url: img.src,
              alt: img.alt,
              caption: img.caption,
            })),
          });
          break;

        case 'info-block':
        case 'tip-block':
        case 'warning-block':
        case 'danger-block':
          const variant = this.mapBlockTypeToVariant(block.type);
          sections.push({
            type: 'infoBlock',
            variant,
            text: block.content,
            title: block.title,
          });
          break;
      }
    }

    return sections;
  }

  /**
   * Маппит тип блока в вариант инфоблока
   */
  private mapBlockTypeToVariant(
    type: 'info-block' | 'tip-block' | 'warning-block' | 'danger-block'
  ): 'tip' | 'important' | 'warning' | 'recommendation' {
    switch (type) {
      case 'tip-block':
        return 'tip';
      case 'warning-block':
        return 'warning';
      case 'danger-block':
        return 'warning';
      case 'info-block':
      default:
        return 'important';
    }
  }

  /**
   * Извлекает метаданные из путешествия
   */
  private extractMeta(travel: Travel): ArticlePdfModel['meta'] {
    return {
      country: travel.countryName,
      region: travel.cityName,
      days: travel.number_days,
      // Дополнительные поля можно добавить, если они есть в типе Travel
    };
  }

  /**
   * Извлекает обложку
   */
  private extractCoverImage(travel: Travel): ImageRef | undefined {
    const firstImage = travel.gallery?.[0];
    if (!firstImage) {
      // Пытаемся использовать travel_image_thumb_url
      if (travel.travel_image_thumb_url) {
        return {
          url: travel.travel_image_thumb_url,
          alt: travel.name,
        };
      }
      return undefined;
    }

    // Преобразуем строку в объект, если нужно
    const imageUrl = typeof firstImage === 'string' ? firstImage : (firstImage as any)?.url || firstImage;
    
    return {
      url: imageUrl,
      alt: travel.name,
    };
  }

  /**
   * Извлекает галерею
   */
  private extractGallery(travel: Travel): ImageRef[] {
    if (!travel.gallery || travel.gallery.length === 0) {
      return [];
    }

    return travel.gallery.map((img, index) => {
      const imageUrl = typeof img === 'string' ? img : (img as any)?.url || img;
      return {
        url: imageUrl,
        alt: `${travel.name} - фото ${index + 1}`,
      };
    });
  }

  /**
   * Извлекает карту
   */
  private extractMap(travel: Travel): ArticlePdfModel['map'] | undefined {
    if (!travel.coordsMeTravel || travel.coordsMeTravel.length === 0) {
      return undefined;
    }

    // Преобразуем координаты в точки
    const points: MapPoint[] = travel.coordsMeTravel.map((coord, index) => {
      const address = travel.travelAddress?.[index];
      const name = typeof address === 'string' 
        ? address 
        : (address as any)?.name || (address as any)?.address || `Точка ${index + 1}`;
      
      return {
        name,
        lat: typeof coord === 'object' && 'lat' in coord ? coord.lat : parseFloat(String(coord).split(',')[0] || '0'),
        lng: typeof coord === 'object' && 'lng' in coord ? coord.lng : parseFloat(String(coord).split(',')[1] || '0'),
        description: typeof address === 'object' && 'description' in address ? (address as any).description : undefined,
      };
    });

    // Вычисляем расстояния между точками
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      points[i].distance = this.calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
    }

    // Генерируем URL статичной карты
    // TODO: Можно улучшить, добавив реальный API ключ или используя другой сервис
    const mapImageUrl = this.generateMapImageUrl(points);

    return {
      image: {
        url: mapImageUrl,
        alt: 'Карта маршрута',
      },
      points,
    };
  }

  /**
   * Генерирует URL для статичной карты
   * TODO: Можно заменить на реальный API или сервис генерации карт
   */
  private generateMapImageUrl(points: MapPoint[]): string {
    if (points.length === 0) return '';

    // Используем OpenStreetMap через статичный сервис
    // В продакшене можно использовать Google Static Maps, Mapbox и т.д.
    const centerLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const centerLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
    
    // Простой fallback - можно заменить на реальный API
    // Для демонстрации используем placeholder
    return `https://api.mapbox.com/styles/v1/mapbox/outdoors-v11/static/path-5+ff9f5a-0.8(${points.map((p) => `${p.lng},${p.lat}`).join(';')})/auto/800x600@2x?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw`;
  }

  /**
   * Вычисляет расстояние между двумя точками в км (формула гаверсинуса)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Радиус Земли в км
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10; // Округляем до 0.1 км
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Извлекает рекомендации
   */
  private extractRecommendations(travel: Travel): RecommendationBlock[] {
    const recommendations: RecommendationBlock[] = [];

    // Рекомендации из travelAddress
    if (travel.travelAddress && travel.travelAddress.length > 0) {
      const places = travel.travelAddress.map((addr) => {
        if (typeof addr === 'string') return addr;
        return (addr as any)?.name || (addr as any)?.address || String(addr);
      });

      recommendations.push({
        title: 'Посещенные места',
        items: places,
        type: 'list',
      });
    }

    return recommendations;
  }

  /**
   * Извлекает подзаголовок
   */
  private extractSubtitle(travel: Travel): string | undefined {
    // Можно извлечь из description или других полей
    if (travel.description) {
      const text = travel.description.replace(/<[^>]*>/g, '').trim();
      const firstSentence = text.split(/[.!?]/)[0];
      if (firstSentence && firstSentence.length > 20 && firstSentence.length < 150) {
        return firstSentence;
      }
    }
    return undefined;
  }
}

