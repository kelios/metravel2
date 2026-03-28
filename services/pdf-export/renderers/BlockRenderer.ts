// src/services/pdf-export/renderers/BlockRenderer.ts
// ✅ АРХИТЕКТУРА: Рендерер блоков контента в HTML

import type { PdfThemeConfig } from '../themes/PdfThemeConfig';
import type { ParsedContentBlock } from '../parsers/ContentParser';
import { ContentParser } from '../parsers/ContentParser';
import { applySmartImageLayout } from '@/utils/richTextImageLayout';

/**
 * Рендерер блоков контента
 */
export class BlockRenderer {
  constructor(private theme: PdfThemeConfig) {}

  private isShortTextBlock(block: ParsedContentBlock): boolean {
    if (block.type === 'heading') {
      return block.text.trim().length <= 120;
    }

    if (block.type === 'paragraph') {
      const text = block.text.trim();
      if (!text) return false;
      const lineCount = text.split(/\n+/).length;
      return text.length <= 140 && lineCount <= 2;
    }

    return false;
  }

  private shouldKeepWithNext(
    block: ParsedContentBlock,
    nextBlock?: ParsedContentBlock
  ): boolean {
    if (!nextBlock) return false;

    if (block.type === 'heading') {
      return ['paragraph', 'image', 'image-gallery', 'list', 'quote'].includes(nextBlock.type);
    }

    if (block.type === 'paragraph' && this.isShortTextBlock(block)) {
      return ['image', 'image-gallery', 'heading'].includes(nextBlock.type);
    }

    return false;
  }

  private renderContainImageWithBackdrop(
    src: string,
    alt: string,
    options: { minHeight?: string; maxHeight?: string; borderRadius?: string } = {}
  ): string {
    const { minHeight, maxHeight, borderRadius } = options;
    const radius = borderRadius || `calc(${this.theme.blocks.borderRadius} * 0.9)`;

    return `
      <div style="
        position: relative;
        width: 100%;
        overflow: hidden;
        border-radius: ${radius};
        background: ${this.theme.colors.surfaceAlt};
        ${minHeight ? `min-height: ${minHeight};` : ''}
        ${maxHeight ? `max-height: ${maxHeight};` : ''}
      ">
        <img
          src="${this.escapeHtml(src)}"
          alt=""
          aria-hidden="true"
          style="
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            filter: blur(18px) saturate(1.06);
            transform: scale(1.08);
            opacity: 0.88;
            ${this.theme.imageFilter ? `filter: blur(18px) saturate(1.06) ${this.theme.imageFilter};` : ''}
          "
          onerror="this.style.display='none';"
        />
        <img
          src="${this.escapeHtml(src)}"
          alt="${this.escapeHtml(alt)}"
          style="
            position: relative;
            z-index: 1;
            width: 100%;
            height: auto;
            min-height: inherit;
            max-height: inherit;
            display: block;
            object-fit: contain;
            ${this.theme.imageFilter ? `filter: ${this.theme.imageFilter};` : ''}
          "
          onerror="this.style.display='none';"
        />
      </div>
    `;
  }

  private getImageAlignmentStyle(layout?: 'single-wide' | 'float-left' | 'float-right'): string {
    switch (layout) {
      case 'float-left':
        return `
          width: 56%;
          max-width: 56%;
          margin: calc(${this.theme.spacing.blockSpacing} * 0.9) auto calc(${this.theme.spacing.blockSpacing} * 1.0) 0;
        `;
      case 'float-right':
        return `
          width: 56%;
          max-width: 56%;
          margin: calc(${this.theme.spacing.blockSpacing} * 0.9) 0 calc(${this.theme.spacing.blockSpacing} * 1.0) auto;
        `;
      case 'single-wide':
      default:
        return `
          width: 100%;
          max-width: 100%;
          margin: calc(${this.theme.spacing.blockSpacing} * 0.95) auto calc(${this.theme.spacing.blockSpacing} * 1.05);
        `;
    }
  }

