// src/services/pdf-export/constructor/importers/ArticleImporter.ts
// ✅ АРХИТЕКТУРА: Импортер статьи в конструктор

import type { PdfDocument, PdfPage, PdfBlock, PdfTheme } from '@/src/types/pdf-constructor';
import type { Travel } from '@/src/types/types';
import { PdfDocumentBuilder } from '../PdfDocumentBuilder';
import { ArticleParser } from '../../parsers/ArticleParser';
import type { ArticlePdfModel, Section } from '@/src/types/article-pdf';
import { PAGE_FORMATS } from '@/src/types/pdf-constructor';
import { ArticleValidator } from '../validators/ArticleValidator';

/**
 * Импортер статьи в конструктор
 * Преобразует Travel в PdfDocument с блоками
 */
export class ArticleImporter {
  private parser: ArticleParser;
  private validator: ArticleValidator;

  constructor() {
    this.parser = new ArticleParser();
    this.validator = new ArticleValidator();
  }

  /**
   * Импортирует статью в конструктор
   */
  import(travel: Travel, theme: PdfTheme): PdfDocument {
    // Валидируем Travel объект
    const validation = this.validator.validate(travel);
    if (!validation.valid) {
      console.error('Ошибки валидации:', validation.errors);
      // Продолжаем импорт, но логируем ошибки
    }
    if (validation.warnings.length > 0) {
      console.warn('Предупреждения валидации:', validation.warnings);
    }

    // Парсим статью в модель
    const model = this.parser.parse(travel);

    // Создаем билдер
    const builder = new PdfDocumentBuilder(travel.name || 'Путешествие', 'A4', 'portrait');
    builder.setTheme(theme);

    // Создаем обложку
    this.createCoverPage(builder, model, theme);

    // Создаем страницу с оглавлением (если есть заголовки)
    const headings = model.sections.filter((s) => s.type === 'heading' && s.level === 2);
    if (headings.length > 0) {
      this.createTocPage(builder, headings, theme);
    }

    // Создаем страницу с метаданными
    this.createMetaPage(builder, model, theme);

    // Создаем страницы с контентом
    this.createContentPages(builder, model, theme);

    // Создаем страницу с картой (если есть)
    if (model.map) {
      this.createMapPage(builder, model.map, theme);
    }

    // Создаем страницу с рекомендациями (если есть)
    if (model.recommendations && model.recommendations.length > 0) {
      this.createRecommendationsPage(builder, model.recommendations, theme);
    }

    return builder.getDocument();
  }

  /**
   * Создает обложку
   */
  private createCoverPage(
    builder: PdfDocumentBuilder,
    model: ArticlePdfModel,
    theme: PdfTheme
  ): void {
    const page = builder.addPage();
    const format = PAGE_FORMATS[page.format];
    const width = format.width;
    const height = format.height;

    // Фоновое изображение (если есть)
    if (model.coverImage) {
      builder.addBlock(page.id, {
        type: 'image',
        position: { x: 0, y: 0, width, height, unit: 'mm' },
        styles: {},
        content: {
          url: model.coverImage.url,
          alt: model.coverImage.alt,
          fit: 'cover',
        },
      });
    }

    // Заголовок
    builder.addBlock(page.id, {
      type: 'heading-h1',
      position: { x: 20, y: height / 2 - 60, width: width - 40, height: 50, unit: 'mm' },
      styles: {
        fontSize: theme.typography.headingSizes.h1 * 1.5,
        fontWeight: 'bold',
        textAlign: 'center',
        color: theme.colors.text,
      },
      content: model.title,
    });

    // Подзаголовок (если есть)
    if (model.subtitle) {
      builder.addBlock(page.id, {
        type: 'paragraph',
        position: { x: 20, y: height / 2, width: width - 40, height: 30, unit: 'mm' },
        styles: {
          fontSize: theme.typography.bodySize * 1.2,
          textAlign: 'center',
          color: theme.colors.textSecondary,
        },
        content: model.subtitle,
      });
    }

    // Автор
    if (model.author) {
      builder.addBlock(page.id, {
        type: 'paragraph',
        position: { x: 20, y: height - 60, width: width - 40, height: 20, unit: 'mm' },
        styles: {
          fontSize: theme.typography.bodySize,
          textAlign: 'center',
          color: theme.colors.textSecondary,
        },
        content: model.author,
      });
    }
  }

