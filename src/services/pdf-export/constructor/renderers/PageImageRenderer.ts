// src/services/pdf-export/constructor/renderers/PageImageRenderer.ts
// ✅ АРХИТЕКТУРА: Рендерер страниц в изображения (Canvas → PNG/WebP)

import type { PdfPage, PdfBlock, PdfTheme, PdfExportConfig, RenderedPage } from '@/src/types/pdf-constructor';
import { PAGE_FORMATS } from '@/src/types/pdf-constructor';
import { ImageLoader } from '../ImageLoader';

/**
 * Рендерер страниц в изображения
 * Использует Canvas API для рендеринга страниц в PNG/WebP
 */
export class PageImageRenderer {
  private config: PdfExportConfig;
  private imageLoader: ImageLoader;

  constructor(config: Partial<PdfExportConfig> = {}) {
    this.config = {
      dpi: config.dpi || 300,
      imageFormat: config.imageFormat || 'png',
      imageQuality: config.imageQuality || 0.95,
      optimizeImages: config.optimimizeImages ?? true,
      compressPdf: config.compressPdf ?? true,
    };
    this.imageLoader = ImageLoader.getInstance();
  }

  /**
   * Рендерит страницу в изображение
   */
  async renderPage(
    page: PdfPage,
    theme: PdfTheme
  ): Promise<RenderedPage> {
    // Вычисляем размеры canvas в пикселях
    const format = PAGE_FORMATS[page.format];
    const width = page.orientation === 'landscape' ? format.height : format.width;
    const height = page.orientation === 'landscape' ? format.width : format.height;
    
    // Конвертируем мм в пиксели (1 мм = 3.779527559 пикселей при 96 DPI)
    // Для 300 DPI: 1 мм = 11.811 пикселей
    const pixelsPerMm = (this.config.dpi / 25.4);
    const canvasWidth = Math.round(width * pixelsPerMm);
    const canvasHeight = Math.round(height * pixelsPerMm);

    // Создаем canvas
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Устанавливаем высокое качество рендеринга
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Рендерим фон страницы
    await this.renderPageBackground(ctx, page, theme, canvasWidth, canvasHeight, pixelsPerMm);

    // Рендерим блоки
    for (const block of page.blocks) {
      if (block.visible !== false) {
        await this.renderBlock(ctx, block, theme, canvasWidth, canvasHeight, pixelsPerMm);
      }
    }

    // Конвертируем canvas в изображение
    const imageData = await this.canvasToImage(canvas);

    return {
      pageId: page.id,
      pageNumber: page.pageNumber,
      imageData,
      width: canvasWidth,
      height: canvasHeight,
    };
  }

  /**
   * Рендерит фон страницы
   */
  private async renderPageBackground(
    ctx: CanvasRenderingContext2D,
    page: PdfPage,
    theme: PdfTheme,
    canvasWidth: number,
    canvasHeight: number,
    pixelsPerMm: number
  ): Promise<void> {
    const { background } = page;

    if (background?.gradient) {
      // Градиентный фон
      const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
      gradient.addColorStop(0, background.gradient[0]);
      gradient.addColorStop(1, background.gradient[1]);
      ctx.fillStyle = gradient;
    } else if (background?.color) {
      ctx.fillStyle = background.color;
    } else {
      ctx.fillStyle = theme.colors.background;
    }

    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Если есть фоновое изображение
    if (background?.image) {
      await this.drawImage(ctx, background.image, 0, 0, canvasWidth, canvasHeight);
    }
  }