  private detectPortraitIndex(
    images: Array<{ width?: number; height?: number }>,
    fallbackIndex: number
  ): number {
    const explicit = images.findIndex((img) => (img.height || 0) > (img.width || 0));
    return explicit >= 0 ? explicit : fallbackIndex;
  }

  private renderGalleryCaption(caption?: string): string {
    if (!caption) return '';
    return `<div style="font-size: ${this.theme.typography.caption.size}; color: ${this.theme.colors.textMuted}; text-align: center; margin-top: 4pt;">${this.escapeHtml(caption)}</div>`;
  }

  private renderGalleryImageCard(
    img: { src: string; alt?: string; caption?: string; width?: number; height?: number },
    options: { containerStyle?: string; imageStyle?: string } = {}
  ): string {
    const safeSrc = this.buildSafeImageUrl(img.src);
    const minHeightMatch = options.imageStyle?.match(/min-height:\s*([^;]+);?/i);
    const maxHeightMatch = options.imageStyle?.match(/max-height:\s*([^;]+);?/i);

    return `
      <div style="
        page-break-inside: avoid;
        break-inside: avoid;
        margin-bottom: 0;
        padding: 2.5mm;
        border-radius: calc(${this.theme.blocks.borderRadius} * 1.4);
        background: ${this.theme.colors.surfaceAlt};
        border: 1px solid ${this.theme.colors.borderLight};
        box-shadow: ${this.theme.blocks.shadow};
        ${options.containerStyle || ''}
      ">
        ${this.renderContainImageWithBackdrop(safeSrc, img.alt || '', {
          minHeight: minHeightMatch?.[1]?.trim(),
          maxHeight: maxHeightMatch?.[1]?.trim(),
          borderRadius: `calc(${this.theme.blocks.borderRadius} * 0.9)`,
        })}
        ${this.renderGalleryCaption(img.caption)}
      </div>
    `;
  }

  /**
   * Рендерит массив блоков в HTML
   */
  renderBlocks(blocks: ParsedContentBlock[]): string {
    return blocks
      .map((block, index) =>
        this.renderBlock(block, {
          keepWithNext: this.shouldKeepWithNext(block, blocks[index + 1]),
        })
      )
      .join('\n');
  }

  /**
   * Рендерит сырой rich-text HTML: применяет умную раскладку изображений,
   * парсит в блоки и рендерит. Централизует паттерн applySmartImageLayout → parse → render.
   */
  renderRichText(rawHtml: string): string {
    if (!rawHtml) return '';
    const formatted = applySmartImageLayout(rawHtml);
    const parser = new ContentParser();
    const blocks = parser.parse(formatted);
    return this.renderBlocks(blocks);
  }

  /**
   * Рендерит один блок
   */
  renderBlock(block: ParsedContentBlock, options: { keepWithNext?: boolean } = {}): string {
    switch (block.type) {
      case 'heading':
        return this.renderHeading(block, options);
      case 'paragraph':
        return this.renderParagraph(block, options);
      case 'list':
        return this.renderList(block);
      case 'quote':
        return this.renderQuote(block);
      case 'image':
        return this.renderImage(block);
      case 'image-gallery':
        return this.renderImageGallery(block);
      case 'info-block':
      case 'warning-block':
      case 'tip-block':
      case 'danger-block':
        return this.renderInfoBlock(block);
      case 'code':
        return this.renderCode(block);
      case 'separator':
        return this.renderSeparator();
      case 'table':
        return this.renderTable(block);
      default:
        return '';
    }
  }