  /**
   * Создает страницу оглавления
   */
  private createTocPage(
    builder: PdfDocumentBuilder,
    headings: Section[],
    theme: PdfTheme
  ): void {
    const page = builder.addPage();
    const format = PAGE_FORMATS[page.format];
    const width = format.width;
    const height = format.height;

    // Заголовок
    builder.addBlock(page.id, {
      type: 'heading-h1',
      position: { x: 20, y: 20, width: width - 40, height: 30, unit: 'mm' },
      styles: {
        fontSize: theme.typography.headingSizes.h1,
        fontWeight: 'bold',
        color: theme.colors.text,
      },
      content: 'Оглавление',
    });

    // Элементы оглавления
    let y = 60;
    headings.forEach((heading, index) => {
      if (heading.type === 'heading') {
        builder.addBlock(page.id, {
          type: 'paragraph',
          position: { x: 20, y, width: width - 60, height: 20, unit: 'mm' },
          styles: {
            fontSize: theme.typography.bodySize,
            color: theme.colors.text,
          },
          content: `${index + 1}. ${heading.text}`,
        });
        y += 25;
      }
    });
  }

  /**
   * Создает страницу с метаданными
   */
  private createMetaPage(
    builder: PdfDocumentBuilder,
    model: ArticlePdfModel,
    theme: PdfTheme
  ): void {
    const page = builder.addPage();
    const format = PAGE_FORMATS[page.format];
    const width = format.width;
    const height = format.height;

    // Заголовок
    builder.addBlock(page.id, {
      type: 'heading-h2',
      position: { x: 20, y: 20, width: width - 40, height: 25, unit: 'mm' },
      styles: {
        fontSize: theme.typography.headingSizes.h2,
        fontWeight: 'bold',
        color: theme.colors.text,
      },
      content: 'Информация о маршруте',
    });

    // Метаданные
    let y = 50;
    const meta = model.meta;

    if (meta.country) {
      this.addMetaItem(builder, page.id, 'Страна', meta.country, y, width, theme);
      y += 25;
    }
    if (meta.region) {
      this.addMetaItem(builder, page.id, 'Регион', meta.region, y, width, theme);
      y += 25;
    }
    if (meta.days) {
      this.addMetaItem(builder, page.id, 'Длительность', `${meta.days} дней`, y, width, theme);
      y += 25;
    }
    if (meta.distanceKm) {
      this.addMetaItem(builder, page.id, 'Длина маршрута', `${meta.distanceKm} км`, y, width, theme);
      y += 25;
    }
    if (meta.difficulty) {
      this.addMetaItem(builder, page.id, 'Сложность', meta.difficulty, y, width, theme);
      y += 25;
    }
  }

  /**
   * Добавляет элемент метаданных
   */
  private addMetaItem(
    builder: PdfDocumentBuilder,
    pageId: string,
    label: string,
    value: string,
    y: number,
    width: number,
    theme: PdfTheme
  ): void {
    builder.addBlock(pageId, {
      type: 'paragraph',
      position: { x: 20, y, width: width - 40, height: 20, unit: 'mm' },
      styles: {
        fontSize: theme.typography.bodySize,
        color: theme.colors.text,
      },
      content: `${label}: ${value}`,
    });
  }

