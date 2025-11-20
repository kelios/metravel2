// src/services/pdf-export/parsers/ContentParser.ts
// ✅ АРХИТЕКТУРА: Парсер HTML/Markdown контента в структурированные блоки
// ✅ ИСПРАВЛЕНИЕ: Объединение текста, нормализация пробелов, удаление невидимых символов

/**
 * Типы блоков контента
 */
export type ContentBlockType =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'quote'
  | 'image'
  | 'image-gallery'
  | 'info-block'
  | 'warning-block'
  | 'tip-block'
  | 'danger-block'
  | 'code'
  | 'separator'
  | 'table';

/**
 * Базовый интерфейс блока контента
 */
export interface ContentBlock {
  type: ContentBlockType;
  id?: string;
}

/**
 * Заголовок
 */
export interface HeadingBlock extends ContentBlock {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

/**
 * Параграф
 */
export interface ParagraphBlock extends ContentBlock {
  type: 'paragraph';
  text: string;
  html?: string; // Оригинальный HTML для сложных случаев
}

/**
 * Список
 */
export interface ListBlock extends ContentBlock {
  type: 'list';
  ordered: boolean;
  items: string[];
}

/**
 * Цитата
 */
export interface QuoteBlock extends ContentBlock {
  type: 'quote';
  text: string;
  author?: string;
}

/**
 * Изображение
 */
export interface ImageBlock extends ContentBlock {
  type: 'image';
  src: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
}

/**
 * Галерея изображений
 */
export interface ImageGalleryBlock extends ContentBlock {
  type: 'image-gallery';
  images: Array<{
    src: string;
    alt?: string;
    caption?: string;
  }>;
  columns?: number;
}

/**
 * Информационный блок (Совет, Важно, Лайфхак, Предупреждение)
 */
export interface InfoBlock extends ContentBlock {
  type: 'info-block' | 'warning-block' | 'tip-block' | 'danger-block';
  title?: string;
  content: string;
  icon?: string;
}

/**
 * Код
 */
export interface CodeBlock extends ContentBlock {
  type: 'code';
  code: string;
  language?: string;
}

/**
 * Разделитель
 */
export interface SeparatorBlock extends ContentBlock {
  type: 'separator';
}

/**
 * Таблица
 */
export interface TableBlock extends ContentBlock {
  type: 'table';
  headers?: string[];
  rows: string[][];
}

/**
 * Объединенный тип всех блоков
 */
export type ParsedContentBlock =
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | QuoteBlock
  | ImageBlock
  | ImageGalleryBlock
  | InfoBlock
  | CodeBlock
  | SeparatorBlock
  | TableBlock;

/**
 * Парсер HTML/Markdown контента
 * ✅ ИСПРАВЛЕНИЕ: Объединяет текст в нормальные абзацы, нормализует пробелы
 */
export class ContentParser {
  /**
   * Нормализует текст: удаляет невидимые символы, нормализует пробелы
   */
  private normalizeText(text: string): string {
    if (!text) return '';
    
    return text
      // Удаляем невидимые символы (zero-width space, non-breaking space в некоторых случаях и т.д.)
      .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
      // Заменяем все виды пробелов на обычный пробел
      .replace(/[\s\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+/g, ' ')
      // Удаляем пробелы в начале и конце
      .trim();
  }

  /**
   * Извлекает весь текст из элемента, объединяя вложенные элементы
   */
  private extractTextContent(element: HTMLElement): string {
    // Клонируем элемент, чтобы не изменять оригинал
    const clone = element.cloneNode(true) as HTMLElement;
    
    // Удаляем скрипты и стили
    const scripts = clone.querySelectorAll('script, style');
    scripts.forEach(el => el.remove());
    
    // Заменяем <br> на пробелы
    const brs = clone.querySelectorAll('br');
    brs.forEach(br => {
      br.replaceWith(document.createTextNode(' '));
    });
    
    // Извлекаем текстовое содержимое
    let text = clone.textContent || '';
    
    // Нормализуем текст
    text = this.normalizeText(text);
    
    return text;
  }

  /**
   * Парсит HTML строку в массив структурированных блоков
   * ✅ ИСПРАВЛЕНИЕ: Объединяет соседние параграфы, нормализует пробелы
   */
  parse(html: string): ParsedContentBlock[] {
    if (!html || html.trim().length === 0) {
      return [];
    }

    // Очищаем HTML от React Native компонентов
    const cleaned = this.cleanHtml(html);

    // Создаем временный DOM элемент для парсинга
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleaned, 'text/html');
    const body = doc.body;

    if (!body) {
      return [];
    }

    // ✅ ИСПРАВЛЕНИЕ: Парсим все элементы, объединяя соседние параграфы
    const blocks: ParsedContentBlock[] = [];
    const nodes = Array.from(body.childNodes);
    
    let currentParagraph: string[] = [];
    
    for (const node of nodes) {
      const parsed = this.parseNode(node);
      
      if (parsed) {
        if (Array.isArray(parsed)) {
          // Если есть накопленный параграф, сохраняем его
          if (currentParagraph.length > 0) {
            blocks.push(this.createParagraphFromParts(currentParagraph));
            currentParagraph = [];
          }
          blocks.push(...parsed);
        } else {
          // Если это параграф, накапливаем его
          if (parsed.type === 'paragraph') {
            const text = this.normalizeText(parsed.text);
            if (text) {
              currentParagraph.push(text);
            }
          } else {
            // Если это не параграф, сохраняем накопленный параграф и добавляем блок
            if (currentParagraph.length > 0) {
              blocks.push(this.createParagraphFromParts(currentParagraph));
              currentParagraph = [];
            }
            blocks.push(parsed);
          }
        }
      }
    }
    
    // Сохраняем последний накопленный параграф
    if (currentParagraph.length > 0) {
      blocks.push(this.createParagraphFromParts(currentParagraph));
    }

    // ✅ ИСПРАВЛЕНИЕ: Объединяем соседние параграфы в один
    return this.mergeAdjacentParagraphs(blocks);
  }