  /**
   * Рендерит блок
   */
  private async renderBlock(
    ctx: CanvasRenderingContext2D,
    block: PdfBlock,
    theme: PdfTheme,
    canvasWidth: number,
    canvasHeight: number,
    pixelsPerMm: number
  ): Promise<void> {
    // Вычисляем позицию и размеры блока
    const x = block.position.unit === 'percent'
      ? (block.position.x / 100) * canvasWidth
      : block.position.x * pixelsPerMm;
    const y = block.position.unit === 'percent'
      ? (block.position.y / 100) * canvasHeight
      : block.position.y * pixelsPerMm;
    const width = block.position.unit === 'percent'
      ? (block.position.width / 100) * canvasWidth
      : block.position.width * pixelsPerMm;
    const height = block.position.unit === 'percent'
      ? (block.position.height / 100) * canvasHeight
      : block.position.height * pixelsPerMm;

    // Сохраняем контекст
    ctx.save();

    // Применяем трансформации
    if (block.styles.transform) {
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      ctx.translate(centerX, centerY);
      if (block.styles.transform.rotate) {
        ctx.rotate((block.styles.transform.rotate * Math.PI) / 180);
      }
      if (block.styles.transform.scale) {
        ctx.scale(block.styles.transform.scale, block.styles.transform.scale);
      }
      ctx.translate(-centerX, -centerY);
    }

    // Применяем opacity
    if (block.styles.opacity !== undefined) {
      ctx.globalAlpha = block.styles.opacity;
    }

    // Рендерим фон блока
    if (block.styles.backgroundColor) {
      ctx.fillStyle = block.styles.backgroundColor;
      this.drawRoundedRect(ctx, x, y, width, height, block.styles.border?.radius || 0);
      ctx.fill();
    }

    // Рендерим фоновое изображение
    if (block.styles.backgroundImage) {
      await this.drawImage(ctx, block.styles.backgroundImage, x, y, width, height);
    }

    // Рендерим границу
    if (block.styles.border && block.styles.border.width) {
      ctx.strokeStyle = block.styles.border.color || theme.colors.border;
      ctx.lineWidth = block.styles.border.width * pixelsPerMm;
      this.drawRoundedRect(ctx, x, y, width, height, block.styles.border.radius || 0);
      ctx.stroke();
    }

    // Рендерим тень
    if (block.styles.shadow) {
      ctx.shadowColor = block.styles.shadow.color || 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = (block.styles.shadow.blur || 0) * pixelsPerMm;
      ctx.shadowOffsetX = (block.styles.shadow.offsetX || 0) * pixelsPerMm;
      ctx.shadowOffsetY = (block.styles.shadow.offsetY || 0) * pixelsPerMm;
    }

    // Рендерим контент блока
    await this.renderBlockContent(ctx, block, theme, x, y, width, height, pixelsPerMm);

    // Восстанавливаем контекст
    ctx.restore();
  }

