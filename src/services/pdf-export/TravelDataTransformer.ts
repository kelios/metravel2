// src/services/pdf-export/TravelDataTransformer.ts
// ✅ АРХИТЕКТУРА: Трансформация данных Travel → TravelForBook

import type { Travel } from '@/src/types/types';
import { TravelForBook } from '@/src/types/pdf-export';
import { ExportError, ExportErrorType } from '@/src/types/pdf-export';

const IMAGE_PROXY_BASE = 'https://images.weserv.nl/?url=';
const DEFAULT_IMAGE_PARAMS = 'w=1600&fit=inside';
const SAFE_COLOR_FALLBACK = '#1f2937';
const PLACEHOLDER_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <rect width="800" height="600" rx="18" ry="18" fill="#f3f4f6"/>
    <path d="M110 450 L220 310 L310 380 L430 270 L690 450" stroke="#d1d5db" stroke-width="20" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="220" cy="300" r="70" fill="#d1d5db"/>
    <circle cx="520" cy="360" r="45" fill="#e5e7eb"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#cbd5f5" font-family="sans-serif" font-size="36">
      Фото недоступно
    </text>
  </svg>`
)}`;

/**
 * Сервис для трансформации данных путешествий
 */
export class TravelDataTransformer {
  /**
   * Преобразует массив Travel в TravelForBook
   */
  transform(travels: Travel[]): TravelForBook[] {
    if (!Array.isArray(travels) || travels.length === 0) {
      throw new ExportError(
        ExportErrorType.TRANSFORMATION_ERROR,
        'Массив путешествий пуст или невалиден'
      );
    }

    return travels.map(travel => this.transformSingle(travel));
  }

  /**
   * Преобразует одно путешествие
   */
  private transformSingle(travel: any): TravelForBook {
    try {
      // ✅ КРИТИЧНО: Логируем входные данные для диагностики
      console.log(`[TravelDataTransformer] INPUT Travel ${travel.id} (${travel.name}):`, {
        hasDescription: travel.description != null,
        descriptionType: typeof travel.description,
        descriptionLength: typeof travel.description === 'string' ? travel.description.length : 0,
        hasGallery: travel.gallery != null,
        galleryType: typeof travel.gallery,
        galleryIsArray: Array.isArray(travel.gallery),
        galleryLength: Array.isArray(travel.gallery) ? travel.gallery.length : 0,
      });
      
      const result: TravelForBook = {
        id: travel.id,
        name: travel.name || '',
        slug: travel.slug,
        url: travel.url,
        description: this.normalizeRichText(travel.description),
        recommendation: this.normalizeRichText(travel.recommendation),
        plus: this.normalizeRichText(travel.plus),
        minus: this.normalizeRichText(travel.minus),
        countryName: travel.countryName || null,
        cityName: travel.cityName || null,
        year: travel.year || null,
        monthName: travel.monthName || null,
        number_days: travel.number_days || null,
        travel_image_thumb_url: travel.travel_image_thumb_url || null,
        travel_image_url: travel.travel_image_url || null,
        gallery: this.transformGallery(travel.gallery),
        travelAddress: this.transformAddresses(travel.travelAddress),
        youtube_link: travel.youtube_link || null,
        userName: travel.userName || null,
      };
      
      // ✅ ОТЛАДКА: Логируем результат преобразования
      console.log(`[TravelDataTransformer] OUTPUT Travel ${travel.id} (${travel.name}):`, {
        description: result.description ? `[${result.description.length} chars]` : 'null',
        descriptionType: typeof result.description,
        recommendation: result.recommendation ? `[${result.recommendation.length} chars]` : 'null',
        gallery: result.gallery ? `[${result.gallery.length} items]` : 'null/undefined',
        galleryType: typeof result.gallery,
        galleryIsArray: Array.isArray(result.gallery),
      });
      
      return result;
    } catch (error) {
      throw new ExportError(
        ExportErrorType.TRANSFORMATION_ERROR,
        `Ошибка преобразования путешествия ${travel.id || 'unknown'}`,
        error instanceof Error ? error : new Error(String(error)),
        { travel }
      );
    }
  }

  /**
   * Удаляет «пустые» HTML / текстовые значения (null, "null", "undefined", пустые строки)
   */
  private normalizeRichText(value: unknown): string | null {
    if (value === undefined || value === null) return null;

    const stringValue = typeof value === 'string' ? value : String(value);
    const trimmed = stringValue.trim();

    if (!trimmed) return null;

    const normalized = trimmed.toLowerCase();
    if (normalized === 'null' || normalized === 'undefined' || normalized === '[]' || normalized === '{}') {
      return null;
    }

    // Удаляем определения CSS-переменных (они ломают html2canvas)
    const withoutVariables = stringValue
      .replace(/--[\w-]+\s*:[^;{}]+;?/gi, '')
      .replace(/:root\s*\{[^}]*\}/gi, '');