  /**
   * Рендерит заголовок
   */
  private renderHeading(
    block: ParsedContentBlock & { type: 'heading' },
    options: { keepWithNext?: boolean } = {}
  ): string {
    const { level, text } = block;
    const style = this.theme.typography[`h${level}` as keyof typeof this.theme.typography] as {
      size: string;
      weight: number;
      lineHeight: number;
      marginBottom: string;
    };

    return `
      <h${level} style="
        font-size: ${style.size};
        font-weight: ${style.weight};
        line-height: ${style.lineHeight};
        margin-bottom: ${style.marginBottom};
        color: ${this.theme.colors.text};
        font-family: ${this.theme.typography.headingFont};
        page-break-after: avoid;
        ${options.keepWithNext ? 'break-after: avoid-page;' : ''}
        orphans: 3;
        widows: 3;
        overflow-wrap: anywhere;
        word-break: break-word;
        hyphens: auto;
      ">${this.escapeHtml(text)}</h${level}>
    `;
  }

  /**
   * Рендерит параграф
   */
  private renderParagraph(
    block: ParsedContentBlock & { type: 'paragraph' },
    options: { keepWithNext?: boolean } = {}
  ): string {
    const { text, html } = block;
    const style = this.theme.typography.body;

    // Если есть HTML, используем его (для форматирования)
    const content = html && html !== text ? html : this.escapeHtml(text);

    return `
      <p style="
        font-size: ${style.size};
        line-height: ${style.lineHeight};
        margin-bottom: ${style.marginBottom};
        color: ${this.theme.colors.text};
        font-family: ${this.theme.typography.bodyFont};
        text-align: justify;
        ${options.keepWithNext ? 'page-break-after: avoid; break-after: avoid-page;' : ''}
        orphans: 2;
        widows: 2;
        overflow-wrap: anywhere;
        word-break: break-word;
        hyphens: auto;
      ">${content}</p>
    `;
  }

  /**
   * Рендерит список
   */
  private renderList(block: ParsedContentBlock & { type: 'list' }): string {
    const { ordered, items } = block;
    const style = this.theme.typography.body;
    const tag = ordered ? 'ol' : 'ul';

    const itemsHtml = items
      .map(
        (item) => `
      <li style="
        font-size: ${style.size};
        line-height: ${style.lineHeight};
        margin-bottom: ${this.theme.spacing.elementSpacing};
        color: ${this.theme.colors.text};
        font-family: ${this.theme.typography.bodyFont};
        overflow-wrap: anywhere;
        word-break: break-word;
        hyphens: auto;
      ">${this.escapeHtml(item)}</li>
    `
      )
      .join('');

    return `
      <${tag} style="
        margin-bottom: ${this.theme.spacing.blockSpacing};
        padding-left: 1.5em;
        page-break-inside: avoid;
      ">${itemsHtml}</${tag}>
    `;
  }

  /**
   * Рендерит цитату
   */
  private renderQuote(block: ParsedContentBlock & { type: 'quote' }): string {
    const { text, author } = block;
    const style = this.theme.typography.body;

    return `
      <blockquote style="
        margin: ${this.theme.spacing.blockSpacing} 0;
        padding: ${this.theme.spacing.elementSpacing} ${this.theme.spacing.blockSpacing};
        border-left: 4px solid ${this.theme.colors.accent};
        background: ${this.theme.colors.surfaceAlt};
        border-radius: ${this.theme.blocks.borderRadius};
        font-size: ${style.size};
        line-height: ${style.lineHeight};
        color: ${this.theme.colors.textSecondary};
        font-family: ${this.theme.typography.bodyFont};
        font-style: italic;
        page-break-inside: avoid;
      ">
        <p style="margin: 0 0 ${author ? this.theme.spacing.elementSpacing : 0} 0;">
          ${this.escapeHtml(text)}
        </p>
        ${author ? `<cite style="font-size: ${this.theme.typography.small.size}; color: ${this.theme.colors.textMuted}; font-style: normal;">— ${this.escapeHtml(author)}</cite>` : ''}
      </blockquote>
    `;
  }