  /**
   * Создает параграф из частей текста
   */
  private createParagraphFromParts(parts: string[]): ParagraphBlock {
    const text = parts
      .map(part => this.normalizeText(part))
      .filter(part => part.length > 0)
      .join(' ')
      .trim();
    
    return {
      type: 'paragraph',
      text: text || '',
    };
  }

  /**
   * Объединяет соседние параграфы в один
   */
  private mergeAdjacentParagraphs(blocks: ParsedContentBlock[]): ParsedContentBlock[] {
    const merged: ParsedContentBlock[] = [];
    let currentParagraph: string[] = [];
    
    for (const block of blocks) {
      if (block.type === 'paragraph') {
        const text = this.normalizeText(block.text);
        if (text && text.length > 0) {
          currentParagraph.push(text);
        }
      } else {
        // Если накоплен параграф, сохраняем его
        if (currentParagraph.length > 0) {
          merged.push(this.createParagraphFromParts(currentParagraph));
          currentParagraph = [];
        }
        merged.push(block);
      }
    }
    
    // Сохраняем последний накопленный параграф
    if (currentParagraph.length > 0) {
      merged.push(this.createParagraphFromParts(currentParagraph));
    }
    
    return merged;
  }

  /**
   * Парсит один DOM узел
   * ✅ ИСПРАВЛЕНИЕ: Не создает блоки для текстовых узлов отдельно
   */
  private parseNode(node: Node): ParsedContentBlock | ParsedContentBlock[] | null {
    // ✅ ИСПРАВЛЕНИЕ: Игнорируем текстовые узлы на верхнем уровне - они будут обработаны в parseParagraph
    if (node.nodeType === Node.TEXT_NODE) {
      const text = this.normalizeText(node.textContent || '');
      // Возвращаем null для текстовых узлов - они будут обработаны родительским элементом
      return text ? {
        type: 'paragraph',
        text,
      } : null;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();

    switch (tagName) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        return this.parseHeading(element);
      
      case 'p':
        return this.parseParagraph(element);
      
      case 'ul':
      case 'ol':
        return this.parseList(element);
      
      case 'blockquote':
        return this.parseQuote(element);
      
      case 'img':
        return this.parseImage(element);
      
      case 'figure':
        return this.parseFigure(element);
      
      case 'div':
      case 'section':
        return this.parseContainer(element);
      
      case 'hr':
        return { type: 'separator' };
      
      case 'pre':
      case 'code':
        return this.parseCode(element);
      
      case 'table':
        return this.parseTable(element);
      
      default:
        // Для неизвестных тегов пытаемся извлечь текст
        const text = this.extractTextContent(element);
        if (text && text.length > 0) {
          return {
            type: 'paragraph',
            text,
            html: element.innerHTML,
          };
        }
        return null;
    }
  }

  /**
   * Парсит заголовок
   */
  private parseHeading(element: HTMLElement): HeadingBlock | null {
    const level = parseInt(element.tagName.charAt(1)) as 1 | 2 | 3 | 4 | 5 | 6;
    const text = this.normalizeText(this.extractTextContent(element));
    
    if (!text || text.length === 0) return null;

    return {
      type: 'heading',
      level,
      text,
    };
  }