  /**
   * Рендерит контент блока
   */
  private async renderBlockContent(
    ctx: CanvasRenderingContext2D,
    block: PdfBlock,
    theme: PdfTheme,
    x: number,
    y: number,
    width: number,
    height: number,
    pixelsPerMm: number
  ): Promise<void> {
    switch (block.type) {
      case 'heading-h1':
      case 'heading-h2':
      case 'heading-h3':
        this.renderText(
          ctx,
          typeof block.content === 'string' ? block.content : '',
          x,
          y,
          width,
          block.styles,
          theme,
          block.type === 'heading-h1' ? 'h1' : block.type === 'heading-h2' ? 'h2' : 'h3'
        );
        break;

      case 'paragraph':
        this.renderText(
          ctx,
          typeof block.content === 'string' ? block.content : '',
          x,
          y,
          width,
          block.styles,
          theme,
          'body'
        );
        break;

      case 'image':
      case 'image-with-caption':
        if (typeof block.content === 'object' && 'url' in block.content) {
          const config = block.content as any;
          await this.drawImage(ctx, config.url, x, y, width, height);
          if (config.caption && block.type === 'image-with-caption') {
            this.renderText(
              ctx,
              config.caption,
              x,
              y + height,
              width,
              { ...block.styles, fontSize: (block.styles.fontSize || 10) * 0.9 },
              theme,
              'caption'
            );
          }
        }
        break;

      case 'image-gallery':
        if (typeof block.content === 'object' && 'images' in block.content) {
          const config = block.content as any;
          await this.renderGallery(ctx, config, x, y, width, height, pixelsPerMm);
        }
        break;

      case 'map':
        if (typeof block.content === 'object' && 'imageUrl' in block.content) {
          const config = block.content as any;
          await this.drawImage(ctx, config.imageUrl, x, y, width, height);
        }
        break;

      case 'tip-block':
      case 'important-block':
      case 'warning-block':
        this.renderInfoBlock(ctx, block, theme, x, y, width, height, pixelsPerMm);
        break;

      case 'quote':
        this.renderQuote(ctx, block, theme, x, y, width, height, pixelsPerMm);
        break;

      case 'checklist':
        if (typeof block.content === 'object' && 'items' in block.content) {
          const config = block.content as any;
          this.renderChecklist(ctx, config, block, theme, x, y, width, height, pixelsPerMm);
        }
        break;

      case 'table':
        if (typeof block.content === 'object' && 'rows' in block.content) {
          const config = block.content as any;
          this.renderTable(ctx, config, block, theme, x, y, width, height, pixelsPerMm);
        }
        break;

      case 'divider':
        this.renderDivider(ctx, block, theme, x, y, width, height, pixelsPerMm);
        break;

      case 'spacer':
        // Пустое пространство - ничего не рендерим
        break;

      default:
        // Для остальных типов блоков рендерим как текст
        if (typeof block.content === 'string') {
          this.renderText(ctx, block.content, x, y, width, block.styles, theme, 'body');
        }
    }
  }