  /**
   * Рендерит изображение
   */
  private renderImage(block: ParsedContentBlock & { type: 'image' }): string {
    const { src, alt, caption, width, height, layout } = block;
    const safeSrc = this.buildSafeImageUrl(src);
    const wrapperStyle = this.getImageAlignmentStyle(layout);

    const imageTag = `
      <div
        ${width ? `data-width="${width}"` : ''}
        ${height ? `data-height="${height}"` : ''}
        style="
          border-radius: calc(${this.theme.blocks.borderRadius} * 1.65);
          box-shadow: ${this.theme.blocks.shadow};
          page-break-inside: avoid;
          overflow: hidden;
        "
      >
        ${this.renderContainImageWithBackdrop(safeSrc, alt || '', {
          borderRadius: `calc(${this.theme.blocks.borderRadius} * 1.65)`,
        })}
      </div>
    `;

    if (caption) {
      return `
        <figure style="
          ${wrapperStyle}
          page-break-inside: avoid;
          break-inside: avoid;
          padding: 4mm;
          background: ${this.theme.colors.surfaceAlt};
          border: 1px solid ${this.theme.colors.borderLight};
          border-radius: calc(${this.theme.blocks.borderRadius} * 1.8);
        ">
          ${imageTag}
          <figcaption style="
            font-size: ${this.theme.typography.caption.size};
            line-height: ${this.theme.typography.caption.lineHeight};
            color: ${this.theme.colors.textMuted};
            text-align: center;
            margin-top: ${this.theme.spacing.elementSpacing};
            font-family: ${this.theme.typography.bodyFont};
          ">${this.escapeHtml(caption)}</figcaption>
        </figure>
      `;
    }

    return `
      <div style="
        ${wrapperStyle}
        page-break-inside: avoid;
        break-inside: avoid;
        padding: 4mm;
        background: ${this.theme.colors.surfaceAlt};
        border: 1px solid ${this.theme.colors.borderLight};
        border-radius: calc(${this.theme.blocks.borderRadius} * 1.8);
      ">
        ${imageTag}
      </div>
    `;
  }