  /**
   * Создает страницы с контентом
   * ✅ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Правильный алгоритм потока блоков по страницам
   */
  private createContentPages(
    builder: PdfDocumentBuilder,
    model: ArticlePdfModel,
    theme: PdfTheme
  ): void {
    const format = PAGE_FORMATS['A4'];
    const pageWidth = format.width; // мм
    const pageHeight = format.height; // мм
    const marginTop = 20; // мм
    const marginBottom = 20; // мм
    const marginLeft = 20; // мм
    const marginRight = 20; // мм
    const contentWidth = pageWidth - marginLeft - marginRight; // мм
    const contentHeight = pageHeight - marginTop - marginBottom; // мм - рабочая область страницы
    
    // ✅ ИСПРАВЛЕНИЕ: Объединяем соседние параграфы перед размещением
    const mergedSections = this.mergeParagraphSections(model.sections);

    // Текущее состояние страницы
    let currentPage = builder.addPage();
    let currentY = marginTop; // Текущая позиция Y на странице (в мм)
    const blockSpacing = theme.spacing.blockSpacing || 8; // Отступ между блоками (в мм)

    for (const section of mergedSections) {
      // ✅ ИСПРАВЛЕНИЕ: Оцениваем высоту блока в мм
      const estimatedBlockHeight = this.estimateBlockHeight(section, contentWidth, theme);
      
      // ✅ ЗАЩИТА: Пропускаем блоки с нулевой высотой
      if (estimatedBlockHeight <= 0) {
        continue;
      }
      
      // ✅ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Правильная проверка помещается ли блок
      // Вычисляем доступную высоту на текущей странице
      const availableHeight = pageHeight - marginBottom - currentY;
      
      // ✅ ИСПРАВЛЕНИЕ: Проверяем, нужно ли создать новую страницу
      const needsNewPage = 
        // Если это H2 заголовок и на странице уже есть контент
        (section.type === 'heading' && section.level === 2 && currentY > marginTop + 20) ||
        // Если блок не помещается по высоте И на странице уже есть контент
        // И блок не пустой (защита от бесконечного цикла)
        (estimatedBlockHeight > availableHeight && currentY > marginTop + 10 && estimatedBlockHeight > 0);
      
      if (needsNewPage) {
        if (typeof console !== 'undefined' && typeof console.log === 'function') {
          console.log(`[ArticleImporter] Новая страница:`, {
            reason: section.type === 'heading' ? 'H2 заголовок' : 'блок не помещается',
            blockHeight: estimatedBlockHeight.toFixed(1) + 'mm',
            availableHeight: availableHeight.toFixed(1) + 'mm',
            currentY: currentY.toFixed(1) + 'mm',
          });
        }
        currentPage = builder.addPage();
        currentY = marginTop;
      }

      // ✅ ИСПРАВЛЕНИЕ: Если блок все еще не помещается (блок больше страницы)
      // Разбиваем его на части или используем минимальную высоту
      let blockHeight = estimatedBlockHeight;
      if (blockHeight > contentHeight) {
        // Если блок больше рабочей области, ограничиваем его размером рабочей области
        // В реальности такой блок нужно разбивать, но для простоты ограничим
        blockHeight = Math.min(blockHeight, contentHeight);
        if (typeof console !== 'undefined' && typeof console.log === 'function') {
          console.warn(`[ArticleImporter] Блок больше страницы, ограничиваем до ${blockHeight.toFixed(1)}mm`);
        }
      }

      // Создаем блок
      const block = this.createBlockFromSection(section, marginLeft, currentY, contentWidth, theme);
      if (block) {
        // ✅ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Устанавливаем правильную высоту блока
        // Перезаписываем высоту, установленную в createBlockFromSection
        block.position.height = blockHeight;
        
        // ✅ ОТЛАДКА: Логируем размещение блока (можно убрать в продакшене)
        if (typeof console !== 'undefined' && typeof console.log === 'function') {
          console.log(`[ArticleImporter] Размещение блока:`, {
            type: section.type,
            height: blockHeight.toFixed(1) + 'mm',
            currentY: currentY.toFixed(1) + 'mm',
            availableHeight: (pageHeight - marginBottom - currentY).toFixed(1) + 'mm',
            page: currentPage.pageNumber,
          });
        }
        
        builder.addBlock(currentPage.id, block);
        
        // ✅ ИСПРАВЛЕНИЕ: Обновляем текущую позицию Y
        currentY += blockHeight + blockSpacing;
        
        // ✅ ИСПРАВЛЕНИЕ: Если осталось мало места (меньше 30мм), переходим на новую страницу
        // Это предотвращает создание страниц с одним маленьким блоком внизу
        const remainingHeight = pageHeight - marginBottom - currentY;
        if (remainingHeight < 30 && remainingHeight > 0) {
          if (typeof console !== 'undefined' && typeof console.log === 'function') {
            console.log(`[ArticleImporter] Мало места (${remainingHeight.toFixed(1)}mm), новая страница`);
          }
          currentPage = builder.addPage();
          currentY = marginTop;
        }
      }
    }
    
    // ✅ ОТЛАДКА: Итоговая статистика
    if (typeof console !== 'undefined' && typeof console.log === 'function') {
      const document = builder.getDocument();
      const totalPages = document.pages.length;
      const totalBlocks = mergedSections.length;
      const blocksPerPage = totalPages > 0 ? (totalBlocks / totalPages).toFixed(1) : 0;
      
      console.log(`[ArticleImporter] Итоговая статистика:`, {
        totalSections: mergedSections.length,
        totalPages: totalPages,
        blocksPerPage: blocksPerPage,
        averageBlocksPerPage: blocksPerPage,
      });
      
      // Детальная статистика по страницам
      document.pages.forEach((page, index) => {
        console.log(`[ArticleImporter] Страница ${page.pageNumber}:`, {
          blocks: page.blocks.length,
          blockTypes: page.blocks.map(b => b.type).join(', '),
        });
      });
    }
  }