  /**
   * Парсит параграф
   * ✅ ИСПРАВЛЕНИЕ: Объединяет весь текст из вложенных элементов
   */
  private parseParagraph(element: HTMLElement): ParagraphBlock | InfoBlock | null {
    // Проверяем, не является ли это специальным блоком
    const specialBlock = this.detectSpecialBlock(element);
    if (specialBlock) {
      return specialBlock;
    }

    const text = this.normalizeText(this.extractTextContent(element));
    
    if (!text || text.length === 0) return null;

    const html = element.innerHTML.trim();
    const hasComplexHtml = html !== text && html.includes('<');

    return {
      type: 'paragraph',
      text,
      html: hasComplexHtml ? html : undefined,
    };
  }

  /**
   * Парсит список
   */
  private parseList(element: HTMLElement): ListBlock | null {
    const ordered = element.tagName.toLowerCase() === 'ol';
    const items: string[] = [];

    const listItems = element.querySelectorAll('li');
    for (const item of Array.from(listItems)) {
      const text = this.normalizeText(this.extractTextContent(item));
      if (text && text.length > 0) {
        items.push(text);
      }
    }

    if (items.length === 0) return null;

    return {
      type: 'list',
      ordered,
      items,
    };
  }

  /**
   * Парсит цитату
   */
  private parseQuote(element: HTMLElement): QuoteBlock | null {
    const text = this.normalizeText(this.extractTextContent(element));
    if (!text || text.length === 0) return null;

    // Пытаемся найти автора (обычно в <cite> или <footer>)
    const cite = element.querySelector('cite, footer');
    const author = cite instanceof HTMLElement ? this.normalizeText(this.extractTextContent(cite)) : undefined;

    return {
      type: 'quote',
      text: author ? text.replace(author, '').trim() : text,
      author,
    };
  }

  /**
   * Парсит изображение
   */
  private parseImage(element: HTMLElement): ImageBlock | null {
    const src = element.getAttribute('src') || '';
    if (!src) return null;

    const alt = element.getAttribute('alt') || undefined;
    const width = element.getAttribute('width') ? parseInt(element.getAttribute('width')!) : undefined;
    const height = element.getAttribute('height') ? parseInt(element.getAttribute('height')!) : undefined;

    // Ищем подпись в родительском figure или следующем элементе
    const parent = element.parentElement;
    const caption = parent?.tagName.toLowerCase() === 'figure'
      ? this.normalizeText(parent.querySelector('figcaption')?.textContent || '')
      : undefined;

    return {
      type: 'image',
      src,
      alt,
      caption: caption && caption.length > 0 ? caption : undefined,
      width,
      height,
    };
  }

  /**
   * Парсит figure (может содержать изображение с подписью или галерею)
   */
  private parseFigure(element: HTMLElement): ParsedContentBlock | null {
    const images = element.querySelectorAll('img');
    
    if (images.length === 0) return null;
    
    if (images.length === 1) {
      // Одно изображение с подписью
      const img = images[0] as HTMLElement;
      const caption = this.normalizeText(element.querySelector('figcaption')?.textContent || '');
      
      return {
        type: 'image',
        src: img.getAttribute('src') || '',
        alt: img.getAttribute('alt') || undefined,
        caption: caption && caption.length > 0 ? caption : undefined,
      };
    } else {
      // Галерея изображений
      const galleryImages = Array.from(images).map((img) => ({
        src: img.getAttribute('src') || '',
        alt: img.getAttribute('alt') || undefined,
        caption: undefined, // Можно улучшить, если подписи хранятся отдельно
      }));

      return {
        type: 'image-gallery',
        images: galleryImages,
        columns: images.length <= 4 ? 2 : images.length <= 6 ? 3 : 4,
      };
    }
  }

  /**
   * Парсит контейнер (div, section) - может содержать специальные блоки
   * ✅ ИСПРАВЛЕНИЕ: Объединяет текст из вложенных элементов
   */
  private parseContainer(element: HTMLElement): ParsedContentBlock | ParsedContentBlock[] | null {
    // Проверяем на специальные блоки
    const specialBlock = this.detectSpecialBlock(element);
    if (specialBlock) {
      return specialBlock;
    }

    // Проверяем на галерею изображений
    const images = element.querySelectorAll('img');
    if (images.length > 1) {
      const galleryImages = Array.from(images).map((img) => ({
        src: img.getAttribute('src') || '',
        alt: img.getAttribute('alt') || undefined,
      }));

      return {
        type: 'image-gallery',
        images: galleryImages,
        columns: images.length <= 4 ? 2 : images.length <= 6 ? 3 : 4,
      };
    }

    // ✅ ИСПРАВЛЕНИЕ: Если контейнер содержит только текст, извлекаем его как параграф
    const text = this.normalizeText(this.extractTextContent(element));
    if (text && text.length > 0) {
      // Проверяем, есть ли другие блочные элементы
      const hasBlockElements = element.querySelector('h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote, img, figure, table');
      if (!hasBlockElements) {
        // Если нет блочных элементов, возвращаем как параграф
        return {
          type: 'paragraph',
          text,
        };
      }
    }

    // Рекурсивно парсим дочерние элементы
    const blocks: ParsedContentBlock[] = [];
    for (const child of Array.from(element.childNodes)) {
      const parsed = this.parseNode(child);
      if (parsed) {
        if (Array.isArray(parsed)) {
          blocks.push(...parsed);
        } else {
          blocks.push(parsed);
        }
      }
    }

    return blocks.length > 0 ? blocks : null;
  }