  /**
   * Рендерит галерею изображений
   */
  private renderImageGallery(block: ParsedContentBlock & { type: 'image-gallery' }): string {
    const { images, columns = 2, layout = 'grid-default' } = block;

    if (layout === 'grid-mixed' || layout === 'grid-mixed-reverse' || layout === 'quilt-3') {
      const portraitIndex = this.detectPortraitIndex(images, layout === 'grid-mixed-reverse' ? 0 : images.length - 1);
      const portrait = images[portraitIndex];
      const supporting = images.filter((_, index) => index !== portraitIndex);

      if (portrait && supporting.length >= 2) {
        const stackHtml = supporting
          .map((img) =>
            this.renderGalleryImageCard(img, {
              imageStyle: 'min-height: 36mm; max-height: 44mm;',
            })
          )
          .join('');
        const portraitHtml = this.renderGalleryImageCard(portrait, {
          imageStyle: 'min-height: 80mm; max-height: 96mm;',
        });

        return `
          <div style="
            display: grid;
            grid-template-columns: ${layout === 'grid-mixed-reverse' ? '1.08fr 0.92fr' : '0.92fr 1.08fr'};
            gap: ${this.theme.spacing.elementSpacing};
            margin: calc(${this.theme.spacing.blockSpacing} * 0.9) 0 calc(${this.theme.spacing.blockSpacing} * 1.05);
            page-break-inside: avoid;
            break-inside: avoid;
            align-items: stretch;
          ">
            ${layout === 'grid-mixed-reverse' ? portraitHtml : `<div style="display:flex; flex-direction:column; gap:${this.theme.spacing.elementSpacing};">${stackHtml}</div>`}
            ${layout === 'grid-mixed-reverse' ? `<div style="display:flex; flex-direction:column; gap:${this.theme.spacing.elementSpacing};">${stackHtml}</div>` : portraitHtml}
          </div>
        `;
      }
    }

    if (layout === 'stack-landscape') {
      const cards = images
        .map((img, index) =>
          this.renderGalleryImageCard(img, {
            containerStyle: index === 0 ? 'transform: translateY(3mm);' : 'transform: translateY(-3mm);',
            imageStyle: 'min-height: 54mm; max-height: 64mm;',
          })
        )
        .join('');

      return `
        <div style="
          display: grid;
          grid-template-columns: 1.14fr 0.86fr;
          gap: ${this.theme.spacing.elementSpacing};
          margin: calc(${this.theme.spacing.blockSpacing} * 0.9) 0 calc(${this.theme.spacing.blockSpacing} * 1.05);
          page-break-inside: avoid;
          break-inside: avoid;
          align-items: start;
        ">${cards}</div>
      `;
    }

    const imagesHtml = images
      .map((img, index) => {
        let containerStyle = '';
        let imageStyle = '';

        if (layout === 'pair-portraits') {
          imageStyle = 'min-height: 68mm; max-height: 82mm;';
          containerStyle = index === 0 ? 'transform: translateY(4mm);' : 'transform: translateY(-4mm);';
        } else if (layout === 'pair-mixed') {
          imageStyle = index === 0
            ? 'min-height: 58mm; max-height: 68mm;'
            : 'min-height: 64mm; max-height: 76mm;';
          containerStyle = index === 0 ? 'transform: translateY(2mm);' : 'transform: translateY(-2mm);';
        } else if (layout === 'pair-balanced') {
          imageStyle = 'min-height: 56mm; max-height: 66mm;';
          containerStyle = index === 0 ? 'transform: translateY(2mm);' : 'transform: translateY(-2mm);';
        } else if (layout === 'row-2-landscape' || layout === 'row-2-balanced') {
          imageStyle = 'min-height: 52mm; max-height: 62mm;';
        } else if (layout === 'row-2-portrait') {
          imageStyle = 'min-height: 64mm; max-height: 76mm;';
        } else if (layout === 'row-2-mixed') {
          imageStyle = 'min-height: 58mm; max-height: 70mm;';
        } else if (layout === 'column-portraits') {
          imageStyle = 'min-height: 62mm; max-height: 78mm;';
          containerStyle = index % 2 === 0 ? 'transform: translateY(2mm);' : 'transform: translateY(-2mm);';
        } else if (layout === 'pair-grid') {
          imageStyle = 'min-height: 50mm; max-height: 64mm;';
          containerStyle = index === 0 || index === 3 ? 'transform: translateY(2mm);' : 'transform: translateY(-2mm);';
        } else if (layout === 'editorial-grid') {
          containerStyle = index === 0 ? 'grid-column: span 2;' : index === 1 || index === 4 ? 'transform: translateY(2mm);' : 'transform: translateY(-2mm);';
          imageStyle = index === 0
            ? 'min-height: 50mm; max-height: 64mm;'
            : 'min-height: 42mm; max-height: 52mm;';
        } else if (layout === 'grid-portrait') {
          imageStyle = 'min-height: 58mm; max-height: 76mm;';
        } else if (layout === 'grid-balanced') {
          imageStyle = 'min-height: 50mm; max-height: 64mm;';
        } else if (layout === 'grid-quilt' || layout === 'quilt-4') {
          const span = index === 0 || index === 3 ? 4 : 2;
          containerStyle = `grid-column: span ${span};`;
          imageStyle = span === 4
            ? 'min-height: 46mm; max-height: 58mm;'
            : 'min-height: 36mm; max-height: 46mm;';
        } else {
          imageStyle = 'min-height: 44mm; max-height: 62mm;';
        }

        return this.renderGalleryImageCard(img, {
          containerStyle,
          imageStyle,
        });
      })
      .join('');

    return `
      <div style="
        display: grid;
        grid-template-columns: ${
          layout === 'pair-portraits' ? '0.96fr 1.04fr'
          : layout === 'pair-mixed' ? '0.92fr 1.08fr'
          : layout === 'pair-balanced' ? '1.02fr 0.98fr'
          : layout === 'pair-grid' ? '1.04fr 0.96fr'
          : layout === 'column-portraits' ? '0.94fr 1.06fr'
          : layout === 'editorial-grid' ? 'repeat(3, 1fr)'
          : `repeat(${columns}, 1fr)`
        };
        gap: ${this.theme.spacing.elementSpacing};
        margin: calc(${this.theme.spacing.blockSpacing} * 0.9) 0 calc(${this.theme.spacing.blockSpacing} * 1.05);
        page-break-inside: avoid;
        break-inside: avoid;
        align-items: start;
      ">${imagesHtml}</div>
    `;
  }