  /**
   * Объединяет соседние параграфы в один
   * ✅ ИСПРАВЛЕНИЕ: Предотвращает создание множества маленьких блоков
   */
  private mergeParagraphSections(sections: Section[]): Section[] {
    const merged: Section[] = [];
    let currentParagraph: string[] = [];
    
    for (const section of sections) {
      if (section.type === 'paragraph' && section.text) {
        // Накопляем текст параграфа
        const text = section.text.trim();
        if (text.length > 0) {
          currentParagraph.push(text);
        }
      } else {
        // Если накоплен параграф, объединяем его
        if (currentParagraph.length > 0) {
          merged.push({
            type: 'paragraph',
            text: currentParagraph.join(' ').trim(),
          });
          currentParagraph = [];
        }
        merged.push(section);
      }
    }
    
    // Сохраняем последний накопленный параграф
    if (currentParagraph.length > 0) {
      merged.push({
        type: 'paragraph',
        text: currentParagraph.join(' ').trim(),
      });
    }
    
    return merged;
  }

  /**
   * Оценивает высоту блока в мм
   * ✅ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Правильный расчет высоты с учетом реальных размеров
   */
  private estimateBlockHeight(section: Section, contentWidth: number, theme: PdfTheme): number {
    // Константы для расчета
    const PT_TO_MM = 0.352778; // 1pt = 0.352778mm
    const fontSizePt = theme.typography.bodySize || 14; // Размер шрифта в pt
    const fontSizeMm = fontSizePt * PT_TO_MM; // Размер шрифта в мм
    const lineHeightMultiplier = theme.typography.lineHeight || 1.6; // Межстрочный интервал
    const lineHeightMm = fontSizeMm * lineHeightMultiplier; // Высота строки в мм
    
    switch (section.type) {
      case 'heading':
        // Заголовки: H2 больше, H3 меньше
        const headingSizePt = section.level === 2 
          ? (theme.typography.headingSizes?.h2 || 24)
          : (theme.typography.headingSizes?.h3 || 20);
        const headingSizeMm = headingSizePt * PT_TO_MM;
        return headingSizeMm * lineHeightMultiplier + 5; // Высота + отступ
      
      case 'paragraph':
        const text = section.text || '';
        if (!text || text.length === 0) return 0;
        
        // ✅ КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Правильный расчет количества символов на строку
        // Средняя ширина символа примерно 0.6 от размера шрифта (для кириллицы)
        const avgCharWidthMm = fontSizeMm * 0.6;
        const charsPerLine = Math.floor(contentWidth / avgCharWidthMm);
        
        // Количество строк
        const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
        
        // Высота блока = количество строк * высота строки + небольшой отступ
        return lines * lineHeightMm + 5;
      
      case 'list':
        const items = section.items || [];
        if (items.length === 0) return 0;
        
        // Каждый элемент списка занимает примерно одну строку + маркер
        const listItemHeight = lineHeightMm + 2; // Высота элемента + небольшой отступ
        return items.length * listItemHeight + 5; // Общая высота + отступ
      
      case 'image':
        // Изображения: пропорциональная высота или фиксированная
        return 100; // Примерная высота изображения в мм
      
      case 'imageGallery':
        return 150; // Примерная высота галереи в мм
      
      case 'quote':
        // Цитаты обычно занимают 2-3 строки
        const quoteText = section.text || '';
        const quoteCharsPerLine = Math.floor(contentWidth / (fontSizeMm * 0.6));
        const quoteLines = Math.max(2, Math.ceil(quoteText.length / quoteCharsPerLine));
        return quoteLines * lineHeightMm + 15; // Высота + отступы для цитаты
      
      case 'infoBlock':
        // Информационные блоки: текст + отступы
        const blockText = section.text || '';
        const blockCharsPerLine = Math.floor((contentWidth - 20) / (fontSizeMm * 0.6)); // Учитываем отступы блока
        const blockLines = Math.max(1, Math.ceil(blockText.length / blockCharsPerLine));
        return blockLines * lineHeightMm + 20; // Высота + отступы блока
      
      default:
        // Для неизвестных типов возвращаем минимальную высоту
        return lineHeightMm + 5;
    }
  }