    // Заменяем обращения к var(--token) на безопасный цвет
    const withoutVarUsage = withoutVariables.replace(/var\s*\(--[^)]+\)/gi, SAFE_COLOR_FALLBACK);

    // Приводим <img> к безопасным src
    const withSafeImages = withoutVarUsage.replace(
      /<img([^>]*?)src=["']([^"']+)["']([^>]*)>/gi,
      (_match, before, src, after) => {
        const safeSrc = this.buildSafeImageUrl(src);
        return `<img${before}src="${safeSrc}"${after}>`;
      }
    );

    const sanitizedStyles = this.sanitizeInlineStyles(withSafeImages);

    return sanitizedStyles;
  }

  /**
   * Преобразует галерею в нормализованный формат
   */
  private transformGallery(gallery: any): TravelForBook['gallery'] {
    if (!gallery) return undefined;
    if (!Array.isArray(gallery)) {
      console.warn('[TravelDataTransformer] Gallery is not an array:', typeof gallery, gallery);
      return undefined;
    }
    if (gallery.length === 0) return undefined;

    const filtered = gallery
      .filter((g: any) => {
        if (!g) return false;
        const url = typeof g === 'string' ? g : (g.url || g);
        return url && typeof url === 'string' && url.trim().length > 0;
      })
      .map((g: any) => ({
        url: typeof g === 'string' ? g : (g.url || g),
        id: typeof g === 'string' ? undefined : (g.id || g.url),
        updated_at: typeof g === 'string' ? undefined : g.updated_at,
      }));
    
    // Если после фильтрации массив пустой, возвращаем undefined
    if (filtered.length === 0) {
      console.warn('[TravelDataTransformer] Gallery filtered to empty array');
      return undefined;
    }
    
    return filtered;
  }

  /**
   * Преобразует адреса в нормализованный формат
   */
  private transformAddresses(addresses: any): TravelForBook['travelAddress'] {
    if (!addresses) return undefined;
    if (!Array.isArray(addresses)) return undefined;

    return addresses.map((addr: any) => ({
      id: String(addr.id || addr),
      address: typeof addr === 'string' ? addr : (addr.address || addr.name || ''),
      coord: typeof addr === 'string' ? '' : (addr.coord || ''),
      travelImageThumbUrl: typeof addr === 'string' ? undefined : addr.travelImageThumbUrl,
      categoryName: typeof addr === 'string' ? undefined : addr.categoryName,
    }));
  }

  /**
   * Валидирует данные перед трансформацией
   */
  validate(travels: Travel[]): void {
    if (!Array.isArray(travels)) {
      throw new ExportError(
        ExportErrorType.VALIDATION_ERROR,
        'Данные путешествий должны быть массивом'
      );
    }

    if (travels.length === 0) {
      throw new ExportError(
        ExportErrorType.VALIDATION_ERROR,
        'Необходимо выбрать хотя бы одно путешествие'
      );
    }

    travels.forEach((travel, index) => {
      if (!travel || !travel.id) {
        throw new ExportError(
          ExportErrorType.VALIDATION_ERROR,
          `Путешествие на позиции ${index} невалидно: отсутствует ID`
        );
      }

      if (!travel.name || travel.name.trim().length === 0) {
        throw new ExportError(
          ExportErrorType.VALIDATION_ERROR,
          `Путешествие ${travel.id} невалидно: отсутствует название`
        );
      }
    });
  }

  private buildSafeImageUrl(url?: string | null): string {
    if (!url) return PLACEHOLDER_IMAGE;
    const trimmed = String(url).trim();
    if (!trimmed) return PLACEHOLDER_IMAGE;
    if (trimmed.startsWith('data:')) return trimmed;
    if (this.isLocalUrl(trimmed)) return PLACEHOLDER_IMAGE;

    try {
      const normalized = trimmed.replace(/^https?:\/\//i, '');
      const delimiter = encodeURIComponent(normalized);
      return `${IMAGE_PROXY_BASE}${delimiter}&${DEFAULT_IMAGE_PARAMS}`;
    } catch {
      return PLACEHOLDER_IMAGE;
    }
  }

  private isLocalUrl(url: string): boolean {
    const lower = url.toLowerCase();
    return (
      lower.includes('localhost') ||
      lower.includes('127.0.0.1') ||
      lower.includes('192.168.') ||
      lower.startsWith('/') ||
      lower.startsWith('blob:')
    );
  }

  private sanitizeInlineStyles(html: string): string {
    return html.replace(/style\s*=\s*("([^"]*)"|'([^']*)')/gi, (_match, _group, doubleQuoted, singleQuoted) => {
      const styleContent = doubleQuoted ?? singleQuoted ?? '';
      const declarations = styleContent
        .split(';')
        .map((decl) => decl.trim())
        .filter(Boolean)
        .filter((decl) => {
          const invalidValuePattern = /(inherit|initial|unset|currentcolor)/i;
          if (/^color\s*:/i.test(decl) && invalidValuePattern.test(decl)) {
            return false;
          }
          if (/^background-color\s*:/i.test(decl) && invalidValuePattern.test(decl)) {
            return false;
          }
          return true;
        })
        .map((decl) => (decl.endsWith(';') ? decl : `${decl};`));
      if (!declarations.length) {
        return '';
      }
      return `style="${declarations.join(' ')}"`;
    });
  }
}