  /**
   * Рендерит информационный блок (Совет, Важно, и т.д.)
   */
  private renderInfoBlock(block: ParsedContentBlock & { type: 'info-block' | 'warning-block' | 'tip-block' | 'danger-block' }): string {
    const { type, title, content } = block;
    
    const config = this.theme.colors[`${type.replace('-block', '')}Block` as keyof typeof this.theme.colors] as {
      background: string;
      border: string;
      text: string;
      icon: string;
    };

    const iconName =
      type === 'warning-block'
        ? 'warning'
        : type === 'tip-block'
          ? 'bulb'
          : type === 'danger-block'
            ? 'danger'
            : 'info';
    const style = this.theme.typography.body;

    return `
      <div style="
        margin: ${this.theme.spacing.blockSpacing} 0;
        padding: ${this.theme.spacing.elementSpacing} ${this.theme.spacing.blockSpacing};
        background: ${config.background};
        border-left: 4px solid ${config.border};
        border-radius: ${this.theme.blocks.borderRadius};
        page-break-inside: avoid;
        box-shadow: ${this.theme.blocks.shadow};
      ">
        <div style="
          display: flex;
          align-items: flex-start;
          gap: ${this.theme.spacing.elementSpacing};
        ">
          <div style="
            flex-shrink: 0;
          ">${this.renderPdfIcon(iconName, config.text, 20)}</div>
          <div style="flex: 1;">
            ${title ? `<div style="font-weight: 700; font-size: ${this.theme.typography.h4.size}; color: ${config.text}; margin-bottom: ${this.theme.spacing.elementSpacing}; font-family: ${this.theme.typography.headingFont};">
              ${this.escapeHtml(title)}
            </div>` : ''}
            <div style="
              font-size: ${style.size};
              line-height: ${style.lineHeight};
              color: ${config.text};
              font-family: ${this.theme.typography.bodyFont};
            ">${this.escapeHtml(content)}</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderPdfIcon(
    name: 'info' | 'warning' | 'bulb' | 'danger',
    color: string,
    sizePt: number
  ): string {
    const size = `${sizePt}pt`;
    const wrapperStyle = `
      width: ${size};
      height: ${size};
      display: inline-block;
    `;

    const svgStart = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${sizePt}" height="${sizePt}" fill="none" stroke="${this.escapeHtml(color)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`;
    const svgEnd = `</svg>`;

    const paths: Record<typeof name, string> = {
      info: `<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>`,
      warning: `<path d="M10.3 3.2 1.7 18a2 2 0 0 0 1.7 3h17.2a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>`,
      bulb: `<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12c.7.6 1 1.3 1 2v1h6v-1c0-.7.3-1.4 1-2a7 7 0 0 0-4-12z"/>`,
      danger: `<path d="M12 2l10 20H2z"/><path d="M12 9v4"/><path d="M12 17h.01"/>`,
    };

    return `
      <span style="${wrapperStyle}">${svgStart}${paths[name]}${svgEnd}</span>
    `;
  }

  /**
   * Рендерит код
   */
  private renderCode(block: ParsedContentBlock & { type: 'code' }): string {
    const { code } = block;

    return `
      <pre style="
        margin: ${this.theme.spacing.blockSpacing} 0;
        padding: ${this.theme.spacing.elementSpacing};
        background: ${this.theme.colors.surfaceAlt};
        border: 1px solid ${this.theme.colors.border};
        border-radius: ${this.theme.blocks.borderRadius};
        overflow-x: auto;
        font-family: ${this.theme.typography.monoFont};
        font-size: ${this.theme.typography.small.size};
        line-height: ${this.theme.typography.small.lineHeight};
        color: ${this.theme.colors.text};
        page-break-inside: avoid;
      "><code>${this.escapeHtml(code)}</code></pre>
    `;
  }