  /**
   * Определяет специальный блок (Совет, Важно, и т.д.)
   */
  private detectSpecialBlock(element: HTMLElement): InfoBlock | null {
    const className = element.className?.toLowerCase() || '';
    const text = this.normalizeText(this.extractTextContent(element));
    
    if (!text || text.length === 0) return null;

    // Проверяем классы и data-атрибуты
    const isTip = className.includes('tip') || className.includes('совет') || className.includes('лайфхак');
    const isWarning = className.includes('warning') || className.includes('предупреждение') || className.includes('важно');
    const isDanger = className.includes('danger') || className.includes('опасность');
    const isInfo = className.includes('info') || className.includes('информация');

    if (isTip) {
      return {
        type: 'tip-block',
        content: text,
        title: this.extractTitle(element),
      };
    }

    if (isWarning) {
      return {
        type: 'warning-block',
        content: text,
        title: this.extractTitle(element),
      };
    }

    if (isDanger) {
      return {
        type: 'danger-block',
        content: text,
        title: this.extractTitle(element),
      };
    }

    if (isInfo) {
      return {
        type: 'info-block',
        content: text,
        title: this.extractTitle(element),
      };
    }

    return null;
  }

  /**
   * Извлекает заголовок из элемента (обычно первый strong/b или специальный класс)
   */
  private extractTitle(element: HTMLElement): string | undefined {
    const titleElement = element.querySelector('strong, b, .title, .heading, h1, h2, h3, h4, h5, h6');
    if (!(titleElement instanceof HTMLElement)) return undefined;
    return this.normalizeText(this.extractTextContent(titleElement)) || undefined;
  }

  /**
   * Парсит код
   */
  private parseCode(element: HTMLElement): CodeBlock | null {
    const code = this.normalizeText(element.textContent || '');
    if (!code || code.length === 0) return null;

    const language = element.getAttribute('class')?.match(/language-(\w+)/)?.[1] || undefined;

    return {
      type: 'code',
      code,
      language,
    };
  }

  /**
   * Парсит таблицу
   */
  private parseTable(element: HTMLElement): TableBlock | null {
    const rows = element.querySelectorAll('tr');
    if (rows.length === 0) return null;

    const tableRows: string[][] = [];
    let headers: string[] | undefined;

    const firstRow = rows[0];
    const isHeaderRow = firstRow.querySelector('th') !== null;
    
    if (isHeaderRow) {
      headers = Array.from(firstRow.querySelectorAll('th, td')).map((cell) => 
        this.normalizeText(cell.textContent || '')
      );
    }

    const startIndex = isHeaderRow ? 1 : 0;
    for (let i = startIndex; i < rows.length; i++) {
      const row = Array.from(rows[i].querySelectorAll('td')).map((cell) => 
        this.normalizeText(cell.textContent || '')
      );
      if (row.length > 0 && row.some(cell => cell.length > 0)) {
        tableRows.push(row);
      }
    }

    if (tableRows.length === 0) return null;

    return {
      type: 'table',
      headers,
      rows: tableRows,
    };
  }

  /**
   * Очищает HTML от React Native компонентов и других нежелательных элементов
   */
  private cleanHtml(html: string): string {
    let cleaned = html;
    let previousLength = 0;
    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
      const currentLength = cleaned.length;
      if (currentLength === previousLength) break;
      previousLength = currentLength;

      cleaned = cleaned
        .replace(/<View[^>]*>/gi, '')
        .replace(/<\/View>/gi, '')
        .replace(/<Text[^>]*>/gi, '')
        .replace(/<\/Text>/gi, '')
        .replace(/<ScrollView[^>]*>.*?<\/ScrollView>/gis, '')
        .replace(/<Image[^>]*\/?>/gi, '')
        .replace(/<TouchableOpacity[^>]*>.*?<\/TouchableOpacity>/gis, '')
        .replace(/<TouchableHighlight[^>]*>.*?<\/TouchableHighlight>/gis, '')
        .replace(/<SafeAreaView[^>]*>.*?<\/SafeAreaView>/gis, '')
        .replace(/<ActivityIndicator[^>]*\/?>/gi, '');
      
      iterations++;
    }

    return cleaned;
  }
}