  /**
   * Создает блок из секции
   */
  private createBlockFromSection(
    section: Section,
    x: number,
    y: number,
    width: number,
    theme: PdfTheme
  ): Omit<PdfBlock, 'id'> | null {
    switch (section.type) {
      case 'heading':
        return {
          type: section.level === 2 ? 'heading-h2' : 'heading-h3',
          position: { x, y, width, height: section.level === 2 ? 30 : 25, unit: 'mm' },
          styles: {
            fontSize: section.level === 2 ? theme.typography.headingSizes.h2 : theme.typography.headingSizes.h3,
            fontWeight: 'bold',
            color: theme.colors.text,
          },
          content: section.text,
        };

      case 'paragraph':
        return {
          type: 'paragraph',
          position: { x, y, width, height: 30, unit: 'mm' },
          styles: {
            fontSize: theme.typography.bodySize,
            lineHeight: theme.typography.lineHeight,
            color: theme.colors.text,
          },
          content: section.text || '',
        };

      case 'image':
        return {
          type: 'image-with-caption',
          position: { x, y, width, height: 150, unit: 'mm' },
          styles: {},
          content: {
            url: section.image.url,
            alt: section.image.alt,
            caption: section.caption || section.image.caption,
          },
        };

      case 'imageGallery':
        return {
          type: 'image-gallery',
          position: { x, y, width, height: 200, unit: 'mm' },
          styles: {},
          content: {
            images: section.images.map((img) => ({
              url: img.url,
              alt: img.alt,
              caption: img.caption,
            })),
            columns: 2,
          },
        };

      case 'infoBlock':
        const blockType = section.variant === 'tip' ? 'tip-block' : section.variant === 'important' ? 'important-block' : 'warning-block';
        return {
          type: blockType,
          position: { x, y, width, height: 60, unit: 'mm' },
          styles: {},
          content: section.text,
        };

      case 'quote':
        return {
          type: 'quote',
          position: { x, y, width, height: 50, unit: 'mm' },
          styles: {
            color: theme.colors.textSecondary,
          },
          content: section.text,
        };

      case 'list':
        // Преобразуем список в параграфы или чек-лист
        const listText = section.items.map((item, index) => `${section.ordered ? `${index + 1}.` : '•'} ${item}`).join('\n');
        return {
          type: 'paragraph',
          position: { x, y, width, height: section.items.length * 20, unit: 'mm' },
          styles: {
            fontSize: theme.typography.bodySize,
            lineHeight: theme.typography.lineHeight,
            color: theme.colors.text,
          },
          content: listText,
        };

      default:
        return null;
    }
  }

  /**
   * Создает страницу с картой
   */
  private createMapPage(
    builder: PdfDocumentBuilder,
    map: ArticlePdfModel['map'],
    theme: PdfTheme
  ): void {
    if (!map) return;

    const page = builder.addPage();
    const format = PAGE_FORMATS[page.format];
    const width = format.width;
    const height = format.height;

    // Заголовок
    builder.addBlock(page.id, {
      type: 'heading-h2',
      position: { x: 20, y: 20, width: width - 40, height: 25, unit: 'mm' },
      styles: {
        fontSize: theme.typography.headingSizes.h2,
        fontWeight: 'bold',
        color: theme.colors.text,
      },
      content: 'Карта маршрута',
    });

    // Карта
    builder.addBlock(page.id, {
      type: 'map',
      position: { x: 20, y: 50, width: width - 40, height: height - 150, unit: 'mm' },
      styles: {},
      content: {
        imageUrl: map.image.url,
        points: map.points,
        description: map.description,
      },
    });
  }

  /**
   * Создает страницу с рекомендациями
   */
  private createRecommendationsPage(
    builder: PdfDocumentBuilder,
    recommendations: ArticlePdfModel['recommendations'],
    theme: PdfTheme
  ): void {
    if (!recommendations || recommendations.length === 0) return;

    const page = builder.addPage();
    const format = PAGE_FORMATS[page.format];
    const width = format.width;
    const height = format.height;

    // Заголовок
    builder.addBlock(page.id, {
      type: 'heading-h2',
      position: { x: 20, y: 20, width: width - 40, height: 25, unit: 'mm' },
      styles: {
        fontSize: theme.typography.headingSizes.h2,
        fontWeight: 'bold',
        color: theme.colors.text,
      },
      content: 'Рекомендации',
    });

    // Блоки рекомендаций
    let y = 50;
    for (const rec of recommendations) {
      builder.addBlock(page.id, {
        type: 'heading-h3',
        position: { x: 20, y, width: width - 40, height: 20, unit: 'mm' },
        styles: {
          fontSize: theme.typography.headingSizes.h3,
          fontWeight: 'bold',
          color: theme.colors.text,
        },
        content: rec.title,
      });

      y += 30;

      // Список элементов
      const listText = rec.items.map((item) => `• ${item}`).join('\n');
      builder.addBlock(page.id, {
        type: 'paragraph',
        position: { x: 20, y, width: width - 40, height: rec.items.length * 20, unit: 'mm' },
        styles: {
          fontSize: theme.typography.bodySize,
          lineHeight: theme.typography.lineHeight,
          color: theme.colors.text,
        },
        content: listText,
      });

      y += rec.items.length * 25 + 20;
    }
  }
}