  /**
   * Рендерит разделитель
   */
  private renderSeparator(): string {
    return `
      <hr style="
        margin: ${this.theme.spacing.sectionSpacing} 0;
        border: none;
        border-top: 1px solid ${this.theme.colors.border};
        page-break-after: avoid;
      " />
    `;
  }

  /**
   * Рендерит таблицу
   */
  private renderTable(block: ParsedContentBlock & { type: 'table' }): string {
    const { headers, rows } = block;
    const style = this.theme.typography.body;

    const headersHtml = headers
      ? `
      <thead>
        <tr>
          ${headers.map((header) => `
            <th style="
              padding: ${this.theme.spacing.elementSpacing};
              background: ${this.theme.colors.surfaceAlt};
              border: 1px solid ${this.theme.colors.border};
              font-weight: 700;
              font-size: ${style.size};
              color: ${this.theme.colors.text};
              text-align: left;
              overflow-wrap: anywhere;
              word-break: break-word;
              hyphens: auto;
            ">${this.escapeHtml(header)}</th>
          `).join('')}
        </tr>
      </thead>
    `
      : '';

    const rowsHtml = rows
      .map(
        (row) => `
      <tr>
        ${row.map((cell) => `
          <td style="
            padding: ${this.theme.spacing.elementSpacing};
            border: 1px solid ${this.theme.colors.border};
            font-size: ${style.size};
            color: ${this.theme.colors.text};
            overflow-wrap: anywhere;
            word-break: break-word;
            hyphens: auto;
          ">${this.escapeHtml(cell)}</td>
        `).join('')}
      </tr>
    `
      )
      .join('');

    return `
      <div style="
        margin: ${this.theme.spacing.blockSpacing} 0;
        overflow-x: auto;
        page-break-inside: avoid;
      ">
        <table style="
          width: 100%;
          border-collapse: collapse;
          border: 1px solid ${this.theme.colors.border};
          border-radius: ${this.theme.blocks.borderRadius};
          overflow: hidden;
          page-break-inside: avoid;
        ">
          ${headersHtml}
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  /**
   * Экранирует HTML
   */
  private escapeHtml(text: string): string {
    if (typeof document === 'undefined') {
      // Fallback для серверного рендеринга
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Строит безопасный URL изображения
   */
  private buildSafeImageUrl(url: string): string {
    if (!url) return '';

    const trimmed = String(url).trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('data:')) return trimmed;
    if (trimmed.startsWith('blob:')) return trimmed;

    // Если URL уже проксирован (например, TravelDataTransformer уже переписал <img src>),
    // не проксируем второй раз — это ломает загрузку изображений в печати/PDF.
    if (/^https?:\/\/images\.weserv\.nl\//i.test(trimmed)) {
      return trimmed;
    }

    // Protocol-relative URLs
    if (trimmed.startsWith('//')) {
      return this.buildSafeImageUrl(`https:${trimmed}`);
    }

    // Root-relative URLs (common in CMS: /storage/..., /uploads/...)
    if (trimmed.startsWith('/')) {
      if (typeof window !== 'undefined' && window.location?.origin) {
        return this.buildSafeImageUrl(`${window.location.origin}${trimmed}`);
      }
      return this.buildSafeImageUrl(`https://metravel.by${trimmed}`);
    }

    // Absolute URLs
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      // Используем прокси для внешних изображений
      try {
        const encoded = encodeURIComponent(trimmed);
        return `https://images.weserv.nl/?url=${encoded}&w=1600&fit=inside`;
      } catch {
        return trimmed;
      }
    }

    // Other relative paths: try to make absolute using prod domain
    return this.buildSafeImageUrl(`https://metravel.by/${trimmed.replace(/^\/+/, '')}`);
  }
}