  /**
   * Рендерит текст
   */
  private renderText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    styles: PdfBlock['styles'],
    theme: PdfTheme,
    type: 'h1' | 'h2' | 'h3' | 'body' | 'caption'
  ): void {
    const fontSize = styles.fontSize || (type === 'h1' ? theme.typography.headingSizes.h1 : type === 'h2' ? theme.typography.headingSizes.h2 : type === 'h3' ? theme.typography.headingSizes.h3 : theme.typography.bodySize);
    const fontFamily = styles.fontFamily || (type.startsWith('h') ? theme.typography.headingFont : theme.typography.bodyFont);
    const fontWeight = styles.fontWeight || (type.startsWith('h') ? 'bold' : 'normal');
    const color = styles.color || theme.colors.text;
    const lineHeight = styles.lineHeight || theme.typography.lineHeight;
    const textAlign = styles.textAlign || 'left';

    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = color;
    ctx.textAlign = textAlign as CanvasTextAlign;
    ctx.textBaseline = 'top';

    // Разбиваем текст на строки
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    // Рендерим строки
    let currentY = y;
    for (const line of lines) {
      const alignX = textAlign === 'center' ? x + maxWidth / 2 : textAlign === 'right' ? x + maxWidth : x;
      ctx.fillText(line, alignX, currentY);
      currentY += fontSize * lineHeight;
    }
  }

  /**
   * Рисует изображение с оптимизацией
   */
  private async drawImage(
    ctx: CanvasRenderingContext2D,
    url: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): Promise<void> {
    try {
      // Загружаем изображение через ImageLoader
      let img = await this.imageLoader.loadImage(url);
      
      // Оптимизируем если нужно
      if (this.config.optimizeImages) {
        const pixelsPerMm = this.config.dpi / 25.4;
        const maxWidth = width;
        const maxHeight = height;
        img = await this.imageLoader.optimizeImage(img, {
          maxWidth,
          maxHeight,
          quality: this.config.imageQuality,
          format: this.config.imageFormat === 'webp' ? 'webp' : 'jpeg',
        });
      }
      
      // Рисуем изображение
      ctx.drawImage(img, x, y, width, height);
    } catch (error) {
      console.error(`Failed to load image ${url}:`, error);
      // Рисуем placeholder
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = '#999';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Ошибка загрузки', x + width / 2, y + height / 2);
    }
  }

  /**
   * Рисует скругленный прямоугольник
   */
  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * Рендерит галерею
   */
  private async renderGallery(
    ctx: CanvasRenderingContext2D,
    config: any,
    x: number,
    y: number,
    width: number,
    height: number,
    pixelsPerMm: number
  ): Promise<void> {
    const { images, columns, gap = 8 } = config;
    const gapPx = gap * pixelsPerMm;
    const imageWidth = (width - gapPx * (columns - 1)) / columns;
    const imageHeight = height / Math.ceil(images.length / columns);

    for (let i = 0; i < images.length; i++) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const imgX = x + col * (imageWidth + gapPx);
      const imgY = y + row * imageHeight;
      await this.drawImage(ctx, images[i].url, imgX, imgY, imageWidth, imageHeight);
    }
  }

  /**
   * Рендерит инфоблок
   */
  private renderInfoBlock(
    ctx: CanvasRenderingContext2D,
    block: PdfBlock,
    theme: PdfTheme,
    x: number,
    y: number,
    width: number,
    height: number,
    pixelsPerMm: number
  ): void {
    const variant = block.type === 'tip-block' ? 'tipBlock' : block.type === 'important-block' ? 'importantBlock' : 'warningBlock';
    const colors = theme.colors[variant];

    // Фон
    ctx.fillStyle = colors.background;
    this.drawRoundedRect(ctx, x, y, width, height, 8 * pixelsPerMm);
    ctx.fill();

    // Граница
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 4 * pixelsPerMm;
    this.drawRoundedRect(ctx, x, y, width, height, 8 * pixelsPerMm);
    ctx.stroke();

    // Текст
    if (typeof block.content === 'string') {
      ctx.fillStyle = colors.text;
      this.renderText(ctx, block.content, x + 16 * pixelsPerMm, y + 16 * pixelsPerMm, width - 32 * pixelsPerMm, block.styles, theme, 'body');
    }
  }

  /**
   * Рендерит цитату
   */
  private renderQuote(
    ctx: CanvasRenderingContext2D,
    block: PdfBlock,
    theme: PdfTheme,
    x: number,
    y: number,
    width: number,
    height: number,
    pixelsPerMm: number
  ): void {
    // Левая граница
    ctx.fillStyle = theme.colors.accent;
    ctx.fillRect(x, y, 4 * pixelsPerMm, height);

    // Текст
    if (typeof block.content === 'string') {
      ctx.fillStyle = theme.colors.textSecondary;
      ctx.fontStyle = 'italic';
      this.renderText(ctx, block.content, x + 16 * pixelsPerMm, y + 16 * pixelsPerMm, width - 32 * pixelsPerMm, block.styles, theme, 'body');
    }
  }

  /**
   * Рендерит чек-лист
   */
  private renderChecklist(
    ctx: CanvasRenderingContext2D,
    config: any,
    block: PdfBlock,
    theme: PdfTheme,
    x: number,
    y: number,
    width: number,
    height: number,
    pixelsPerMm: number
  ): void {
    const { items } = config;
    const itemHeight = 20 * pixelsPerMm;
    let currentY = y;

    for (const item of items) {
      // Чекбокс
      ctx.strokeStyle = theme.colors.border;
      ctx.lineWidth = 2 * pixelsPerMm;
      ctx.strokeRect(x, currentY, 16 * pixelsPerMm, 16 * pixelsPerMm);

      if (item.checked) {
        ctx.fillStyle = theme.colors.accent;
        ctx.fillRect(x + 2 * pixelsPerMm, currentY + 2 * pixelsPerMm, 12 * pixelsPerMm, 12 * pixelsPerMm);
      }

      // Текст
      this.renderText(ctx, item.text, x + 24 * pixelsPerMm, currentY, width - 24 * pixelsPerMm, block.styles, theme, 'body');
      currentY += itemHeight;
    }
  }

  /**
   * Рендерит таблицу
   */
  private renderTable(
    ctx: CanvasRenderingContext2D,
    config: any,
    block: PdfBlock,
    theme: PdfTheme,
    x: number,
    y: number,
    width: number,
    height: number,
    pixelsPerMm: number
  ): void {
    const { headers = [], rows = [], bordered = true } = config;
    if (headers.length === 0 && rows.length === 0) {
      // Пустая таблица
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(x, y, width, height);
      ctx.fillStyle = '#999';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Пустая таблица', x + width / 2, y + height / 2);
      return;
    }
    
    const numColumns = headers.length > 0 ? headers.length : (rows[0]?.length || 1);
    const rowHeight = 30 * pixelsPerMm;
    const colWidth = width / numColumns;

    // Заголовки
    if (headers.length > 0) {
      ctx.fillStyle = theme.colors.surface || '#f9fafb';
      ctx.fillRect(x, y, width, rowHeight);
      if (bordered) {
        ctx.strokeStyle = theme.colors.border || '#e5e7eb';
        ctx.lineWidth = 1 * pixelsPerMm;
        ctx.strokeRect(x, y, width, rowHeight);
      }

      for (let i = 0; i < headers.length; i++) {
        this.renderText(ctx, headers[i], x + i * colWidth + 8 * pixelsPerMm, y + 8 * pixelsPerMm, colWidth - 16 * pixelsPerMm, { ...block.styles, fontWeight: 'bold' }, theme, 'body');
        if (bordered && i < headers.length - 1) {
          ctx.beginPath();
          ctx.moveTo(x + (i + 1) * colWidth, y);
          ctx.lineTo(x + (i + 1) * colWidth, y + rowHeight);
          ctx.stroke();
        }
      }
    }

    // Строки
    const startY = headers.length > 0 ? y + rowHeight : y;
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const rowY = startY + rowIndex * rowHeight;

      if (config.striped && rowIndex % 2 === 1) {
        ctx.fillStyle = theme.colors.surface || '#f9fafb';
        ctx.fillRect(x, rowY, width, rowHeight);
      }

      for (let colIndex = 0; colIndex < Math.min(row.length, numColumns); colIndex++) {
        const cellText = String(row[colIndex] || '');
        this.renderText(ctx, cellText, x + colIndex * colWidth + 8 * pixelsPerMm, rowY + 8 * pixelsPerMm, colWidth - 16 * pixelsPerMm, block.styles, theme, 'body');
        if (bordered && colIndex < numColumns - 1) {
          ctx.beginPath();
          ctx.moveTo(x + (colIndex + 1) * colWidth, rowY);
          ctx.lineTo(x + (colIndex + 1) * colWidth, rowY + rowHeight);
          ctx.stroke();
        }
      }

      if (bordered) {
        ctx.strokeRect(x, rowY, width, rowHeight);
      }
    }
  }

  /**
   * Рендерит разделитель
   */
  private renderDivider(
    ctx: CanvasRenderingContext2D,
    block: PdfBlock,
    theme: PdfTheme,
    x: number,
    y: number,
    width: number,
    height: number,
    pixelsPerMm: number
  ): void {
    ctx.strokeStyle = block.styles.border?.color || theme.colors.border;
    ctx.lineWidth = (block.styles.border?.width || 1) * pixelsPerMm;
    ctx.beginPath();
    ctx.moveTo(x, y + height / 2);
    ctx.lineTo(x + width, y + height / 2);
    ctx.stroke();
  }

  /**
   * Конвертирует canvas в изображение
   */
  private async canvasToImage(canvas: HTMLCanvasElement): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const mimeType = this.config.imageFormat === 'png' 
          ? 'image/png' 
          : this.config.imageFormat === 'webp' 
          ? 'image/webp' 
          : 'image/jpeg';
        
        const quality = this.config.imageFormat === 'png' ? undefined : this.config.imageQuality;

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to convert canvas to blob'));
              return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve(reader.result as string);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          },
          mimeType,
          quality
        );
      } catch (error) {
        reject(error);
      }
    });
  }
}

