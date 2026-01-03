// src/services/pdf-export/TravelDataTransformer.ts
// ✅ АРХИТЕКТУРА: Трансформация данных Travel → TravelForBook

import type { Travel } from '@/src/types/types';
import { TravelForBook } from '@/src/types/pdf-export';
import { ExportError, ExportErrorType } from '@/src/types/pdf-export';
import { sanitizeRichTextForPdf } from '@/src/utils/sanitizeRichText';

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
        travel_image_thumb_url: this.buildSafeImageUrl(travel.travel_image_thumb_url),
        travel_image_url: travel.travel_image_url ? this.buildSafeImageUrl(travel.travel_image_url) : undefined,
        gallery: this.transformGallery(travel.gallery),
        travelAddress: this.transformAddresses(travel.travelAddress),
        youtube_link: travel.youtube_link || null,
        userName: travel.userName || null,
      };
      
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

    // ✅ КРИТИЧНО: Удаляем React Native компоненты (View, Text) которые могут попасть в HTML
    // Эти компоненты не являются валидными HTML элементами и ломают рендеринг
    // Используем рекурсивный подход для удаления вложенных компонентов
    
    let withoutReactComponents = stringValue;
    let previousLength = 0;
    let iterations = 0;
    const maxIterations = 10; // Защита от бесконечного цикла
    
    // Рекурсивно удаляем React Native компоненты пока они есть
    while (iterations < maxIterations) {
      const currentLength = withoutReactComponents.length;
      if (currentLength === previousLength) break; // Больше нечего удалять
      previousLength = currentLength;
      
      // Удаляем <View> и </View> теги, сохраняя их содержимое
      withoutReactComponents = withoutReactComponents
        .replace(/<View[^>]*>/gi, '')
        .replace(/<\/View>/gi, '')
        // Удаляем <Text> и </Text> теги, сохраняя их содержимое
        .replace(/<Text[^>]*>/gi, '')
        .replace(/<\/Text>/gi, '')
        // Удаляем другие возможные React Native компоненты
        .replace(/<ScrollView[^>]*>.*?<\/ScrollView>/gis, '')
        .replace(/<Image\b[^>]*\/?>/g, '')
        .replace(/<TouchableOpacity[^>]*>.*?<\/TouchableOpacity>/gis, '')
        .replace(/<TouchableHighlight[^>]*>.*?<\/TouchableHighlight>/gis, '')
        .replace(/<SafeAreaView[^>]*>.*?<\/SafeAreaView>/gis, '')
        .replace(/<ActivityIndicator[^>]*\/?>/gi, '');
      
      iterations++;
    }

    // Удаляем определения CSS-переменных (они ломают html2canvas)
    const withoutVariables = withoutReactComponents
      .replace(/--[\w-]+\s*:[^;{}]+;?/gi, '')
      .replace(/:root\s*\{[^}]*\}/gi, '');

    // Заменяем обращения к var(--token) на безопасный цвет
    const withoutVarUsage = withoutVariables.replace(/var\s*\(--[^)]+\)/gi, SAFE_COLOR_FALLBACK);

    // Инлайним самые частые class-based стили (редакторы Quill/WordPress/TinyMCE),
    // чтобы они не терялись в PDF (где CSS классов обычно нет).
    const withInlinedClassStyles = this.inlineKnownClassStyles(withoutVarUsage);

    const sanitizedHtml = sanitizeRichTextForPdf(withInlinedClassStyles);
    const sanitizedStyles = this.sanitizeInlineStyles(sanitizedHtml);

    // ✅ КРИТИЧНО: Убеждаемся что HTML валиден - если остался голый текст без тегов,
    // оборачиваем его в <p> для корректного отображения
    const trimmedResult = sanitizedStyles.trim();
    if (trimmedResult && !trimmedResult.match(/^<[a-z]/i)) {
      // Если строка начинается не с HTML тега, оборачиваем в параграф
      return `<p>${trimmedResult}</p>`;
    }

    return sanitizedStyles;
  }

  private inlineKnownClassStyles(html: string): string {
    // 1) Текстовое выравнивание (Quill)
    const alignMap: Array<{ re: RegExp; style: string }> = [
      { re: /\bql-align-center\b/i, style: 'text-align: center;' },
      { re: /\bql-align-right\b/i, style: 'text-align: right;' },
      { re: /\bql-align-justify\b/i, style: 'text-align: justify;' },
      { re: /\bql-align-left\b/i, style: 'text-align: left;' },
      { re: /\btext-center\b/i, style: 'text-align: center;' },
      { re: /\btext-right\b/i, style: 'text-align: right;' },
    ];

    // 2) Выравнивание изображений (WordPress/TinyMCE)
    const imgAlignMap: Array<{ re: RegExp; style: string }> = [
      { re: /\baligncenter\b/i, style: 'display: block; margin-left: auto; margin-right: auto;' },
      { re: /\balignleft\b/i, style: 'float: left; margin-right: 12pt; margin-bottom: 8pt;' },
      { re: /\balignright\b/i, style: 'float: right; margin-left: 12pt; margin-bottom: 8pt;' },
    ];

    // Общий обработчик: добавляет CSS в style= если class= содержит нужные классы
    return html.replace(
      /<(p|div|section|h[1-6]|img|figure)([^>]*?)>/gi,
      (full, tagNameRaw, attrsRaw) => {
        const tagName = String(tagNameRaw).toLowerCase();
        const attrs = String(attrsRaw || '');
        const classMatch = attrs.match(/\bclass\s*=\s*(['"])(.*?)\1/i);
        if (!classMatch) return full;
        const classValue = classMatch[2] || '';

        const stylesToAdd: string[] = [];
        for (const item of alignMap) {
          if (item.re.test(classValue)) stylesToAdd.push(item.style);
        }
        if (tagName === 'img' || tagName === 'figure') {
          for (const item of imgAlignMap) {
            if (item.re.test(classValue)) stylesToAdd.push(item.style);
          }
        }

        if (stylesToAdd.length === 0) return full;

        const styleMatch = attrs.match(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i);
        if (styleMatch) {
          const quote = styleMatch[1];
          const existing = styleMatch[2] || '';
          const merged = `${existing}${existing.trim().endsWith(';') || existing.trim() === '' ? ' ' : '; '}${stylesToAdd.join(' ')}`;
          const newAttrs = attrs.replace(styleMatch[0], `style=${quote}${merged}${quote}`);
          return `<${tagNameRaw}${newAttrs}>`;
        }

        return `<${tagNameRaw}${attrs} style="${stylesToAdd.join(' ')}">`;
      }
    );
  }

  /**
   * Преобразует галерею в нормализованный формат
   */
  private transformGallery(gallery: any): TravelForBook['gallery'] {
    if (!gallery) return undefined;
    if (!Array.isArray(gallery)) {
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
        url: this.buildSafeImageUrl(typeof g === 'string' ? g : (g.url || g)),
        id: typeof g === 'string' ? undefined : (g.id || g.url),
        updated_at: typeof g === 'string' ? undefined : g.updated_at,
      }));
    
    // Если после фильтрации массив пустой, возвращаем undefined
    if (filtered.length === 0) {
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
      travelImageThumbUrl:
        typeof addr === 'string'
          ? undefined
          : this.buildSafeImageUrl(addr.travelImageThumbUrl),
      categoryName: typeof addr === 'string' ? undefined : addr.categoryName,
    }));
  }

  /**
   * Валидирует данные перед трансформацией
   * ✅ PDF-001: Добавлена валидация размера данных
   */
  validate(travels: Travel[]): void {
    // Константы для валидации
    const MAX_TRAVELS = 50;
    const MAX_TEXT_LENGTH = 50000; // Максимальная длина текста в одном поле
    const MAX_IMAGES_PER_TRAVEL = 30;
    const MAX_TOTAL_IMAGES = 200;
    const MAX_TOTAL_TEXT_LENGTH = 500000; // Общая длина всего текста

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

    // ✅ PDF-001: Проверка максимального количества путешествий
    if (travels.length > MAX_TRAVELS) {
      throw new ExportError(
        ExportErrorType.VALIDATION_ERROR,
        `Слишком много путешествий выбрано (${travels.length}). Максимум ${MAX_TRAVELS} путешествий для одного экспорта.`
      );
    }

    let totalImages = 0;
    let totalTextLength = 0;

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

      // ✅ PDF-001: Проверка длины текстовых полей
      const textFields = [
        travel.description,
        travel.recommendation,
        travel.plus,
        travel.minus,
      ].filter(Boolean);

      textFields.forEach((text, fieldIndex) => {
        const textLength = typeof text === 'string' ? text.length : String(text).length;
        if (textLength > MAX_TEXT_LENGTH) {
          const fieldNames = ['описание', 'рекомендации', 'плюсы', 'минусы'];
          throw new ExportError(
            ExportErrorType.VALIDATION_ERROR,
            `Путешествие "${travel.name}" содержит слишком длинное ${fieldNames[fieldIndex]} (${textLength} символов). Максимум ${MAX_TEXT_LENGTH} символов.`
          );
        }
        totalTextLength += textLength;
      });

      // ✅ PDF-001: Проверка количества изображений
      const galleryCount = Array.isArray(travel.gallery) ? travel.gallery.length : 0;
      const thumbCount = travel.travel_image_thumb_url ? 1 : 0;
      const imageCount = galleryCount + thumbCount;

      if (imageCount > MAX_IMAGES_PER_TRAVEL) {
        throw new ExportError(
          ExportErrorType.VALIDATION_ERROR,
          `Путешествие "${travel.name}" содержит слишком много изображений (${imageCount}). Максимум ${MAX_IMAGES_PER_TRAVEL} изображений на путешествие.`
        );
      }

      totalImages += imageCount;
    });

    // ✅ PDF-001: Проверка общего количества изображений
    if (totalImages > MAX_TOTAL_IMAGES) {
      throw new ExportError(
        ExportErrorType.VALIDATION_ERROR,
        `Слишком много изображений в выбранных путешествиях (${totalImages}). Максимум ${MAX_TOTAL_IMAGES} изображений для одного экспорта.`
      );
    }

    // ✅ PDF-001: Проверка общей длины текста
    if (totalTextLength > MAX_TOTAL_TEXT_LENGTH) {
      throw new ExportError(
        ExportErrorType.VALIDATION_ERROR,
        `Слишком много текста в выбранных путешествиях (${totalTextLength} символов). Максимум ${MAX_TOTAL_TEXT_LENGTH} символов для одного экспорта.`
      );
    }
  }

  private buildSafeImageUrl(url?: string | null): string {
    if (!url) return PLACEHOLDER_IMAGE;
    const trimmed = String(url).trim();
    if (!trimmed) return PLACEHOLDER_IMAGE;
    if (trimmed.startsWith('data:')) return trimmed;
    if (this.isLocalUrl(trimmed)) return trimmed;
    if (/^https?:\/\/images\.weserv\.nl\//i.test(trimmed)) {
      return trimmed;
    }
    // Протокол-относительные URL
    if (trimmed.startsWith('//')) {
      return this.buildSafeImageUrl(`https:${trimmed}`);
    }
    // Относительные пути ("/storage/...") и ресурсы текущего домена считаем безопасными
    if (trimmed.startsWith('/')) {
      if (typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}${trimmed}`;
      }
      // В средах без window используем продовый домен
      return `https://metravel.by${trimmed}`;
    }

    // Если это относительный путь без протокола и без ведущего '/',
    // считаем его путём на нашем домене (часто приходит из CMS как `uploads/...` или `storage/...`).
    // Пример: `uploads/photo.jpg` -> `https://metravel.by/uploads/photo.jpg`
    if (!/^https?:\/\//i.test(trimmed) && !trimmed.includes('://')) {
      return this.buildSafeImageUrl(`https://metravel.by/${trimmed.replace(/^\/+/, '')}`);
    }

    // Если URL указывает на локальную сеть (dev backend), он будет недоступен в печати/PDF.
    // Переписываем origin на продовый домен, сохраняя path + query.
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      const isLocalhost = host === 'localhost' || host === '127.0.0.1';
      const isPrivateV4 =
        /^192\.168\./.test(host) ||
        /^10\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

      if (isLocalhost || isPrivateV4) {
        const rewritten = new URL(trimmed);
        rewritten.protocol = 'https:';
        rewritten.host = 'metravel.by';
        return this.buildSafeImageUrl(rewritten.toString());
      }
    } catch {
      // ignore URL parse errors
    }

    try {
      const absolute = /^https?:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed.replace(/^\/+/, '')}`;
      const normalized = absolute.replace(/^https?:\/\//i, '');
      const delimiter = encodeURIComponent(normalized);
      return `${IMAGE_PROXY_BASE}${delimiter}&${DEFAULT_IMAGE_PARAMS}`;
    } catch {
      return PLACEHOLDER_IMAGE;
    }
  }

  private isLocalUrl(url: string): boolean {
    const lower = url.toLowerCase();
    // Оставляем только blob:-URL как локальные (их нельзя безопасно проксировать)
    return lower.startsWith('blob:');
  }

  private sanitizeInlineStyles(html: string): string {
    return html.replace(/style\s*=\s*("([^"]*)"|'([^']*)')/gi, (_match, _group, doubleQuoted, singleQuoted) => {
      const styleContent = doubleQuoted ?? singleQuoted ?? '';
      const declarations = styleContent
        .split(';')
        .map((decl: string) => decl.trim())
        .filter(Boolean)
        .filter((decl: string) => {
          const invalidValuePattern = /(inherit|initial|unset|currentcolor)/i;
          if (/^color\s*:/i.test(decl) && invalidValuePattern.test(decl)) {
            return false;
          }
          if (/^background-color\s*:/i.test(decl) && invalidValuePattern.test(decl)) {
            return false;
          }
          return true;
        })
        .map((decl: string) => (decl.endsWith(';') ? decl : `${decl};`));
      if (!declarations.length) {
        return '';
      }
      return `style="${declarations.join(' ')}"`;
    });
  }
}
